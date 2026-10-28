package subtitles

import (
	"context"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

// Kind is what is being searched for.
type Kind string

// Kinds of media.
const (
	KindMovie   Kind = "movie"
	KindEpisode Kind = "episode"
)

// Query describes the video, built from Jellyfin's metadata.
type Query struct {
	Kind     Kind
	Title    string // movie title, or episode title
	Year     int
	Show     string // series name for episodes
	Season   int
	Episode  int
	IMDbID   string // movie IMDb ID, or the series IMDb ID for episodes
	FileName string // video file name, for release matching
	Hash     string // OpenSubtitles moviehash, when known
	Language Language
}

// Candidate is one downloadable subtitle.
type Candidate struct {
	Provider        string  `json:"provider"`
	Ref             string  `json:"-"` // provider-specific download reference
	Release         string  `json:"release"`
	HearingImpaired bool    `json:"hearingImpaired"`
	AITranslated    bool    `json:"aiTranslated"`
	Forced          bool    `json:"forced"`
	HashMatch       bool    `json:"hashMatch"`
	ReleaseMatch    bool    `json:"releaseMatch"`
	Downloads       int     `json:"downloads"`
	Score           float64 `json:"score"`
	// Title and Year are the work the provider matched, when it says.
	Title string `json:"-"`
	Year  int    `json:"-"`
	// ExactMatch means the provider looked the item up by ID (IMDb), not by name.
	ExactMatch bool `json:"-"`
}

// Provider is one subtitle source.
type Provider interface {
	ID() string
	Name() string
	// Supports reports whether the provider can search this query at all.
	Supports(q Query) bool
	Search(ctx context.Context, q Query) ([]Candidate, error)
	// Download returns the raw payload (zip, gzip or text).
	Download(ctx context.Context, c Candidate) ([]byte, error)
}

// QuotaError means a provider refused for now: its daily allowance is used up
// (Daily, resets at midnight UTC) or it is throttling requests.
type QuotaError struct {
	Message string
	Daily   bool
}

func (e *QuotaError) Error() string { return e.Message }

var wordSplit = regexp.MustCompile(`[^a-z0-9]+`)

// releaseWords extracts meaningful tokens from a file or release name.
func releaseWords(name string) map[string]bool {
	words := map[string]bool{}
	for _, word := range wordSplit.Split(strings.ToLower(name), -1) {
		if len(word) > 2 && word != "mkv" && word != "mp4" && word != "x264" && word != "x265" && word != "hevc" && word != "srt" {
			words[word] = true
		}
	}
	return words
}

// ReleaseOverlap counts words shared by the video's file name and a release
// name, ignoring words from the title itself so only release details
// (quality, source, group) count.
func ReleaseOverlap(fileName, release string, titles ...string) int {
	ignore := map[string]bool{}
	for _, title := range titles {
		for word := range releaseWords(title) {
			ignore[word] = true
		}
	}
	ours := releaseWords(fileName)
	count := 0
	for word := range releaseWords(release) {
		if ours[word] && !ignore[word] && !isEpisodeToken(word) {
			count++
		}
	}
	return count
}

var episodeToken = regexp.MustCompile(`^s\d{1,2}e\d{1,3}$|^\d{4}$`)

func isEpisodeToken(word string) bool { return episodeToken.MatchString(word) }

// Rank scores a candidate for display: exact hash first, then release
// similarity; machine-translated, forced and hearing-impaired uploads sink.
func Rank(c *Candidate, q Query) {
	score := c.Score
	if c.HashMatch {
		score += 1000
	}
	overlap := ReleaseOverlap(q.FileName, c.Release, q.Show, q.Title)
	score += float64(overlap * 8)
	if overlap >= 2 {
		c.ReleaseMatch = true
		score += 20
	}
	lowerFile, lowerRelease := strings.ToLower(q.FileName), strings.ToLower(c.Release)
	for _, resolution := range []string{"2160p", "1080p", "720p", "480p"} {
		if strings.Contains(lowerFile, resolution) && strings.Contains(lowerRelease, resolution) {
			score += 6
		}
	}
	if q.Year > 0 && strings.Contains(lowerRelease, strconv.Itoa(q.Year)) {
		score += 10
	}
	if c.AITranslated {
		score -= 100
	}
	if c.Forced {
		score -= 50
	}
	if c.HearingImpaired {
		score -= 15
	}
	c.Score = score
}

// normalTitle lower-cases a title or URL slug, drops a leading "the", a
// trailing year and punctuation, so "The.Matrix.1999" and "the-matrix" agree.
func normalTitle(title string) string {
	words := strings.FieldsFunc(strings.ToLower(title), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})
	if len(words) > 1 && words[0] == "the" {
		words = words[1:]
	}
	if n := len(words); n > 1 && len(words[n-1]) == 4 && (strings.HasPrefix(words[n-1], "19") || strings.HasPrefix(words[n-1], "20")) {
		words = words[:n-1]
	}
	return strings.Join(words, " ")
}

// Trustworthy reports whether a result is certainly for this item, which
// unattended downloads require: an exact file hash, a lookup by ID, or the
// provider's own title (and year, for movies) matching the item's.
func Trustworthy(c Candidate, q Query) bool {
	if c.HashMatch || c.ExactMatch {
		return true
	}
	want := q.Title
	if q.Kind == KindEpisode {
		want = q.Show
	}
	if c.Title == "" || normalTitle(c.Title) != normalTitle(want) {
		return false
	}
	if q.Kind == KindMovie && c.Year > 0 && q.Year > 0 && (c.Year-q.Year > 1 || q.Year-c.Year > 1) {
		return false
	}
	return true
}
