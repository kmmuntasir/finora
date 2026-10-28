# Deploying Finora

Finora Web is a folder of static files. The Finora API is an optional single
binary. Both talk to your existing Jellyfin server.

## 1. Choose a setup

Browsers block requests from an `https://` page to `http://` addresses. That
single rule decides which combinations work:

| | HTTPS setup | HTTP setup |
| --- | --- | --- |
| Finora Web | `https://finora.example.com` | `http://<public-ip>:<web-port>` |
| Jellyfin | Must be `https://` | `http://` or `https://` |
| Finora API (optional) | Must be `https://` | `http://` or `https://` (HTTPS needed for Google sign-in) |
| Admin console sign-in | Jellyfin password, or Google | Google only |
| Install as an app (PWA) | Yes | No |
| Traffic encrypted | Yes | No — the same as using Jellyfin over HTTP today |

Finora checks this at startup and explains the problem if an HTTPS page is
configured with an HTTP address.

**HTTP setup in practice.** Run Finora Web next to Jellyfin and forward a
router port to it, exactly as you already do for Jellyfin. The Finora API can
sit behind a CDN proxy such as Cloudflare on an HTTPS hostname: it only
carries small JSON requests and subtitle text, never video.

## 2. Finora Web

Build once, configure at runtime:

```bash
cd web
pnpm install
pnpm build                # output in web/dist/
```

Serve `web/dist/` with any static web server, falling back to `index.html`
for unknown paths. An Nginx config is in [`web/nginx.conf`](../web/nginx.conf).

Put a `config.json` next to `index.html`:

```json
{
  "jellyfinUrl": "http://<public-ip>:<port>",
  "apiUrl": null
}
```

Set `apiUrl` to the Finora API's address to enable the subtitle finder,
announcements and Google sign-in.

## 3. Finora API (optional)

```bash
cd api
go build -o finora-api ./cmd/finora-api
FINORA_DATA_DIR=/var/lib/finora FINORA_LISTEN=:8080 ./finora-api
```

On first start the log shows a one-time **setup code**. Open Finora Web →
**Admin → Finora**, enter the code, the Jellyfin address and a Jellyfin API key
(Jellyfin dashboard → Administration → API Keys). You can instead set
everything with environment variables; see [api/README.md](../api/README.md).

Important settings:

- **Allowed origins:** the exact address(es) Finora Web is served from, for
  example `http://<public-ip>:<web-port>`.
- **Jellyfin address:** the same single address browsers use. If the API runs
  inside your home network and that address is your router's public IP, the
  router must support NAT loopback (hairpin NAT). Check with
  `curl http://<public-ip>:<port>/System/Info/Public` from the API's machine.
- **Back up** the data directory (`finora.db` and `subtitles/`).

A systemd unit is in [`deploy/finora-api.service`](../deploy/finora-api.service).

## 4. Docker

```bash
cp deploy/docker-compose.example.yml docker-compose.yml
cp deploy/compose.env.example .env                # ports, Jellyfin address, origins
cp web/public/config.example.json config.json     # what browsers use
docker compose up -d --build
```

Finora Web listens on `FINORA_WEB_PORT` (default 8080) and the API on
`FINORA_API_PORT` (default 8081). Without `FINORA_JELLYFIN_API_KEY`, finish
the API setup under **Admin → Finora** with the code from
`docker compose logs api`. The API keeps its database and subtitles in the
`finora-data` volume.

## 5. Google sign-in for admins (optional)

Needed for the admin console in the HTTP setup; optional with HTTPS.

1. Give the Finora API an HTTPS address (`FINORA_PUBLIC_URL`).
2. In Google Cloud, create an OAuth client (web application) with the
   redirect URI `<FINORA_PUBLIC_URL>/api/v1/auth/google/callback`.
3. Enter the client ID and secret under **Admin → Finora**, and link each
   admin's Google account to their Jellyfin administrator account.
4. Make sure Quick Connect is enabled in Jellyfin.

Sessions created this way end automatically after the configured lifetime
(12 hours by default). Over plain HTTP, Google sign-in keeps admin passwords
off the network, but the session token still travels unencrypted while you
use it.

## 6. Subtitle finder (optional)

Works with the Finora API. Addic7ed and SubDL need no account; for
OpenSubtitles add a free API key from opensubtitles.com under
**Admin → Finora → Subtitle finder**. Subtitles are uploaded to Jellyfin, which
saves them beside the video when the library option "Save subtitles into
media folders" is on.

## 7. Security checklist

- Use HTTPS where you can.
- Give everyone, including admins, a non-admin Jellyfin account for daily
  viewing; use admin accounts only when needed.
- Use long, unique passwords for Jellyfin administrator accounts.
- Keep the Jellyfin API key and OAuth secrets out of version control; the
  Finora API never sends them to browsers.
