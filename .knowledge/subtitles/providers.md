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

## OpenSubtitles terms and limits

Checked 2026-10-28 against the
[API docs](https://opensubtitles.stoplight.io/docs/opensubtitles-api/e3750fd63a100-getting-started)
and the
[integrator terms](https://opensubtitles.stoplight.io/docs/opensubtitles-api/f43c0749230b3-terms-of-use-for-integrators)
(last updated 13 October 2026). The docs site is rendered with JavaScript, so
open it in a browser rather than fetching it.

- **Quota:** searching is unlimited. Without login a free key gets 5
  downloads per IP per 24 hours. A signed-in user gets 20 (free) up to 1000
  (VIP). A consumer marked "Under Development" gets 100 a day without login,
  as a temporary measure. Counters reset at midnight UTC.
- **Headers:** `Api-Key` and a `User-Agent` of the form `AppName vX.Y` are
  required; a bad User-Agent gives 403. Finora sends `Finora v0.1.0`.
- **Rate limits:** 5 requests per second per IP, and 1 per second on
  `/login`. Follow redirects. Sorted, lowercase query parameters avoid
  redirects.
- **Shared use:** when one key serves users who have no OpenSubtitles
  account, a paid plan is needed. Each user's own account on a free key is
  fine. Never ship a username and password inside a released app. A
  self-hosted Finora uses the admin's own key, as "a person who creates a key
  for their own scripts and tools".
- **Attribution:** free keys must show "Subtitles provided by
  OpenSubtitles.com" where subtitles are searched. The subtitle finder shows
  it whenever OpenSubtitles took part in a search.
- **Storage:** keeping a downloaded subtitle next to the video is allowed.
  Fetching subtitles nobody asked for is not.
- **Inactive keys:** the opensubtitles.com consumer page says consumers with
  no downloads for more than 60 days are purged automatically. A scheduled
  "keep-alive" download would be a download nobody asked for, so Finora does
  not do one. Instead the API records each OpenSubtitles download
  (`opensubtitles_last_download`) and when it first saw the key
  (`opensubtitles_key_seen`). From day 45 it warns in
  **Admin → Finora → Subtitle finder** and once a day in the log. The date
  covers only downloads made through Finora.

## Automatic downloads (Tier 3)

The Finora API can fetch missing subtitles across the library every night
(Admin → Finora → Automatic subtitles; off by default). It follows the
rules of the owner's `subtitle-fetcher`:

- It goes through all movies and episodes, newest additions first, one
  language at a time, with at most "downloads per night" downloads and 400
  searches per run. (Until 2026-10-30 it only looked at the 5,000 newest
  videos; the reference library has about 18,000.)
- An item counts as covered when it has any non-forced subtitle stream in
  that language, or a Finora copy that Jellyfin hasn't indexed yet.
- A miss waits a week before the next try, and the job gives up after three
  tries (`auto_subtitle_attempts` table). A miss while a provider failed or
  was resting is inconclusive and doesn't count as a try.
- Addic7ed answers 503 (and sometimes 429) when one address asks too often;
  both make it rest.
- A provider that reports a quota or throttling error rests until midnight
  UTC (daily limits) or for 15 minutes. If every provider is resting, the
  run stops.
- It runs once a day at the chosen local hour. A server that was off at that
  hour catches up when it starts. "Run now" starts a run immediately.

`finora-api import-subtitle-fetcher state.json` takes over subtitle-fetcher's
misses (status `failed`, with their try count and date), matched to Jellyfin
items by path without drive or host, lower case
(`api/internal/fetcherstate`). On the reference library 4,494 of 4,523
misses matched. None had reached three tries, so they are retried once or
twice more rather than skipped.

Unattended downloads accept only results that are certainly for the item
(`subtitles.Trustworthy`):

- a file-hash match, or an OpenSubtitles lookup by IMDb ID, or
- the provider's own title for the match agreeing with the item's, plus the
  year (within one) for movies. The titles come from OpenSubtitles
  `feature_details`, the SubDL page slug, and the Addic7ed show path.

Release-name ranking alone is not enough. The first live test, before this
rule, downloaded "Le Couperet" and "The Intern (2015)" subtitles for test
videos whose titles OpenSubtitles' text search matched loosely.

On the OpenSubtitles terms: automatic fetching "for one signed-in user's own
library, on that user's quota" is allowed, so a self-hosted Finora with the
owner's key and account fits. Fetching subtitles nobody asked for, to fill a
cache, is not. The job only fetches for videos in the library.

