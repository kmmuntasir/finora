// Package store is the Finora API's SQLite persistence layer.
package store

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"sort"
	"strings"
	"time"

	_ "modernc.org/sqlite" // pure-Go SQLite driver
)

//go:embed migrations/*.sql
var migrations embed.FS

// Store wraps the database handle.
type Store struct {
	db *sql.DB
}

// ErrNotFound is returned when a row does not exist.
var ErrNotFound = errors.New("not found")

// Open opens (or creates) the database at path and applies pending migrations.
func Open(ctx context.Context, path string) (*Store, error) {
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	// SQLite allows one writer; a single connection keeps writes simple and safe.
	db.SetMaxOpenConns(1)
	s := &Store{db: db}
	if err := s.migrate(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

// Close closes the database.
func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`); err != nil {
		return fmt.Errorf("create migrations table: %w", err)
	}
	names, err := fs.Glob(migrations, "migrations/*.sql")
	if err != nil {
		return err
	}
	sort.Strings(names)
	for _, name := range names {
		var exists int
		if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM schema_migrations WHERE name = ?`, name).Scan(&exists); err != nil {
			return err
		}
		if exists > 0 {
			continue
		}
		body, err := migrations.ReadFile(name)
		if err != nil {
			return err
		}
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, string(body)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("apply %s: %w", name, err)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`, name, now()); err != nil {
			_ = tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

func now() string { return time.Now().UTC().Format(time.RFC3339) }

// ---- settings ----

// Setting returns a stored setting, or "" when unset.
func (s *Store) Setting(ctx context.Context, key string) (string, error) {
	var value string
	err := s.db.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return value, err
}

// SetSettings writes several settings atomically. Empty values delete the key.
func (s *Store) SetSettings(ctx context.Context, values map[string]string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	for key, value := range values {
		if strings.TrimSpace(value) == "" {
			_, err = tx.ExecContext(ctx, `DELETE FROM settings WHERE key = ?`, key)
		} else {
			_, err = tx.ExecContext(ctx, `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
		}
		if err != nil {
			_ = tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

// ---- announcements ----

// Announcement is a site-wide banner shown to every user.
type Announcement struct {
	ID        int64      `json:"id"`
	Message   string     `json:"message"`
	Tone      string     `json:"tone"`
	StartsAt  *time.Time `json:"startsAt"`
	EndsAt    *time.Time `json:"endsAt"`
	CreatedBy string     `json:"createdBy"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

func parseOptionalTime(value sql.NullString) *time.Time {
	if !value.Valid || value.String == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, value.String)
	if err != nil {
		return nil
	}
	return &parsed
}

func formatOptionalTime(value *time.Time) any {
	if value == nil {
		return nil
	}
	return value.UTC().Format(time.RFC3339)
}

// Announcements lists announcements; activeAt filters to those visible at that time.
func (s *Store) Announcements(ctx context.Context, activeAt *time.Time) ([]Announcement, error) {
	query := `SELECT id, message, tone, starts_at, ends_at, created_by, created_at, updated_at FROM announcements`
	var args []any
	if activeAt != nil {
		at := activeAt.UTC().Format(time.RFC3339)
		query += ` WHERE (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?)`
		args = append(args, at, at)
	}
	query += ` ORDER BY created_at DESC`
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Announcement{}
	for rows.Next() {
		var a Announcement
		var starts, ends sql.NullString
		var created, updated string
		if err := rows.Scan(&a.ID, &a.Message, &a.Tone, &starts, &ends, &a.CreatedBy, &created, &updated); err != nil {
			return nil, err
		}
		a.StartsAt, a.EndsAt = parseOptionalTime(starts), parseOptionalTime(ends)
		a.CreatedAt, _ = time.Parse(time.RFC3339, created)
		a.UpdatedAt, _ = time.Parse(time.RFC3339, updated)
		result = append(result, a)
	}
	return result, rows.Err()
}

// SaveAnnouncement inserts (ID 0) or updates an announcement.
func (s *Store) SaveAnnouncement(ctx context.Context, a Announcement) (int64, error) {
	stamp := now()
	if a.ID == 0 {
		res, err := s.db.ExecContext(ctx,
			`INSERT INTO announcements (message, tone, starts_at, ends_at, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			a.Message, a.Tone, formatOptionalTime(a.StartsAt), formatOptionalTime(a.EndsAt), a.CreatedBy, stamp, stamp)
		if err != nil {
			return 0, err
		}
		return res.LastInsertId()
	}
	res, err := s.db.ExecContext(ctx,
		`UPDATE announcements SET message = ?, tone = ?, starts_at = ?, ends_at = ?, updated_at = ? WHERE id = ?`,
		a.Message, a.Tone, formatOptionalTime(a.StartsAt), formatOptionalTime(a.EndsAt), stamp, a.ID)
	if err != nil {
		return 0, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return 0, ErrNotFound
	}
	return a.ID, nil
}

