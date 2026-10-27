import {
  BaseItemKind,
  ItemFields,
  ItemSortBy,
  SortOrder,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { Spinner } from "@/components/Spinner";
import { useSession } from "@/features/auth/context";
import { ItemGrid } from "./ItemGrid";

const PAGE_SIZE = 120;
type Facet = "genre" | "studio" | "tag";
const FACETS: Facet[] = ["genre", "studio", "tag"];
const FACET_LABEL: Record<Facet, string> = { genre: "Genre", studio: "Studio", tag: "Tag" };

/** Films and shows across all libraries sharing a genre, studio or tag. */
export function BrowsePage() {
  const { api, user } = useSession();
  const [params] = useSearchParams();
  const facet = FACETS.find((name) => params.get(name));
  const value = facet ? params.get(facet)! : null;

  const query = useInfiniteQuery({
    queryKey: ["browse", user.Id, facet, value],
    enabled: Boolean(facet && value),
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) =>
      (
        await getItemsApi(api).getItems(
          {
            userId: user.Id,
            recursive: true,
            includeItemTypes: [BaseItemKind.Movie, BaseItemKind.Series],
            genres: facet === "genre" ? [value!] : undefined,
            studios: facet === "studio" ? [value!] : undefined,
            tags: facet === "tag" ? [value!] : undefined,
            sortBy: [ItemSortBy.SortName],
            sortOrder: [SortOrder.Ascending],
            fields: [ItemFields.PrimaryImageAspectRatio],
            enableUserData: true,
            startIndex: pageParam,
            limit: PAGE_SIZE,
          },
          { signal },
        )
      ).data,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + (page.Items?.length ?? 0), 0);
      return loaded < (last.TotalRecordCount ?? 0) && last.Items?.length ? loaded : undefined;
    },
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.Items ?? []) ?? [],
    [query.data],
  );
  const total = query.data?.pages[0]?.TotalRecordCount ?? 0;

  return (
    <div className="px-page-x-mobile pt-8 pb-24 md:px-page-x md:pt-10">
      <p className="text-label-md text-on-surface-muted">{facet ? FACET_LABEL[facet] : "Browse"}</p>
      <h1 className="text-headline-lg">{value ?? "Nothing selected"}</h1>
      {query.data && (
        <p className="mt-1 text-body-sm text-on-surface-muted">{total.toLocaleString()} titles</p>
      )}
      <div className="mt-6">
        {query.isPending && facet ? (
          <Spinner />
        ) : (
          <ItemGrid
            items={items}
            shape="poster"
            hasMore={Boolean(query.hasNextPage) && !query.isFetchingNextPage}
            onLoadMore={() => void query.fetchNextPage()}
          />
        )}
      </div>
    </div>
  );
}
