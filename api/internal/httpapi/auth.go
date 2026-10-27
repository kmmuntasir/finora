package httpapi

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/kmmuntasir/finora/api/internal/jellyfin"
	"github.com/kmmuntasir/finora/api/internal/store"
)

type contextKey int

const (
	userKey contextKey = iota
	tokenHashKey
)

var mediaBrowserToken = regexp.MustCompile(`(?i)token="([^"]+)"`)

// bearerToken extracts the Jellyfin access token from "Bearer x" or a
// Jellyfin-style "MediaBrowser … Token="x"" header.
func bearerToken(r *http.Request) string {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if after, ok := strings.CutPrefix(header, "Bearer "); ok {
		return strings.TrimSpace(after)
	}
	if match := mediaBrowserToken.FindStringSubmatch(header); match != nil {
		return match[1]
	}
	return ""
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

type cachedUser struct {
	user    jellyfin.User
	expires time.Time
}

// userCache avoids asking Jellyfin to validate the same token on every request.
type userCache struct {
	mu    sync.Mutex
	ttl   time.Duration
	users map[string]cachedUser
}

func newUserCache(ttl time.Duration) *userCache {
	return &userCache{ttl: ttl, users: map[string]cachedUser{}}
}

func (c *userCache) get(hash string) (jellyfin.User, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.users[hash]
	if !ok || time.Now().After(entry.expires) {
		delete(c.users, hash)
		return jellyfin.User{}, false
	}
	return entry.user, true
}

func (c *userCache) put(hash string, user jellyfin.User) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.users[hash] = cachedUser{user: user, expires: time.Now().Add(c.ttl)}
}

func userFrom(ctx context.Context) jellyfin.User {
	user, _ := ctx.Value(userKey).(jellyfin.User)
	return user
}

func tokenHashFrom(ctx context.Context) string {
	hash, _ := ctx.Value(tokenHashKey).(string)
	return hash
}

// requireUser validates the caller's Jellyfin token with Jellyfin itself.
func (s *Server) requireUser(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r)
		if token == "" {
			writeError(w, http.StatusUnauthorized, "sign in required")
			return
		}
		settings, err := s.settings(r.Context())
		if err != nil || !settings.Configured() {
			writeError(w, http.StatusServiceUnavailable, "the Finora API is not configured yet")
			return
		}
		hash := hashToken(token)
		user, ok := s.users.get(hash)
		if !ok {
			user, err = s.jellyfin(settings).CurrentUser(r.Context(), token)
			if errors.Is(err, jellyfin.ErrUnauthorized) {
				writeError(w, http.StatusUnauthorized, "your session has ended")
				return
			}
			if err != nil {
				s.log.Warn("token check failed", "error", err)
				writeError(w, http.StatusBadGateway, "could not reach Jellyfin")
				return
			}
			s.users.put(hash, user)
		}
		if user.Policy.IsDisabled {
			writeError(w, http.StatusForbidden, "this account is disabled")
			return
		}
		ctx := context.WithValue(context.WithValue(r.Context(), userKey, user), tokenHashKey, hash)
		next(w, r.WithContext(ctx))
	}
}

// requireAdmin allows Jellyfin administrators. Calls from a non-secure page
// (plain HTTP, not localhost) must use a session created through Google
// sign-in, so admin passwords never cross the network unencrypted
// (decision 0004).
func (s *Server) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return s.requireUser(func(w http.ResponseWriter, r *http.Request) {
		user := userFrom(r.Context())
		if !user.Policy.IsAdministrator {
			writeError(w, http.StatusForbidden, "administrators only")
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" && !secureOrigin(origin) {
			_, err := s.store.ActiveGoogleSessionByToken(r.Context(), tokenHashFrom(r.Context()))
			if errors.Is(err, store.ErrNotFound) {
				writeError(w, http.StatusForbidden, "over an unencrypted connection, sign in with Google to use admin features")
				return
			}
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal error")
				return
			}
		}
		next(w, r)
	})
}
