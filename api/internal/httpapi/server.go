// Package httpapi exposes the Finora API over HTTP (JSON only).
package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/kmmuntasir/finora/api/internal/config"
	"github.com/kmmuntasir/finora/api/internal/jellyfin"
	"github.com/kmmuntasir/finora/api/internal/store"
)

// Server holds the API's dependencies.
type Server struct {
	store     *store.Store
	log       *slog.Logger
	setupCode string
	google    GoogleAuthFactory
	limiter   *rateLimiter
	users     *userCache
	now       func() time.Time
}

// Options configures a Server.
type Options struct {
	Store     *store.Store
	Logger    *slog.Logger
	SetupCode string
	// Google builds the Google sign-in client from current settings; nil uses the real one.
	Google GoogleAuthFactory
}

// New creates a server.
func New(opts Options) *Server {
	google := opts.Google
	if google == nil {
		google = newGoogleAuth
	}
	return &Server{
		store:     opts.Store,
		log:       opts.Logger,
		setupCode: opts.SetupCode,
		google:    google,
		limiter:   newRateLimiter(10, time.Minute),
		users:     newUserCache(time.Minute),
		now:       time.Now,
	}
}

func (s *Server) settings(ctx context.Context) (config.Settings, error) {
	return config.Resolve(ctx, s.store)
}

func (s *Server) jellyfin(settings config.Settings) *jellyfin.Client {
	return jellyfin.New(settings.JellyfinURL, settings.JellyfinAPIKey)
}

// Handler returns the routed, middleware-wrapped HTTP handler.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.handleHealth)
	mux.HandleFunc("GET /api/v1/public/config", s.handlePublicConfig)
	mux.HandleFunc("GET /api/v1/announcements", s.handleActiveAnnouncements)
	mux.HandleFunc("POST /api/v1/setup", s.limited(s.handleSetup))

	mux.HandleFunc("GET /api/v1/auth/google/start", s.limited(s.handleGoogleStart))
	mux.HandleFunc("GET /api/v1/auth/google/callback", s.handleGoogleCallback)
	mux.HandleFunc("POST /api/v1/auth/google/confirm", s.requireUser(s.handleGoogleConfirm))
	mux.HandleFunc("GET /api/v1/auth/session", s.requireUser(s.handleSession))

	mux.HandleFunc("GET /api/v1/admin/settings", s.requireAdmin(s.handleGetSettings))
	mux.HandleFunc("PUT /api/v1/admin/settings", s.requireAdmin(s.handlePutSettings))
	mux.HandleFunc("GET /api/v1/admin/allowlist", s.requireAdmin(s.handleListAllowlist))
	mux.HandleFunc("PUT /api/v1/admin/allowlist", s.requireAdmin(s.handlePutAllowlist))
	mux.HandleFunc("DELETE /api/v1/admin/allowlist/{email}", s.requireAdmin(s.handleDeleteAllowlist))
	mux.HandleFunc("GET /api/v1/admin/announcements", s.requireAdmin(s.handleListAnnouncements))
	mux.HandleFunc("POST /api/v1/admin/announcements", s.requireAdmin(s.handleSaveAnnouncement))
	mux.HandleFunc("PUT /api/v1/admin/announcements/{id}", s.requireAdmin(s.handleSaveAnnouncement))
	mux.HandleFunc("DELETE /api/v1/admin/announcements/{id}", s.requireAdmin(s.handleDeleteAnnouncement))

	return s.recoverer(s.cors(mux))
}

// ---- middleware ----

func (s *Server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				s.log.Error("panic", "path", r.URL.Path, "error", recovered)
				writeError(w, http.StatusInternalServerError, "internal error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// cors allows only configured Finora Web origins. Requests carry tokens in the
// Authorization header; no cookies are used.
func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			settings, err := s.settings(r.Context())
			allowed := err == nil && (settings.OriginAllowed(origin) || (!settings.Configured() && isLoopbackOrigin(origin)))
			if allowed {
				h := w.Header()
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				h.Set("Access-Control-Max-Age", "600")
				h.Add("Vary", "Origin")
			}
			if r.Method == http.MethodOptions {
				if allowed {
					w.WriteHeader(http.StatusNoContent)
				} else {
					w.WriteHeader(http.StatusForbidden)
				}
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) limited(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.limiter.allow(clientIP(r)) {
			writeError(w, http.StatusTooManyRequests, "too many attempts; try again in a minute")
			return
		}
		next(w, r)
	}
}

// ---- helpers ----

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func readJSON(r *http.Request, out any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 64<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(out); err != nil {
		return errors.New("invalid JSON body")
	}
	return nil
}

func randomToken(bytes int) string {
	buf := make([]byte, bytes)
	if _, err := rand.Read(buf); err != nil {
		panic(err)
	}
	return hex.EncodeToString(buf)
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func isLoopbackOrigin(origin string) bool {
	normalized, ok := config.NormalizeOrigin(origin)
	if !ok {
		return false
	}
	host := strings.TrimPrefix(strings.TrimPrefix(normalized, "http://"), "https://")
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	host = strings.Trim(host, "[]")
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// secureOrigin mirrors the browser's secure-context rule: HTTPS, or loopback.
func secureOrigin(origin string) bool {
	return strings.HasPrefix(strings.ToLower(origin), "https://") || isLoopbackOrigin(origin)
}

// ---- rate limiting ----

type rateLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	hits   map[string][]time.Time
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{limit: limit, window: window, hits: map[string][]time.Time{}}
}

func (l *rateLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	cutoff := time.Now().Add(-l.window)
	recent := l.hits[key][:0]
	for _, hit := range l.hits[key] {
		if hit.After(cutoff) {
			recent = append(recent, hit)
		}
	}
	if len(recent) >= l.limit {
		l.hits[key] = recent
		return false
	}
	l.hits[key] = append(recent, time.Now())
	return true
}
