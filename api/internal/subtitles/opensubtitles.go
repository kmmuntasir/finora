package subtitles

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

// OpenSubtitles uses the opensubtitles.com REST API. It needs an API key;
// signing in with an account raises the daily download allowance.
type OpenSubtitles struct {
	APIKey   string
	Username string
	Password string
	BaseURL  string

	mu         sync.Mutex
	token      string
	tokenUntil time.Time
	remaining  int
	resetAt    time.Time
}

func (o *OpenSubtitles) ID() string            { return "opensubtitles" }
func (o *OpenSubtitles) Name() string          { return "OpenSubtitles" }
func (o *OpenSubtitles) Supports(q Query) bool { return o.APIKey != "" }

func (o *OpenSubtitles) base() string {
	if o.BaseURL != "" {
		return o.BaseURL
	}
	return "https://api.opensubtitles.com/api/v1"
}

func (o *OpenSubtitles) request(ctx context.Context, method, path string, body any, auth bool) (*http.Response, error) {
	var reader *bytes.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		reader = bytes.NewReader(raw)
	}
	var req *http.Request
	var err error
	if reader != nil {
		req, err = http.NewRequestWithContext(ctx, method, o.base()+path, reader)
	} else {
		req, err = http.NewRequestWithContext(ctx, method, o.base()+path, nil)
	}
	if err != nil {
		return nil, err
	}
	req.Header.Set("Api-Key", o.APIKey)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Finora v0.1.0")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if auth {
		o.mu.Lock()
		if o.token != "" {
			req.Header.Set("Authorization", "Bearer "+o.token)
		}
		o.mu.Unlock()
	}
	return httpClient.Do(req)
}

func (o *OpenSubtitles) login(ctx context.Context) error {
	if o.Username == "" || o.Password == "" {
		return nil
	}
	o.mu.Lock()
	valid := o.token != "" && time.Now().Before(o.tokenUntil)
	o.mu.Unlock()
	if valid {
		return nil
	}
	resp, err := o.request(ctx, http.MethodPost, "/login", map[string]string{"username": o.Username, "password": o.Password}, false)
	if err != nil {
		return err
	}
	body, _ := readBody(resp)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("OpenSubtitles login failed (%d)", resp.StatusCode)
	}
	var result struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return err
	}
	o.mu.Lock()
	o.token, o.tokenUntil = result.Token, time.Now().Add(23*time.Hour)
	o.mu.Unlock()
	return nil
}

type osAttributes struct {
	Release          string  `json:"release"`
	HearingImpaired  bool    `json:"hearing_impaired"`
	AITranslated     bool    `json:"ai_translated"`
	MachineTrans     bool    `json:"machine_translated"`
	ForeignPartsOnly bool    `json:"foreign_parts_only"`
	DownloadCount    int     `json:"download_count"`
	Ratings          float64 `json:"ratings"`
	Votes            int     `json:"votes"`
	HashMatch        bool    `json:"moviehash_match"`
	Files            []struct {
		FileID   int    `json:"file_id"`
		FileName string `json:"file_name"`
	} `json:"files"`
}

