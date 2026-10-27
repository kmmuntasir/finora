package config

import "testing"

func TestNormalizeOrigin(t *testing.T) {
	cases := map[string]string{
		"http://10.0.0.1:8080/":           "http://10.0.0.1:8080",
		"HTTPS://Finora.Example.com/path": "https://finora.example.com",
	}
	for in, want := range cases {
		if got, ok := NormalizeOrigin(in); !ok || got != want {
			t.Errorf("NormalizeOrigin(%q) = %q, %v", in, got, ok)
		}
	}
	for _, bad := range []string{"", "ftp://x", "not a url", "http://"} {
		if _, ok := NormalizeOrigin(bad); ok {
			t.Errorf("NormalizeOrigin(%q) should fail", bad)
		}
	}
}

func TestSettingsHelpers(t *testing.T) {
	s := Settings{AllowedOrigins: SplitOrigins("http://a.example, https://b.example/"), PublicURL: "http://api.example"}
	if !s.OriginAllowed("https://b.example") || s.OriginAllowed("https://c.example") {
		t.Fatal("origin check")
	}
	s.GoogleClientID, s.GoogleClientSecret = "id", "secret"
	if s.GoogleEnabled() {
		t.Fatal("Google sign-in needs an HTTPS public URL")
	}
	s.PublicURL = "https://api.example"
	if !s.GoogleEnabled() {
		t.Fatal("Google sign-in should be enabled")
	}
}

func TestNormalizeBaseURL(t *testing.T) {
	if got, ok := NormalizeBaseURL("http://1.2.3.4:8096/?x=1#y"); !ok || got != "http://1.2.3.4:8096" {
		t.Fatalf("got %q %v", got, ok)
	}
	if _, ok := NormalizeBaseURL("http://user:pass@host"); ok {
		t.Fatal("credentials must be rejected")
	}
}
