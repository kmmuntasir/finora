-- Automatic subtitle job: one row per item and language it has tried.
CREATE TABLE auto_subtitle_attempts (
    item_id      TEXT NOT NULL,
    language     TEXT NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 0,
    last_attempt TEXT NOT NULL,
    last_error   TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (item_id, language)
);
