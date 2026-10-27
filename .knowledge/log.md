---
tags: [log]
updated: 2026-10-28
---

# Project Log

Newest first. One entry per meaningful step: what happened, what was learned,
links to the notes that changed.

## 2026-10-28

- **Tier 2, overnight run (unattended).** Writes are tested against a
  throwaway local Jellyfin 10.11.11 in Docker with generated test media, so
  the family server stays read-only
  ([sandbox](jellyfin/sandbox.md)). Built so far:
  - PWA: manifest, icons and an app-shell service worker, registered only in
    secure contexts.
  - Item "More" menu: add to playlist or collection (with create), download,
    delete. Playlist page with drag-to-reorder, remove and rename; collection
    editing. The player continues through the playlist it was started from.
  - Admin tools on detail pages: refresh metadata, edit metadata, identify,
    edit images.
  - Admin user page: parental controls (rating, unrated items, allowed and
    blocked tags, viewing times), limits (streams, bitrate), devices with
    sign out, and approving a Quick Connect code for that user.
  - Later the same night: settings (subtitle appearance and timing,
    skip-segment behaviour, date format), home row order and Continue
    listening, user picker and PIN reset, library views and filters with
    multi-select, Suggestions/Upcoming/Networks/Episodes, search
    suggestions, trailers, a chapter menu, and styled ASS/SSA subtitles
    with JASSUB ([frontend notes](web/frontend-notes.md#styled-subtitles-assssa)).
  - Found that `/Devices?userId` lists every accessible device
    ([api-notes](jellyfin/api-notes.md#revoking-a-session)).
- **OpenSubtitles key care.** Read the OpenSubtitles API docs and integrator
  terms ([providers](subtitles/providers.md#opensubtitles-terms-and-limits)).
  Added download tracking and a 60-day purge warning, but no automatic
  keep-alive download, because the terms forbid fetching subtitles nobody
  asked for. Also added the attribution line that free keys require.
- **E2E tests.** Playwright (`pnpm test:e2e`) runs against a Jellyfin mocked
  with `page.route`. It covers sign-in, wrong password, reload, sign-out,
  home rows, library grid and filters, the detail page and search, on
  desktop and phone viewports.
- **Phase 7 (subtitle finder) built.** Go providers ported from
  `subtitle-fetcher` (Addic7ed, SubDL updated for its new markup,
  OpenSubtitles), payload checks, OpenSubtitles hash via Jellyfin range
  reads, upload to Jellyfin with indexed-copy detection, WebVTT fallback,
  delete. Web: "Find subtitles" dialog, player default selection, admin
  subtitle settings. Verified live, then reverted (the test episode is
  unchanged).
- **Tier 1 complete.** Added the last Must filters (year, age rating,
  resolution, has subtitles). Found a Jellyfin 10.11.11 bug where
  `hasSubtitles` drops resolution filters; the two are mutually exclusive in
  Finora ([api-notes](jellyfin/api-notes.md#item-query-filters)). Next: Tier 2,
  starting with the subtitle finder (Phase 7).
- **Phase 6b (Finora API) built.** Go 1.27 (installed to `~/.local/go1.27.3`),
  stdlib HTTP, SQLite (`modernc.org/sqlite`), embedded migrations; first-run
  setup code; settings with environment overrides; CORS allowlist; Jellyfin
  token checks; admin rule over insecure origins; announcements; Google
  sign-in via Quick Connect with PKCE, grants and revocation janitor. Go tests
  (race-clean) cover setup, CORS, admin rules, announcements and the full
  Google flow against fakes. Frontend: announcement banner, Google sign-in
  button and callback, admin Finora tab. Verified announcements end to end;
  Google sign-in itself needs a real OAuth client. Deployment files in
  `deploy/`, Dockerfiles in `api/` and `web/`.
- **Phase 6a (admin console) built.** Users list with search and online
  status, user editor (create, rename, enable, admin, hidden, library access,
  permissions, password set, delete with confirmation), active sessions with
  stop and message (5 s refresh), library scans with progress, link to the
  Jellyfin dashboard. HTTP lock implemented as `window.isSecureContext`
  (localhost counts as secure). Verified read-only against the server; no
  user was modified.
- **Phase 5 (settings) built.** Profile picture (base64 upload), password
  change, Quick Connect authorisation, theme (dark/light/system, light
  surfaces retuned in `DESIGN.md`), home layout, audio/subtitle languages and
  mode, default audio track, autoplay next, remember selections (all saved
  to the Jellyfin user configuration), streaming quality (device).
- **Phase 4 (music) built.** App-wide audio engine (universal audio endpoint),
  queue store with play next / add / reorder (dnd kit) / remove / shuffle /
  repeat, mini player bar, full-screen now playing with queue and synced
  lyrics, Instant Mix, album track rows, media session. Verified FLAC
  playback across navigation; test traces restored exactly.
- **Phase 3 (video player) built.** Own device profile, direct play / HLS
  fallback, subtitles and audio switching, quality and speed, trickplay seek
  previews, chapters, skip-segment button, up-next with countdown, keyboard
  and media-session controls, progress reporting. Test traces on the
  reference server were reverted (see `CLAUDE.md`).
- Phase 2 browsing complete for Tier 1: item detail pages (movie, series,
  episode, album, artist, person, collection, playlist), search across all
  libraries (Bengali verified), genre/studio browse pages, `/` and Ctrl+K
  search shortcut. Play buttons go to a placeholder until Phase 3.
- Home layouts kept as a per-user choice saved in Jellyfin display
  preferences. Phase 2 started: sidebar + phone tab bar, library pages with
  server-side sort/filters/genres, A–Z rail, virtualised infinite grid, folder
  navigation. Found and worked around slow folder user data
  ([api-notes](jellyfin/api-notes.md#slow-user-data-on-some-folders)).
- **Prototype round, Home:** three variants (A Spotlight hero, B Dashboard,
  C Focus) on real data at `/?v=a|b|c`, awaiting the owner's choice. Shared
  cards, rows, artwork fallbacks and home queries are built for reuse.
- **Phase 1 (sign-in) built.** Password login, Quick Connect, remember-me
  (localStorage vs sessionStorage), session restore via `/Users/Me`, 401 →
  "session ended", sign-out, route guards. Verified in a browser: guard
  redirect, Quick Connect code issued by the reference server, expiry path.
  A real password sign-in still needs the owner to try it. Notes in
  [web/frontend-notes.md](web/frontend-notes.md#authentication).
- **Phase 0 done.** `web/` scaffolded (Vite 8, React 19, TS 6, Tailwind 4),
  runtime `config.json` with HTTPS/HTTP mix check, `@jellyfin/sdk` 0.13.0,
  `DESIGN.md` (lint clean) with generated Tailwind tokens, SolaimanLipi
  WOFF2 fonts, minimal app shell. Verified in a browser against the
  reference server. See [web/frontend-notes.md](web/frontend-notes.md).
- Chose SolaimanLipi as the UI typeface ([0006](decisions/0006-typeface-solaimanlipi.md)).
- Wrote `docs/ui-plan.md` and vendored five design skills into
  `.claude/skills/` ([0007](decisions/0007-design-workflow.md)).
- Added git-ignored `.secrets.md` for private values behind placeholders.
- Created this knowledge base and `CLAUDE.md`.
- Evaluated 14 design repositories for the UI plan; see
  [design/references.md](design/references.md).
- Verified in Jellyfin 10.11.11 source that an API key can approve Quick
  Connect for any user and that deleting a device revokes its token; see
  [jellyfin/api-notes.md](jellyfin/api-notes.md) and
  [decision 0004](decisions/0004-admin-sign-in.md).
- Verified subtitle upload endpoint behaviour and HTTP range support; see
  [decision 0005](decisions/0005-subtitle-delivery.md).
- Reviewed the `subtitle-fetcher` project; summary in
  [subtitles/providers.md](subtitles/providers.md).

## 2026-10-27

- Rewrote `docs/concept.md` from scratch around the real server: viewer
  feature parity with the official web client, basic admin, deployment
  profiles.
- Decided on a separate React frontend and an optional Go API
  ([0001](decisions/0001-frontend-talks-directly-to-jellyfin.md),
  [0002](decisions/0002-optional-go-api.md),
  [0003](decisions/0003-single-jellyfin-address-and-profiles.md)).
- Vectorised the concept logo into SVGs; see [brand/logo.md](brand/logo.md).
- Added `.gitignore` (the local `.env` holds a Jellyfin API key).
