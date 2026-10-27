# Finora API

Optional Go service for features Jellyfin lacks: the subtitle finder,
announcements, Google sign-in for admins and Finora-wide settings.
It never serves the frontend and never proxies media. See
[../docs/concept.md](../docs/concept.md), section 7.

## Run

```bash
go build -o finora-api ./cmd/finora-api
FINORA_DATA_DIR=./data FINORA_LISTEN=:8080 ./finora-api
```

On first start without a Jellyfin connection, the log prints a one-time setup
code. Open Finora Web → Admin → Finora and enter it with the Jellyfin address
and an API key. Alternatively, configure everything with environment
variables (they override saved settings and lock them in the UI):

| Variable | Meaning |
| --- | --- |
| `FINORA_LISTEN` | Listen address, default `:8080` |
| `FINORA_DATA_DIR` | Directory for `finora.db`, default `./data` |
| `FINORA_JELLYFIN_URL` | Jellyfin address, for example `http://<public-ip>:<port>` |
| `FINORA_JELLYFIN_API_KEY` | Jellyfin API key (never sent to browsers) |
| `FINORA_ALLOWED_ORIGINS` | Comma-separated Finora Web origins allowed by CORS |
| `FINORA_PUBLIC_URL` | This API's public **HTTPS** address (Google redirect URI base) |
| `FINORA_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `FINORA_GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `FINORA_GOOGLE_SESSION_HOURS` | Lifetime of Google admin sessions, default `12` |
| `FINORA_SUBTITLE_PROVIDERS` | Search order, default `addic7ed,subdl,opensubtitles`; `none` disables |
| `FINORA_SUBTITLE_ACCESS` | `all` (default) or `admins` |
| `FINORA_SUBTITLE_DAILY_LIMIT` | Downloads per user per day, default `20`, `0` = no limit |
| `FINORA_OPENSUBTITLES_API_KEY` | OpenSubtitles.com API key (optional) |
| `FINORA_OPENSUBTITLES_USERNAME` / `_PASSWORD` | Optional account for a higher daily quota |

Google sign-in needs an OAuth client in Google Cloud with the redirect URI
`<FINORA_PUBLIC_URL>/api/v1/auth/google/callback`, and at least one Google
account linked to a Jellyfin administrator (Admin → Finora).

## Develop

```bash
go vet ./...
go test ./...
```

Deployment examples: [../deploy/](../deploy/).
