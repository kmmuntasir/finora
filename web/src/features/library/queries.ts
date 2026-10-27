import {
  ItemFields,
  ItemFilter,
  ItemSortBy,
  SortOrder,
  type BaseItemDto,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getFilterApi } from "@jellyfin/sdk/lib/utils/api/filter-api";
import { getGenresApi } from "@jellyfin/sdk/lib/utils/api/genres-api";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import { getLibraryApi } from "@jellyfin/sdk/lib/utils/api/library-api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/context";
import { SORTS, type FilterKey, type LibraryKind } from "./library-config";
import type { LibraryState } from "./library-state";

const PAGE_SIZE = 120;

const FILTER_MAP: Record<FilterKey, ItemFilter> = {
  unplayed: ItemFilter.IsUnplayed,
  played: ItemFilter.IsPlayed,
  resumable: ItemFilter.IsResumable,
  favorite: ItemFilter.IsFavorite,
};

function flip(order: SortOrder): SortOrder {
  return order === SortOrder.Ascending ? SortOrder.Descending : SortOrder.Ascending;
}

/** Paged, server-sorted and server-filtered library contents. */
export function useLibraryItems(view: BaseItemDto, kind: LibraryKind, state: LibraryState) {
  const { api, user } = useSession();
  const sort = SORTS[state.sort];
  const letter = state.letter;

  return useInfiniteQuery({
    queryKey: ["library-items", user.Id, view.Id, state],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await getItemsApi(api).getItems(
        {
          userId: user.Id,
          parentId: state.parent ?? view.Id,
          includeItemTypes: state.parent ? undefined : (kind.itemTypes ?? undefined),
          recursive: kind.recursive,
          sortBy: kind.recursive ? sort.by : [ItemSortBy.IsFolder, ...sort.by],
          sortOrder: kind.recursive
            ? [state.reversed ? flip(sort.order) : sort.order]
            : [SortOrder.Descending, state.reversed ? flip(sort.order) : sort.order],
          filters: state.filters.map((filter) => FILTER_MAP[filter]),
          genres: state.genre ? [state.genre] : undefined,
          years: state.year ? [state.year] : undefined,
          officialRatings: state.rating ? [state.rating] : undefined,
          // isHd=true already excludes 4K (BaseItemRepository resolution filter).
          isHd: state.resolution === "sd" ? false : state.resolution === "hd" ? true : undefined,
          is4K: state.resolution === "4k" ? true : undefined,
          // Jellyfin 10.11 ignores resolution filters when hasSubtitles is set,
          // so the toolbar never sends both (see .knowledge/jellyfin/api-notes.md).
          hasSubtitles: state.subtitles && !state.resolution ? true : undefined,
          nameStartsWith: letter && letter !== "#" ? letter : undefined,
          nameLessThan: letter === "#" ? "A" : undefined,
          fields: [ItemFields.PrimaryImageAspectRatio, ItemFields.ChildCount],
          // Jellyfin can take tens of seconds computing user data for folders
          // (see .knowledge/jellyfin/api-notes.md); folder listings fetch it
          // separately for playable items only.
          enableUserData: kind.recursive,
          startIndex: pageParam,
          limit: PAGE_SIZE,
          enableTotalRecordCount: true,
        },
        { signal },
      );
      if (kind.recursive) return data;

      const playableIds = (data.Items ?? [])
        .filter((item) => !item.IsFolder && item.Id)
        .map((item) => item.Id!);
      if (!playableIds.length) return data;
      const { data: withUserData } = await getItemsApi(api).getItems(
        { userId: user.Id, ids: playableIds, enableUserData: true, enableImages: false },
        { signal },
      );
      const userData = new Map(withUserData.Items?.map((item) => [item.Id, item.UserData]));
      return {
        ...data,
        Items: data.Items?.map((item) =>
          item.IsFolder ? item : { ...item, UserData: userData.get(item.Id) },
        ),
      };
    },
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + (page.Items?.length ?? 0), 0);
      return loaded < (lastPage.TotalRecordCount ?? 0) && lastPage.Items?.length
        ? loaded
        : undefined;
    },
    // Random order must not reshuffle on every background refetch.
    staleTime: state.sort === "random" ? Infinity : 60 * 1000,
  });
}

/** Years and age ratings that actually occur in this library. */
export function useLibraryFilterValues(view: BaseItemDto, kind: LibraryKind) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["library-filters", user.Id, view.Id],
    queryFn: async ({ signal }) => {
      const { data } = await getFilterApi(api).getQueryFiltersLegacy(
        { userId: user.Id, parentId: view.Id, includeItemTypes: kind.itemTypes ?? undefined },
        { signal },
      );
      return {
        years: [...(data.Years ?? [])].sort((a, b) => b - a),
        ratings: [...(data.OfficialRatings ?? [])].sort(),
      };
    },
    enabled: kind.advancedFilters,
    staleTime: 10 * 60 * 1000,
  });
}

export function useGenres(view: BaseItemDto, kind: LibraryKind) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["genres", user.Id, view.Id],
    queryFn: async ({ signal }) =>
      (
        await getGenresApi(api).getGenres(
          {
            userId: user.Id,
            parentId: view.Id,
            includeItemTypes: kind.itemTypes ?? undefined,
            sortBy: [ItemSortBy.SortName],
          },
          { signal },
        )
      ).data.Items ?? [],
    enabled: kind.genres,
    staleTime: 10 * 60 * 1000,
  });
}

/** Folder trail from the library root to the current folder. */
export function useAncestors(itemId: string | null) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["ancestors", user.Id, itemId],
    queryFn: async ({ signal }) =>
      (await getLibraryApi(api).getAncestors({ itemId: itemId!, userId: user.Id }, { signal }))
        .data,
    enabled: Boolean(itemId),
  });
}

/** Basic item info (name, type) without user data, which can be slow for folders. */
export function useItemSummary(itemId: string | null | undefined) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["item-summary", user.Id, itemId],
    queryFn: async ({ signal }) =>
      (
        await getItemsApi(api).getItems(
          { userId: user.Id, ids: [itemId!], enableUserData: false },
          { signal },
        )
      ).data.Items?.[0] ?? null,
    enabled: Boolean(itemId),
  });
}
