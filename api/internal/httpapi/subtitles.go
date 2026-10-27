package httpapi

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/kmmuntasir/finora/api/internal/config"
	"github.com/kmmuntasir/finora/api/internal/jellyfin"
	"github.com/kmmuntasir/finora/api/internal/store"
	"github.com/kmmuntasir/finora/api/internal/subtitles"
)

// providerSet keeps provider instances alive across requests so pacing,
// login tokens and quota state persist.
type providerSet struct {
	mu            sync.Mutex
	addic7ed      *subtitles.Addic7ed
	subdl         *subtitles.SubDL
	openSubtitles *subtitles.OpenSubtitles
	osKey         string
}

func newProviderSet() *providerSet {
	return &providerSet{addic7ed: subtitles.NewAddic7ed(), subdl: &subtitles.SubDL{}}
}

func (p *providerSet) ordered(settings config.Settings) []subtitles.Provider {
	p.mu.Lock()
	defer p.mu.Unlock()
	key := settings.OSAPIKey + "\x00" + settings.OSUsername + "\x00" + settings.OSPassword
	if p.openSubtitles == nil || p.osKey != key {
		p.openSubtitles = &subtitles.OpenSubtitles{APIKey: settings.OSAPIKey, Username: settings.OSUsername, Password: settings.OSPassword}
		p.osKey = key
	}
	var result []subtitles.Provider
	for _, id := range settings.SubtitleProviders {
		switch id {
		case "addic7ed":
			result = append(result, p.addic7ed)
		case "subdl":
			result = append(result, p.subdl)
		case "opensubtitles":
			result = append(result, p.openSubtitles)
		}
	}
	return result
}

func (p *providerSet) byID(settings config.Settings, id string) subtitles.Provider {
	for _, provider := range p.ordered(settings) {
		if provider.ID() == id {
			return provider
		}
	}
	return nil
}

// candidateToken is what the browser sends back to download a search result.
type candidateToken struct {
	Provider string `json:"p"`
	Ref      string `json:"r"`
	Release  string `json:"n"`
	HI       bool   `json:"h"`
	Forced   bool   `json:"f"`
}

func encodeCandidate(c subtitles.Candidate) string {
	raw, _ := json.Marshal(candidateToken{Provider: c.Provider, Ref: c.Ref, Release: c.Release, HI: c.HearingImpaired, Forced: c.Forced})
	return base64.RawURLEncoding.EncodeToString(raw)
}

func decodeCandidate(token string) (subtitles.Candidate, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return subtitles.Candidate{}, err
	}
	var t candidateToken
	if err := json.Unmarshal(raw, &t); err != nil {
		return subtitles.Candidate{}, err
	}
	return subtitles.Candidate{Provider: t.Provider, Ref: t.Ref, Release: t.Release, HearingImpaired: t.HI, Forced: t.Forced}, nil
}

// subtitleAccess applies the "who may download" setting.
func (s *Server) subtitleAccess(w http.ResponseWriter, r *http.Request) (config.Settings, bool) {
	settings, err := s.settings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database unavailable")
		return settings, false
	}
	if settings.SubtitleAccess == "admins" && !userFrom(r.Context()).Policy.IsAdministrator {
		writeError(w, http.StatusForbidden, "only administrators can download subtitles on this server")
		return settings, false
	}
	if len(settings.SubtitleProviders) == 0 {
		writeError(w, http.StatusServiceUnavailable, "no subtitle providers are enabled")
		return settings, false
	}
	return settings, true
}

var episodeName = regexp.MustCompile(`(?i)s(\d{1,2})e(\d{1,3})`)