func (o *OpenSubtitles) Search(ctx context.Context, q Query) ([]Candidate, error) {
	if err := o.login(ctx); err != nil {
		return nil, err
	}
	var queries []url.Values
	base := url.Values{"languages": {q.Language.Code}}
	with := func(extra map[string]string) url.Values {
		values := url.Values{}
		for key, value := range base {
			values[key] = value
		}
		for key, value := range extra {
			values.Set(key, value)
		}
		return values
	}
	if q.Hash != "" {
		queries = append(queries, with(map[string]string{"moviehash": q.Hash}))
	}
	imdb := strings.TrimPrefix(strings.ToLower(q.IMDbID), "tt")
	if q.Kind == KindEpisode {
		if imdb != "" {
			queries = append(queries, with(map[string]string{"parent_imdb_id": imdb, "season_number": strconv.Itoa(q.Season), "episode_number": strconv.Itoa(q.Episode)}))
		}
		queries = append(queries, with(map[string]string{"type": "episode", "query": q.Show, "season_number": strconv.Itoa(q.Season), "episode_number": strconv.Itoa(q.Episode)}))
	} else {
		if imdb != "" {
			queries = append(queries, with(map[string]string{"imdb_id": imdb}))
		}
		titleQuery := map[string]string{"type": "movie", "query": q.Title}
		if q.Year > 0 {
			titleQuery["year"] = strconv.Itoa(q.Year)
		}
		queries = append(queries, with(titleQuery))
	}

	seen := map[int]bool{}
	var candidates []Candidate
	for _, values := range queries {
		resp, err := o.request(ctx, http.MethodGet, "/subtitles?"+values.Encode(), nil, true)
		if err != nil {
			return candidates, err
		}
		body, _ := readBody(resp)
		if resp.StatusCode == http.StatusUnauthorized {
			return nil, errors.New("OpenSubtitles rejected the API key")
		}
		if resp.StatusCode != http.StatusOK {
			return candidates, fmt.Errorf("OpenSubtitles search failed (%d)", resp.StatusCode)
		}
		var result struct {
			Data []struct {
				Attributes osAttributes `json:"attributes"`
			} `json:"data"`
		}
		if err := json.Unmarshal(body, &result); err != nil {
			return candidates, err
		}
		for _, item := range result.Data {
			a := item.Attributes
			if a.ForeignPartsOnly {
				continue
			}
			for _, file := range a.Files {
				if file.FileID == 0 || seen[file.FileID] {
					continue
				}
				seen[file.FileID] = true
				release := a.Release
				if release == "" {
					release = file.FileName
				}
				candidates = append(candidates, Candidate{
					Provider:        o.ID(),
					Ref:             strconv.Itoa(file.FileID),
					Release:         release,
					HearingImpaired: a.HearingImpaired,
					AITranslated:    a.AITranslated || a.MachineTrans,
					HashMatch:       a.HashMatch,
					Downloads:       a.DownloadCount,
					Score:           a.Ratings*10 + float64(a.Votes)/100 + float64(a.DownloadCount)/200,
				})
			}
		}
		if len(candidates) >= 20 {
			break
		}
	}
	return candidates, nil
}

func (o *OpenSubtitles) Download(ctx context.Context, c Candidate) ([]byte, error) {
	fileID, err := strconv.Atoi(c.Ref)
	if err != nil {
		return nil, errors.New("invalid OpenSubtitles file")
	}
	if err := o.login(ctx); err != nil {
		return nil, err
	}
	resp, err := o.request(ctx, http.MethodPost, "/download", map[string]int{"file_id": fileID}, true)
	if err != nil {
		return nil, err
	}
	body, _ := readBody(resp)
	if resp.StatusCode == http.StatusNotAcceptable {
		return nil, &QuotaError{Message: "OpenSubtitles daily download limit reached", Daily: true}
	}
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, &QuotaError{Message: "OpenSubtitles is rate limiting; try again shortly"}
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OpenSubtitles download failed (%d)", resp.StatusCode)
	}
	var result struct {
		Link      string `json:"link"`
		Remaining int    `json:"remaining"`
		ResetTime string `json:"reset_time_utc"`
	}
	if err := json.Unmarshal(body, &result); err != nil || result.Link == "" {
		return nil, errors.New("OpenSubtitles returned no download link")
	}
	o.mu.Lock()
	o.remaining = result.Remaining
	o.resetAt, _ = time.Parse(time.RFC3339, result.ResetTime)
	o.mu.Unlock()
	file, err := get(ctx, result.Link, nil)
	if err != nil {
		return nil, err
	}
	if file.StatusCode != http.StatusOK {
		_ = file.Body.Close()
		return nil, fmt.Errorf("OpenSubtitles CDN returned %d", file.StatusCode)
	}
	return readBody(file)
}

// Quota reports the remaining downloads, when known.
func (o *OpenSubtitles) Quota() (remaining int, resetAt time.Time) {
	o.mu.Lock()
	defer o.mu.Unlock()
	return o.remaining, o.resetAt
}
