// Package jellyfin is the Finora API's minimal Jellyfin client: token checks,
// Quick Connect approval and device revocation.
package jellyfin

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
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

// MediaStream is the subset of a Jellyfin media stream the API needs.
type MediaStream struct {
	Index      int    `json:"Index"`
	Type       string `json:"Type"`
	IsExternal bool   `json:"IsExternal"`
	Path       string `json:"Path"`
	Language   string `json:"Language"`
	IsForced   bool   `json:"IsForced"`
}

// MediaSource is the subset of a Jellyfin media source the API needs.
type MediaSource struct {
	ID           string        `json:"Id"`
	Path         string        `json:"Path"`
	Size         int64         `json:"Size"`
	MediaStreams []MediaStream `json:"MediaStreams"`
}

// Item is the subset of Jellyfin's BaseItemDto used for subtitle searches.
type Item struct {
	ID                string            `json:"Id"`
	Name              string            `json:"Name"`
	Type              string            `json:"Type"`
	Path              string            `json:"Path"`
	ProductionYear    int               `json:"ProductionYear"`
	SeriesName        string            `json:"SeriesName"`
	SeriesID          string            `json:"SeriesId"`
	ParentIndexNumber int               `json:"ParentIndexNumber"`
	IndexNumber       int               `json:"IndexNumber"`
	ProviderIDs       map[string]string `json:"ProviderIds"`
	MediaSources      []MediaSource     `json:"MediaSources"`
	// MediaStreams is filled by list queries that ask for the MediaStreams field.
	MediaStreams []MediaStream `json:"MediaStreams"`
}

// Item fetches an item as the given user would see it (respecting their
// library access). An empty userID asks as the server (the API key's admin view).
func (c *Client) Item(ctx context.Context, userID, itemID string) (Item, error) {
	var result struct {
		Items []Item `json:"Items"`
	}
	query := url.Values{"ids": {itemID}, "fields": {"Path,ProviderIds,MediaSources,MediaStreams"}, "enableUserData": {"false"}}
	if userID != "" {
		query.Set("userId", userID)
	}
	if err := c.do(ctx, http.MethodGet, "/Items", c.APIKey, query, nil, &result); err != nil {
		return Item{}, err
	}
	if len(result.Items) == 0 {
		return Item{}, ErrNotFound
	}
	return result.Items[0], nil
}

// VideosNewestFirst lists movies and episodes, newest additions first, with
// their streams, a page at a time. Returns the page and the total count.
func (c *Client) VideosNewestFirst(ctx context.Context, start, limit int) ([]Item, int, error) {
	var result struct {
		Items            []Item `json:"Items"`
		TotalRecordCount int    `json:"TotalRecordCount"`
	}
	query := url.Values{
		"recursive":        {"true"},
		"includeItemTypes": {"Movie,Episode"},
		"isMissing":        {"false"},
		"sortBy":           {"DateCreated,SortName"},
		"sortOrder":        {"Descending"},
		"fields":           {"MediaStreams,Path"},
		"enableUserData":   {"false"},
		"enableImages":     {"false"},
		"startIndex":       {strconv.Itoa(start)},
		"limit":            {strconv.Itoa(limit)},
	}
	if err := c.do(ctx, http.MethodGet, "/Items", c.APIKey, query, nil, &result); err != nil {
		return nil, 0, err
	}
	return result.Items, result.TotalRecordCount, nil
}

// ErrNotFound means the item does not exist or the user can't see it.
var ErrNotFound = errors.New("jellyfin: not found")

// ReadRange reads part of an item's original file (for the OpenSubtitles hash).
func (c *Client) ReadRange(ctx context.Context, itemID string, offset, length int64) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/Items/"+url.PathEscape(itemID)+"/Download", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", authHeader(c.APIKey))
	req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", offset, offset+length-1))
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusPartialContent {
		return nil, fmt.Errorf("jellyfin: range read returned %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, length))
}

// UploadSubtitle sends a subtitle to Jellyfin, which saves it beside the
// video (when the library allows it) and queues a refresh of the item.
func (c *Client) UploadSubtitle(ctx context.Context, itemID, language3, format string, data []byte, forced, hearingImpaired bool) error {
	body, err := json.Marshal(map[string]any{
		"Language":          language3,
		"Format":            format,
		"IsForced":          forced,
		"IsHearingImpaired": hearingImpaired,
		"Data":              base64.StdEncoding.EncodeToString(data),
	})
	if err != nil {
		return err
	}
	return c.do(ctx, http.MethodPost, "/Videos/"+url.PathEscape(itemID)+"/Subtitles", c.APIKey, nil, bytes.NewReader(body), nil)
}

// DeleteSubtitle removes an external subtitle stream from an item.
func (c *Client) DeleteSubtitle(ctx context.Context, itemID string, index int) error {
	return c.do(ctx, http.MethodDelete, fmt.Sprintf("/Videos/%s/Subtitles/%d", url.PathEscape(itemID), index), c.APIKey, nil, nil, nil)
}