// DeleteAnnouncement removes an announcement.
func (s *Store) DeleteAnnouncement(ctx context.Context, id int64) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM announcements WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// ---- admin allowlist ----

// AllowedAdmin maps a Google account to a Jellyfin admin user.
type AllowedAdmin struct {
	Email          string    `json:"email"`
	JellyfinUserID string    `json:"jellyfinUserId"`
	CreatedAt      time.Time `json:"createdAt"`
}

// AllowedAdmins lists the allowlist.
func (s *Store) AllowedAdmins(ctx context.Context) ([]AllowedAdmin, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT email, jellyfin_user_id, created_at FROM admin_allowlist ORDER BY email`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []AllowedAdmin{}
	for rows.Next() {
		var a AllowedAdmin
		var created string
		if err := rows.Scan(&a.Email, &a.JellyfinUserID, &created); err != nil {
			return nil, err
		}
		a.CreatedAt, _ = time.Parse(time.RFC3339, created)
		result = append(result, a)
	}
	return result, rows.Err()
}

// AllowedAdmin finds the Jellyfin user for an email (case-insensitive).
func (s *Store) AllowedAdmin(ctx context.Context, email string) (AllowedAdmin, error) {
	var a AllowedAdmin
	var created string
	err := s.db.QueryRowContext(ctx, `SELECT email, jellyfin_user_id, created_at FROM admin_allowlist WHERE email = ?`, email).Scan(&a.Email, &a.JellyfinUserID, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return a, ErrNotFound
	}
	a.CreatedAt, _ = time.Parse(time.RFC3339, created)
	return a, err
}

// SetAllowedAdmin adds or updates an allowlist entry.
func (s *Store) SetAllowedAdmin(ctx context.Context, email, jellyfinUserID string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO admin_allowlist (email, jellyfin_user_id, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET jellyfin_user_id = excluded.jellyfin_user_id`,
		strings.ToLower(strings.TrimSpace(email)), jellyfinUserID, now())
	return err
}

// RemoveAllowedAdmin deletes an allowlist entry.
func (s *Store) RemoveAllowedAdmin(ctx context.Context, email string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM admin_allowlist WHERE email = ?`, email)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// ---- OAuth states ----

// OAuthState is a pending Google sign-in.
type OAuthState struct {
	State     string
	QCCode    string
	ReturnURL string
	Verifier  string
	ExpiresAt time.Time
}

// SaveOAuthState stores a pending sign-in.
func (s *Store) SaveOAuthState(ctx context.Context, st OAuthState) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO oauth_states (state, qc_code, return_url, verifier, expires_at) VALUES (?, ?, ?, ?, ?)`,
		st.State, st.QCCode, st.ReturnURL, st.Verifier, st.ExpiresAt.UTC().Format(time.RFC3339))
	return err
}

// TakeOAuthState returns and deletes a pending sign-in (single use). Expired states are not returned.
func (s *Store) TakeOAuthState(ctx context.Context, state string) (OAuthState, error) {
	var st OAuthState
	var expires string
	err := s.db.QueryRowContext(ctx, `DELETE FROM oauth_states WHERE state = ? RETURNING state, qc_code, return_url, verifier, expires_at`, state).
		Scan(&st.State, &st.QCCode, &st.ReturnURL, &st.Verifier, &expires)
	if errors.Is(err, sql.ErrNoRows) {
		return st, ErrNotFound
	}
	if err != nil {
		return st, err
	}
	st.ExpiresAt, _ = time.Parse(time.RFC3339, expires)
	if time.Now().After(st.ExpiresAt) {
		return st, ErrNotFound
	}
	return st, nil
}

