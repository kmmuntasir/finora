package subtitles

import (
	"archive/zip"
	"bytes"
	"encoding/binary"
	"fmt"
	"strings"
	"testing"
)

func srt(cues int, line string) string {
	var b strings.Builder
	for i := 1; i <= cues; i++ {
		fmt.Fprintf(&b, "%d\n00:00:%02d,000 --> 00:00:%02d,500\n%s %d\n\n", i, i%60, i%60, line, i)
	}
	return b.String()
}

func zipOf(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	for name, body := range files {
		f, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = f.Write([]byte(body))
	}
	_ = w.Close()
	return buf.Bytes()
}

var english, _ = LookupLanguage("eng")

func TestHash(t *testing.T) {
	head := make([]byte, HashChunk)
	tail := make([]byte, HashChunk)
	binary.LittleEndian.PutUint64(head, 1)
	binary.LittleEndian.PutUint64(tail, 2)
	if got := OpenSubtitlesHash(100, head, tail); got != fmt.Sprintf("%016x", 103) {
		t.Fatalf("hash = %s", got)
	}
}

func TestExtractPicksEpisodeFromSeasonPack(t *testing.T) {
	q := Query{Kind: KindEpisode, Season: 2, Episode: 5}
	payload := zipOf(t, map[string]string{
		"Show.S02E04.srt":        srt(40, "wrong episode"),
		"Show.S02E05.srt":        srt(40, "right episode"),
		"Show.S02E05.French.srt": srt(40, "French"),
	})
	text, err := ExtractSubtitle(payload, q, english)
	if err != nil || !strings.Contains(text, "right episode") {
		t.Fatalf("got %q, %v", text[:min(40, len(text))], err)
	}
}

func TestRejectsFakesAndOtherScripts(t *testing.T) {
	if _, err := ExtractSubtitle([]byte("<!DOCTYPE html><html>"+strings.Repeat("x", 200)), Query{}, english); err == nil {
		t.Fatal("saved web page accepted")
	}
	if _, err := ExtractSubtitle([]byte(srt(3, "too short")), Query{}, english); err == nil {
		t.Fatal("tiny file accepted")
	}
	if _, err := ExtractSubtitle([]byte(srt(40, "Привет мир это русский текст")), Query{}, english); err == nil {
		t.Fatal("Cyrillic accepted as English")
	}
	bengali, _ := LookupLanguage("bn")
	if _, err := ExtractSubtitle([]byte(srt(40, "আমি বাংলায় কথা বলি")), Query{}, bengali); err != nil {
		t.Fatalf("Bengali rejected: %v", err)
	}
}

func TestDecodeText(t *testing.T) {
	if got := DecodeText([]byte("\xEF\xBB\xBFhello\r\n")); got != "hello\n" {
		t.Fatalf("utf8 bom: %q", got)
	}
	if got := DecodeText([]byte("caf\xe9")); got != "café" {
		t.Fatalf("windows-1252: %q", got)
	}
	utf16 := []byte{0xFF, 0xFE, 'h', 0, 'i', 0}
	if got := DecodeText(utf16); got != "hi" {
		t.Fatalf("utf-16: %q", got)
	}
}

func TestSRTToVTT(t *testing.T) {
	got := SRTToVTT("1\n00:00:01,250 --> 00:00:02,500\nHello\n")
	want := "WEBVTT\n\n1\n00:00:01.250 --> 00:00:02.500\nHello\n\n"
	if got != want {
		t.Fatalf("got %q", got)
	}
}

func TestRankPrefersHashAndReleaseMatches(t *testing.T) {
	q := Query{FileName: "Inception.2010.1080p.BluRay.x264-SPARKS.mkv", Year: 2010}
	plain := Candidate{Release: "Inception.2010.720p.WEB"}
	matching := Candidate{Release: "Inception.2010.1080p.BluRay.x264-SPARKS"}
	hashed := Candidate{Release: "something", HashMatch: true}
	ai := Candidate{Release: "Inception.2010.1080p.BluRay.x264-SPARKS", AITranslated: true}
	for _, c := range []*Candidate{&plain, &matching, &hashed, &ai} {
		Rank(c, q)
	}
	if !(hashed.Score > matching.Score && matching.Score > plain.Score && matching.Score > ai.Score) {
		t.Fatalf("scores: hash %v match %v plain %v ai %v", hashed.Score, matching.Score, plain.Score, ai.Score)
	}
	if !matching.ReleaseMatch || plain.ReleaseMatch {
		t.Fatal("release match flag")
	}
}

