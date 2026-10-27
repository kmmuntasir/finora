---
tags: [jellyfin, environment]
updated: 2026-10-27
---

# Reference Server (anonymised)

The server Finora is built and tested against. Numbers are approximate and
change over time. Connection details live only in the local, untracked
`.env` (`JELLYFIN_URL`, `JELLYFIN_API_KEY`).

| Aspect | Value |
| --- | --- |
| Version | Jellyfin 10.11.11, x64 |
| Libraries | Movies, TV Series, Music, Collections (boxsets), three Home Videos libraries |
| Size | ~4,200 movies; ~195 series / ~14,000 episodes; ~5,500 songs / ~480 albums; ~300 collections |
| Home Videos | Folder-based; some titles mix Bengali and Latin script and are long |
| Users | ~34 family and friends, 3 admins; all hidden from the login screen; most have per-library access |
| Quick Connect | Enabled |
| Transcoding | CPU only, no hardware acceleration |
| Formats (sample of 300 movies) | Video mostly H.264, some AV1/HEVC/VP9; audio mostly AAC; subtitles almost all SRT |
| Trickplay | Enabled for Movies, TV, Stand-up |
| Intro / segment plugins | None installed |
| Library options | "Save subtitles with media" on everywhere |
| Plugins | AudioDB, MusicBrainz, OMDb, TMDb, Studio Images, LanguageTags, YoutubeMetadata |
| Clients | Jellyfin Web main video client; a Subsonic-style desktop music client is the most common device; Android, iOS, Android TV apps |
| Exposure | Plain HTTP via router port forward; home IP deliberately not in DNS |
| Custom CSS | Used today to inject a site-wide notice banner |

## UI implications

- Bengali text appears in titles: fonts need a Bengali fallback.
- Home Videos items often lack posters; 16:9 thumbnails and a designed
  fallback are needed.
- Music is used heavily; the music player is not an afterthought.
