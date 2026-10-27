import {
  BaseItemKind,
  ItemFields,
  ItemSortBy,
  SortOrder,
  type BaseItemDto,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api/tv-shows-api";
import { getUserLibraryApi } from "@jellyfin/sdk/lib/utils/api/user-library-api";
import { getUserViewsApi } from "@jellyfin/sdk/lib/utils/api/user-views-api";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/context";

const CARD_FIELDS = [ItemFields.Overview, ItemFields.PrimaryImageAspectRatio, ItemFields.Genres];

/** The libraries ("views") this user can see, in their configured order. */
export function useUserViews() {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["views", user.Id],
    queryFn: async ({ signal }) =>
      (await getUserViewsApi(api).getUserViews({ userId: user.Id }, { signal })).data.Items ?? [],
    staleTime: 10 * 60 * 1000,
  });
}

export function useResumeItems(limit = 16) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["resume", user.Id, limit],
    queryFn: async ({ signal }) =>
      (
        await getItemsApi(api).getResumeItems(
          {
            userId: user.Id,
            limit,
            mediaTypes: ["Video"],
            fields: CARD_FIELDS,
            enableUserData: true,
          },
          { signal },
        )
      ).data.Items ?? [],
  });
}

export function useNextUp(limit = 16) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["next-up", user.Id, limit],
    queryFn: async ({ signal }) =>
      (
        await getTvShowsApi(api).getNextUp(
          { userId: user.Id, limit, fields: CARD_FIELDS, enableUserData: true },
          { signal },
        )
      ).data.Items ?? [],
  });
}

export function useLatest(view: BaseItemDto, limit = 16) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["latest", user.Id, view.Id, limit],
    queryFn: async ({ signal }) => {
      // /Items/Latest returns individual tracks for music; albums read better.
      if (view.CollectionType === "music") {
        const { data } = await getItemsApi(api).getItems(
          {
            userId: user.Id,
            parentId: view.Id,
            includeItemTypes: [BaseItemKind.MusicAlbum],
            recursive: true,
            sortBy: [ItemSortBy.DateCreated],
            sortOrder: [SortOrder.Descending],
            limit,
            fields: CARD_FIELDS,
          },
          { signal },
        );
        return data.Items ?? [];
      }
      return (
        await getUserLibraryApi(api).getLatestMedia(
          { userId: user.Id, parentId: view.Id, limit, fields: CARD_FIELDS, enableUserData: true },
          { signal },
        )
      ).data;
    },
    enabled: Boolean(view.Id),
  });
}

/**
 * Albums of recently played tracks, most recent first. Jellyfin has no
 * "resume" for music, so this is what "Continue listening" shows.
 */
export function useRecentAlbums(limit = 16) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["recent-albums", user.Id, limit],
    queryFn: async ({ signal }) => {
      const items = getItemsApi(api);
      const { data } = await items.getItems(
        {
          userId: user.Id,
          includeItemTypes: [BaseItemKind.Audio],
          recursive: true,
          filters: ["IsPlayed"],
          sortBy: [ItemSortBy.DatePlayed],
          sortOrder: [SortOrder.Descending],
          limit: 100,
          enableUserData: true,
        },
        { signal },
      );
      const albumIds = [
        ...new Set((data.Items ?? []).map((track) => track.AlbumId).filter(Boolean) as string[]),
      ].slice(0, limit);
      if (!albumIds.length) return [];
      const albums =
        (await items.getItems({ userId: user.Id, ids: albumIds, fields: CARD_FIELDS }, { signal }))
          .data.Items ?? [];
      // /Items with ids returns them in library order; restore recency order.
      return albumIds
        .map((id) => albums.find((album) => album.Id === id))
        .filter((album): album is BaseItemDto => Boolean(album));
    },
  });
}
