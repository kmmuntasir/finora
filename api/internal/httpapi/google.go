package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"github.com/kmmuntasir/finora/api/internal/config"
	"github.com/kmmuntasir/finora/api/internal/store"
)

// GoogleIdentity is the verified result of a Google sign-in.
type GoogleIdentity struct {
	Email         string
	EmailVerified bool
}

// GoogleAuth abstracts Google's OAuth/OIDC so tests can replace it.
type GoogleAuth interface {
	AuthCodeURL(state, verifier string) string
	Exchange(ctx context.Context, code, verifier string) (GoogleIdentity, error)
}

// GoogleAuthFactory builds a GoogleAuth from the current settings.
type GoogleAuthFactory func(ctx context.Context, settings config.Settings) (GoogleAuth, error)

type realGoogleAuth struct {
	oauth    *oauth2.Config
	verifier *oidc.IDTokenVerifier
}

var (
	providerOnce sync.Once
	provider     *oidc.Provider
	providerErr  error
)

func newGoogleAuth(ctx context.Context, settings config.Settings) (GoogleAuth, error) {
	providerOnce.Do(func() {
		provider, providerErr = oidc.NewProvider(context.WithoutCancel(ctx), "https://accounts.google.com")
	})
	if providerErr != nil {
		providerOnce = sync.Once{} // retry next time
		return nil, providerErr
	}
	return &realGoogleAuth{
		oauth: &oauth2.Config{
			ClientID:     settings.GoogleClientID,
			ClientSecret: settings.GoogleClientSecret,
			Endpoint:     google.Endpoint,
			RedirectURL:  settings.PublicURL + "/api/v1/auth/google/callback",
			Scopes:       []string{oidc.ScopeOpenID, "email"},
		},
		verifier: provider.Verifier(&oidc.Config{ClientID: settings.GoogleClientID}),
	}, nil
}

func (g *realGoogleAuth) AuthCodeURL(state, verifier string) string {
	return g.oauth.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier), oauth2.SetAuthURLParam("prompt", "select_account"))
}

func (g *realGoogleAuth) Exchange(ctx context.Context, code, verifier string) (GoogleIdentity, error) {
	token, err := g.oauth.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return GoogleIdentity{}, fmt.Errorf("exchange: %w", err)
	}
	raw, ok := token.Extra("id_token").(string)
	if !ok {
		return GoogleIdentity{}, errors.New("no ID token in Google's response")
	}
	idToken, err := g.verifier.Verify(ctx, raw)
	if err != nil {
		return GoogleIdentity{}, fmt.Errorf("verify ID token: %w", err)
	}
	var claims struct {
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return GoogleIdentity{}, err
	}
	return GoogleIdentity{Email: strings.ToLower(claims.Email), EmailVerified: claims.EmailVerified}, nil
}

var quickConnectCode = regexp.MustCompile(`^\d{6}$`)

const (
	stateLifetime = 10 * time.Minute
	grantLifetime = 5 * time.Minute
)

// redirectWithResult sends the browser back to Finora Web with an outcome.
func redirectWithResult(w http.ResponseWriter, r *http.Request, returnURL string, params url.Values) {
	target, err := url.Parse(returnURL)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid return address")
		return
	}
	query := target.Query()
	for key, values := range params {
		query[key] = values
	}
	target.RawQuery = query.Encode()
	http.Redirect(w, r, target.String(), http.StatusFound)
}

// handleGoogleStart begins Google sign-in for a pending Quick Connect code.
func (s *Server) handleGoogleStart(w http.ResponseWriter, r *http.Request) {
	settings, err := s.settings(r.Context())
	if err != nil || !settings.Configured() || !settings.GoogleEnabled() {
		writeError(w, http.StatusNotFound, "Google sign-in is not set up")
		return
	}
	code := r.URL.Query().Get("code")
	returnURL := r.URL.Query().Get("return")
	origin, ok := config.NormalizeOrigin(returnURL)
	if !ok || !settings.OriginAllowed(origin) {
		writeError(w, http.StatusBadRequest, "return address is not an allowed Finora Web origin")
		return
	}
	if !quickConnectCode.MatchString(code) {
		redirectWithResult(w, r, returnURL, url.Values{"google": {"error"}, "reason": {"bad-request"}})
		return
	}
	auth, err := s.google(r.Context(), settings)
	if err != nil {
		s.log.Error("google provider", "error", err)
		redirectWithResult(w, r, returnURL, url.Values{"google": {"error"}, "reason": {"unavailable"}})
		return
	}
	state := randomToken(24)
	verifier := oauth2.GenerateVerifier()
	if err := s.store.SaveOAuthState(r.Context(), store.OAuthState{
		State: state, QCCode: code, ReturnURL: returnURL, Verifier: verifier, ExpiresAt: s.now().Add(stateLifetime),
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "could not start sign-in")
		return
	}
	http.Redirect(w, r, auth.AuthCodeURL(state, verifier), http.StatusFound)
}

