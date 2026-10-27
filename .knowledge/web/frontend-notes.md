---
tags: [web, frontend, gotchas]
updated: 2026-10-28
---

# Frontend Notes

Facts and gotchas learned while building Finora Web.

## Toolchain (Phase 0, October 2026)

| Tool | Version | Note |
| --- | --- | --- |
| Vite | 8 | Created with `create-vite` `react-ts` template |
| React | 19 | |
| TypeScript | 6 | `strict`, `noUncheckedIndexedAccess` |
| Tailwind CSS | 4 | `@tailwindcss/vite`; theme generated from `DESIGN.md` |
| React Router | 8 | `createBrowserRouter`, `RouterProvider` from `react-router` |
| TanStack Query | 5 | |
| Vitest | 5 | jsdom environment |
| oxlint, Prettier | | `pnpm check` runs everything |

## `@jellyfin/sdk` version

- `1.0.x` targets **Jellyfin 12** (`API_VERSION` 12.3.0).
- `0.13.0` targets **Jellyfin 10.11** (`API_VERSION` 10.11.1). Finora pins
  this while the reference server runs 10.11.
- Per-endpoint helpers live in `@jellyfin/sdk/lib/utils/api/<name>-api`.

## Design tokens → Tailwind

- `web/scripts/build-tokens.mjs` reads the YAML front matter of `DESIGN.md`
  and writes `web/src/styles/tokens.css` (dark values on `:root`, `light-*`
  overrides on `[data-theme="light"]`, utilities via `@theme inline`).
- **Gotcha:** named spacing tokens such as `--spacing-2xl` shadow Tailwind's
  container sizes, so `max-w-2xl` silently became 32px. T-shirt spacing
  steps are therefore not exported; code uses Tailwind's numeric 4px scale
  (`sm` = 2, `md` = 3, `lg` = 4, `xl` = 6, `2xl` = 8, …). Only semantic
  spacing tokens (`page-x`, `sidebar`, `player-bar`, …) are exported.
- Typography tokens become `text-<name>` utilities that set size, line
  height, weight and letter spacing together.

## Authentication

- Only the access token is stored (`finora.session`): localStorage with
  "keep me signed in", sessionStorage without. Sessions are bound to the
  configured Jellyfin URL.
- Each SDK `Api` gets its own Axios instance; the signed-in client has an
  interceptor that treats any 401 as an ended session.
- Quick Connect: `POST /QuickConnect/Initiate` → poll
  `GET /QuickConnect/Connect?secret=` every 3 s → `POST
  /Users/AuthenticateWithQuickConnect`. Requests expire after 10 minutes
  (`QuickConnectManager.Timeout`), after which the poll returns 404.
- The login disclaimer is rendered as plain text (no HTML) to avoid XSS.
- In development, React StrictMode runs the restore effect twice, so an
  invalid token shows two 401s in the console; this is expected.

## Artwork and home data

- Image endpoints (`/Items/{id}/Images/{type}?tag=&maxWidth=`) need no
  authentication; the tag makes URLs cacheable.
- Fallback order for 16:9 frames mirrors Jellyfin: Thumb / Backdrop (own,
  then parent), otherwise the **Primary** image — the poster, or for videos
  without one the frame Jellyfin extracted at indexing — shown letterboxed on
  a blurred copy instead of a placeholder (`wideArtwork` in
  `web/src/api/images.ts`). Owner feedback, 2026-10-28.
- On the reference server every item has a Primary image; many Bangla films
  have no backdrop or logo, and episodes have no own backdrop.
- `/Items/Latest` on a music library returns individual tracks; Finora queries
  `MusicAlbum` items sorted by `DateCreated` instead.
- Next Up includes episodes already in Continue Watching; Finora removes
  those duplicates.

## Player

- Device profile is Finora's own (`web/src/features/player/device-profile.ts`);
  the SDK's `getBrowserDeviceProfile` only covers subtitles. Codecs are
  probed with `MediaSource.isTypeSupported` and `canPlayType`.
- Direct play uses `/Videos/{id}/stream.{container}?Static=true&ApiKey=…`.
  `<video>` and `<img>` cannot send headers, so the token goes in the URL for
  streams and trickplay tiles (same as jellyfin-web). API calls still use the
  `Authorization` header.
- Server-side conversion uses HLS with fMP4 segments (`Container: mp4`) so
  H.264, HEVC and AV1 can be copied without re-encoding; hls.js plays it
  where the browser lacks native HLS.
- Text subtitles are requested as external WebVTT (`Stream.vtt`) and shown
  through `<track>`; image subtitles (PGS, VobSub) are burned in, which
  needs a transcode.
- Play method shown in the info panel: only `ContainerNotSupported` is a
  remux ("direct stream"); a bitrate cap means re-encoding.
- If direct play fails in the browser, the player retries once with direct
  play disabled.
- Progress is reported every 10 s and on pause/seek; the final stop uses a
  keepalive `fetch` on page hide, then `DELETE /Videos/ActiveEncodings` frees
  ffmpeg for converted streams.
- Every playback start increments `PlayCount` and sets `LastPlayedDate`
  (`SessionManager.OnPlaybackStart`), in every client.

## Verified against the reference server

- A dev server on `http://127.0.0.1:5173` reads public server info from
  Jellyfin directly (CORS allowed); no console errors.
- SolaimanLipi 400 and 700 load and render; 100 loads on demand.
- Player (Chromium): MP4 H.264/AAC direct plays; capped quality switches to
  HLS fMP4 via hls.js; trickplay thumbnails and chapter names show; exiting
  ends the server session and its encoder.
