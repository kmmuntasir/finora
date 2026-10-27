# Finora

Finora is an open-source web client for Jellyfin: a React frontend that talks
directly to Jellyfin, plus an optional Go API for features Jellyfin lacks
(subtitle finder, announcements, Google sign-in for admins, settings).

## Read first

1. [.knowledge/index.md](.knowledge/index.md) — the knowledge base: decisions,
   verified Jellyfin behaviour, research, project log.
2. [docs/concept.md](docs/concept.md) — product concept and feature scope.

Open other notes only when the task needs them.

## Keep the knowledge base current

- When you learn something durable (verified API behaviour, a decision and its
  reason, research results), add or update a note in `.knowledge/` and link it
  from `.knowledge/index.md`.
- Add an entry to `.knowledge/log.md` (newest first) for every meaningful
  step.
- Decisions go in `.knowledge/decisions/NNNN-short-title.md` with context,
  decision and consequences. Do not rewrite accepted decisions; supersede them
  with a new one.
- Cite sources for facts: Jellyfin source file and line, API response, or URL.

## Rules

- **No secrets or private details in tracked files.** The local `.env` holds
  `JELLYFIN_URL` and `JELLYFIN_API_KEY` for development; it is git-ignored.
  Never print the API key.
- **Use placeholders in `.knowledge/` and all other tracked files.** Never
  write the owner's real IP addresses (public or LAN), ports, domains,
  hostnames, API keys, tokens, passwords, user names, email addresses or
  phone numbers. Use placeholders instead:

  | Real value | Placeholder |
  | --- | --- |
  | Public IP | `<public-ip>` |
  | LAN IP | `<lan-ip>` |
  | Port | `<port>` |
  | Jellyfin URL | `http://<public-ip>:<port>` |
  | Domain or hostname | `example.com`, `finora.example.com` |
  | API key, token, password | `<jellyfin-api-key>`, `<token>`, `<password>` |
  | User name, email | `<username>`, `<admin@example.com>` |

  Real values live in `.secrets.md` (git-ignored) and the API key in `.env`
  (git-ignored). Read them from there when local work needs them; never copy
  them into tracked files. Add new private values to `.secrets.md`.
- **Read-only against the reference server** unless the user approves a
  change. It is a live family server.
- **Jellyfin source for lookups:** clone tag `v10.11.11` (the reference
  server's version) next to this repository and grep it instead of guessing:
  `git clone --depth 1 --branch v10.11.11 https://github.com/jellyfin/jellyfin.git`.
- **Never let media pass through the Finora API**, and keep Finora Web fully
  functional without it (see decisions 0001–0003).
- **Support both HTTP and HTTPS deployments** (decision 0003).
- Validate Markdown after writing it (the `markdown-writer` skill, if
  available).
- Commit only when asked.
