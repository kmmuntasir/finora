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

## Implementation notes (2026-10-28)

- Jellyfin names the upload `<video stem>.<lang3>[.forced][.sdh].srt`, adding
  a counter when the name exists (`SubtitleManager.TrySaveToFiles`). Finora
  snapshots the item's external subtitle paths before uploading; the first
  new path that starts with `<video stem>.<lang3>` afterwards is Finora's.
- Paths come from the Jellyfin host's OS. The reference server runs on
  Windows, so the API splits paths on both `/` and `\`.
- Stored subtitles are served as WebVTT at `/api/v1/subtitles/files/<id>.vtt`.
  The 128-bit random ID is the capability, because `<track>` cannot send an
  `Authorization` header.
- Verified end to end on the reference server: SubDL result → upload →
  Jellyfin indexed it as an external stream within seconds → removed through
  Finora (Jellyfin deleted the file).

