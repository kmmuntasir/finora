---
tags: [jellyfin, api, verified]
updated: 2026-10-28
---

# Jellyfin API Notes

Verified behaviour of Jellyfin **10.11.11**. Paths are relative to the
Jellyfin server repository at tag `v10.11.11`
(`git clone --depth 1 --branch v10.11.11 https://github.com/jellyfin/jellyfin.git`).
Re-verify when the target version changes.

## Authentication roles

- A request made with an API key gets the `Administrator` role
  (`Jellyfin.Api/Auth/CustomAuthenticationHandler.cs:54`).
- `RequestHelpers.GetUserId` lets administrators act for any `userId`; others
  get `Forbidden` (`Jellyfin.Api/Helpers/RequestHelpers.cs:67-85`).

## Quick Connect with an API key

- `POST /QuickConnect/Authorize?code=…&userId=…` requires any authenticated
  caller; `userId` goes through `GetUserId`
  (`Jellyfin.Api/Controllers/QuickConnectController.cs`).
- `AuthorizeRequest` calls `SessionManager.AuthenticateDirect` for that user
  and that request's device, with no password
  (`Emby.Server.Implementations/QuickConnect/QuickConnectManager.cs:136-170`).
- An authorized request expires one minute later, so the client must finish
  promptly.

## Revoking a session

- `DELETE /Devices?id=…` logs out every session of the device
  (`Jellyfin.Api/Controllers/DevicesController.cs:123`), and `Logout(Device)`
  deletes the device record and its access token
  (`Emby.Server.Implementations/Session/SessionManager.cs:1705`).
- Revocation is per device ID — use a unique device ID per session you may
  want to revoke.

## Subtitles

- `POST /Videos/{itemId}/Subtitles`, policy `SubtitleManagement`. Body
  `UploadSubtitleDto`: `Language`, `Format`, `IsForced`, `IsHearingImpaired`,
  `Data` (base64). Saves the file, then
  `QueueRefresh(item, MetadataRefreshOptions, RefreshPriority.High)`
  (`Jellyfin.Api/Controllers/SubtitleController.cs`).
- `DELETE /Videos/{itemId}/Subtitles/{index}` removes an external subtitle.
- Library option `SaveSubtitlesWithMedia` decides whether uploads land beside
  the video or in the metadata folder.

## Other verified behaviour

- CORS: responses carry `Access-Control-Allow-Origin: *`, and preflights for
  `authorization, content-type` succeed (tested against a 10.11.11 server).
- `GET /Items/{id}/Download` honours `Range` (returns `206` with
  `Content-Range`), so partial reads such as the OpenSubtitles hash (first
  and last 64 KB) need no file access.
