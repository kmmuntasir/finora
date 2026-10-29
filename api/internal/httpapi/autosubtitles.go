package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/kmmuntasir/finora/api/internal/config"
	"github.com/kmmuntasir/finora/api/internal/jellyfin"
	"github.com/kmmuntasir/finora/api/internal/subtitles"
)

// The automatic job fetches missing subtitles across the whole library,
// newest additions first, at most AutoPerRun downloads and autoMaxChecked
// searches per run (items that fail wait a week, so each night reaches
// further back). It follows subtitle-fetcher's
// rules: new items before retries, a failed item waits a week before the next
// try, and gives up after three tries; a provider that hits its quota rests
// (see providerSet.noteQuota). It never runs unless an admin turns it on.
const (
	autoMaxAttempts = 3
	autoRetryAfter  = 7 * 24 * time.Hour
	autoPageSize    = 200
	// autoMaxChecked bounds the searches in one run (each takes a few
	// seconds across the providers), so a large library with many misses
	// still finishes in well under an hour.
	autoMaxChecked = 400
	autoActorID    = "finora-auto"
	autoActorName  = "Finora (automatic)"
	keyAutoLastRun = "auto_subtitle_last_run"
)

// autoRun summarises one run of the job.
type autoRun struct {
	Started    time.Time  `json:"started"`
	Finished   *time.Time `json:"finished"`
	Checked    int        `json:"checked"`
	Downloaded int        `json:"downloaded"`
	Failed     int        `json:"failed"`
	// Stopped explains an early end (quota, error); empty when the run finished normally.
	Stopped string `json:"stopped,omitempty"`
}

type autoState struct {
	mu      sync.Mutex
	running bool
	current *autoRun
	trigger chan struct{}
}

func newAutoState() *autoState { return &autoState{trigger: make(chan struct{}, 1)} }

// hasSubtitle reports whether an item already has a (non-forced) subtitle in a language.
func hasSubtitle(item jellyfin.Item, language subtitles.Language) bool {
	streams := item.MediaStreams
	for _, source := range item.MediaSources {
		streams = append(streams, source.MediaStreams...)
	}
	for _, stream := range streams {
		if stream.Type != "Subtitle" || stream.IsForced {
			continue
		}
		if found, ok := subtitles.LookupLanguage(stream.Language); ok && found.Code == language.Code {
			return true
		}
	}
	return false
}

func (s *Server) lastAutoRun(ctx context.Context) *autoRun {
	raw, err := s.store.Setting(ctx, keyAutoLastRun)
	if err != nil || raw == "" {
		return nil
	}
	var run autoRun
	if json.Unmarshal([]byte(raw), &run) != nil {
		return nil
	}
	return &run
}

// nextAutoRun is when the job next starts on its own: today at the set hour
// (already due if that has passed and today's run hasn't happened, so a
// server that was off catches up), otherwise tomorrow.
func nextAutoRun(now time.Time, hour int, last *autoRun) time.Time {
	local := now.Local()
	today := time.Date(local.Year(), local.Month(), local.Day(), hour, 0, 0, 0, time.Local)
	if last != nil && !last.Started.Local().Before(today) {
		return today.AddDate(0, 0, 1)
	}
	return today
}

// RunAutoSubtitles checks every minute whether the daily run is due, and runs
// on demand when an admin presses "Run now". It returns when ctx ends.
func (s *Server) RunAutoSubtitles(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		manual := false
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		case <-s.auto.trigger:
			manual = true
		}
		settings, err := s.settings(ctx)
		if err != nil || !settings.Configured() {
			continue
		}
		if !manual {
			if !settings.AutoSubtitles || s.now().Before(nextAutoRun(s.now(), settings.AutoHour, s.lastAutoRun(ctx))) {
				continue
			}
		}
		s.runAutoSubtitles(ctx, settings)
	}
}

func (s *Server) runAutoSubtitles(ctx context.Context, settings config.Settings) {
	run := &autoRun{Started: s.now()}
	s.auto.mu.Lock()
	s.auto.running, s.auto.current = true, run
	s.auto.mu.Unlock()
	defer func() {
		finished := s.now()
		s.auto.mu.Lock()
		run.Finished = &finished
		s.auto.running, s.auto.current = false, nil
		raw, _ := json.Marshal(run)
		s.auto.mu.Unlock()
		_ = s.store.SetSettings(context.WithoutCancel(ctx), map[string]string{keyAutoLastRun: string(raw)})
		s.log.Info("automatic subtitles finished", "checked", run.Checked, "downloaded", run.Downloaded, "failed", run.Failed, "stopped", run.Stopped)
	}()

	if len(s.providers.ordered(settings)) == 0 {
		run.Stopped = "no subtitle providers are enabled"
		return
	}
	client := s.jellyfin(settings)
	budget := settings.AutoPerRun
	for _, code := range settings.AutoLanguages {
		language, ok := subtitles.LookupLanguage(code)
		if !ok {
			continue
		}
		for start := 0; budget > 0 && run.Checked < autoMaxChecked; start += autoPageSize {
			items, total, err := client.VideosNewestFirst(ctx, start, autoPageSize)
			if err != nil {
				run.Stopped = "Jellyfin didn't answer: " + err.Error()
				return
			}
			stop := s.autoPage(ctx, settings, client, language, items, run, &budget)
			if stop != "" {
				run.Stopped = stop
				return
			}
			if start+autoPageSize >= total {
				break
			}
		}
	}
}

