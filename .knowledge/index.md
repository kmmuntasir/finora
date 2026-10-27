# Finora Knowledge Base

Project-specific knowledge for people and coding agents working on Finora.
Start here, then open only the notes you need.

The full product spec lives in [docs/concept.md](../docs/concept.md). This
knowledge base holds what the spec does not: verified facts, decisions with
their reasons, research, and a running log.

## Conventions

- One topic per note. Short, factual, dated where facts can go stale.
- Link notes with relative Markdown links so they work on GitHub and in
  Obsidian alike.
- Every note starts with front matter: `tags`, `updated`.
- Verified facts cite their source (Jellyfin source file and line, an API
  response, a documentation URL).
- Never store secrets or private details here — IP addresses, ports,
  domains, API keys, tokens, passwords, user names, emails. Use placeholders
  such as `<public-ip>`, `<port>` and `<jellyfin-api-key>` (full list in
  [CLAUDE.md](../CLAUDE.md)). The repository is public.
- Record notable work and findings in [log.md](log.md), newest first.

## Map

### Product

- [docs/concept.md](../docs/concept.md) — product concept, feature tiers (Tier 1 = Must), delivery phases
- [docs/ui-plan.md](../docs/ui-plan.md) — UI approach, visual direction, quality gates
- [api/README.md](../api/README.md) — Finora API configuration and environment variables
- [log.md](log.md) — chronological project log

### Decisions

| ID | Decision | Status |
| --- | --- | --- |
| [0001](decisions/0001-frontend-talks-directly-to-jellyfin.md) | Finora Web talks directly to Jellyfin | Accepted |
| [0002](decisions/0002-optional-go-api.md) | Optional Go API with SQLite, API only | Accepted |
| [0003](decisions/0003-single-jellyfin-address-and-profiles.md) | One Jellyfin address; HTTP and HTTPS profiles | Accepted |
| [0004](decisions/0004-admin-sign-in.md) | Admin sign-in rules; Google via Quick Connect | Accepted |
| [0005](decisions/0005-subtitle-delivery.md) | Subtitles uploaded through the API with immediate fallback | Accepted |
| [0006](decisions/0006-typeface-solaimanlipi.md) | Typeface: SolaimanLipi | Accepted |
| [0007](decisions/0007-design-workflow.md) | Design workflow without a designer | Accepted |

### Jellyfin

- [jellyfin/api-notes.md](jellyfin/api-notes.md) — verified API behaviour with source references
- [jellyfin/sandbox.md](jellyfin/sandbox.md) — throwaway local Jellyfin in Docker for testing writes
- [jellyfin/reference-server.md](jellyfin/reference-server.md) — what the reference server looks like (anonymised)

### Subtitles

- [subtitles/providers.md](subtitles/providers.md) — provider behaviour learned in `subtitle-fetcher`

### Frontend

- [web/frontend-notes.md](web/frontend-notes.md) — toolchain, SDK version pin, token pipeline gotchas

### Brand and design

- [brand/logo.md](brand/logo.md) — logo assets, colours, how the SVGs were made
- [design/references.md](design/references.md) — evaluated design tools and references
- [DESIGN.md](../DESIGN.md) — the design system (tokens + rationale)
