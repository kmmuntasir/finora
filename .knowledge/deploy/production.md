---
tags: [deploy, production]
updated: 2026-10-29
---

# Production: the homelab LXC

The owner's homelab deployment is **production** (decided 2026-10-29).
Development happens on the local machine; deploy to production **only when
the owner asks**. Real addresses are in `.secrets.md` (section "Production")
and `.env.deploy`, both git-ignored.

## Layout

| Piece | Where |
| --- | --- |
| Host | Proxmox LXC `finora`, Debian 12, 1 core, 128 MB RAM + 128 MB swap, 1 GB disk, static `<lan-ip>`, starts on boot |
| Finora Web | nginx (`nginx-light`) on port 80, files in `/var/www/finora`, site `/etc/nginx/sites-available/finora` (= `web/nginx.conf` with that root) |
| Browser address | `http://<public-ip>:<finora-port>`, a router port forward to the container's port 80 |
| Finora API | `/usr/local/bin/finora-api`, unit `deploy/finora-api.service`, settings in `/etc/finora/api.env` (mode 600), data in `/var/lib/finora` |
| API address | `https://finora-api.example.com`: Cloudflare (orange cloud, wildcard record) → Zoraxy on the gateway container → `<lan-ip>:8081` |
| Jellyfin, for browsers | `http://<public-ip>:<port>` in `/var/www/finora/config.json` |
| Jellyfin, for the API | the LAN address `http://<lan-ip>:8096`, so API traffic stays inside the home network |

`api.env` sets `FINORA_LISTEN=:8081`, the Jellyfin URL and API key,
`FINORA_ALLOWED_ORIGINS` (the public web address and the LAN one),
`FINORA_PUBLIC_URL` and the OpenSubtitles key. Google sign-in is not set up
yet, so the admin console stays locked on this HTTP setup until it is
([deployment guide](../../docs/deployment.md#5-google-sign-in-for-admins-optional)).

Measured after the first deploy: about 19 MB RAM in use (nginx about 10 MB,
API about 12 MB) and 504 MB of the 1 GB disk (Debian itself takes most of
it; `postfix` and `man-db` were removed).

## Deploying an update

```bash
export PATH=$HOME/.local/go1.27.3/bin:$PATH   # Go for the API build
deploy/deploy-lxc.sh            # web and API; or `web` / `api` alone
```

The script builds locally, copies the files over SSH (through the jump host
in `.env.deploy`), keeps the server's `config.json` and `api.env`, swaps the
web folder and restarts the API. Afterwards check
`http://<public-ip>:<finora-port>/` and
`https://finora-api.example.com/api/v1/public/config`.

## Lessons from the first deploy

- Plain HTTP on a real address is **not a secure context**, unlike
  `localhost` and `127.0.0.1` used in development. `crypto.randomUUID` and
  `navigator.clipboard` are missing there, and the app crashed at start.
  Use `randomId()` and `copyText()` from `web/src/lib/`; an oxlint rule
  forbids the originals, and the `plain-http` Playwright project runs the
  app on `http://finora.test:4173` to catch the rest.
- Chrome on Android offers only "Create shortcut", not "Install": Chrome
  installs a web app only when it is served over HTTPS
  ([install criteria](https://web.dev/articles/install-criteria)), and
  Finora registers its service worker only in secure contexts.
- The router supports NAT loopback, so the public Jellyfin address also
  works from inside the home network.