// baseName returns the file name for Windows or POSIX paths: Jellyfin may run
// on Windows ("D:\\media\\…") while the Finora API runs on Linux.
func baseName(path string) string {
	if i := strings.LastIndexAny(path, `/\`); i >= 0 {
		return path[i+1:]
	}
	return path
}

// stem is the file name without its extension.
func stem(path string) string {
	name := baseName(path)
	if i := strings.LastIndex(name, "."); i > 0 {
		return name[:i]
	}
	return name
}

// buildQuery turns Jellyfin's metadata into a provider query, hashing the
// file through two small range requests.
func (s *Server) buildQuery(ctx context.Context, client *jellyfin.Client, user jellyfin.User, itemID, langCode string) (subtitles.Query, jellyfin.Item, error) {
	item, err := client.Item(ctx, user.ID, itemID)
	if err != nil {
		return subtitles.Query{}, item, err
	}
	lang, ok := subtitles.LookupLanguage(langCode)
	if !ok {
		return subtitles.Query{}, item, errors.New("unsupported language")
	}
	query := subtitles.Query{Language: lang, Title: item.Name, Year: item.ProductionYear, FileName: baseName(item.Path)}
	switch item.Type {
	case "Episode":
		query.Kind = subtitles.KindEpisode
		query.Show, query.Season, query.Episode = item.SeriesName, item.ParentIndexNumber, item.IndexNumber
		if item.SeriesID != "" {
			if series, err := client.Item(ctx, user.ID, item.SeriesID); err == nil {
				query.IMDbID = series.ProviderIDs["Imdb"]
			}
		}
	case "Movie":
		query.Kind = subtitles.KindMovie
		query.IMDbID = item.ProviderIDs["Imdb"]
	case "Video":
		query.Kind = subtitles.KindMovie
		if m := episodeName.FindStringSubmatch(item.Name); m != nil {
			query.Kind = subtitles.KindEpisode
		}
	default:
		return subtitles.Query{}, item, errors.New("subtitles can only be found for movies, episodes and videos")
	}
	if len(item.MediaSources) > 0 && item.MediaSources[0].Size > 2*subtitles.HashChunk {
		size := item.MediaSources[0].Size
		head, errHead := client.ReadRange(ctx, item.ID, 0, subtitles.HashChunk)
		tail, errTail := client.ReadRange(ctx, item.ID, size-subtitles.HashChunk, subtitles.HashChunk)
		if errHead == nil && errTail == nil {
			query.Hash = subtitles.OpenSubtitlesHash(size, head, tail)
		}
	}
	return query, item, nil
}

type searchResult struct {
	ID string `json:"id"`
	subtitles.Candidate
	ProviderName string `json:"providerName"`
}

type providerStatus struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Status  string `json:"status"` // ok, error, quota, skipped
	Message string `json:"message,omitempty"`
	Results int    `json:"results"`
}

func (s *Server) handleSubtitleLanguages(w http.ResponseWriter, _ *http.Request) {
	type language struct {
		Code  string `json:"code"`
		Code3 string `json:"code3"`
		Name  string `json:"name"`
	}
	var result []language
	for _, l := range subtitles.Languages() {
		result = append(result, language{l.Code, l.Code3, l.Name})
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleSubtitleSearch(w http.ResponseWriter, r *http.Request) {
	settings, ok := s.subtitleAccess(w, r)
	if !ok {
		return
	}
	client := s.jellyfin(settings)
	query, _, err := s.buildQuery(r.Context(), client, userFrom(r.Context()), r.URL.Query().Get("itemId"), r.URL.Query().Get("lang"))
	if errors.Is(err, jellyfin.ErrNotFound) {
		writeError(w, http.StatusNotFound, "item not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	providers := s.providers.ordered(settings)
	statuses := make([]providerStatus, len(providers))
	found := make([][]subtitles.Candidate, len(providers))
	var wg sync.WaitGroup
	for i, provider := range providers {
		statuses[i] = providerStatus{ID: provider.ID(), Name: provider.Name(), Status: "ok"}
		if !provider.Supports(query) {
			statuses[i].Status = "skipped"
			if provider.ID() == "opensubtitles" {
				statuses[i].Message = "needs an API key"
			} else {
				statuses[i].Message = "TV episodes only"
			}
			continue
		}
		wg.Add(1)
		go func(i int, provider subtitles.Provider) {
			defer wg.Done()
			ctx, cancel := context.WithTimeout(r.Context(), 40*time.Second)
			defer cancel()
			candidates, err := provider.Search(ctx, query)
			if err != nil {
				statuses[i].Status, statuses[i].Message = "error", err.Error()
				s.log.Warn("subtitle search failed", "provider", provider.ID(), "error", err)
			}
			found[i] = candidates
			statuses[i].Results = len(candidates)
		}(i, provider)
	}
	wg.Wait()

	results := []searchResult{}
	seen := map[string]bool{}
	for i, candidates := range found {
		for _, candidate := range candidates {
			key := candidate.Provider + "\x00" + strings.ToLower(candidate.Release)
			if candidate.Release != "" && seen[key] {
				continue
			}
			seen[key] = true
			subtitles.Rank(&candidate, query)
			results = append(results, searchResult{ID: encodeCandidate(candidate), Candidate: candidate, ProviderName: providers[i].Name()})
		}
	}
	slices.SortStableFunc(results, func(a, b searchResult) int {
		switch {
		case a.Score > b.Score:
			return -1
		case a.Score < b.Score:
			return 1
		}
		return 0
	})
	if len(results) > 40 {
		results = results[:40]
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": results, "providers": statuses, "hash": query.Hash != ""})
}

func (s *Server) subtitlesDir() string { return filepath.Join(s.dataDir, "subtitles") }

func (s *Server) handleSubtitleDownload(w http.ResponseWriter, r *http.Request) {
	settings, ok := s.subtitleAccess(w, r)
	if !ok {
		return
	}
	var req struct {
		ItemID    string `json:"itemId"`
		Language  string `json:"language"`
		Candidate string `json:"candidate"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	user := userFrom(r.Context())
	if settings.SubtitleDailyLimit > 0 && !user.Policy.IsAdministrator {
		count, err := s.store.CountSubtitlesSince(r.Context(), user.ID, s.now().Add(-24*time.Hour))
		if err == nil && count >= settings.SubtitleDailyLimit {
			writeError(w, http.StatusTooManyRequests, fmt.Sprintf("you can download %d subtitles per day", settings.SubtitleDailyLimit))
			return
		}
	}
	candidate, err := decodeCandidate(req.Candidate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid subtitle choice")
		return
	}
	provider := s.providers.byID(settings, candidate.Provider)
	if provider == nil {
		writeError(w, http.StatusBadRequest, "that provider is not enabled")
		return
	}
	client := s.jellyfin(settings)
	query, item, err := s.buildQuery(r.Context(), client, user, req.ItemID, req.Language)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()
	payload, err := provider.Download(ctx, candidate)
	var quota *subtitles.QuotaError
	if errors.As(err, &quota) {
		writeError(w, http.StatusTooManyRequests, quota.Message)
		return
	}
	if err != nil {
		s.log.Warn("subtitle download failed", "provider", candidate.Provider, "error", err)
		writeError(w, http.StatusBadGateway, provider.Name()+" did not deliver the file; try another result")
		return
	}
	text, err := subtitles.ExtractSubtitle(payload, query, query.Language)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "the downloaded file is not a usable subtitle; try another result")
		return
	}

	id := randomToken(16)
	if err := os.MkdirAll(s.subtitlesDir(), 0o700); err != nil {
		writeError(w, http.StatusInternalServerError, "could not store the subtitle")
		return
	}
	fileName := id + ".srt"
	if err := os.WriteFile(filepath.Join(s.subtitlesDir(), fileName), []byte(text), 0o600); err != nil {
		writeError(w, http.StatusInternalServerError, "could not store the subtitle")
		return
	}

	source := jellyfin.MediaSource{}
	if len(item.MediaSources) > 0 {
		source = item.MediaSources[0]
	}
	before := []string{}
	for _, stream := range source.MediaStreams {
		if stream.Type == "Subtitle" && stream.IsExternal {
			before = append(before, stream.Path)
		}
	}
	beforeJSON, _ := json.Marshal(before)

	uploadErr := client.UploadSubtitle(r.Context(), item.ID, query.Language.Code3, "srt", []byte(text), candidate.Forced, candidate.HearingImpaired)
	record := store.Subtitle{
		ID: id, ItemID: item.ID, MediaSourceID: source.ID, Language: query.Language.Code, Provider: candidate.Provider,
		Release: candidate.Release, HearingImpaired: candidate.HearingImpaired, Forced: candidate.Forced,
		FileName: fileName, PathsBefore: string(beforeJSON), CreatedByID: user.ID, CreatedByName: user.Name,
	}
	if uploadErr != nil {
		s.log.Warn("subtitle upload to Jellyfin failed", "error", uploadErr)
		record.UploadError = "Jellyfin did not accept the upload; it is still available in Finora"
	}
	if err := s.store.SaveSubtitle(r.Context(), record); err != nil {
		writeError(w, http.StatusInternalServerError, "could not record the subtitle")
		return
	}
	s.log.Info("subtitle added", "provider", candidate.Provider, "by", user.Name)
	record.CreatedAt = s.now()
	writeJSON(w, http.StatusOK, s.subtitleView(record, nil))
}

