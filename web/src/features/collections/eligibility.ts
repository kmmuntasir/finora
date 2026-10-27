import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";

const PLAYLIST_TYPES = new Set([
  "Movie",
  "Episode",
  "Season",
  "Series",
  "Video",
  "MusicVideo",
  "Audio",
  "MusicAlbum",
  "MusicArtist",
  "AudioBook",
  "Folder",
]);

const COLLECTION_TYPES = new Set([
  "Movie",
  "Series",
  "Video",
  "MusicVideo",
  "MusicAlbum",
  "Book",
  "AudioBook",
]);

/** Item types the official client offers "Add to playlist" for. */
export function canAddToPlaylist(item: BaseItemDto): boolean {
  return PLAYLIST_TYPES.has(item.Type ?? "");
}

export function canAddToCollection(item: BaseItemDto): boolean {
  return COLLECTION_TYPES.has(item.Type ?? "");
}
