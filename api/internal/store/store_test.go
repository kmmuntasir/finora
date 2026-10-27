package store

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"
)

func open(t *testing.T) *Store {
	t.Helper()
	s, err := Open(context.Background(), filepath.Join(t.TempDir(), "finora.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

func TestMigrationsAreIdempotent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "finora.db")
	for i := 0; i < 2; i++ {
		s, err := Open(context.Background(), path)
		if err != nil {
			t.Fatalf("open %d: %v", i, err)
		}
		_ = s.Close()
	}
}

func TestSettings(t *testing.T) {
	ctx := context.Background()
	s := open(t)
	if err := s.SetSettings(ctx, map[string]string{"a": "1", "b": "2"}); err != nil {
		t.Fatal(err)
	}
	if v, _ := s.Setting(ctx, "a"); v != "1" {
		t.Fatalf("a = %q", v)
	}
	if err := s.SetSettings(ctx, map[string]string{"a": ""}); err != nil {
		t.Fatal(err)
	}
	if v, _ := s.Setting(ctx, "a"); v != "" {
		t.Fatalf("a should be deleted, got %q", v)
	}
}

func TestAnnouncementsRespectSchedule(t *testing.T) {
	ctx := context.Background()
	s := open(t)
	past := time.Now().Add(-time.Hour)
	future := time.Now().Add(time.Hour)
	for _, a := range []Announcement{
		{Message: "always", Tone: "info", CreatedBy: "x"},
		{Message: "expired", Tone: "info", EndsAt: &past, CreatedBy: "x"},
		{Message: "upcoming", Tone: "warning", StartsAt: &future, CreatedBy: "x"},
	} {
		if _, err := s.SaveAnnouncement(ctx, a); err != nil {
			t.Fatal(err)
		}
	}
	at := time.Now()
	active, err := s.Announcements(ctx, &at)
	if err != nil {
		t.Fatal(err)
	}
	if len(active) != 1 || active[0].Message != "always" {
		t.Fatalf("active = %+v", active)
	}
	all, _ := s.Announcements(ctx, nil)
	if len(all) != 3 {
		t.Fatalf("all = %d", len(all))
	}
	if err := s.DeleteAnnouncement(ctx, 999); !errors.Is(err, ErrNotFound) {
		t.Fatalf("delete missing: %v", err)
	}
}

func TestOAuthStateIsSingleUse(t *testing.T) {
	ctx := context.Background()
	s := open(t)
	st := OAuthState{State: "s1", QCCode: "123456", ReturnURL: "http://x/cb", Verifier: "v", ExpiresAt: time.Now().Add(time.Minute)}
	if err := s.SaveOAuthState(ctx, st); err != nil {
		t.Fatal(err)
	}
	got, err := s.TakeOAuthState(ctx, "s1")
	if err != nil || got.QCCode != "123456" || got.Verifier != "v" {
		t.Fatalf("take: %+v %v", got, err)
	}
	if _, err := s.TakeOAuthState(ctx, "s1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("second take should fail: %v", err)
	}
	expired := OAuthState{State: "s2", QCCode: "1", ReturnURL: "x", ExpiresAt: time.Now().Add(-time.Minute)}
	_ = s.SaveOAuthState(ctx, expired)
	if _, err := s.TakeOAuthState(ctx, "s2"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expired state accepted: %v", err)
	}
}

func TestGoogleSessionLifecycle(t *testing.T) {
	ctx := context.Background()
	s := open(t)
	g := GoogleSession{DeviceID: "d1", JellyfinUserID: "u1", Email: "a@example.com", ExpiresAt: time.Now().Add(time.Hour)}
	if err := s.SaveGoogleSession(ctx, g); err != nil {
		t.Fatal(err)
	}
	if _, err := s.BindGoogleSessionToken(ctx, "d1", "someone-else", "h"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("bound to the wrong user: %v", err)
	}
	if _, err := s.BindGoogleSessionToken(ctx, "d1", "u1", "hash1"); err != nil {
		t.Fatal(err)
	}
	if got, err := s.ActiveGoogleSessionByToken(ctx, "hash1"); err != nil || got.Email != "a@example.com" {
		t.Fatalf("lookup: %+v %v", got, err)
	}
	old := GoogleSession{DeviceID: "d2", JellyfinUserID: "u1", Email: "a@example.com", ExpiresAt: time.Now().Add(-time.Minute)}
	_ = s.SaveGoogleSession(ctx, old)
	expired, _ := s.ExpiredGoogleSessions(ctx)
	if len(expired) != 1 || expired[0].DeviceID != "d2" {
		t.Fatalf("expired = %+v", expired)
	}
	_ = s.MarkGoogleSessionRevoked(ctx, "d2")
	if expired, _ = s.ExpiredGoogleSessions(ctx); len(expired) != 0 {
		t.Fatalf("revoked session still listed")
	}
}

func TestAllowlistIsCaseInsensitive(t *testing.T) {
	ctx := context.Background()
	s := open(t)
	if err := s.SetAllowedAdmin(ctx, " Admin@Example.com ", "u1"); err != nil {
		t.Fatal(err)
	}
	got, err := s.AllowedAdmin(ctx, "ADMIN@example.COM")
	if err != nil || got.JellyfinUserID != "u1" {
		t.Fatalf("lookup: %+v %v", got, err)
	}
}

func TestGoogleGrantMustMatchUser(t *testing.T) {
	ctx := context.Background()
	s := open(t)
	_ = s.SaveGoogleGrant(ctx, GoogleGrant{QCCode: "111111", JellyfinUserID: "u1", Email: "a@example.com", ExpiresAt: time.Now().Add(time.Minute)})
	if _, err := s.TakeGoogleGrant(ctx, "111111", "u2"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("grant redeemed by the wrong user: %v", err)
	}
	if g, err := s.TakeGoogleGrant(ctx, "111111", "u1"); err != nil || g.Email != "a@example.com" {
		t.Fatalf("take: %+v %v", g, err)
	}
	if _, err := s.TakeGoogleGrant(ctx, "111111", "u1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("grant reused: %v", err)
	}
}
