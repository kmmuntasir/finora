---
tags: [jellyfin, testing]
updated: 2026-10-29
---

# Local Jellyfin sandbox

A throwaway Jellyfin for testing features that change data (playlists,
metadata edits, user policies), so the reference server stays read-only.

- Image `jellyfin/jellyfin:10.11.11`, container `finora-sandbox-jf`, bound
  to `127.0.0.1:8097`. Data lives outside the repository in
  `../finora-sandbox/` (`config/`, `cache/`, `media/`).
- Media is generated with ffmpeg: three short test-pattern movies, a
  three-episode show, a three-track album and an external `.srt`.
- The startup wizard is completed through the API (`/Startup/Configuration`,
  `/Startup/User`, `/Startup/Complete`). Libraries are added with
  `POST /Library/VirtualFolders`.
- Users: `admin` and `kid`, with throwaway passwords. An API key and the
  user IDs are in `../finora-sandbox/sandbox.env`, which is not tracked.
- To point local development at it, set `jellyfinUrl` in
  `web/public/config.json` (git-ignored) to `http://127.0.0.1:8097`.
- Online metadata works: "Comedy Night (2015)" was matched to a real comedy
  festival, and "Identify" can turn a test movie into a real title.

Start and stop it with `docker start finora-sandbox-jf` and
`docker stop finora-sandbox-jf`. Extra test files: a video with chapters and
an MKV with a styled ASS track and an attached font.

## README screenshots

`docs/screenshots/` comes from the sandbox filled with made-up titles, so no
copyrighted artwork is shown. `web/scripts/screenshots/catalogue.json` lists
the titles; `render.mjs <media-folder>` draws posters, backdrops and an album
cover next to long, low-bitrate generated clips; after a library scan,
`shots.mjs` (with `pnpm dev` running against the sandbox) signs in and saves
the screenshots. The server name was set to "Home Media" through
`/System/Configuration`.

## Recreate

Recreate from scratch: `docker rm -f finora-sandbox-jf`, delete
`../finora-sandbox/config`, then repeat the steps above.
