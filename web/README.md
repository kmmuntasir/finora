# Finora Web

The Finora frontend: a React single-page app that talks directly to Jellyfin.
Product scope: [../docs/concept.md](../docs/concept.md). UI approach:
[../docs/ui-plan.md](../docs/ui-plan.md).

## Requirements

- Node.js 24+
- pnpm

## Setup

```bash
pnpm install
cp public/config.example.json public/config.json
# edit public/config.json: set jellyfinUrl to your Jellyfin server
pnpm dev
```

`config.json` is loaded at runtime from next to `index.html`, so one build
works in every deployment:

| Key           | Required | Meaning                                                                    |
| ------------- | -------- | -------------------------------------------------------------------------- |
| `jellyfinUrl` | Yes      | Jellyfin address used by browsers, for example `http://<public-ip>:<port>` |
| `apiUrl`      | No       | Optional Finora API base URL, or `null`                                    |

If the page is served over HTTPS, both URLs must be HTTPS; Finora shows a
clear error otherwise.

## Scripts

| Command       | What it does                                           |
| ------------- | ------------------------------------------------------ |
| `pnpm dev`    | Generate design tokens, start the dev server           |
| `pnpm build`  | Generate tokens, type-check, build to `dist/`          |
| `pnpm tokens` | Regenerate `src/styles/tokens.css` from `../DESIGN.md` |
| `pnpm check`  | Formatting, lint, type-check and tests                 |
| `pnpm test`   | Unit tests (Vitest)                                    |

## Notes

- Design tokens live in [../DESIGN.md](../DESIGN.md); never edit
  `src/styles/tokens.css` by hand.
- `@jellyfin/sdk` is pinned to `0.13.x`, the line that targets Jellyfin
  10.11. The `1.x` line targets Jellyfin 12.
- Fonts: SolaimanLipi (SIL OFL 1.1), licence in `src/assets/fonts/OFL.txt`.