func TestParseSubDLReleases(t *testing.T) {
	html := `<div data-language="english" data-language-name="English"><ul>
<li><h4>Show.S01E03.1080p.WEB</h4> data-episode-from="3" data-episode-to="3" <a href="https://dl.subdl.com/subtitle/111-222.zip">dl</a></li>
<li data-full-season><h4>Show.S01.Complete</h4><a href="https://dl.subdl.com/subtitle/333-444.zip">dl</a></li>
</ul></div><div data-language="arabic" data-language-name="Arabic"><li><h4>Arabic one</h4><a href="https://dl.subdl.com/subtitle/555-666.zip">x</a></li></div>`
	releases := parseSubDLReleases(html, english)
	if len(releases) != 2 {
		t.Fatalf("releases = %+v", releases)
	}
	q := Query{Kind: KindEpisode, Season: 1, Episode: 3}
	if score, ok := subdlScore(releases[0], q); !ok || score != 60 {
		t.Fatalf("exact episode: %d %v", score, ok)
	}
	if score, ok := subdlScore(releases[1], q); !ok || score != 40 {
		t.Fatalf("full season: %d %v", score, ok)
	}
	if _, ok := subdlScore(releases[0], Query{Kind: KindEpisode, Season: 1, Episode: 9}); ok {
		t.Fatal("other episode accepted")
	}
}

func TestParseAddic7edPage(t *testing.T) {
	html := `<td>Version KILLERS, 720p</td>
<td class="language">English<a href="#"></a></td><td><b>Completed</b></td><a href="/original/1/1">Download</a>
<td>Version DIMENSION, Hearing Impaired</td>
<td class="language">English</td><td><b>45%</b> </td><a href="/original/1/2">Download</a>
<td class="language">French</td><td><b>Completed</b></td><a href="/original/1/3">Download</a>`
	got := parseAddic7edPage(html, "/serie/Show/1/1/x", english)
	if len(got) != 1 || got[0].Release != "KILLERS" || got[0].Ref != "/original/1/1|/serie/Show/1/1/x" {
		t.Fatalf("candidates = %+v", got)
	}
}

func TestSubDLSeasonLinkAndBengaliSection(t *testing.T) {
	html := `<a href="/subtitle/sd1/show/first-season">S1</a><a href="/subtitle/sd1/show/second-season">S2</a>`
	if got := subdlSeasonLink(html, "/subtitle/sd1/show", 2); got != "/subtitle/sd1/show/second-season" {
		t.Fatalf("season link = %q", got)
	}
	if got := subdlSeasonLink(html, "/subtitle/sd1/show", 5); got != "" {
		t.Fatalf("missing season should be empty, got %q", got)
	}
	bengali, _ := LookupLanguage("ben")
	page := `<div data-language="bengali" data-language-name="Bangla"><li><h4>Movie.Bangla</h4><a href="https://dl.subdl.com/subtitle/1-2.zip">x</a></li></div>`
	if releases := parseSubDLReleases(page, bengali); len(releases) != 1 {
		t.Fatalf("bengali releases = %+v", releases)
	}
}

func TestReleaseMatchIgnoresTitleWords(t *testing.T) {
	q := Query{Kind: KindEpisode, Show: "Silicon Valley", Title: "Minimum Viable Product", FileName: "Silicon.Valley.S01E01.720p.HDTV.x264-KILLERS.mkv"}
	sameShowOnly := Candidate{Release: "Silicon.Valley.S01E01.Minimum.Viable.Product.1080p.AMZN.WEB-DL"}
	sameRelease := Candidate{Release: "Silicon.Valley.S01E01.HDTV.x264-KILLERS"}
	Rank(&sameShowOnly, q)
	Rank(&sameRelease, q)
	if sameShowOnly.ReleaseMatch || !sameRelease.ReleaseMatch {
		t.Fatalf("show-only %v, same release %v", sameShowOnly.ReleaseMatch, sameRelease.ReleaseMatch)
	}
}

func TestTrustworthy(t *testing.T) {
	movie := Query{Kind: KindMovie, Title: "The Matrix", Year: 1999}
	cases := []struct {
		name string
		c    Candidate
		want bool
	}{
		{"hash match", Candidate{HashMatch: true}, true},
		{"looked up by IMDb", Candidate{ExactMatch: true}, true},
		{"same title", Candidate{Title: "the-matrix"}, true},
		{"same title with year", Candidate{Title: "The Matrix", Year: 1999}, true},
		{"another film", Candidate{Title: "Le Couperet", Year: 2005}, false},
		{"same title, other year", Candidate{Title: "The Matrix", Year: 2021}, false},
		{"no title", Candidate{Release: "The.Matrix.1999.1080p"}, false},
	}
	for _, c := range cases {
		if got := Trustworthy(c.c, movie); got != c.want {
			t.Errorf("%s: got %v", c.name, got)
		}
	}
	episode := Query{Kind: KindEpisode, Show: "The Office (US)", Season: 2, Episode: 3}
	if !Trustworthy(Candidate{Title: "The Office (US)"}, episode) {
		t.Error("show title should match")
	}
}

func TestProviderTitles(t *testing.T) {
	if got := subdlTitle("/subtitle/sd12345/the-matrix/first-season"); got != "the matrix" {
		t.Errorf("subdl = %q", got)
	}
	if got := addic7edShow("/serie/The_Office_(US)/2/3/Office_Olympics"); got != "The Office (US)" {
		t.Errorf("addic7ed = %q", got)
	}
}