// handleGoogleCallback verifies the Google account and approves the Quick
// Connect code for the linked Jellyfin admin.
func (s *Server) handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	pending, err := s.store.TakeOAuthState(r.Context(), query.Get("state"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "this sign-in link has expired; start again from Finora")
		return
	}
	fail := func(reason string) {
		redirectWithResult(w, r, pending.ReturnURL, url.Values{"google": {"error"}, "reason": {reason}})
	}
	if query.Get("error") != "" {
		fail("cancelled")
		return
	}
	settings, err := s.settings(r.Context())
	if err != nil || !settings.GoogleEnabled() {
		fail("unavailable")
		return
	}
	auth, err := s.google(r.Context(), settings)
	if err != nil {
		fail("unavailable")
		return
	}
	identity, err := auth.Exchange(r.Context(), query.Get("code"), pending.Verifier)
	if err != nil {
		s.log.Warn("google exchange failed", "error", err)
		fail("google")
		return
	}
	if !identity.EmailVerified {
		fail("not-allowed")
		return
	}
	entry, err := s.store.AllowedAdmin(r.Context(), identity.Email)
	if err != nil {
		s.log.Warn("google sign-in refused: not on allowlist")
		fail("not-allowed")
		return
	}
	client := s.jellyfin(settings)
	user, err := client.UserByID(r.Context(), entry.JellyfinUserID)
	if err != nil || !user.Policy.IsAdministrator || user.Policy.IsDisabled {
		fail("not-allowed")
		return
	}
	if err := client.AuthorizeQuickConnect(r.Context(), pending.QCCode, user.ID); err != nil {
		s.log.Warn("quick connect approval failed", "error", err)
		fail("code-expired")
		return
	}
	if err := s.store.SaveGoogleGrant(r.Context(), store.GoogleGrant{
		QCCode: pending.QCCode, JellyfinUserID: user.ID, Email: identity.Email, ExpiresAt: s.now().Add(grantLifetime),
	}); err != nil {
		fail("unavailable")
		return
	}
	s.log.Info("google sign-in approved", "jellyfinUser", user.Name)
	redirectWithResult(w, r, pending.ReturnURL, url.Values{"google": {"ok"}})
}

// handleGoogleConfirm links the new Jellyfin session to the Google sign-in so
// it is treated as a Google session and revoked when its lifetime ends.
func (s *Server) handleGoogleConfirm(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code     string `json:"code"`
		DeviceID string `json:"deviceId"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	user := userFrom(r.Context())
	grant, err := s.store.TakeGoogleGrant(r.Context(), req.Code, user.ID)
	if err != nil {
		writeError(w, http.StatusForbidden, "no matching Google sign-in")
		return
	}
	settings, err := s.settings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	owned, err := s.jellyfin(settings).DeviceBelongsTo(r.Context(), req.DeviceID, user.ID)
	if err != nil || !owned {
		writeError(w, http.StatusBadRequest, "this device does not belong to the signed-in user")
		return
	}
	expires := s.now().Add(time.Duration(settings.SessionHours) * time.Hour)
	if err := s.store.SaveGoogleSession(r.Context(), store.GoogleSession{
		DeviceID: req.DeviceID, JellyfinUserID: user.ID, Email: grant.Email, TokenHash: tokenHashFrom(r.Context()), ExpiresAt: expires,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "could not record the session")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"google": true, "email": grant.Email, "expiresAt": expires.UTC()})
}

func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) {
	session, err := s.store.ActiveGoogleSessionByToken(r.Context(), tokenHashFrom(r.Context()))
	if errors.Is(err, store.ErrNotFound) {
		writeJSON(w, http.StatusOK, map[string]any{"google": false})
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"google": true, "email": session.Email, "expiresAt": session.ExpiresAt.UTC()})
}

// RunJanitor revokes expired Google sessions in Jellyfin and purges stale
// sign-in records, once a minute until ctx ends.
func (s *Server) RunJanitor(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		s.sweep(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *Server) sweep(ctx context.Context) {
	s.checkOSActivity(ctx)
	if err := s.store.PurgeExpired(ctx); err != nil {
		s.log.Warn("purge failed", "error", err)
	}
	expired, err := s.store.ExpiredGoogleSessions(ctx)
	if err != nil || len(expired) == 0 {
		return
	}
	settings, err := s.settings(ctx)
	if err != nil || !settings.Configured() {
		return
	}
	client := s.jellyfin(settings)
	for _, session := range expired {
		if err := client.DeleteDevice(ctx, session.DeviceID); err != nil {
			s.log.Warn("could not revoke Google session", "error", err)
			continue
		}
		_ = s.store.MarkGoogleSessionRevoked(ctx, session.DeviceID)
		s.log.Info("revoked expired Google session")
	}
}
