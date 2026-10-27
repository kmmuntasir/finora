package jellyfin

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCurrentUserSendsTokenAndMapsUnauthorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Authorization"), `Token="good"`) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"Id":"u1","Name":"Alex","Policy":{"IsAdministrator":true}}`))
	}))
	defer server.Close()
	c := New(server.URL+"/", "key")

	user, err := c.CurrentUser(context.Background(), "good")
	if err != nil || user.ID != "u1" || !user.Policy.IsAdministrator {
		t.Fatalf("user = %+v, err = %v", user, err)
	}
	if _, err := c.CurrentUser(context.Background(), "bad"); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
}

func TestAuthorizeQuickConnectUsesAPIKey(t *testing.T) {
	var got string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Method + " " + r.URL.Path + "?" + r.URL.RawQuery + " " + r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("true"))
	}))
	defer server.Close()
	if err := New(server.URL, "secret-key").AuthorizeQuickConnect(context.Background(), "123456", "u1"); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(got, "POST /QuickConnect/Authorize?code=123456&userId=u1 ") || !strings.Contains(got, `Token="secret-key"`) {
		t.Fatalf("request = %q", got)
	}
}

func TestDeleteDeviceIgnoresMissingDevice(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()
	if err := New(server.URL, "k").DeleteDevice(context.Background(), "d1"); err != nil {
		t.Fatalf("expected nil for missing device, got %v", err)
	}
}
