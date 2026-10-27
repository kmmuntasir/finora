// Package config resolves Finora API settings: environment variables override
// values saved in the database, so containers can be configured declaratively.
package config

import (
	"context"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/kmmuntasir/finora/api/internal/store"
)

// Setting keys in the database and their environment variable overrides.
const (
	KeyJellyfinURL        = "jellyfin_url"
	KeyJellyfinAPIKey     = "jellyfin_api_key"
	KeyPublicURL          = "public_url"
	KeyAllowedOrigins     = "allowed_origins"
	KeyGoogleClientID     = "google_client_id"
	KeyGoogleClientSecret = "google_client_secret"
	KeySessionHours       = "google_session_hours"
)

var envNames = map[string]string{
	KeyJellyfinURL:        "FINORA_JELLYFIN_URL",
	KeyJellyfinAPIKey:     "FINORA_JELLYFIN_API_KEY",
	KeyPublicURL:          "FINORA_PUBLIC_URL",
	KeyAllowedOrigins:     "FINORA_ALLOWED_ORIGINS",
	KeyGoogleClientID:     "FINORA_GOOGLE_CLIENT_ID",
	KeyGoogleClientSecret: "FINORA_GOOGLE_CLIENT_SECRET",
	KeySessionHours:       "FINORA_GOOGLE_SESSION_HOURS",
}

// Settings is a resolved snapshot.
type Settings struct {
	JellyfinURL        string
	JellyfinAPIKey     string
	PublicURL          string
	AllowedOrigins     []string
	GoogleClientID     string
	GoogleClientSecret string
	SessionHours       int
	// FromEnv lists keys fixed by environment variables (not editable in the UI).
	FromEnv map[string]bool
}

// Configured reports whether the API can talk to Jellyfin.
func (s Settings) Configured() bool { return s.JellyfinURL != "" && s.JellyfinAPIKey != "" }

// GoogleEnabled reports whether Google sign-in can work.
func (s Settings) GoogleEnabled() bool {
	return s.GoogleClientID != "" && s.GoogleClientSecret != "" && strings.HasPrefix(s.PublicURL, "https://")
}

// OriginAllowed reports whether a browser origin may call the API.
func (s Settings) OriginAllowed(origin string) bool {
	for _, allowed := range s.AllowedOrigins {
		if strings.EqualFold(allowed, origin) {
			return true
		}
	}
	return false
}

// Resolve reads settings from the environment and the store.
func Resolve(ctx context.Context, st *store.Store) (Settings, error) {
	values := map[string]string{}
	fromEnv := map[string]bool{}
	for key, env := range envNames {
		if value, ok := os.LookupEnv(env); ok && strings.TrimSpace(value) != "" {
			values[key] = strings.TrimSpace(value)
			fromEnv[key] = true
			continue
		}
		value, err := st.Setting(ctx, key)
		if err != nil {
			return Settings{}, err
		}
		values[key] = value
	}
	hours, err := strconv.Atoi(values[KeySessionHours])
	if err != nil || hours <= 0 {
		hours = 12
	}
	return Settings{
		JellyfinURL:        strings.TrimRight(values[KeyJellyfinURL], "/"),
		JellyfinAPIKey:     values[KeyJellyfinAPIKey],
		PublicURL:          strings.TrimRight(values[KeyPublicURL], "/"),
		AllowedOrigins:     SplitOrigins(values[KeyAllowedOrigins]),
		GoogleClientID:     values[KeyGoogleClientID],
		GoogleClientSecret: values[KeyGoogleClientSecret],
		SessionHours:       hours,
		FromEnv:            fromEnv,
	}, nil
}

// SplitOrigins parses a comma-separated origin list, normalising each entry.
func SplitOrigins(raw string) []string {
	var origins []string
	for _, part := range strings.Split(raw, ",") {
		if origin, ok := NormalizeOrigin(part); ok {
			origins = append(origins, origin)
		}
	}
	return origins
}

// NormalizeOrigin reduces a URL to scheme://host[:port].
func NormalizeOrigin(raw string) (string, bool) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return "", false
	}
	return strings.ToLower(parsed.Scheme + "://" + parsed.Host), true
}

// NormalizeBaseURL validates an http(s) base URL and drops trailing slashes.
func NormalizeBaseURL(raw string) (string, bool) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.User != nil {
		return "", false
	}
	parsed.RawQuery, parsed.Fragment = "", ""
	return strings.TrimRight(parsed.String(), "/"), true
}
