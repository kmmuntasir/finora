package subtitles

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAddic7edSearchThrottlingRests(t *testing.T) {
	for _, status := range []int{http.StatusTooManyRequests, http.StatusServiceUnavailable} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(status)
		}))
		a := &Addic7ed{BaseURL: server.URL}
		_, err := a.Search(context.Background(), Query{Kind: KindEpisode, Show: "Show", Season: 1, Episode: 2, Language: Language{Code: "en", Name: "English"}})
		server.Close()
		var quota *QuotaError
		if !errors.As(err, &quota) {
			t.Fatalf("status %d: err = %v, want a QuotaError so Addic7ed rests", status, err)
		}
	}
}
