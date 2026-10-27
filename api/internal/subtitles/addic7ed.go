package subtitles

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// Addic7ed scrapes addic7ed.com, a TV specialist. It throttles hard, so all
// requests share one pacer (about one request every 3 seconds).
type Addic7ed struct {
	BaseURL string
	pacer   pacer
}

// NewAddic7ed creates the provider with polite pacing.
func NewAddic7ed() *Addic7ed { return &Addic7ed{pacer: pacer{gap: 3200 * time.Millisecond}} }

func (a *Addic7ed) ID() string            { return "addic7ed" }
func (a *Addic7ed) Name() string          { return "Addic7ed" }
func (a *Addic7ed) Supports(q Query) bool { return q.Kind == KindEpisode && q.Show != "" }

func (a *Addic7ed) base() string {
	if a.BaseURL != "" {
		return a.BaseURL
	}
	return "https://www.addic7ed.com"
}

var (
	a7SeriePath  = regexp.MustCompile(`^/?serie/[^/]+/\d+/\d+/?`)
	a7Original   = regexp.MustCompile(`href="(/original/\d+/\d+)"`)
	a7Version    = regexp.MustCompile(`(?i)Version [^,<]{3,80},`)
	a7Incomplete = regexp.MustCompile(`\b\d{1,3}\s*%(?:\s|<)`)
	trailingYear = regexp.MustCompile(`\s+\b(?:19|20)\d{2}\b\s*$`)
)

func (a *Addic7ed) Search(ctx context.Context, q Query) ([]Candidate, error) {
	code := "S" + pad2(q.Season) + "E" + pad2(q.Episode)
	terms := []string{q.Show + " " + code}
	if noYear := strings.TrimSpace(trailingYear.ReplaceAllString(q.Show, "")); noYear != q.Show {
		terms = append(terms, noYear+" "+code)
	}
	linkRx := regexp.MustCompile(`href="(serie/[^"']+/` + fmt.Sprint(q.Season) + `/` + fmt.Sprint(q.Episode) + `/[^"]*)"`)

	var episodePath string
	for _, term := range terms {
		if err := a.pacer.wait(ctx); err != nil {
			return nil, err
		}
		resp, err := get(context.WithValue(ctx, noRedirectKey{}, true), a.base()+"/srch.php?search="+url.QueryEscape(term)+"&Submit=Search", nil)
		if err != nil {
			return nil, err
		}
		if resp.StatusCode >= 300 && resp.StatusCode < 400 {
			location := resp.Header.Get("Location")
			_ = resp.Body.Close()
			location = regexp.MustCompile(`^https?://[^/]+`).ReplaceAllString(location, "")
			if a7SeriePath.MatchString(location) {
				episodePath = strings.TrimPrefix(location, "/")
				break
			}
			continue
		}
		body, err := readBody(resp)
		if err != nil || resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("Addic7ed search failed (%d)", resp.StatusCode)
		}
		if m := linkRx.FindStringSubmatch(string(body)); m != nil {
			episodePath = m[1]
			break
		}
	}
	if episodePath == "" {
		return nil, nil
	}

	if err := a.pacer.wait(ctx); err != nil {
		return nil, err
	}
	resp, err := get(ctx, a.base()+"/"+episodePath, nil)
	if err != nil {
		return nil, err
	}
	page, err := readBody(resp)
	if err != nil || resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Addic7ed episode page failed (%d)", resp.StatusCode)
	}
	return parseAddic7edPage(string(page), "/"+episodePath, q.Language), nil
}

// parseAddic7edPage lists completed subtitles in the language; each language
// cell is followed by its status and download link.
func parseAddic7edPage(html, referer string, lang Language) []Candidate {
	var candidates []Candidate
	parts := regexp.MustCompile(`(?i)class="language">`).Split(html, -1)
	for _, segment := range parts[1:] {
		languageName := strings.TrimSpace(regexp.MustCompile(`^[\s]*([\w ()&'-]{3,30}?)\s*<(?:a\b|/td)`).FindStringSubmatch(segment + "<a")[1])
		if !strings.EqualFold(languageName, lang.Name) {
			continue
		}
		status := segment[:min(len(segment), 700)]
		if a7Incomplete.MatchString(status) && !strings.Contains(status, "<b>Completed</b>") {
			continue
		}
		href := a7Original.FindStringSubmatch(segment)
		if href == nil {
			continue
		}
		anchor := strings.LastIndex(html, `href="`+href[1]+`"`)
		before := html[max(0, anchor-3000):max(0, anchor)]
		versions := a7Version.FindAllString(before, -1)
		heading := ""
		if len(versions) > 0 {
			heading = versions[len(versions)-1]
		}
		hearingImpaired := strings.Contains(strings.ToLower(heading), "hearing impaired")
		team := strings.TrimSuffix(strings.TrimSpace(strings.TrimPrefix(heading, "Version ")), ",")
		score := 10.0
		if hearingImpaired {
			score = 6
		}
		candidates = append(candidates, Candidate{
			Provider:        "addic7ed",
			Ref:             href[1] + "|" + referer,
			Release:         team,
			HearingImpaired: hearingImpaired,
			Score:           score,
		})
		if len(candidates) >= 5 {
			break
		}
	}
	return candidates
}

func (a *Addic7ed) Download(ctx context.Context, c Candidate) ([]byte, error) {
	href, referer, ok := strings.Cut(c.Ref, "|")
	if !ok || !strings.HasPrefix(href, "/original/") {
		return nil, errors.New("invalid Addic7ed reference")
	}
	for attempt := 0; attempt < 2; attempt++ {
		if err := a.pacer.wait(ctx); err != nil {
			return nil, err
		}
		resp, err := get(ctx, a.base()+href, map[string]string{"Referer": a.base() + referer})
		if err != nil {
			return nil, err
		}
		body, err := readBody(resp)
		if err != nil {
			return nil, err
		}
		head := strings.ToLower(string(body[:min(len(body), 600)]))
		throttled := resp.StatusCode == http.StatusTooManyRequests || strings.Contains(head, "too many requests") || strings.Contains(head, "please wait")
		if throttled && attempt == 0 {
			select {
			case <-time.After(25 * time.Second):
				continue
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}
		if throttled {
			return nil, &QuotaError{Message: "Addic7ed is throttling requests; try again later"}
		}
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("Addic7ed download failed (%d)", resp.StatusCode)
		}
		return body, nil
	}
	return nil, errors.New("unreachable")
}
