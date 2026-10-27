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

## Verified against the reference server

- A dev server on `http://127.0.0.1:5173` reads public server info from
  Jellyfin directly (CORS allowed); no console errors.
- SolaimanLipi 400 and 700 load and render; 100 loads on demand.
