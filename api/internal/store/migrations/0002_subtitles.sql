-- Subtitles downloaded through Finora (decision 0005). The text is also kept
-- in the data directory so the player can use it before Jellyfin indexes it.
CREATE TABLE subtitles (
    id                TEXT PRIMARY KEY,       -- random, unguessable (used in public VTT URLs)
    item_id           TEXT NOT NULL,
    media_source_id   TEXT NOT NULL,
    language          TEXT NOT NULL,          -- ISO 639-1
    provider          TEXT NOT NULL,
    release_name      TEXT NOT NULL,
    hearing_impaired  INTEGER NOT NULL DEFAULT 0,
    forced            INTEGER NOT NULL DEFAULT 0,
    file_name         TEXT NOT NULL,          -- inside <data>/subtitles/
    paths_before      TEXT NOT NULL,          -- JSON: external subtitle paths before upload
    jellyfin_path     TEXT,                   -- set once Jellyfin has indexed our file
    upload_error      TEXT,
    created_by_id     TEXT NOT NULL,
    created_by_name   TEXT NOT NULL,
    created_at        TEXT NOT NULL
);

CREATE INDEX subtitles_item ON subtitles (item_id);
CREATE INDEX subtitles_creator ON subtitles (created_by_id, created_at);
