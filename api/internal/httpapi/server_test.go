package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kmmuntasir/finora/api/internal/config"
	"github.com/kmmuntasir/finora/api/internal/store"
)

// fakeJellyfin implements the handful of endpoints the API uses.
type fakeJellyfin struct {
	mu               sync.Mutex
	authorized       []string
	deletedDevices   []string
	deletedSubtitles []string
	*httptest.Server
}

func newFakeJellyfin(t *testing.T) *fakeJellyfin {
	f := &fakeJellyfin{}
	users := map[string]string{
		"admin-token":  `{"Id":"uadmin","Name":"Admin","Policy":{"IsAdministrator":true}}`,
		"viewer-token": `{"Id":"uviewer","Name":"Viewer","Policy":{"IsAdministrator":false}}`,
	}
	byID := map[string]string{
		"uadmin":  users["admin-token"],
		"uviewer": users["viewer-token"],
	}
	mux := http.NewServeMux()
	token := func(r *http.Request) string {
		header := r.Header.Get("Authorization")
		i := strings.Index(header, `Token="`)
		if i < 0 {
			return ""
		}
		rest := header[i+7:]
		return rest[:strings.Index(rest, `"`)]
	}
	mux.HandleFunc("GET /Users/Me", func(w http.ResponseWriter, r *http.Request) {
		body, ok := users[token(r)]
		if !ok {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = io.WriteString(w, body)
	})
	mux.HandleFunc("GET /Users/{id}", func(w http.ResponseWriter, r *http.Request) {
		if token(r) != "api-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		body, ok := byID[r.PathValue("id")]
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_, _ = io.WriteString(w, body)
	})
	mux.HandleFunc("GET /System/Info", func(w http.ResponseWriter, r *http.Request) {
		if token(r) != "api-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = io.WriteString(w, `{"ServerName":"Test","Version":"10.11.11"}`)
	})
	mux.HandleFunc("POST /QuickConnect/Authorize", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.authorized = append(f.authorized, r.URL.Query().Get("code")+":"+r.URL.Query().Get("userId"))
		f.mu.Unlock()
		_, _ = io.WriteString(w, "true")
	})
	mux.HandleFunc("GET /Items", func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `{"Items":[{"Id":"item1","Name":"Movie","Type":"Movie","Path":"/media/Movie.mkv","MediaSources":[{"Id":"ms1","Path":"/media/Movie.mkv","Size":1000,"MediaStreams":[`+
			`{"Index":3,"Type":"Subtitle","IsExternal":true,"Path":"/media/Movie.en.srt"},`+
			`{"Index":4,"Type":"Subtitle","IsExternal":true,"Path":"/media/Movie.eng.srt"}]}]}]}`)
	})
	mux.HandleFunc("DELETE /Videos/{id}/Subtitles/{index}", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.deletedSubtitles = append(f.deletedSubtitles, r.PathValue("id")+"/"+r.PathValue("index"))
		f.mu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /Devices", func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `{"Items":[{"Id":"dev-google","LastUserId":"`+r.URL.Query().Get("userId")+`"}]}`)
	})
	mux.HandleFunc("DELETE /Devices", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.deletedDevices = append(f.deletedDevices, r.URL.Query().Get("id"))
		f.mu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	})
	f.Server = httptest.NewServer(mux)
	t.Cleanup(f.Close)
	return f
}

type fakeGoogle struct{}

func (fakeGoogle) AuthCodeURL(state, _ string) string {
	return "https://accounts.google.test/auth?state=" + state
}

func (fakeGoogle) Exchange(_ context.Context, code, verifier string) (GoogleIdentity, error) {
	if verifier == "" {
		return GoogleIdentity{}, io.ErrUnexpectedEOF
	}
	switch code {
	case "admin":
		return GoogleIdentity{Email: "admin@example.com", EmailVerified: true}, nil
	case "stranger":
		return GoogleIdentity{Email: "stranger@example.com", EmailVerified: true}, nil
	}
	return GoogleIdentity{}, io.ErrUnexpectedEOF
}

type harness struct {
	t        *testing.T
	jellyfin *fakeJellyfin
	store    *store.Store
	server   *Server
	http     *httptest.Server
}

