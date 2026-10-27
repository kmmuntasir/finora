---
tags: [subtitles, research]
updated: 2026-10-28
---

# Subtitle Providers

> **Status (2026-10-28):** ported to Go in `api/internal/subtitles/`. Changes
> found while porting are noted inline as **Update**.

Learned in the author's earlier `subtitle-fetcher` project (Node, verified
live in August 2026). Finora's Go API ports this logic.

| Provider | Scope | Access | Behaviour to respect |
| --- | --- | --- | --- |
| Addic7ed | TV episodes only | Anonymous scraping | Unique match → 302 to the episode page; multi-match → result list. Download needs a `Referer` from that page. Throttles hard: pace requests globally (~3.2 s), cool down 25 s on a throttle page, give up after a second throttle. Skip rows still "NN%" (incomplete). |
| SubDL | Movies and episodes | Anonymous scraping | Search → detail pages with per-language sections and `dl.subdl.com` zip links. Daily cap ≈ 300 downloads per IP: hard (403/406/429 on zip) or soft (search results silently empty). **Update:** searching "Show s01" now finds nothing; search the series name, then follow the season link (`…/first-season`, `…/second-season`). Language sections use full names (`data-language="english"`, `"bengali"` labelled "Bangla"). |
| OpenSubtitles.com | Movies and episodes | REST API key; optional login raises quota | Query by file hash first, then title / season / episode (Finora can also use IMDb IDs from Jellyfin). `/download` returns `remaining` and `reset_time_utc`; 406 = quota exhausted, 429 = honour `Retry-After`. |
| Podnapisi, Gestdown, YTS | — | — | Adapters exist but are often ISP-blocked; off by default. |

## Processing

- Payloads may be zip, gzip or plain. Pick `.srt` members, drop
  foreign-language file names, and for season packs prefer `SxxEyy`, then
  `NxEE`, then a bare episode number; avoid `forced`.
- Plausibility: at least two `-->` cue timings in the first 40 KB; detect
  1–10 KB "subtitle" files that are saved HTML pages.
- Normalise to UTF-8 and strip the BOM.

## Ranking

- Exact hash match first.
- Release-name overlap with the actual file name (+8 per shared word),
  matching 720p/1080p, year match for movies, episode-range match for packs.
- Prefer non-AI-translated, then non-hearing-impaired; skip foreign-parts-only.
