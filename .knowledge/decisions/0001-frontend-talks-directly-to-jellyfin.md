---
tags: [decision, architecture]
updated: 2026-10-28
status: accepted
---

# 0001 — Finora Web talks directly to Jellyfin

## Context

Finora replaces the official Jellyfin web client. Media must not pass through
any Finora service: the reference operator fronts small services with a CDN
proxy that forbids video, and the home upload link is the bottleneck anyway.

## Decision

Finora Web is a static React app that calls Jellyfin's API, image, stream and
websocket endpoints directly from the browser, like any Jellyfin client.
Jellyfin answers `Access-Control-Allow-Origin: *` by default, so no proxy is
needed.

## Consequences

- Browsing, playback, music, user settings and the admin console work with no
  Finora backend at all.
- The browser must be able to reach Jellyfin, and an HTTPS page needs an
  HTTPS Jellyfin ([0003](0003-single-jellyfin-address-and-profiles.md)).