const webOrigin = "http://203.0.113.10:8080"

func newHarness(t *testing.T, configured bool) *harness {
	t.Helper()
	jf := newFakeJellyfin(t)
	st, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.Close() })
	if configured {
		if err := st.SetSettings(context.Background(), map[string]string{
			config.KeyJellyfinURL:        jf.URL,
			config.KeyJellyfinAPIKey:     "api-key",
			config.KeyAllowedOrigins:     webOrigin + ",https://finora.example.com",
			config.KeyPublicURL:          "https://api.example.com",
			config.KeyGoogleClientID:     "client",
			config.KeyGoogleClientSecret: "secret",
		}); err != nil {
			t.Fatal(err)
		}
	}
	server := New(Options{
		Store:     st,
		Logger:    slog.New(slog.NewTextHandler(io.Discard, nil)),
		SetupCode: "12345678",
		Google:    func(context.Context, config.Settings) (GoogleAuth, error) { return fakeGoogle{}, nil },
	})
	h := &harness{t: t, jellyfin: jf, store: st, server: server, http: httptest.NewServer(server.Handler())}
	t.Cleanup(h.http.Close)
	return h
}

func (h *harness) request(method, path, token, origin string, body any) *http.Response {
	h.t.Helper()
	var reader io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		reader = bytes.NewReader(raw)
	}
	req, _ := http.NewRequest(method, h.http.URL+path, reader)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	resp, err := client.Do(req)
	if err != nil {
		h.t.Fatal(err)
	}
	h.t.Cleanup(func() { _ = resp.Body.Close() })
	return resp
}

func expectStatus(t *testing.T, resp *http.Response, want int) {
	t.Helper()
	if resp.StatusCode != want {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("%s %s: status %d, want %d: %s", resp.Request.Method, resp.Request.URL.Path, resp.StatusCode, want, body)
	}
}

func TestSetupFlow(t *testing.T) {
	h := newHarness(t, false)
	expectStatus(t, h.request("POST", "/api/v1/setup", "", "", map[string]string{"code": "00000000", "jellyfinUrl": h.jellyfin.URL, "apiKey": "api-key"}), http.StatusForbidden)
	expectStatus(t, h.request("POST", "/api/v1/setup", "", "", map[string]string{"code": "12345678", "jellyfinUrl": h.jellyfin.URL, "apiKey": "wrong"}), http.StatusBadRequest)
	expectStatus(t, h.request("POST", "/api/v1/setup", "", "", map[string]string{"code": "12345678", "jellyfinUrl": h.jellyfin.URL, "apiKey": "api-key", "allowedOrigins": webOrigin}), http.StatusOK)
	expectStatus(t, h.request("POST", "/api/v1/setup", "", "", map[string]string{"code": "12345678", "jellyfinUrl": h.jellyfin.URL, "apiKey": "api-key"}), http.StatusConflict)
}

func TestCORS(t *testing.T) {
	h := newHarness(t, true)
	resp := h.request("OPTIONS", "/api/v1/public/config", "", webOrigin, nil)
	expectStatus(t, resp, http.StatusNoContent)
	if resp.Header.Get("Access-Control-Allow-Origin") != webOrigin {
		t.Fatalf("missing CORS header")
	}
	expectStatus(t, h.request("OPTIONS", "/api/v1/public/config", "", "https://evil.example", nil), http.StatusForbidden)
}

func TestAdminRules(t *testing.T) {
	h := newHarness(t, true)
	expectStatus(t, h.request("GET", "/api/v1/admin/settings", "", "https://finora.example.com", nil), http.StatusUnauthorized)
	expectStatus(t, h.request("GET", "/api/v1/admin/settings", "bogus", "https://finora.example.com", nil), http.StatusUnauthorized)
	expectStatus(t, h.request("GET", "/api/v1/admin/settings", "viewer-token", "https://finora.example.com", nil), http.StatusForbidden)
	resp := h.request("GET", "/api/v1/admin/settings", "admin-token", "https://finora.example.com", nil)
	expectStatus(t, resp, http.StatusOK)
	var view map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&view)
	if view["jellyfinApiKeySet"] != true || view["googleClientSecretSet"] != true {
		t.Fatalf("view = %v", view)
	}
	raw, _ := json.Marshal(view)
	if strings.Contains(string(raw), "api-key") || strings.Contains(string(raw), `"secret"`) {
		t.Fatal("secrets leaked in the settings response")
	}
	// Over plain HTTP from another machine, admins need a Google session.
	expectStatus(t, h.request("GET", "/api/v1/admin/settings", "admin-token", webOrigin, nil), http.StatusForbidden)
	// Localhost counts as secure (development).
	expectStatus(t, h.request("GET", "/api/v1/admin/settings", "admin-token", "http://localhost:5173", nil), http.StatusOK)
}