// ---- Google sessions ----

// GoogleSession is a Jellyfin session created through Google sign-in.
type GoogleSession struct {
	DeviceID       string
	JellyfinUserID string
	Email          string
	TokenHash      string
	ExpiresAt      time.Time
}

// SaveGoogleSession records a session (token hash may be filled in later).
func (s *Store) SaveGoogleSession(ctx context.Context, g GoogleSession) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO google_sessions (device_id, jellyfin_user_id, email, token_hash, created_at, expires_at) VALUES (?, ?, ?, NULLIF(?, ''), ?, ?)
		 ON CONFLICT(device_id) DO UPDATE SET jellyfin_user_id = excluded.jellyfin_user_id, email = excluded.email, expires_at = excluded.expires_at, revoked_at = NULL`,
		g.DeviceID, g.JellyfinUserID, g.Email, g.TokenHash, now(), g.ExpiresAt.UTC().Format(time.RFC3339))
	return err
}

// BindGoogleSessionToken attaches the Jellyfin token hash to a pending session for the user.
func (s *Store) BindGoogleSessionToken(ctx context.Context, deviceID, jellyfinUserID, tokenHash string) (GoogleSession, error) {
	var g GoogleSession
	var expires string
	err := s.db.QueryRowContext(ctx,
		`UPDATE google_sessions SET token_hash = ? WHERE device_id = ? AND jellyfin_user_id = ? AND revoked_at IS NULL AND expires_at > ?
		 RETURNING device_id, jellyfin_user_id, email, expires_at`,
		tokenHash, deviceID, jellyfinUserID, now()).Scan(&g.DeviceID, &g.JellyfinUserID, &g.Email, &expires)
	if errors.Is(err, sql.ErrNoRows) {
		return g, ErrNotFound
	}
	g.TokenHash = tokenHash
	g.ExpiresAt, _ = time.Parse(time.RFC3339, expires)
	return g, err
}

// ActiveGoogleSessionByToken finds a live Google session by token hash.
func (s *Store) ActiveGoogleSessionByToken(ctx context.Context, tokenHash string) (GoogleSession, error) {
	var g GoogleSession
	var expires string
	err := s.db.QueryRowContext(ctx,
		`SELECT device_id, jellyfin_user_id, email, expires_at FROM google_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
		tokenHash, now()).Scan(&g.DeviceID, &g.JellyfinUserID, &g.Email, &expires)
	if errors.Is(err, sql.ErrNoRows) {
		return g, ErrNotFound
	}
	g.TokenHash = tokenHash
	g.ExpiresAt, _ = time.Parse(time.RFC3339, expires)
	return g, err
}

// ExpiredGoogleSessions lists sessions past their lifetime that are not yet revoked.
func (s *Store) ExpiredGoogleSessions(ctx context.Context) ([]GoogleSession, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT device_id, jellyfin_user_id, email FROM google_sessions WHERE revoked_at IS NULL AND expires_at <= ?`, now())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []GoogleSession
	for rows.Next() {
		var g GoogleSession
		if err := rows.Scan(&g.DeviceID, &g.JellyfinUserID, &g.Email); err != nil {
			return nil, err
		}
		result = append(result, g)
	}
	return result, rows.Err()
}

// MarkGoogleSessionRevoked records that the Jellyfin device was deleted.
func (s *Store) MarkGoogleSessionRevoked(ctx context.Context, deviceID string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE google_sessions SET revoked_at = ? WHERE device_id = ?`, now(), deviceID)
	return err
}

// PurgeExpired deletes expired pending sign-ins and grants.
func (s *Store) PurgeExpired(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, `DELETE FROM oauth_states WHERE expires_at <= ?`, now()); err != nil {
		return err
	}
	_, err := s.db.ExecContext(ctx, `DELETE FROM google_grants WHERE expires_at <= ?`, now())
	return err
}

// ---- Google grants ----

// GoogleGrant records that Google sign-in approved a Quick Connect code for a user.
type GoogleGrant struct {
	QCCode         string
	JellyfinUserID string
	Email          string
	ExpiresAt      time.Time
}

