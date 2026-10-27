import {
  BaseItemKind,
  ItemFields,
  ItemSortBy,
  type BaseItemDto,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import { getPersonsApi } from "@jellyfin/sdk/lib/utils/api/persons-api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/context";

export interface SearchGroup {
  id: string;
  title: string;
  items: BaseItemDto[];
}

const GROUPS: { id: string; title: string; types: BaseItemKind[] }[] = [
  { id: "movies", title: "Movies", types: [BaseItemKind.Movie] },
  { id: "series", title: "Shows", types: [BaseItemKind.Series] },
  { id: "episodes", title: "Episodes", types: [BaseItemKind.Episode] },
  { id: "videos", title: "Videos", types: [BaseItemKind.Video] },
  { id: "collections", title: "Collections", types: [BaseItemKind.BoxSet] },
  { id: "artists", title: "Artists", types: [BaseItemKind.MusicArtist] },
  { id: "albums", title: "Albums", types: [BaseItemKind.MusicAlbum] },
  { id: "songs", title: "Songs", types: [BaseItemKind.Audio] },
];

/** Searches every library at once; each group is its own request so slow ones don't block others. */
export function useSearch(term: string) {
  const { api, user } = useSession();
  const trimmed = term.trim();
  return useQuery({
    queryKey: ["search", user.Id, trimmed],
    enabled: trimmed.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    queryFn: async ({ signal }): Promise<SearchGroup[]> => {
      const items = getItemsApi(api);
      const groupResults = GROUPS.map(async (group) => {
        const { data } = await items.getItems(
          {
            userId: user.Id,
            searchTerm: trimmed,
            includeItemTypes: group.types,
            recursive: true,
            limit: 24,
            fields: [ItemFields.PrimaryImageAspectRatio],
            enableUserData: false,
          },
          { signal },
        );
        return { id: group.id, title: group.title, items: data.Items ?? [] };
      });
      const people = getPersonsApi(api)
        .getPersons({ userId: user.Id, searchTerm: trimmed, limit: 24 }, { signal })
        .then(({ data }) => ({ id: "people", title: "People", items: data.Items ?? [] }));
      const groups = await Promise.all([...groupResults, people]);
      return groups.filter((group) => group.items.length > 0);
    },
  });
}

/** Shown before typing: favourites first, then a random pick, as in the official client. */
export function useSearchSuggestions(enabled: boolean) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["search-suggestions", user.Id],
    queryFn: async ({ signal }) =>
      (
        await getItemsApi(api).getItems(
          {
            userId: user.Id,
            includeItemTypes: [BaseItemKind.Movie, BaseItemKind.Series],
            recursive: true,
            sortBy: [ItemSortBy.IsFavoriteOrLiked, ItemSortBy.Random],
            limit: 20,
            fields: [ItemFields.PrimaryImageAspectRatio],
            enableUserData: true,
          },
          { signal },
        )
      ).data.Items ?? [],
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

const RECENT_KEY = "finora.recentSearches";

export function readRecentSearches(): string[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
    return Array.isArray(saved)
      ? saved.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

/** Remembers a search on this device (most recent first, eight at most). */
export function rememberSearch(term: string): string[] {
  const value = term.trim();
  const next = [
    value,
    ...readRecentSearches().filter((entry) => entry.toLowerCase() !== value.toLowerCase()),
  ].slice(0, 8);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function clearRecentSearches(): void {
  window.localStorage.removeItem(RECENT_KEY);
}
