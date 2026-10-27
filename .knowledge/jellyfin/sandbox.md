---
tags: [jellyfin, testing]
updated: 2026-10-28
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

Recreate from scratch: `docker rm -f finora-sandbox-jf`, delete
`../finora-sandbox/config`, then repeat the steps above.
