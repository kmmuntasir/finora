package httpapi

import (
	"crypto/subtle"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/kmmuntasir/finora/api/internal/config"
	"github.com/kmmuntasir/finora/api/internal/jellyfin"
	"github.com/kmmuntasir/finora/api/internal/store"
)

// ---- public ----

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	settings, err := s.settings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	status := map[string]any{"status": "ok", "configured": settings.Configured()}
	if settings.Configured() {
		_, err := s.jellyfin(settings).SystemInfo(r.Context())
		status["jellyfinReachable"] = err == nil
	}
	writeJSON(w, http.StatusOK, status)
}

func (s *Server) handlePublicConfig(w http.ResponseWriter, r *http.Request) {
	settings, err := s.settings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"configured":   settings.Configured(),
		"googleSignIn": settings.Configured() && settings.GoogleEnabled(),
		"features": map[string]bool{
			"announcements": true,
			"subtitles":     false,
		},
	})
}

func (s *Server) handleActiveAnnouncements(w http.ResponseWriter, r *http.Request) {
	at := s.now()
	announcements, err := s.store.Announcements(r.Context(), &at)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load announcements")
		return
	}
	writeJSON(w, http.StatusOK, announcements)
}

type setupRequest struct {
	Code           string `json:"code"`
	JellyfinURL    string `json:"jellyfinUrl"`
	APIKey         string `json:"apiKey"`
	AllowedOrigins string `json:"allowedOrigins"`
}

// handleSetup stores the Jellyfin connection on first run. It requires the
// one-time code printed to the log, and is closed once configured.
func (s *Server) handleSetup(w http.ResponseWriter, r *http.Request) {
	settings, err := s.settings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if settings.Configured() || s.setupCode == "" {
		writeError(w, http.StatusConflict, "already configured; change settings as an administrator")
		return
	}
	var req setupRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if subtle.ConstantTimeCompare([]byte(strings.TrimSpace(req.Code)), []byte(s.setupCode)) != 1 {
		writeError(w, http.StatusForbidden, "wrong setup code")
		return
	}
	baseURL, ok := config.NormalizeBaseURL(req.JellyfinURL)
	if !ok || strings.TrimSpace(req.APIKey) == "" {
		writeError(w, http.StatusBadRequest, "a valid Jellyfin URL and API key are required")
		return
	}
	info, err := jellyfin.New(baseURL, strings.TrimSpace(req.APIKey)).SystemInfo(r.Context())
	if err != nil {
		writeError(w, http.StatusBadRequest, "Jellyfin did not accept this URL and API key")
		return
	}
	values := map[string]string{config.KeyJellyfinURL: baseURL, config.KeyJellyfinAPIKey: strings.TrimSpace(req.APIKey)}
	if origins := config.SplitOrigins(req.AllowedOrigins); len(origins) > 0 {
		values[config.KeyAllowedOrigins] = strings.Join(origins, ",")
	}
	if err := s.store.SetSettings(r.Context(), values); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save settings")
		return
	}
	s.log.Info("setup complete", "server", info.ServerName, "version", info.Version)
	writeJSON(w, http.StatusOK, map[string]string{"serverName": info.ServerName, "version": info.Version})
}

// ---- admin: settings ----

type settingsView struct {
	JellyfinURL           string          `json:"jellyfinUrl"`
	JellyfinAPIKeySet     bool            `json:"jellyfinApiKeySet"`
	PublicURL             string          `json:"publicUrl"`
	AllowedOrigins        []string        `json:"allowedOrigins"`
	GoogleClientID        string          `json:"googleClientId"`
	GoogleClientSecretSet bool            `json:"googleClientSecretSet"`
	SessionHours          int             `json:"googleSessionHours"`
	LockedByEnvironment   map[string]bool `json:"lockedByEnvironment"`
}

func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := s.settings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	writeJSON(w, http.StatusOK, settingsView{
		JellyfinURL:           settings.JellyfinURL,
		JellyfinAPIKeySet:     settings.JellyfinAPIKey != "",
		PublicURL:             settings.PublicURL,
		AllowedOrigins:        append([]string{}, settings.AllowedOrigins...),
		GoogleClientID:        settings.GoogleClientID,
		GoogleClientSecretSet: settings.GoogleClientSecret != "",
		SessionHours:          settings.SessionHours,
		LockedByEnvironment:   settings.FromEnv,
	})
}

// settingsUpdate uses pointers: nil leaves a value unchanged; secrets are write-only.
type settingsUpdate struct {
	JellyfinURL        *string   `json:"jellyfinUrl"`
	JellyfinAPIKey     *string   `json:"jellyfinApiKey"`
	PublicURL          *string   `json:"publicUrl"`
	AllowedOrigins     *[]string `json:"allowedOrigins"`
	GoogleClientID     *string   `json:"googleClientId"`
	GoogleClientSecret *string   `json:"googleClientSecret"`
	SessionHours       *int      `json:"googleSessionHours"`
}

