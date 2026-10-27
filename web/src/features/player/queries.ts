import {
  BaseItemKind,
  ItemSortBy,
  MediaSegmentType,
  type BaseItemDto,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import { getMediaSegmentsApi } from "@jellyfin/sdk/lib/utils/api/media-segments-api";
import { getPlaylistsApi } from "@jellyfin/sdk/lib/utils/api/playlists-api";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api/tv-shows-api";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/context";

/**
 * What plays after this item: the next video of the playlist or collection it
 * was started from, the next episode of a series, or for home videos the next
 * video in the same folder (by name).
 */
export function useNextEpisode(item: BaseItemDto, listId?: string | null) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["next-episode", user.Id, item.Id, listId ?? null],
    enabled:
      Boolean(listId) ||
      (item.Type === "Episode" && Boolean(item.SeriesId)) ||
      (item.Type === "Video" && Boolean(item.ParentId)),
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      if (listId) {
        const list = (
          await getItemsApi(api).getItems({ userId: user.Id, ids: [listId] }, { signal })
        ).data.Items?.[0];
        const children =
          list?.Type === "Playlist"
            ? ((
                await getPlaylistsApi(api).getPlaylistItems(
                  { playlistId: listId, userId: user.Id, enableUserData: false },
                  { signal },
                )
              ).data.Items ?? [])
            : ((
                await getItemsApi(api).getItems(
                  {
                    userId: user.Id,
                    parentId: listId,
                    sortBy: [ItemSortBy.ProductionYear, ItemSortBy.SortName],
                    enableUserData: false,
                  },
                  { signal },
                )
              ).data.Items ?? []);
        const videos = children.filter((child) => child.MediaType === "Video");
        const position = videos.findIndex((video) => video.Id === item.Id);
        return position >= 0 ? (videos[position + 1] ?? null) : null;
      }
      if (item.Type === "Video") {
        // Folder listings skip user data: Jellyfin computes it slowly for some folders.
        const { data } = await getItemsApi(api).getItems(
          {
            userId: user.Id,
            parentId: item.ParentId!,
            includeItemTypes: [BaseItemKind.Video],
            sortBy: [ItemSortBy.SortName],
            enableUserData: false,
          },
          { signal },
        );
        const siblings = data.Items ?? [];
        const position = siblings.findIndex((sibling) => sibling.Id === item.Id);
        return position >= 0 ? (siblings[position + 1] ?? null) : null;
      }
      const { data } = await getTvShowsApi(api).getEpisodes(
        {
          seriesId: item.SeriesId!,
          userId: user.Id,
          startItemId: item.Id!,
          limit: 2,
          enableUserData: true,
        },
        { signal },
      );
      const next = data.Items?.[1];
      return next && next.Id !== item.Id ? next : null;
    },
  });
}

export interface SkippableSegment {
  type: "Intro" | "Recap" | "Outro" | "Preview" | "Commercial";
  start: number;
  end: number;
}

/** Intro/recap/credits segments; empty when no segment provider plugin is installed. */
export function useSegments(itemId: string) {
  const { api } = useSession();
  return useQuery({
    queryKey: ["segments", itemId],
    staleTime: Infinity,
    queryFn: async ({ signal }): Promise<SkippableSegment[]> => {
      const { data } = await getMediaSegmentsApi(api).getItemSegments(
        {
          itemId,
          includeSegmentTypes: [
            MediaSegmentType.Intro,
            MediaSegmentType.Recap,
            MediaSegmentType.Outro,
            MediaSegmentType.Preview,
            MediaSegmentType.Commercial,
          ],
        },
        { signal },
      );
      return (data.Items ?? [])
        .filter((segment) => segment.Type && segment.Type !== "Unknown")
        .map((segment) => ({
          type: segment.Type as SkippableSegment["type"],
          start: (segment.StartTicks ?? 0) / 10_000_000,
          end: (segment.EndTicks ?? 0) / 10_000_000,
        }))
        .filter((segment) => segment.end > segment.start);
    },
  });
}
