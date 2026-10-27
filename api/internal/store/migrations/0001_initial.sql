-- Finora API schema. Jellyfin remains the source of truth for users, media and
-- watch state; this database only holds what Jellyfin cannot.

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE announcements (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    message    TEXT    NOT NULL,
    tone       TEXT    NOT NULL DEFAULT 'info' CHECK (tone IN ('info', 'warning', 'success')),
    starts_at  TEXT,            -- RFC 3339, NULL = immediately
    ends_at    TEXT,            -- RFC 3339, NULL = until removed
    created_by TEXT    NOT NULL,
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
);

-- Google accounts allowed to sign in as a Jellyfin admin (decision 0004).
CREATE TABLE admin_allowlist (
    email            TEXT PRIMARY KEY COLLATE NOCASE,
    jellyfin_user_id TEXT NOT NULL,
    created_at       TEXT NOT NULL
);

-- In-flight Google sign-ins: links the OAuth state to the Quick Connect code.
CREATE TABLE oauth_states (
    state      TEXT PRIMARY KEY,
    qc_code    TEXT NOT NULL,
    return_url TEXT NOT NULL,
    verifier   TEXT NOT NULL,   -- PKCE code verifier
    expires_at TEXT NOT NULL
);

-- Successful Google sign-ins waiting for the browser to finish Quick Connect.
-- Single use; binds the approved Quick Connect code to the Jellyfin user.
CREATE TABLE google_grants (
    qc_code          TEXT PRIMARY KEY,
    jellyfin_user_id TEXT NOT NULL,
    email            TEXT NOT NULL,
    expires_at       TEXT NOT NULL
);

-- Jellyfin sessions created through Google sign-in; revoked when they expire.
CREATE TABLE google_sessions (
    device_id        TEXT PRIMARY KEY,
    jellyfin_user_id TEXT NOT NULL,
    email            TEXT NOT NULL,
    token_hash       TEXT,
    created_at       TEXT NOT NULL,
    expires_at       TEXT NOT NULL,
    revoked_at       TEXT
);

CREATE INDEX google_sessions_token ON google_sessions (token_hash);