// SaveGoogleGrant stores a grant.
func (s *Store) SaveGoogleGrant(ctx context.Context, g GoogleGrant) error {
	_, err := s.db.ExecContext(ctx, `INSERT OR REPLACE INTO google_grants (qc_code, jellyfin_user_id, email, expires_at) VALUES (?, ?, ?, ?)`,
		g.QCCode, g.JellyfinUserID, g.Email, g.ExpiresAt.UTC().Format(time.RFC3339))
	return err
}

// TakeGoogleGrant returns and deletes an unexpired grant for the code and user.
func (s *Store) TakeGoogleGrant(ctx context.Context, qcCode, jellyfinUserID string) (GoogleGrant, error) {
	var g GoogleGrant
	var expires string
	err := s.db.QueryRowContext(ctx,
		`DELETE FROM google_grants WHERE qc_code = ? AND jellyfin_user_id = ? RETURNING qc_code, jellyfin_user_id, email, expires_at`,
		qcCode, jellyfinUserID).Scan(&g.QCCode, &g.JellyfinUserID, &g.Email, &expires)
	if errors.Is(err, sql.ErrNoRows) {
		return g, ErrNotFound
	}
	if err != nil {
		return g, err
	}
	g.ExpiresAt, _ = time.Parse(time.RFC3339, expires)
	if time.Now().After(g.ExpiresAt) {
		return g, ErrNotFound
	}
	return g, nil
}

// ---- subtitles ----

// Subtitle is a subtitle added through Finora.
type Subtitle struct {
	ID              string    `json:"id"`
	ItemID          string    `json:"itemId"`
	MediaSourceID   string    `json:"mediaSourceId"`
	Language        string    `json:"language"`
	Provider        string    `json:"provider"`
	Release         string    `json:"release"`
	HearingImpaired bool      `json:"hearingImpaired"`
	Forced          bool      `json:"forced"`
	FileName        string    `json:"-"`
	PathsBefore     string    `json:"-"`
	JellyfinPath    string    `json:"-"`
	UploadError     string    `json:"uploadError,omitempty"`
	CreatedByID     string    `json:"createdById"`
	CreatedByName   string    `json:"createdByName"`
	CreatedAt       time.Time `json:"createdAt"`
}

const subtitleColumns = `id, item_id, media_source_id, language, provider, release_name, hearing_impaired, forced, file_name, paths_before, COALESCE(jellyfin_path, ''), COALESCE(upload_error, ''), created_by_id, created_by_name, created_at`

func scanSubtitle(row interface{ Scan(...any) error }) (Subtitle, error) {
	var s Subtitle
	var created string
	err := row.Scan(&s.ID, &s.ItemID, &s.MediaSourceID, &s.Language, &s.Provider, &s.Release, &s.HearingImpaired, &s.Forced,
		&s.FileName, &s.PathsBefore, &s.JellyfinPath, &s.UploadError, &s.CreatedByID, &s.CreatedByName, &created)
	s.CreatedAt, _ = time.Parse(time.RFC3339, created)
	return s, err
}

// SaveSubtitle records a new subtitle.
func (s *Store) SaveSubtitle(ctx context.Context, sub Subtitle) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO subtitles (id, item_id, media_source_id, language, provider, release_name, hearing_impaired, forced, file_name, paths_before, upload_error, created_by_id, created_by_name, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''), ?, ?, ?)`,
		sub.ID, sub.ItemID, sub.MediaSourceID, sub.Language, sub.Provider, sub.Release, sub.HearingImpaired, sub.Forced,
		sub.FileName, sub.PathsBefore, sub.UploadError, sub.CreatedByID, sub.CreatedByName, now())
	return err
}

// Subtitle returns one subtitle.
func (s *Store) Subtitle(ctx context.Context, id string) (Subtitle, error) {
	sub, err := scanSubtitle(s.db.QueryRowContext(ctx, `SELECT `+subtitleColumns+` FROM subtitles WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return sub, ErrNotFound
	}
	return sub, err
}

