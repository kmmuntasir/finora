import {
  BaseItemKind,
  ItemFields,
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
