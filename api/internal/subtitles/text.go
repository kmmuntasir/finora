package subtitles

import (
	"archive/zip"
	"bytes"
	"compress/gzip"
	"errors"
	"io"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/encoding/charmap"
	xunicode "golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"
)

// ErrNotSubtitle means a payload did not contain a usable subtitle.
var ErrNotSubtitle = errors.New("not a usable subtitle file")

const maxPayload = 20 << 20 // 20 MB

var foreignName = regexp.MustCompile(`(?i)\b(ar|ara|arabic|fa|per|farsi|heb|hebrew|ru|rus|russian|zh|chi|zho|chinese|ko|kor|korean|ja|jp|jpn|japanese|brazilian|por|portuguese|fre|fra|french|spa|spanish|ger|deu|german|ita|italian|dut|nl|dutch|pol|polish|tur|turkish|vie|vietnamese|tha|thai|ind|bahasa|indonesian|urdu|hindi|tamil|telugu|malayalam|vostfr)\b`)

// ExtractSubtitle returns the best SRT text from a zip, gzip or plain payload,
// preferring the episode's file inside season packs.
func ExtractSubtitle(payload []byte, query Query, lang Language) (string, error) {
	if len(payload) > maxPayload {
		return "", ErrNotSubtitle
	}
	if bytes.HasPrefix(payload, []byte("PK\x03\x04")) {
		return extractFromZip(payload, query, lang)
	}
	if bytes.HasPrefix(payload, []byte{0x1f, 0x8b}) {
		reader, err := gzip.NewReader(bytes.NewReader(payload))
		if err != nil {
			return "", ErrNotSubtitle
		}
		inflated, err := io.ReadAll(io.LimitReader(reader, maxPayload))
		if err != nil {
			return "", ErrNotSubtitle
		}
		return ExtractSubtitle(inflated, query, lang)
	}
	return checkedText(payload, lang)
}

type zipEntry struct {
	name string
	data []byte
}

func extractFromZip(payload []byte, query Query, lang Language) (string, error) {
	archive, err := zip.NewReader(bytes.NewReader(payload), int64(len(payload)))
	if err != nil {
		return "", ErrNotSubtitle
	}
	var entries []zipEntry
	for _, file := range archive.File {
		name := strings.ToLower(file.Name)
		if file.FileInfo().IsDir() || path.Ext(name) != ".srt" || file.UncompressedSize64 < 60 || file.UncompressedSize64 > maxPayload {
			continue
		}
		reader, err := file.Open()
		if err != nil {
			continue
		}
		data, err := io.ReadAll(io.LimitReader(reader, maxPayload))
		_ = reader.Close()
		if err == nil {
			entries = append(entries, zipEntry{name: path.Base(name), data: data})
		}
	}
	if len(entries) == 0 {
		return "", ErrNotSubtitle
	}
	// Drop files named for another language unless that leaves nothing.
	pool := entries
	if lang.Code == "en" {
		var english []zipEntry
		for _, entry := range entries {
			if !foreignName.MatchString(entry.name) {
				english = append(english, entry)
			}
		}
		if len(english) > 0 {
			pool = english
		}
	}
	sort.SliceStable(pool, func(i, j int) bool {
		a, b := entryScore(pool[i].name, query), entryScore(pool[j].name, query)
		if a != b {
			return a > b
		}
		return len(pool[i].data) > len(pool[j].data)
	})
	for _, entry := range pool {
		if text, err := checkedText(entry.data, lang); err == nil {
			return text, nil
		}
	}
	return "", ErrNotSubtitle
}

// entryScore prefers the requested episode inside season packs and avoids forced-only files.
func entryScore(name string, query Query) int {
	score := 0
	if strings.Contains(name, "forced") {
		score -= 6
	}
	if query.Kind != KindEpisode {
		return score
	}
	se := "s" + pad2(query.Season) + "e" + pad2(query.Episode)
	switch {
	case strings.Contains(name, se):
		score += 100
	case regexp.MustCompile(`\b` + strconv.Itoa(query.Season) + `x` + pad2(query.Episode) + `\b`).MatchString(name):
		score += 90
	default:
		stem := strings.TrimSuffix(name, ".srt")
		bare := regexp.MustCompile(`(?:^|[\s._-])0?` + strconv.Itoa(query.Episode) + `(?:[\s._-]|$)`)
		if bare.MatchString(stem) && !strings.Contains(name, "complete") && !strings.Contains(name, "pack") {
			score += 40
		} else {
			score -= 25
		}
	}
	return score
}

func pad2(n int) string {
	if n < 10 {
		return "0" + strconv.Itoa(n)
	}
	return strconv.Itoa(n)
}

// DecodeText converts subtitle bytes to UTF-8, handling BOMs and legacy Windows-1252 files.
func DecodeText(data []byte) string {
	switch {
	case bytes.HasPrefix(data, []byte{0xEF, 0xBB, 0xBF}):
		data = data[3:]
	case bytes.HasPrefix(data, []byte{0xFF, 0xFE}), bytes.HasPrefix(data, []byte{0xFE, 0xFF}):
		decoded, _, err := transform.Bytes(xunicode.UTF16(xunicode.LittleEndian, xunicode.UseBOM).NewDecoder(), data)
		if err == nil {
			return normalizeNewlines(string(decoded))
		}
	}
	if utf8.Valid(data) {
		return normalizeNewlines(string(data))
	}
	decoded, _, err := transform.Bytes(charmap.Windows1252.NewDecoder(), data)
	if err != nil {
		return normalizeNewlines(string(bytes.ToValidUTF8(data, []byte("?"))))
	}
	return normalizeNewlines(string(decoded))
}

func normalizeNewlines(text string) string {
	return strings.ReplaceAll(strings.ReplaceAll(text, "\r\n", "\n"), "\r", "\n")
}

// checkedText decodes and validates a subtitle: real cue timings, not a
// saved web page, and (for Latin-script languages) not another script.
func checkedText(data []byte, lang Language) (string, error) {
	if len(data) < 80 {
		return "", ErrNotSubtitle
	}
	text := DecodeText(data)
	head := strings.ToLower(text[:min(len(text), 2000)])
	if strings.Contains(head, "<html") || strings.Contains(head, "<!doctype") {
		return "", ErrNotSubtitle
	}
	cues := strings.Count(text, "-->")
	minCues := 5
	if len(data) < 15000 {
		minCues = 25 // small files are often fakes
	}
	if cues < minCues {
		return "", ErrNotSubtitle
	}
	if lang.Latin {
		letters, latin := 0, 0
		for _, r := range text {
			if unicode.IsLetter(r) {
				letters++
				if unicode.Is(unicode.Latin, r) {
					latin++
				}
			}
		}
		if letters > 0 && float64(letters-latin)/float64(letters) > 0.06 {
			return "", ErrNotSubtitle
		}
	}
	return strings.TrimSpace(text) + "\n", nil
}

var timing = regexp.MustCompile(`(\d{1,2}:\d{2}:\d{2}),(\d{3})`)

// SRTToVTT converts SRT text to WebVTT for browser <track> elements.
func SRTToVTT(srt string) string {
	var out strings.Builder
	out.WriteString("WEBVTT\n\n")
	for _, line := range strings.Split(normalizeNewlines(srt), "\n") {
		if strings.Contains(line, "-->") {
			line = timing.ReplaceAllString(line, "$1.$2")
		}
		out.WriteString(line)
		out.WriteByte('\n')
	}
	return out.String()
}
