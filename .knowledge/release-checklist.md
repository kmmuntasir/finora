---
tags: [release]
updated: 2026-10-29
---

# First-release checklist

Status of the definition of done in
[docs/concept.md](../docs/concept.md#10-definition-of-done-first-release),
checked on 2026-10-29. Items marked "owner" need a check on the reference
server that this project may not do on its own (it is read-only and a live
family server).

| Item | Status | Evidence |
| --- | --- | --- |
| Must features work against the real server | Owner | Each phase was checked read-only against the reference server (see [log](log.md)); writes were tested on the [sandbox](jellyfin/sandbox.md). A full pass with the owner's account is still open. |
| HTTP and HTTPS profiles tested and documented | Partly | Both documented in `docs/deployment.md`. The HTTP profile ran from `deploy/docker-compose.example.yml`. HTTPS was only exercised as a secure context on `localhost`, not behind a real TLS proxy. |
| Most files direct play; transcode reason visible | Owner | Direct play verified on the reference server in Phase 3 and in `web/e2e/play.spec.ts` (static stream). The share of direct play across the whole library is unmeasured. |
| Resume and watched state in sync with other clients | Owner | Finora reports progress through Jellyfin's own session endpoints (`play.spec.ts` checks the reports); a cross-client check is open. |
| Admins manage users, access and permissions | Done | Admin console (Phase 6a), parental controls and limits (Tier 2), `web/e2e/admin.spec.ts`. |
| Works fully without the Finora API | Done | All e2e tests run with `apiUrl: null`. |
| Downloaded subtitle usable at once, visible elsewhere | Owner | Verified live in Phase 7 and reverted; other clients only see it after Jellyfin indexes it. |
| No secret reaches the browser | Done | The API returns only `…Set` flags for keys and secrets (`api/internal/httpapi/handlers.go`); the web build reads no environment secrets; the built bundle does not contain the keys from `.env`. |
| Desktop and phone browsers | Done | e2e runs on desktop and phone viewports; real phones still worth a try. |
| Critical flows have automated tests | Done | Sign-in, browse, play and admin user edit in `web/e2e/`; accessibility checks in `a11y.spec.ts`. |
| Deployment documented and reproducible | Done | `docs/deployment.md`, `deploy/`, both images built and run from a clean checkout. |
| No credentials or secrets in the repository | Done | Whole git history searched for the keys in `.env` and the private values in `.secrets.md`: no hits. |
