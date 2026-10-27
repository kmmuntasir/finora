package httpapi

import (
	"context"
	"time"

	"github.com/kmmuntasir/finora/api/internal/config"
)

// OpenSubtitles deletes API consumers that make no downloads for 60 days.
// Finora records each download and warns admins before that happens. It
// never downloads on its own: the integrator terms forbid fetching subtitles
// nobody asked for.
const (
	osPurgeAfter = 60 * 24 * time.Hour
	osWarnAfter  = 45 * 24 * time.Hour

	keyOSLastDownload = "opensubtitles_last_download"
	keyOSKeySeen      = "opensubtitles_key_seen"
)

// osActivity describes how close the OpenSubtitles key is to being purged.
type osActivity struct {
	LastDownload *time.Time `json:"lastDownload"`
	// Since is the last download, or when Finora first saw the key if it has never downloaded.
	Since      *time.Time `json:"since"`
	PurgeAfter *time.Time `json:"purgeAfter"`
	Warning    bool       `json:"warning"`
	Remaining  *int       `json:"remaining"`
	ResetAt    *time.Time `json:"resetAt"`
}

func (s *Server) recordOSDownload(ctx context.Context) {
	if err := s.store.SetSettings(ctx, map[string]string{keyOSLastDownload: s.now().UTC().Format(time.RFC3339)}); err != nil {
		s.log.Warn("could not record OpenSubtitles download", "error", err)
	}
}

func (s *Server) storedTime(ctx context.Context, key string) *time.Time {
	value, err := s.store.Setting(ctx, key)
	if err != nil || value == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil
	}
	return &parsed
}

func (s *Server) osActivity(ctx context.Context, settings config.Settings) *osActivity {
	if settings.OSAPIKey == "" {
		return nil
	}
	activity := &osActivity{LastDownload: s.storedTime(ctx, keyOSLastDownload)}
	activity.Since = activity.LastDownload
	if activity.Since == nil {
		activity.Since = s.storedTime(ctx, keyOSKeySeen)
	}
	if activity.Since != nil {
		purge := activity.Since.Add(osPurgeAfter)
		activity.PurgeAfter = &purge
		activity.Warning = s.now().Sub(*activity.Since) >= osWarnAfter
	}
	if p := s.providers.openSubtitles; p != nil {
		if remaining, resetAt := p.Quota(); !resetAt.IsZero() {
			activity.Remaining, activity.ResetAt = &remaining, &resetAt
		}
	}
	return activity
}

// checkOSActivity runs from the janitor: it notes when a key first appears
// and logs a warning, at most daily, when the key nears the purge.
func (s *Server) checkOSActivity(ctx context.Context) {
	if s.now().Sub(s.osCheckedAt) < 24*time.Hour {
		return
	}
	settings, err := s.settings(ctx)
	if err != nil || settings.OSAPIKey == "" {
		return
	}
	s.osCheckedAt = s.now()
	if s.storedTime(ctx, keyOSKeySeen) == nil {
		_ = s.store.SetSettings(ctx, map[string]string{keyOSKeySeen: s.now().UTC().Format(time.RFC3339)})
	}
	if activity := s.osActivity(ctx, settings); activity != nil && activity.Warning {
		s.log.Warn("OpenSubtitles key has not downloaded recently and may be deleted; download one subtitle through Finora to keep it",
			"since", activity.Since.Format(time.DateOnly), "deletedAround", activity.PurgeAfter.Format(time.DateOnly))
	}
}
