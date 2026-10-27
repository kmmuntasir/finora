---
tags: [decision, subtitles]
updated: 2026-10-28
status: accepted
---

# 0005 — Subtitles uploaded through the API, with immediate fallback

## Context

Jellyfin's OpenSubtitles plugin gives a poor experience and SubBuzz no longer
works. A downloaded subtitle must be usable at once by every user, even
before Jellyfin re-indexes the item.

## Decision

1. The Finora API searches providers (ported from `subtitle-fetcher`, see
   [providers](../subtitles/providers.md)) using metadata from Jellyfin.
2. It stores the chosen subtitle in its data directory and SQLite.
3. It uploads it with `POST /Videos/{itemId}/Subtitles` using the API key.
   Jellyfin writes it beside the video when the library option "save
   subtitles with media" is on, then queues a high-priority refresh.
4. Until Jellyfin lists the new stream, Finora's player loads the subtitle
   from the API as a WebVTT text track.
5. Finora selects a Finora-added subtitle by default for viewers who have not
   picked a track and whose preferred language matches.

## Consequences

- No FTP or file-share access needed.
- Other Jellyfin clients see the subtitle after indexing; whether they show
  it by default depends on each user's Jellyfin subtitle settings.