type subtitleView struct {
	store.Subtitle
	Language3 string `json:"language3"`
	URL       string `json:"url"`
	// JellyfinStreamIndex is set once Jellyfin has indexed the file.
	JellyfinStreamIndex *int `json:"jellyfinStreamIndex"`
}

func (s *Server) subtitleView(sub store.Subtitle, index *int) subtitleView {
	lang, _ := subtitles.LookupLanguage(sub.Language)
	return subtitleView{Subtitle: sub, Language3: lang.Code3, URL: "/api/v1/subtitles/files/" + sub.ID + ".vtt", JellyfinStreamIndex: index}
}

// handleItemSubtitles lists Finora-added subtitles for an item and works out
// which Jellyfin stream each one became.
func (s *Server) handleItemSubtitles(w http.ResponseWriter, r *http.Request) {
	settings, err := s.settings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	itemID := r.PathValue("itemId")
	records, err := s.store.SubtitlesForItem(r.Context(), itemID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load subtitles")
		return
	}
	views := []subtitleView{}
	if len(records) == 0 {
		writeJSON(w, http.StatusOK, views)
		return
	}
	item, err := s.jellyfin(settings).Item(r.Context(), userFrom(r.Context()).ID, itemID)
	if err != nil {
		writeError(w, http.StatusNotFound, "item not found")
		return
	}
	streams := map[string]jellyfin.MediaStream{}
	for _, source := range item.MediaSources {
		for _, stream := range source.MediaStreams {
			if stream.Type == "Subtitle" && stream.IsExternal {
				streams[stream.Path] = stream
			}
		}
	}
	claimed := map[string]bool{}
	for _, record := range records {
		if record.JellyfinPath != "" {
			claimed[record.JellyfinPath] = true
		}
	}
	videoStem := stem(item.Path)
	for _, record := range records {
		if record.JellyfinPath == "" {
			// Find the new file Jellyfin indexed after our upload.
			var before []string
			_ = json.Unmarshal([]byte(record.PathsBefore), &before)
			lang, _ := subtitles.LookupLanguage(record.Language)
			for path := range streams {
				base := baseName(path)
				if claimed[path] || slices.Contains(before, path) || !strings.HasPrefix(base, videoStem+"."+lang.Code3) {
					continue
				}
				record.JellyfinPath = path
				claimed[path] = true
				_ = s.store.SetSubtitleJellyfinPath(r.Context(), record.ID, path)
				break
			}
		}
		var index *int
		if stream, ok := streams[record.JellyfinPath]; ok && record.JellyfinPath != "" {
			index = &stream.Index
		}
		views = append(views, s.subtitleView(record, index))
	}
	writeJSON(w, http.StatusOK, views)
}

