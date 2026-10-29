// Package fetcherstate reads the state file of the owner's subtitle-fetcher
// (state.json), so the automatic subtitle job can take over its history
// instead of searching again for titles it already gave up on.
package fetcherstate

import (
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strings"
	"time"
)

// Miss is a video subtitle-fetcher searched for without success.
type Miss struct {
	Attempts  int
	LastTried time.Time
	LastError string
}

type file struct {
	Status    string `json:"status"`
	Attempts  int    `json:"attempts"`
	When      string `json:"when"`
	LastError string `json:"lastError"`
}

// Misses returns the failed videos in a state.json, keyed by PathKey.
func Misses(r io.Reader) (map[string]Miss, error) {
	var state struct {
		Files map[string]file `json:"files"`
	}
	if err := json.NewDecoder(r).Decode(&state); err != nil {
		return nil, fmt.Errorf("read subtitle-fetcher state: %w", err)
	}
	misses := map[string]Miss{}
	for path, entry := range state.Files {
		if entry.Status != "failed" || entry.Attempts < 1 {
			continue
		}
		when, err := time.Parse(time.RFC3339, entry.When)
		if err != nil {
			continue
		}
		misses[PathKey(path)] = Miss{Attempts: entry.Attempts, LastTried: when, LastError: entry.LastError}
	}
	return misses, nil
}

var root = regexp.MustCompile(`^(?:[a-z]:/|//[^/]+/)`)

// PathKey makes a Jellyfin path (D:\share\Videos\x.mkv) and a
// subtitle-fetcher path (//host/share/videos/x.mkv, lower case) comparable:
// lower case, forward slashes, without the drive letter or host.
func PathKey(path string) string {
	key := strings.ToLower(strings.ReplaceAll(path, `\`, "/"))
	return root.ReplaceAllString(key, "")
}
