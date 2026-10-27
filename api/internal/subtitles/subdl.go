package subtitles

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

// SubDL scrapes subdl.com anonymously. Its per-IP daily cap shows up as
// 403/406/429 on zip downloads.
type SubDL struct {
	BaseURL string
}

func (s *SubDL) ID() string          { return "subdl" }
func (s *SubDL) Name() string        { return "SubDL" }
func (s *SubDL) Supports(Query) bool { return true }

func (s *SubDL) base() string {
	if s.BaseURL != "" {
		return s.BaseURL
	}
	return "https://subdl.com"
}

var (
	subdlDetail      = regexp.MustCompile(`href="(/subtitle/sd\d+/[^"/?#]+)`)
	subdlLanguage    = regexp.MustCompile(`data-language="([a-z_-]+)"[^>]*data-language-name="([^"]*)"`)
	subdlZip         = regexp.MustCompile(`https://dl\.subdl\.com/subtitle/[\d-]+\.zip`)
	subdlReleaseName = regexp.MustCompile(`<h4>([^<]{4,160})</h4>`)
	subdlEpFrom      = regexp.MustCompile(`data-episode-from="?(\d+)`)
	subdlEpTo        = regexp.MustCompile(`data-episode-to="?(\d+)`)
)

type subdlRelease struct {
	zip        string
	name       string
	fullSeason bool
	epFrom     int
	epTo       int
}

func (s *SubDL) Search(ctx context.Context, q Query) ([]Candidate, error) {
	// SubDL finds series by name; seasons are separate pages (verified October 2026).
	term := q.Title
	if q.Kind == KindEpisode {
		term = q.Show
	} else if q.Year > 0 {
		term += " " + strconv.Itoa(q.Year)
	}
	resp, err := get(ctx, s.base()+"/search/"+strings.ReplaceAll(url.PathEscape(term), "%20", "+"), nil)
	if err != nil {
		return nil, err
	}
	body, err := readBody(resp)
	if err != nil || resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("SubDL search failed (%d)", resp.StatusCode)
	}
	seen := map[string]bool{}
	var pages []string
	for _, match := range subdlDetail.FindAllStringSubmatch(string(body), -1) {
		id := strings.Split(match[1], "/")[2]
		if !seen[id] {
			seen[id] = true
			pages = append(pages, match[1])
		}
		if len(pages) >= 2 {
			break
		}
	}

	var candidates []Candidate
	for _, page := range pages {
		html, err := s.fetchPage(ctx, page)
		if err != nil {
			continue
		}
		if q.Kind == KindEpisode {
			// A series page links one page per season; follow the right one.
			seasonPage := subdlSeasonLink(html, page, q.Season)
			if seasonPage == "" {
				continue
			}
			if html, err = s.fetchPage(ctx, seasonPage); err != nil {
				continue
			}
			page = seasonPage
		}
		for _, release := range parseSubDLReleases(html, q.Language) {
			score, relevant := subdlScore(release, q)
			if !relevant {
				continue
			}
			candidates = append(candidates, Candidate{
				Provider:        s.ID(),
				Ref:             release.zip + "|" + page,
				Release:         release.name,
				HearingImpaired: regexp.MustCompile(`(?i)\b(sdh|hi)\b`).MatchString(release.name),
				Score:           float64(score),
			})
		}
	}
	return candidates, nil
}

func (s *SubDL) fetchPage(ctx context.Context, page string) (string, error) {
	resp, err := get(ctx, s.base()+page, nil)
	if err != nil {
		return "", err
	}
	body, err := readBody(resp)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("SubDL page failed (%d)", resp.StatusCode)
	}
	return string(body), nil
}

var ordinals = []string{"", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
	"eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth"}

// subdlSeasonLink finds the season page ("…/first-season") on a series page.
func subdlSeasonLink(html, seriesPage string, season int) string {
	if season < 1 || season >= len(ordinals) {
		return ""
	}
	link := seriesPage + "/" + ordinals[season] + "-season"
	if strings.Contains(html, `href="`+link+`"`) {
		return link
	}
	return ""
}

// parseSubDLReleases reads release rows from the sections for one language.
func parseSubDLReleases(html string, lang Language) []subdlRelease {
	marks := subdlLanguage.FindAllStringSubmatchIndex(html, -1)
	var releases []subdlRelease
	for i, mark := range marks {
		// Sections are keyed by full language names ("english", "bengali").
		code := strings.ToLower(html[mark[2]:mark[3]])
		name := strings.ToLower(html[mark[4]:mark[5]])
		want := strings.ToLower(lang.Name)
		if code != lang.Code && code != want && name != want {
			continue
		}
		end := len(html)
		if i+1 < len(marks) {
			end = marks[i+1][0]
		}
		for _, chunk := range strings.Split(html[mark[0]:end], "<li") {
			zip := subdlZip.FindString(chunk)
			if zip == "" {
				continue
			}
			release := subdlRelease{zip: zip, epFrom: -1, epTo: -1}
			if m := subdlReleaseName.FindStringSubmatch(chunk); m != nil {
				release.name = strings.TrimSpace(m[1])
			}
			head := chunk[:min(len(chunk), 300)]
			release.fullSeason = regexp.MustCompile(`data-full-season(?:[^a-z-]|$)`).MatchString(head)
			if m := subdlEpFrom.FindStringSubmatch(chunk); m != nil {
				release.epFrom, _ = strconv.Atoi(m[1])
			}
			if m := subdlEpTo.FindStringSubmatch(chunk); m != nil {
				release.epTo, _ = strconv.Atoi(m[1])
			}
			releases = append(releases, release)
		}
	}
	return releases
}

// subdlScore ranks a release for the episode or movie; irrelevant episodes are dropped.
func subdlScore(r subdlRelease, q Query) (int, bool) {
	if q.Kind != KindEpisode {
		return 0, true
	}
	name := strings.ToLower(strings.NewReplacer(".", " ", "_", " ").Replace(r.name))
	switch {
	case r.epFrom >= 0:
		to := r.epTo
		if to < 0 {
			to = r.epFrom
		}
		if r.epFrom <= q.Episode && q.Episode <= to {
			return 60, true
		}
		return 0, false
	case r.fullSeason:
		return 40, true
	case strings.Contains(name, "s"+pad2(q.Season)+"e"+pad2(q.Episode)):
		return 60, true
	case strings.Contains(name, "s"+pad2(q.Season)):
		return 25, true
	}
	return 0, false
}

func (s *SubDL) Download(ctx context.Context, c Candidate) ([]byte, error) {
	zip, page, ok := strings.Cut(c.Ref, "|")
	if !ok || !strings.HasPrefix(zip, "https://dl.subdl.com/") {
		return nil, errors.New("invalid SubDL reference")
	}
	resp, err := get(ctx, zip, map[string]string{"Referer": s.base() + page})
	if err != nil {
		return nil, err
	}
	switch resp.StatusCode {
	case http.StatusOK:
		return readBody(resp)
	case http.StatusForbidden, http.StatusNotAcceptable, http.StatusTooManyRequests:
		_ = resp.Body.Close()
		return nil, &QuotaError{Message: "SubDL's daily download limit for this server was reached", Daily: true}
	default:
		_ = resp.Body.Close()
		return nil, fmt.Errorf("SubDL download failed (%d)", resp.StatusCode)
	}
}