func TestAnnouncements(t *testing.T) {
	h := newHarness(t, true)
	origin := "https://finora.example.com"
	resp := h.request("POST", "/api/v1/admin/announcements", "admin-token", origin, map[string]any{"message": "Disk upgrade on Friday", "tone": "warning"})
	expectStatus(t, resp, http.StatusOK)
	var created map[string]int64
	_ = json.NewDecoder(resp.Body).Decode(&created)

	resp = h.request("GET", "/api/v1/announcements", "", "", nil)
	expectStatus(t, resp, http.StatusOK)
	var active []store.Announcement
	_ = json.NewDecoder(resp.Body).Decode(&active)
	if len(active) != 1 || active[0].CreatedBy != "Admin" {
		t.Fatalf("active = %+v", active)
	}
	expectStatus(t, h.request("POST", "/api/v1/admin/announcements", "admin-token", origin, map[string]any{"message": ""}), http.StatusBadRequest)
	expectStatus(t, h.request("DELETE", "/api/v1/admin/announcements/"+jsonNumber(created["id"]), "admin-token", origin, nil), http.StatusNoContent)
}

func jsonNumber(n int64) string {
	raw, _ := json.Marshal(n)
	return string(raw)
}

func TestGoogleSignInFlow(t *testing.T) {
	h := newHarness(t, true)
	ctx := context.Background()
	if err := h.store.SetAllowedAdmin(ctx, "admin@example.com", "uadmin"); err != nil {
		t.Fatal(err)
	}
	returnURL := webOrigin + "/auth/google"

	// A return address on another origin is refused.
	expectStatus(t, h.request("GET", "/api/v1/auth/google/start?code=123456&return="+url.QueryEscape("https://evil.example/cb"), "", "", nil), http.StatusBadRequest)

	resp := h.request("GET", "/api/v1/auth/google/start?code=123456&return="+url.QueryEscape(returnURL), "", "", nil)
	expectStatus(t, resp, http.StatusFound)
	state, _ := url.Parse(resp.Header.Get("Location"))
	stateValue := state.Query().Get("state")

	resp = h.request("GET", "/api/v1/auth/google/callback?state="+stateValue+"&code=admin", "", "", nil)
	expectStatus(t, resp, http.StatusFound)
	if loc := resp.Header.Get("Location"); !strings.HasPrefix(loc, returnURL) || !strings.Contains(loc, "google=ok") {
		t.Fatalf("redirect = %s", loc)
	}
	if len(h.jellyfin.authorized) != 1 || h.jellyfin.authorized[0] != "123456:uadmin" {
		t.Fatalf("quick connect approvals = %v", h.jellyfin.authorized)
	}
	// The state is single use.
	expectStatus(t, h.request("GET", "/api/v1/auth/google/callback?state="+stateValue+"&code=admin", "", "", nil), http.StatusBadRequest)

	// The browser finishes Quick Connect and confirms with its new token.
	expectStatus(t, h.request("POST", "/api/v1/auth/google/confirm", "viewer-token", webOrigin, map[string]string{"code": "123456", "deviceId": "dev-google"}), http.StatusForbidden)
	expectStatus(t, h.request("POST", "/api/v1/auth/google/confirm", "admin-token", webOrigin, map[string]string{"code": "123456", "deviceId": "dev-google"}), http.StatusOK)

	resp = h.request("GET", "/api/v1/auth/session", "admin-token", webOrigin, nil)
	var session map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&session)
	if session["google"] != true {
		t.Fatalf("session = %v", session)
	}
	// Now admin features work over plain HTTP.
	expectStatus(t, h.request("GET", "/api/v1/admin/settings", "admin-token", webOrigin, nil), http.StatusOK)

	// When the session expires, the janitor deletes the Jellyfin device.
	h.server.now = func() time.Time { return time.Now().Add(13 * time.Hour) }
	if err := h.store.SaveGoogleSession(ctx, store.GoogleSession{DeviceID: "dev-old", JellyfinUserID: "uadmin", Email: "admin@example.com", ExpiresAt: time.Now().Add(-time.Minute)}); err != nil {
		t.Fatal(err)
	}
	h.server.sweep(ctx)
	if len(h.jellyfin.deletedDevices) != 1 || h.jellyfin.deletedDevices[0] != "dev-old" {
		t.Fatalf("deleted devices = %v", h.jellyfin.deletedDevices)
	}
}