// autoPage works through one page of items; a non-empty result stops the run.
func (s *Server) autoPage(ctx context.Context, settings config.Settings, client *jellyfin.Client, language subtitles.Language, items []jellyfin.Item, run *autoRun, budget *int) string {
	ids := make([]string, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
	}
	attempts, err := s.store.AutoAttempts(ctx, language.Code, ids)
	if err != nil {
		return "database unavailable"
	}
	for _, item := range items {
		if *budget <= 0 || run.Checked >= autoMaxChecked {
			return ""
		}
		if ctx.Err() != nil {
			return "stopped"
		}
		if hasSubtitle(item, language) {
			continue
		}
		previous := attempts[item.ID]
		if previous.Attempts >= autoMaxAttempts || (previous.Attempts > 0 && s.now().Sub(previous.LastAttempt) < autoRetryAfter) {
			continue
		}
		// Added through Finora but not indexed by Jellyfin yet.
		if existing, err := s.store.SubtitlesForItem(ctx, item.ID); err == nil {
			found := false
			for _, sub := range existing {
				found = found || sub.Language == language.Code
			}
			if found {
				continue
			}
		}

		run.Checked++
		query, full, err := s.buildQuery(ctx, client, jellyfin.User{}, item.ID, language.Code)
		if err != nil {
			continue
		}
		results, statuses := s.searchCandidates(ctx, settings, query)
		resting := 0
		for _, status := range statuses {
			if status.Status == "quota" {
				resting++
			}
		}
		if len(statuses) > 0 && resting == len(statuses) {
			return "every provider has reached its limit for now"
		}
		failure := "no subtitles found"
		// Unattended, only results that are certainly for this item count.
		trusted := results[:0:0]
		for _, result := range results {
			if subtitles.Trustworthy(result.Candidate, query) {
				trusted = append(trusted, result)
			}
		}
		if len(results) > 0 && len(trusted) == 0 {
			failure = "no result clearly matched the title"
		}
		done := false
		// Try the best few results; a bad file or a provider at its limit moves on to the next.
		for i := 0; i < len(trusted) && i < 3 && !done; i++ {
			provider := s.providers.byID(settings, trusted[i].Candidate.Provider)
			if provider == nil {
				continue
			}
			_, err := s.fetchSubtitle(ctx, client, provider, full, query, trusted[i].Candidate, autoActorID, autoActorName)
			var fetchFailure *fetchError
			switch {
			case err == nil:
				done = true
			case errors.As(err, &fetchFailure):
				failure = fetchFailure.message
			default:
				failure = err.Error()
			}
		}
		if done {
			run.Downloaded++
			*budget--
			_ = s.store.ClearAutoAttempt(ctx, item.ID, language.Code)
			s.log.Info("automatic subtitle added", "item", item.Name, "language", language.Code)
		} else {
			run.Failed++
			_ = s.store.RecordAutoAttempt(ctx, item.ID, language.Code, failure)
		}
	}
	return ""
}

type autoStatus struct {
	Enabled bool       `json:"enabled"`
	Running bool       `json:"running"`
	Current *autoRun   `json:"current"`
	LastRun *autoRun   `json:"lastRun"`
	NextRun *time.Time `json:"nextRun"`
}

func (s *Server) handleAutoStatus(w http.ResponseWriter, r *http.Request) {
	settings, err := s.settings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	status := autoStatus{Enabled: settings.AutoSubtitles, LastRun: s.lastAutoRun(r.Context())}
	s.auto.mu.Lock()
	status.Running = s.auto.running
	if s.auto.current != nil {
		current := *s.auto.current
		status.Current = &current
	}
	s.auto.mu.Unlock()
	if settings.AutoSubtitles {
		next := nextAutoRun(s.now(), settings.AutoHour, status.LastRun)
		status.NextRun = &next
	}
	writeJSON(w, http.StatusOK, status)
}

func (s *Server) handleAutoRunNow(w http.ResponseWriter, _ *http.Request) {
	s.auto.mu.Lock()
	running := s.auto.running
	s.auto.mu.Unlock()
	if running {
		writeError(w, http.StatusConflict, "a run is already in progress")
		return
	}
	select {
	case s.auto.trigger <- struct{}{}:
	default:
	}
	w.WriteHeader(http.StatusAccepted)
}