// SubtitlesForItem lists subtitles added for an item, newest first.
func (s *Store) SubtitlesForItem(ctx context.Context, itemID string) ([]Subtitle, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT `+subtitleColumns+` FROM subtitles WHERE item_id = ? ORDER BY created_at DESC`, itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Subtitle{}
	for rows.Next() {
		sub, err := scanSubtitle(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, sub)
	}
	return result, rows.Err()
}

// SetSubtitleJellyfinPath records where Jellyfin indexed the file.
func (s *Store) SetSubtitleJellyfinPath(ctx context.Context, id, path string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE subtitles SET jellyfin_path = ? WHERE id = ?`, path, id)
	return err
}

// DeleteSubtitle removes the record.
func (s *Store) DeleteSubtitle(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM subtitles WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// CountSubtitlesByProviderSince counts everyone's downloads per provider since a time.
func (s *Store) CountSubtitlesByProviderSince(ctx context.Context, since time.Time) (map[string]int, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT provider, COUNT(*) FROM subtitles WHERE created_at >= ? GROUP BY provider`, since.UTC().Format(time.RFC3339))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	counts := map[string]int{}
	for rows.Next() {
		var provider string
		var count int
		if err := rows.Scan(&provider, &count); err != nil {
			return nil, err
		}
		counts[provider] = count
	}
	return counts, rows.Err()
}

// CountSubtitlesSince counts a user's downloads since a time (daily limits).
func (s *Store) CountSubtitlesSince(ctx context.Context, userID string, since time.Time) (int, error) {
	var count int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM subtitles WHERE created_by_id = ? AND created_at >= ?`, userID, since.UTC().Format(time.RFC3339)).Scan(&count)
	return count, err
}

// ---- automatic subtitles ----

// AutoAttempt is the automatic job's memory of one item and language.
type AutoAttempt struct {
	Attempts    int
	LastAttempt time.Time
	LastError   string
}

// AutoAttempts returns the attempts recorded for these items in one language.
func (s *Store) AutoAttempts(ctx context.Context, language string, itemIDs []string) (map[string]AutoAttempt, error) {
	result := map[string]AutoAttempt{}
	if len(itemIDs) == 0 {
		return result, nil
	}
	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(itemIDs)), ",")
	args := []any{language}
	for _, id := range itemIDs {
		args = append(args, id)
	}
	rows, err := s.db.QueryContext(ctx, `SELECT item_id, attempts, last_attempt, last_error FROM auto_subtitle_attempts WHERE language = ? AND item_id IN (`+placeholders+`)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id, last, lastError string
		var attempts int
		if err := rows.Scan(&id, &attempts, &last, &lastError); err != nil {
			return nil, err
		}
		when, _ := time.Parse(time.RFC3339, last)
		result[id] = AutoAttempt{Attempts: attempts, LastAttempt: when, LastError: lastError}
	}
	return result, rows.Err()
}

// RecordAutoAttempt counts a failed automatic attempt for an item and language.
func (s *Store) RecordAutoAttempt(ctx context.Context, itemID, language, failure string) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO auto_subtitle_attempts (item_id, language, attempts, last_attempt, last_error) VALUES (?, ?, 1, ?, ?)
		ON CONFLICT(item_id, language) DO UPDATE SET attempts = attempts + 1, last_attempt = excluded.last_attempt, last_error = excluded.last_error`, itemID, language, now(), failure)
	return err
}

// ImportAutoAttempt records misses from another tool (subtitle-fetcher). It
// never lowers a count Finora already has.
func (s *Store) ImportAutoAttempt(ctx context.Context, itemID, language string, attempts int, when time.Time, failure string) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO auto_subtitle_attempts (item_id, language, attempts, last_attempt, last_error) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(item_id, language) DO UPDATE SET
			attempts = max(attempts, excluded.attempts),
			last_attempt = max(last_attempt, excluded.last_attempt),
			last_error = CASE WHEN excluded.attempts > attempts THEN excluded.last_error ELSE last_error END`,
		itemID, language, attempts, when.UTC().Format(time.RFC3339), failure)
	return err
}

// ClearAutoAttempt forgets an item once it has a subtitle in that language.
func (s *Store) ClearAutoAttempt(ctx context.Context, itemID, language string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM auto_subtitle_attempts WHERE item_id = ? AND language = ?`, itemID, language)
	return err
}
