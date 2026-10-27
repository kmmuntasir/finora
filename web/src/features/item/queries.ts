import {
  ItemFields,
  ItemSortBy,
  type BaseItemDto,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import { getLibraryApi } from "@jellyfin/sdk/lib/utils/api/library-api";
import { getPlaystateApi } from "@jellyfin/sdk/lib/utils/api/playstate-api";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api/tv-shows-api";
import { getUserLibraryApi } from "@jellyfin/sdk/lib/utils/api/user-library-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/context";

const LIST_FIELDS = [
  ItemFields.Overview,
  ItemFields.PrimaryImageAspectRatio,
  ItemFields.MediaSourceCount,
];

/** Full item details (people, studios, media sources, …). */
export function useItemDetails(itemId: string | undefined) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["item-details", user.Id, itemId],
    queryFn: async ({ signal }) =>
      (await getUserLibraryApi(api).getItem({ itemId: itemId!, userId: user.Id }, { signal })).data,
    enabled: Boolean(itemId),
  });
}

export function useSeasons(seriesId: string | undefined) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["seasons", user.Id, seriesId],
    queryFn: async ({ signal }) =>
      (
        await getTvShowsApi(api).getSeasons(
          { seriesId: seriesId!, userId: user.Id, enableUserData: true },
          { signal },
        )
      ).data.Items ?? [],
    enabled: Boolean(seriesId),
  });
}

export function useEpisodes(seriesId: string | undefined, seasonId: string | undefined) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["episodes", user.Id, seriesId, seasonId],
    queryFn: async ({ signal }) =>
      (
        await getTvShowsApi(api).getEpisodes(
          {
            seriesId: seriesId!,
            seasonId,
            userId: user.Id,
            fields: LIST_FIELDS,
            enableUserData: true,
          },
          { signal },
        )
      ).data.Items ?? [],
    enabled: Boolean(seriesId && seasonId),
  });
}

export function useSeriesNextUp(seriesId: string | undefined) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["next-up", user.Id, "series", seriesId],
    queryFn: async ({ signal }) =>
      (
        await getTvShowsApi(api).getNextUp(
          { seriesId: seriesId!, userId: user.Id, limit: 1, enableUserData: true },
          { signal },
        )
      ).data.Items?.[0] ?? null,
    enabled: Boolean(seriesId),
  });
}

export function useSimilar(item: BaseItemDto | undefined) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["similar", user.Id, item?.Id],
    queryFn: async ({ signal }) =>
      (
        await getLibraryApi(api).getSimilarItems(
          {
            itemId: item!.Id!,
            userId: user.Id,
            limit: 16,
            fields: [ItemFields.PrimaryImageAspectRatio],
          },
          { signal },
        )
      ).data.Items ?? [],
    enabled:
      Boolean(item?.Id) &&
      ["Movie", "Series", "MusicAlbum", "MusicArtist"].includes(item?.Type ?? ""),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSpecialFeatures(item: BaseItemDto | undefined) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["extras", user.Id, item?.Id],
    queryFn: async ({ signal }) =>
      (
        await getUserLibraryApi(api).getSpecialFeatures(
          { itemId: item!.Id!, userId: user.Id },
          { signal },
        )
      ).data,
    enabled: Boolean(item?.Id) && (item?.SpecialFeatureCount ?? 0) > 0,
  });
}

export function useLocalTrailers(item: BaseItemDto | undefined) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["trailers", user.Id, item?.Id],
    queryFn: async ({ signal }) =>
      (
        await getUserLibraryApi(api).getLocalTrailers(
          { itemId: item!.Id!, userId: user.Id },
          { signal },
        )
      ).data,
    enabled: Boolean(item?.Id) && (item?.LocalTrailerCount ?? 0) > 0,
  });
}

/** Contents of an album, collection, playlist; or works of an artist or person. */
export function useRelatedItems(item: BaseItemDto | undefined) {
  const { api, user } = useSession();
  const type = item?.Type;
  return useQuery({
    queryKey: ["related", user.Id, item?.Id],
    queryFn: async ({ signal }) => {
      const base = { userId: user.Id, fields: LIST_FIELDS, enableUserData: true };
      const items = getItemsApi(api);
      const request =
        type === "MusicArtist"
          ? {
              ...base,
              albumArtistIds: [item!.Id!],
              includeItemTypes: ["MusicAlbum" as const],
              recursive: true,
              sortBy: [ItemSortBy.ProductionYear, ItemSortBy.SortName],
              sortOrder: ["Descending" as const],
            }
          : type === "Person"
            ? {
                ...base,
                personIds: [item!.Id!],
                includeItemTypes: ["Movie" as const, "Series" as const],
                recursive: true,
                sortBy: [ItemSortBy.ProductionYear, ItemSortBy.SortName],
                sortOrder: ["Descending" as const],
              }
            : type === "MusicAlbum"
              ? {
                  ...base,
                  parentId: item!.Id!,
                  sortBy: [
                    ItemSortBy.ParentIndexNumber,
                    ItemSortBy.IndexNumber,
                    ItemSortBy.SortName,
                  ],
                }
              : type === "Playlist"
                ? { ...base, parentId: item!.Id! }
                : {
                    ...base,
                    parentId: item!.Id!,
                    sortBy: [ItemSortBy.ProductionYear, ItemSortBy.SortName],
                  };
      return (await items.getItems(request, { signal })).data.Items ?? [];
    },
    enabled:
      Boolean(item?.Id) &&
      ["MusicArtist", "Person", "MusicAlbum", "Playlist", "BoxSet"].includes(type ?? ""),
  });
}

/** Optimistic watched / favourite toggles; related lists refresh afterwards. */
export function useUserDataToggle(item: BaseItemDto) {
  const { api, user } = useSession();
  const queryClient = useQueryClient();
  const key = ["item-details", user.Id, item.Id];

  const refresh = () => {
    for (const prefix of [
      "item-details",
      "resume",
      "next-up",
      "latest",
      "library-items",
      "episodes",
      "seasons",
    ]) {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  };

  const patch = (changes: Partial<NonNullable<BaseItemDto["UserData"]>>) =>
    queryClient.setQueryData<BaseItemDto>(key, (old) =>
      old ? { ...old, UserData: { ...old.UserData, ...changes } } : old,
    );

  const played = useMutation({
    mutationFn: async (value: boolean) => {
      patch({ Played: value });
      const playstate = getPlaystateApi(api);
      const params = { itemId: item.Id!, userId: user.Id };
      await (value ? playstate.markPlayedItem(params) : playstate.markUnplayedItem(params));
    },
    onSettled: refresh,
  });

  const favorite = useMutation({
    mutationFn: async (value: boolean) => {
      patch({ IsFavorite: value });
      const library = getUserLibraryApi(api);
      const params = { itemId: item.Id!, userId: user.Id };
      await (value ? library.markFavoriteItem(params) : library.unmarkFavoriteItem(params));
    },
    onSettled: refresh,
  });

  return { played, favorite };
}
