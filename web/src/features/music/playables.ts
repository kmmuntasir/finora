import type { Api } from "@jellyfin/sdk";
import {
  BaseItemKind,
  ItemFields,
  ItemSortBy,
  type BaseItemDto,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getInstantMixApi } from "@jellyfin/sdk/lib/utils/api/instant-mix-api";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";

const MUSIC_TYPES = new Set(["MusicAlbum", "MusicArtist", "MusicGenre", "Audio"]);

/** Whether Play for this item belongs to the music player rather than the video player. */
export function isMusic(item: BaseItemDto): boolean {
  return item.MediaType === "Audio" || MUSIC_TYPES.has(item.Type ?? "");
}

const FIELDS = [ItemFields.PrimaryImageAspectRatio, ItemFields.MediaSourceCount];

/** Tracks to queue for an album, artist, playlist or single song, in listening order. */
export async function fetchTracks(
  api: Api,
  userId: string,
  item: BaseItemDto,
): Promise<BaseItemDto[]> {
  const items = getItemsApi(api);
  switch (item.Type) {
    case "Audio":
      return [item];
    case "MusicAlbum":
      return (
        (
          await items.getItems({
            userId,
            parentId: item.Id!,
            includeItemTypes: [BaseItemKind.Audio],
            sortBy: [ItemSortBy.ParentIndexNumber, ItemSortBy.IndexNumber, ItemSortBy.SortName],
            fields: FIELDS,
          })
        ).data.Items ?? []
      );
    case "MusicArtist":
      return (
        (
          await items.getItems({
            userId,
            artistIds: [item.Id!],
            includeItemTypes: [BaseItemKind.Audio],
            recursive: true,
            sortBy: [
              ItemSortBy.PremiereDate,
              ItemSortBy.Album,
              ItemSortBy.ParentIndexNumber,
              ItemSortBy.IndexNumber,
            ],
            fields: FIELDS,
            limit: 500,
          })
        ).data.Items ?? []
      );
    default:
      // Playlists keep their own order.
      return (
        (await items.getItems({ userId, parentId: item.Id!, fields: FIELDS })).data.Items ?? []
      );
  }
}

export async function fetchInstantMix(
  api: Api,
  userId: string,
  item: BaseItemDto,
): Promise<BaseItemDto[]> {
  const { data } = await getInstantMixApi(api).getInstantMixFromItem({
    itemId: item.Id!,
    userId,
    limit: 100,
    fields: FIELDS,
  });
  return data.Items ?? [];
}