func (s *Server) handlePutSettings(w http.ResponseWriter, r *http.Request) {
	var req settingsUpdate
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	values := map[string]string{}
	if req.JellyfinURL != nil {
		url, ok := config.NormalizeBaseURL(*req.JellyfinURL)
		if !ok {
			writeError(w, http.StatusBadRequest, "invalid Jellyfin URL")
			return
		}
		values[config.KeyJellyfinURL] = url
	}
	if req.JellyfinAPIKey != nil && strings.TrimSpace(*req.JellyfinAPIKey) != "" {
		values[config.KeyJellyfinAPIKey] = strings.TrimSpace(*req.JellyfinAPIKey)
	}
	if req.PublicURL != nil {
		if strings.TrimSpace(*req.PublicURL) == "" {
			values[config.KeyPublicURL] = ""
		} else if url, ok := config.NormalizeBaseURL(*req.PublicURL); ok {
			values[config.KeyPublicURL] = url
		} else {
			writeError(w, http.StatusBadRequest, "invalid public URL")
			return
		}
	}
	if req.AllowedOrigins != nil {
		values[config.KeyAllowedOrigins] = strings.Join(config.SplitOrigins(strings.Join(*req.AllowedOrigins, ",")), ",")
	}
	if req.GoogleClientID != nil {
		values[config.KeyGoogleClientID] = strings.TrimSpace(*req.GoogleClientID)
	}
	if req.GoogleClientSecret != nil {
		values[config.KeyGoogleClientSecret] = strings.TrimSpace(*req.GoogleClientSecret)
	}
	if req.SessionHours != nil {
		if *req.SessionHours < 1 || *req.SessionHours > 24*30 {
			writeError(w, http.StatusBadRequest, "session lifetime must be between 1 hour and 30 days")
			return
		}
		values[config.KeySessionHours] = strconv.Itoa(*req.SessionHours)
	}
	settings, err := s.settings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	for key := range values {
		if settings.FromEnv[key] {
			writeError(w, http.StatusConflict, key+" is set by an environment variable and cannot be changed here")
			return
		}
	}
	// Never lock out the Jellyfin connection with a bad key.
	if _, changingURL := values[config.KeyJellyfinURL]; changingURL || values[config.KeyJellyfinAPIKey] != "" {
		url, key := settings.JellyfinURL, settings.JellyfinAPIKey
		if v, ok := values[config.KeyJellyfinURL]; ok {
			url = v
		}
		if v := values[config.KeyJellyfinAPIKey]; v != "" {
			key = v
		}
		if _, err := jellyfin.New(url, key).SystemInfo(r.Context()); err != nil {
			writeError(w, http.StatusBadRequest, "Jellyfin did not accept this URL and API key")
			return
		}
	}
	if err := s.store.SetSettings(r.Context(), values); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save settings")
		return
	}
	s.log.Info("settings changed", "by", userFrom(r.Context()).Name, "keys", keysOf(values))
	s.handleGetSettings(w, r)
}

func keysOf(values map[string]string) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	return keys
}

// ---- admin: Google allowlist ----

func (s *Server) handleListAllowlist(w http.ResponseWriter, r *http.Request) {
	entries, err := s.store.AllowedAdmins(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load the allowlist")
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

func (s *Server) handlePutAllowlist(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email          string `json:"email"`
		JellyfinUserID string `json:"jellyfinUserId"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if !strings.Contains(email, "@") || req.JellyfinUserID == "" {
		writeError(w, http.StatusBadRequest, "an email address and a Jellyfin user are required")
		return
	}
	settings, err := s.settings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	target, err := s.jellyfin(settings).UserByID(r.Context(), req.JellyfinUserID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "that Jellyfin user does not exist")
		return
	}
	if !target.Policy.IsAdministrator {
		writeError(w, http.StatusBadRequest, "only Jellyfin administrators can be linked to Google sign-in")
		return
	}
	if err := s.store.SetAllowedAdmin(r.Context(), email, target.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save")
		return
	}
	s.log.Info("allowlist updated", "by", userFrom(r.Context()).Name, "jellyfinUser", target.Name)
	s.handleListAllowlist(w, r)
}

func (s *Server) handleDeleteAllowlist(w http.ResponseWriter, r *http.Request) {
	err := s.store.RemoveAllowedAdmin(r.Context(), strings.ToLower(r.PathValue("email")))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not on the allowlist")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not remove")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- admin: announcements ----

func (s *Server) handleListAnnouncements(w http.ResponseWriter, r *http.Request) {
	announcements, err := s.store.Announcements(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load announcements")
		return
	}
	writeJSON(w, http.StatusOK, announcements)
}

func (s *Server) handleSaveAnnouncement(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Message  string     `json:"message"`
		Tone     string     `json:"tone"`
		StartsAt *time.Time `json:"startsAt"`
		EndsAt   *time.Time `json:"endsAt"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	message := strings.TrimSpace(req.Message)
	if message == "" || len(message) > 500 {
		writeError(w, http.StatusBadRequest, "the message must be 1–500 characters")
		return
	}
	if req.Tone == "" {
		req.Tone = "info"
	}
	if req.Tone != "info" && req.Tone != "warning" && req.Tone != "success" {
		writeError(w, http.StatusBadRequest, "tone must be info, warning or success")
		return
	}
	if req.StartsAt != nil && req.EndsAt != nil && !req.EndsAt.After(*req.StartsAt) {
		writeError(w, http.StatusBadRequest, "the end must be after the start")
		return
	}
	announcement := store.Announcement{Message: message, Tone: req.Tone, StartsAt: req.StartsAt, EndsAt: req.EndsAt, CreatedBy: userFrom(r.Context()).Name}
	if raw := r.PathValue("id"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid id")
			return
		}
		announcement.ID = id
	}
	id, err := s.store.SaveAnnouncement(r.Context(), announcement)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "announcement not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save the announcement")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int64{"id": id})
}

func (s *Server) handleDeleteAnnouncement(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := s.store.DeleteAnnouncement(r.Context(), id); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "announcement not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
