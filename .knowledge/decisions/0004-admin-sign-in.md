---
tags: [decision, security, auth]
updated: 2026-10-28
status: accepted
---

# 0004 — Admin sign-in rules; Google via Quick Connect

## Decision

| Profile | Jellyfin admin password | Google sign-in |
| --- | --- | --- |
| HTTPS | Allowed (nothing stored) | Optional |
| HTTP | Viewer access only; admin console stays locked | Required for the admin console |

Google flow, with no password involved:

1. Finora Web starts Quick Connect with Jellyfin, keeping the secret, and uses
   a fresh unique device ID.
2. The browser visits the Finora API's Google sign-in (HTTPS) carrying only
   the Quick Connect code.
3. The API verifies the Google ID token and maps the email to a Jellyfin
   admin user through an allowlist.
4. The API approves the code for that user with the API key:
   `POST /QuickConnect/Authorize?code=…&userId=…`.
5. Finora Web completes Quick Connect and holds a normal Jellyfin session.
6. The API revokes the device with `DELETE /Devices?id=…` when the session
   lifetime (default 12 h) ends.

## Implementation notes (2026-10-28)

- "Over HTTP" means a non-secure browser context: Finora Web checks
  `window.isSecureContext`, the API checks the request `Origin` (HTTPS or
  loopback counts as secure), so `localhost` development works with
  password sessions.
- The Google callback approves the Quick Connect code and stores a
  single-use **grant** (code + Jellyfin user, 5 minutes). The browser
  completes Quick Connect, then calls `POST /api/v1/auth/google/confirm`
  with its new token, the code and its device ID. The API redeems the grant
  only for the same user and checks the device belongs to that user via
  `GET /Devices?userId=…` before recording the Google session.
- Google sign-in uses PKCE and a single-use OAuth state (10 minutes).
- A janitor revokes expired Google sessions every minute with
  `DELETE /Devices?id=…`.

## Why it works

Verified in Jellyfin 10.11.11 source; see
[api-notes](../jellyfin/api-notes.md#quick-connect-with-an-api-key).

## Limits

- Google requires HTTPS redirect URIs and rejects raw IP hosts (only
  `localhost` is exempt), so the API needs an HTTPS hostname.
- On HTTP the session token still travels unencrypted; revocation bounds its
  lifetime.
- Jellyfin itself still accepts admin passwords on its own port. The HTTP
  rule is a Finora guard rail, not a security boundary.
