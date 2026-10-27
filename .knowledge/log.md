---
tags: [log]
updated: 2026-10-28
---

# Project Log

Newest first. One entry per meaningful step: what happened, what was learned,
links to the notes that changed.

## 2026-10-28

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
