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
- `GET /Devices?userId=…` does **not** list the user's own devices. It
  returns every device the user may *access*
  (`DeviceManager.GetDevicesForUser` filters with `CanAccessDevice`), which
  is all devices when `EnableAllDevices` is on (the default). To find the
  devices someone signed in on, also match `LastUserId`
  (`Jellyfin.Server.Implementations/Devices/DeviceManager.cs:181`). Finora
  does this in both the admin device list and the API's Google sign-in check.

## Subtitles

- `POST /Videos/{itemId}/Subtitles`, policy `SubtitleManagement`. Body
  `UploadSubtitleDto`: `Language`, `Format`, `IsForced`, `IsHearingImpaired`,
  `Data` (base64). Saves the file, then
  `QueueRefresh(item, MetadataRefreshOptions, RefreshPriority.High)`
  (`Jellyfin.Api/Controllers/SubtitleController.cs`).
- `DELETE /Videos/{itemId}/Subtitles/{index}` removes an external subtitle.
- Library option `SaveSubtitlesWithMedia` decides whether uploads land beside
  the video or in the metadata folder.

## Slow user data on some folders

- On the reference server, `GET /Items?userId=…&parentId=<Kids Content view>`
  took 33–50 s, while the same call without `userId`, or with
  `enableUserData=false`, took ~30 ms. Other folder libraries were fast.
  Measured 2026-10-28.
- Cause: computing per-user played state for folder items. Finora lists
  folder libraries with `enableUserData=false` and then fetches user data
  only for the playable items in the page (`ids=…`, ~0.2 s).
- Single-item lookups for folders (`useItemSummary`) also skip user data.
- `GET /Items/{id}/Ancestors` returns the library's physical root folder
  (type `Folder`) and `root` (`AggregateFolder`), not the user view, so
  breadcrumbs drop those.

## Item query filters

- `GET /Studios?userId=…` returns nothing in 10.11.11: passing `userId`
  builds a user-scoped query that matches no studio
  (`Jellyfin.Api/Controllers/StudiosController.cs:95`). Without `userId` it
  works, also with a user token. Studio entities only exist after a library
  scan has run since the metadata was fetched.
- `/Items` has `tags`, `studioIds`, `is3D`, `hasTrailer`,
  `hasSpecialFeature` and `seriesStatus` filters, but no HDR filter.

- `isHd=true` means HD **excluding** 4K; `isHd=false` means SD; `is4K=true`
  means 4K (`BaseItemRepository` resolution filter, 10.11.11).
- **Bug (10.11.11):** combining `hasSubtitles` with `isHd`/`is4K` drops the
  resolution filter. On the reference server `is4K=true` gives 2 movies but
  `is4K=true&hasSubtitles=true` gives 3,237 (the same as `hasSubtitles`
  alone). Genre + resolution combines correctly. Finora makes the two
  filters mutually exclusive. Measured 2026-10-28.

## User settings

- `POST /UserImage?userId=…` expects the image **base64-encoded** in the body
  with the image's `Content-Type` (`ImageController.PostUserImage` reads it
  through `GetFromBase64Stream`).
- `GET /Localization/Cultures` contains several cultures per three-letter
  code (Chinese variants share `zho`); de-duplicate before using codes as
  keys.
- Viewer preferences live in the user configuration
  (`POST /Users/Configuration?userId=…`): `AudioLanguagePreference`,
  `SubtitleLanguagePreference`, `SubtitleMode`, `PlayDefaultAudioTrack`,
  `EnableNextEpisodeAutoPlay`, `RememberAudioSelections`,
  `RememberSubtitleSelections`.

## Playlists, collections and item editing

- Playlist entries are addressed by `PlaylistItemId`, which in 10.11 is the
  linked item's ID in `N` format. `MoveItem` and `RemoveItemFromPlaylist`
  both match on it (`Emby.Server.Implementations/Playlists/PlaylistManager.cs:261,299`).
- Only the owner, or a user the playlist is shared with `CanEdit`, may
  change a playlist. `GET /Playlists/{id}/Users/{userId}` with your own user
  ID tells you (`CanEdit`), including for the owner
  (`Jellyfin.Api/Controllers/PlaylistsController.cs:225`).
- `/Collections` needs the `CollectionManagement` policy, which comes from
  `UserPolicy.EnableCollectionManagement`; admins have it too.
- `POST /Items/{id}` replaces fields such as `Genres`, `Name` and
  `ProviderIds` with whatever is sent, so send the full item with edits
  merged in (`Jellyfin.Api/Controllers/ItemUpdateController.cs:238`).
- `POST /Items/RemoteSearch/Apply/{id}` and `POST /Items/{id}/Refresh`
  return at once and refresh in the background. Downloading a remote
  backdrop adds a backdrop instead of replacing the first one.
- `GET /Items/{id}/Download` answers with `Content-Disposition: attachment`,
  so a plain link downloads without leaving the page.

## Display preferences (CustomPrefs)

- Finora stores its per-user settings in `CustomPrefs` of
  `DisplayPreferences/finora?client=finora`.
- Keys starting with `homesection` or `landing-` are Jellyfin's own: the
  server parses `homesectionN` as a number and returns HTTP 500 for any
  other suffix (`Jellyfin.Api/Controllers/DisplayPreferencesController.cs:180`).
  Keys such as `chromecastVersion`, `skipBackLength`, `skipForwardLength`,
  `enableNextVideoInfoOverlay`, `dashboardTheme` and `tvhome` are moved
  into dedicated columns (lines 149–176).
- Two overlapping saves that both add a new key fail with
  `UNIQUE constraint failed: CustomItemDisplayPreferences…` (HTTP 500).
  Finora queues saves so only one runs at a time.
- Library order and home exclusions are user configuration, shared with
  other clients: `OrderedViews`, `MyMediaExcludes`, `LatestItemsExcludes`.
  `/UserViews` already returns libraries in `OrderedViews` order.

## Parental controls

- `GET /Localization/ParentalRatings` returns ratings with
  `RatingScore {score, subScore}`; several names share a score ("PG",
  "TV-PG"). A user's limit is `MaxParentalRating` plus
  `MaxParentalSubRating`.
- `AccessSchedules` use `DayOfWeek` values `Sunday`…`Saturday`, `Everyday`,
  `Weekday` and `Weekend`, with fractional hours (`8.5` = 08:30).

## Other verified behaviour

- CORS: responses carry `Access-Control-Allow-Origin: *`, and preflights for
  `authorization, content-type` succeed (tested against a 10.11.11 server).
- `GET /Items/{id}/Download` honours `Range` (returns `206` with
  `Content-Range`), so partial reads such as the OpenSubtitles hash (first
  and last 64 KB) need no file access.