func TestGoogleSignInRefusesUnknownAccounts(t *testing.T) {
	h := newHarness(t, true)
	returnURL := webOrigin + "/auth/google"
	resp := h.request("GET", "/api/v1/auth/google/start?code=654321&return="+url.QueryEscape(returnURL), "", "", nil)
	state, _ := url.Parse(resp.Header.Get("Location"))
	resp = h.request("GET", "/api/v1/auth/google/callback?state="+state.Query().Get("state")+"&code=stranger", "", "", nil)
	expectStatus(t, resp, http.StatusFound)
	if loc := resp.Header.Get("Location"); !strings.Contains(loc, "reason=not-allowed") {
		t.Fatalf("redirect = %s", loc)
	}
	if len(h.jellyfin.authorized) != 0 {
		t.Fatal("Quick Connect approved for an unknown account")
	}
}

func TestAllowlistOnlyAcceptsAdmins(t *testing.T) {
	h := newHarness(t, true)
	origin := "https://finora.example.com"
	expectStatus(t, h.request("PUT", "/api/v1/admin/allowlist", "admin-token", origin, map[string]string{"email": "v@example.com", "jellyfinUserId": "uviewer"}), http.StatusBadRequest)
	expectStatus(t, h.request("PUT", "/api/v1/admin/allowlist", "admin-token", origin, map[string]string{"email": "A@Example.com", "jellyfinUserId": "uadmin"}), http.StatusOK)
	expectStatus(t, h.request("DELETE", "/api/v1/admin/allowlist/a@example.com", "admin-token", origin, nil), http.StatusNoContent)
}

