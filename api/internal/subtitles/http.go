package subtitles

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// browserUA is used for sites that reject unknown clients.
const browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"

var httpClient = &http.Client{
	Timeout: 45 * time.Second,
	// Providers redirect to their CDNs; Addic7ed's search redirect is handled manually.
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if req.Context().Value(noRedirectKey{}) != nil {
			return http.ErrUseLastResponse
		}
		if len(via) >= 5 {
			return fmt.Errorf("too many redirects")
		}
		return nil
	},
}

type noRedirectKey struct{}

func get(ctx context.Context, url string, headers map[string]string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", browserUA)
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	return httpClient.Do(req)
}

func readBody(resp *http.Response) ([]byte, error) {
	defer resp.Body.Close()
	return io.ReadAll(io.LimitReader(resp.Body, maxPayload))
}

// pacer spaces requests to one site, shared by every search.
type pacer struct {
	mu   sync.Mutex
	gap  time.Duration
	last time.Time
}

func (p *pacer) wait(ctx context.Context) error {
	p.mu.Lock()
	next := p.last.Add(p.gap)
	now := time.Now()
	if next.Before(now) {
		next = now
	}
	p.last = next
	p.mu.Unlock()
	select {
	case <-time.After(time.Until(next)):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
