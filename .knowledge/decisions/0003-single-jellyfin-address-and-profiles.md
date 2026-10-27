---
tags: [decision, deployment, security]
updated: 2026-10-28
status: accepted
---

# 0003 — One Jellyfin address; HTTP and HTTPS profiles

## Context

Browsers block calls from an HTTPS page to `http://` URLs (mixed content),
including media and images. Many self-hosters, the reference operator
included, run Jellyfin on `http://<public-ip>:<port>` and do not want their
home IP published in DNS.

## Decision

- Jellyfin has exactly one configured address, used by browsers and by the
  Finora API.
- Two first-class deployment profiles:
  - **HTTPS:** Finora Web, Jellyfin and the API are all HTTPS.
  - **HTTP:** Finora Web and Jellyfin on `http://<ip>:<port>`; the API may be
    HTTP or HTTPS (HTTPS needed for Google sign-in).
- Finora Web checks at startup that an HTTPS page is not configured with HTTP
  URLs, and shows a clear error if it is.

## Consequences

- If the API runs on the LAN and the Jellyfin address is the router's public
  IP, the router must support NAT loopback.
- On HTTP, viewer credentials and media travel unencrypted — the same as
  using Jellyfin over HTTP without Finora.