func TestItemSubtitlesFindJellyfinCopyAndServeVTT(t *testing.T) {
	h := newHarness(t, true)
	ctx := context.Background()
	h.server.dataDir = t.TempDir()
	if err := os.MkdirAll(h.server.subtitlesDir(), 0o700); err != nil {
		t.Fatal(err)
	}
	id := strings.Repeat("a", 32)
	_ = os.WriteFile(filepath.Join(h.server.subtitlesDir(), id+".srt"), []byte("1\n00:00:01,000 --> 00:00:02,000\nHi\n"), 0o600)
	_ = h.store.SaveSubtitle(ctx, store.Subtitle{
		ID: id, ItemID: "item1", MediaSourceID: "ms1", Language: "en", Provider: "subdl", Release: "R",
		FileName: id + ".srt", PathsBefore: `["/media/Movie.en.srt"]`, CreatedByID: "uviewer", CreatedByName: "Viewer",
	})

	resp := h.request("GET", "/api/v1/subtitles/items/item1", "viewer-token", "", nil)
	expectStatus(t, resp, http.StatusOK)
	var views []struct {
		ID                  string `json:"id"`
		JellyfinStreamIndex *int   `json:"jellyfinStreamIndex"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&views)
	// The fake item has the pre-existing file at index 3 and our new one at index 4.
	if len(views) != 1 || views[0].JellyfinStreamIndex == nil || *views[0].JellyfinStreamIndex != 4 {
		t.Fatalf("views = %+v", views)
	}

	resp = h.request("GET", "/api/v1/subtitles/files/"+id+".vtt", "", "", nil)
	expectStatus(t, resp, http.StatusOK)
	body, _ := io.ReadAll(resp.Body)
	if !strings.HasPrefix(string(body), "WEBVTT") || !strings.Contains(string(body), "00:00:01.000") {
		t.Fatalf("vtt = %q", body)
	}
	// Path tricks never reach a file (the router cleans the path; the handler only accepts hex IDs).
	if resp := h.request("GET", "/api/v1/subtitles/files/../../etc.vtt", "", "", nil); resp.StatusCode == http.StatusOK {
		t.Fatal("path traversal served a file")
	}
	expectStatus(t, h.request("GET", "/api/v1/subtitles/files/notanid.vtt", "", "", nil), http.StatusNotFound)

	// Only the creator or an admin may remove it.
	expectStatus(t, h.request("DELETE", "/api/v1/subtitles/"+id, "viewer-token", "", nil), http.StatusNoContent)
	if len(h.jellyfin.deletedSubtitles) != 1 || h.jellyfin.deletedSubtitles[0] != "item1/4" {
		t.Fatalf("deleted = %v", h.jellyfin.deletedSubtitles)
	}
}

func TestSubtitleSettings(t *testing.T) {
	h := newHarness(t, true)
	origin := "https://finora.example.com"
	resp := h.request("PUT", "/api/v1/admin/settings", "admin-token", origin, map[string]any{
		"subtitleProviders": []string{"subdl"}, "subtitleAccess": "admins", "subtitleDailyLimit": 5, "openSubtitlesApiKey": "os-key",
	})
	expectStatus(t, resp, http.StatusOK)
	var view map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&view)
	if view["subtitleAccess"] != "admins" || view["openSubtitlesApiKeySet"] != true {
		t.Fatalf("view = %v", view)
	}
	raw, _ := json.Marshal(view)
	if strings.Contains(string(raw), "os-key") {
		t.Fatal("OpenSubtitles key leaked")
	}
	// Viewers are now refused.
	expectStatus(t, h.request("GET", "/api/v1/subtitles/search?itemId=item1&lang=en", "viewer-token", "", nil), http.StatusForbidden)
	expectStatus(t, h.request("PUT", "/api/v1/admin/settings", "admin-token", origin, map[string]any{"subtitleProviders": []string{"bogus"}}), http.StatusBadRequest)
}

func TestBaseNameHandlesWindowsPaths(t *testing.T) {
	cases := map[string]string{
		`D:\\media\\Show\\Episode.S01E01.mkv`: "Episode.S01E01.mkv",
		"/media/show/Episode.mkv":             "Episode.mkv",
		"plain.mkv":                           "plain.mkv",
	}
	for in, want := range cases {
		if got := baseName(in); got != want {
			t.Errorf("baseName(%q) = %q, want %q", in, got, want)
		}
	}
	if got := stem(`D:\\media\\Movie.2010.mkv`); got != "Movie.2010" {
		t.Errorf("stem = %q", got)
	}
}

func TestOpenSubtitlesActivityWarnsBeforePurge(t *testing.T) {
	h := newHarness(t, true)
	ctx := context.Background()
	if err := h.store.SetSettings(ctx, map[string]string{config.KeyOSAPIKey: "os-key"}); err != nil {
		t.Fatal(err)
	}
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	h.server.now = func() time.Time { return start }
	h.server.sweep(ctx) // notes when the key was first seen

	activity := func() map[string]any {
		resp := h.request("GET", "/api/v1/admin/settings", "admin-token", "https://finora.example.com", nil)
		expectStatus(t, resp, http.StatusOK)
		var view map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&view)
		a, _ := view["openSubtitlesActivity"].(map[string]any)
		return a
	}
	if a := activity(); a["warning"] != false || a["purgeAfter"] != "2026-03-02T00:00:00Z" {
		t.Fatalf("fresh key: %v", a)
	}
	h.server.now = func() time.Time { return start.Add(50 * 24 * time.Hour) }
	if a := activity(); a["warning"] != true {
		t.Fatalf("after 50 idle days: %v", a)
	}
	h.server.recordOSDownload(ctx)
	if a := activity(); a["warning"] != false || a["lastDownload"] == nil {
		t.Fatalf("after a download: %v", a)
	}
}
