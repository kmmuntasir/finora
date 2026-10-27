package subtitles

import (
	"context"
	"regexp"
	"strconv"
	"strings"
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

// QuotaError means a provider's daily allowance is used up; retry later.
type QuotaError struct{ Message string }

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
