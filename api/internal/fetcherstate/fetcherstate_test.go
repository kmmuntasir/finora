package fetcherstate

import (
	"strings"
	"testing"
)

func TestPathKeyMatchesJellyfinAndFetcherPaths(t *testing.T) {
	jellyfin := PathKey(`D:\share\media\Videos\Movies\Emma (1996)\Emma.1996.720p.mp4`)
	fetcher := PathKey(`//nas/share/media/videos/movies/emma (1996)/emma.1996.720p.mp4`)
	if jellyfin != fetcher || jellyfin != "share/media/videos/movies/emma (1996)/emma.1996.720p.mp4" {
		t.Fatalf("keys differ: %q vs %q", jellyfin, fetcher)
	}
	if PathKey("/media/videos/a.mkv") != "/media/videos/a.mkv" {
		t.Fatal("Linux paths should stay as they are")
	}
}

func TestMissesKeepsOnlyFailures(t *testing.T) {
	state := `{"files": {
		"//h/s/a.mkv": {"status": "failed", "attempts": 3, "when": "2026-09-02T07:09:48.510Z", "lastError": "no provider had it"},
		"//h/s/b.mkv": {"status": "done", "when": "2026-09-02T07:09:48.510Z"},
		"//h/s/c.mkv": {"status": "pending"}
	}}`
	misses, err := Misses(strings.NewReader(state))
	if err != nil {
		t.Fatal(err)
	}
	miss, ok := misses["s/a.mkv"]
	if len(misses) != 1 || !ok || miss.Attempts != 3 || miss.LastError != "no provider had it" || miss.LastTried.Day() != 2 {
		t.Fatalf("misses = %+v", misses)
	}
}
