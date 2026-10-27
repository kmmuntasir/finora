// Package jellyfin is the Finora API's minimal Jellyfin client: token checks,
// Quick Connect approval and device revocation.
package jellyfin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ErrUnauthorized means Jellyfin rejected the token.
var ErrUnauthorized = errors.New("jellyfin: unauthorized")

// Client talks to one Jellyfin server.
type Client struct {
	BaseURL string
	APIKey  string
	HTTP    *http.Client
}

// New creates a client with sensible timeouts.
func New(baseURL, apiKey string) *Client {
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		APIKey:  apiKey,
		HTTP:    &http.Client{Timeout: 15 * time.Second},
	}
}

// User is the subset of Jellyfin's UserDto the API needs.
type User struct {
	ID     string `json:"Id"`
	Name   string `json:"Name"`
	Policy struct {
		IsAdministrator bool `json:"IsAdministrator"`
		IsDisabled      bool `json:"IsDisabled"`
	} `json:"Policy"`
}

// SystemInfo is the subset of Jellyfin's system info the API needs.
type SystemInfo struct {
	ServerName string `json:"ServerName"`
	Version    string `json:"Version"`
	ID         string `json:"Id"`
}

func authHeader(token string) string {
	return fmt.Sprintf(`MediaBrowser Client="Finora API", Device="Finora API", DeviceId="finora-api", Version="0.1.0", Token="%s"`, token)
}

func (c *Client) do(ctx context.Context, method, path, token string, query url.Values, body io.Reader, out any) error {
	endpoint := c.BaseURL + path
	if len(query) > 0 {
		endpoint += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", authHeader(token))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("jellyfin: %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return ErrUnauthorized
	}
	if resp.StatusCode >= 300 {
		snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return fmt.Errorf("jellyfin: %s %s: status %d: %s", method, path, resp.StatusCode, strings.TrimSpace(string(snippet)))
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// CurrentUser returns the user a viewer token belongs to.
func (c *Client) CurrentUser(ctx context.Context, token string) (User, error) {
	var user User
	err := c.do(ctx, http.MethodGet, "/Users/Me", token, nil, nil, &user)
	return user, err
}

// UserByID looks up a user with the API key.
func (c *Client) UserByID(ctx context.Context, userID string) (User, error) {
	var user User
	err := c.do(ctx, http.MethodGet, "/Users/"+url.PathEscape(userID), c.APIKey, nil, nil, &user)
	return user, err
}

// SystemInfo checks the API key against the server.
func (c *Client) SystemInfo(ctx context.Context) (SystemInfo, error) {
	var info SystemInfo
	err := c.do(ctx, http.MethodGet, "/System/Info", c.APIKey, nil, nil, &info)
	return info, err
}

// AuthorizeQuickConnect approves a Quick Connect code for a user. API keys act
// as administrators, so this signs the user in without a password
// (Jellyfin 10.11 QuickConnectController.AuthorizeQuickConnect).
func (c *Client) AuthorizeQuickConnect(ctx context.Context, code, userID string) error {
	query := url.Values{"code": {code}, "userId": {userID}}
	return c.do(ctx, http.MethodPost, "/QuickConnect/Authorize", c.APIKey, query, nil, nil)
}

// DeleteDevice logs out every session of a device and deletes its token.
func (c *Client) DeleteDevice(ctx context.Context, deviceID string) error {
	err := c.do(ctx, http.MethodDelete, "/Devices", c.APIKey, url.Values{"id": {deviceID}}, nil, nil)
	if err != nil && strings.Contains(err.Error(), "status 404") {
		return nil // already gone
	}
	return err
}

// DeviceBelongsTo reports whether a device's last user is the given user.
func (c *Client) DeviceBelongsTo(ctx context.Context, deviceID, userID string) (bool, error) {
	var result struct {
		Items []struct {
			ID         string `json:"Id"`
			LastUserID string `json:"LastUserId"`
		} `json:"Items"`
	}
	if err := c.do(ctx, http.MethodGet, "/Devices", c.APIKey, url.Values{"userId": {userID}}, nil, &result); err != nil {
		return false, err
	}
	for _, device := range result.Items {
		if device.ID == deviceID {
			return strings.EqualFold(strings.ReplaceAll(device.LastUserID, "-", ""), strings.ReplaceAll(userID, "-", "")), nil
		}
	}
	return false, nil
}