var subtitleFileName = regexp.MustCompile(`^([0-9a-f]{32})\.vtt$`)

// handleSubtitleFile serves a stored subtitle as WebVTT. The random ID is the
// capability; <track> elements cannot send Authorization headers.
func (s *Server) handleSubtitleFile(w http.ResponseWriter, r *http.Request) {
	match := subtitleFileName.FindStringSubmatch(r.PathValue("file"))
	if match == nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	record, err := s.store.Subtitle(r.Context(), match[1])
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	data, err := os.ReadFile(filepath.Join(s.subtitlesDir(), record.FileName))
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	w.Header().Set("Content-Type", "text/vtt; charset=utf-8")
	w.Header().Set("Cache-Control", "private, max-age=3600")
	_, _ = w.Write([]byte(subtitles.SRTToVTT(string(data))))
}

// handleDeleteSubtitle removes a Finora-added subtitle from Jellyfin and Finora.
func (s *Server) handleDeleteSubtitle(w http.ResponseWriter, r *http.Request) {
	user := userFrom(r.Context())
	record, err := s.store.Subtitle(r.Context(), r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if record.CreatedByID != user.ID && !user.Policy.IsAdministrator {
		writeError(w, http.StatusForbidden, "only the person who added it or an administrator can remove it")
		return
	}
	settings, err := s.settings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	client := s.jellyfin(settings)
	if record.JellyfinPath != "" {
		if item, err := client.Item(r.Context(), user.ID, record.ItemID); err == nil {
			for _, source := range item.MediaSources {
				for _, stream := range source.MediaStreams {
					if stream.Type == "Subtitle" && stream.Path == record.JellyfinPath {
						if err := client.DeleteSubtitle(r.Context(), record.ItemID, stream.Index); err != nil {
							s.log.Warn("could not delete subtitle from Jellyfin", "error", err)
						}
					}
				}
			}
		}
	}
	_ = os.Remove(filepath.Join(s.subtitlesDir(), record.FileName))
	if err := s.store.DeleteSubtitle(r.Context(), record.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
