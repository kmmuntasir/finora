---
tags: [decision, architecture, backend]
updated: 2026-10-28
status: accepted
---

# 0002 — Optional Go API with SQLite, API only

## Context

Some features need server-side work or secrets: searching subtitle providers,
keeping provider credentials and the Jellyfin API key away from browsers,
Google sign-in, announcements, Finora-wide settings.

## Decision

- A small Go service with SQLite (`modernc.org/sqlite`, pure Go) provides a
  JSON API under `/api/v1`.
- It is **optional**. Features that need it are hidden when `apiUrl` is not
  configured or the API is unreachable.
- It does **not** serve the frontend and does **not** proxy media or the
  Jellyfin API.
- The frontend is a separate React app built to `dist/` and served by Nginx
  or any static server.

## Consequences

- Two deployables; a small LXC can host both.
- The API carries only JSON and subtitle text, so it can sit behind a CDN
  proxy that hides the origin IP.
