import type { BaseItemDto, RecommendationDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getMoviesApi } from "@jellyfin/sdk/lib/utils/api/movies-api";
import { getStudiosApi } from "@jellyfin/sdk/lib/utils/api/studios-api";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api/tv-shows-api";
import { useQuery } from "@tanstack/react-query";
import { LandscapeCard, PosterCard } from "@/components/media/cards";
import { MediaRow } from "@/components/media/MediaRow";
import { Spinner } from "@/components/Spinner";
import { useSession } from "@/features/auth/context";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LIBRARY_TABS, type LibraryTab } from "./library-config";
import { t } from "@/i18n";

export function LibraryTabs({
  collectionType,
  current,
  onChange,
}: {
  collectionType: string | null | undefined;
  current: LibraryTab;
  onChange: (tab: LibraryTab) => void;
}) {
  const tabs = LIBRARY_TABS[collectionType ?? ""];
  if (!tabs) return null;
  return (
    <nav
      aria-label={t("Library views")}
      className="mt-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border [scrollbar-width:none]"
    >
      {tabs.map(({ tab, label }) => (
        <button
          key={tab}
          type="button"
          aria-current={current === tab ? "page" : undefined}
          onClick={() => onChange(tab)}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-label-md transition-colors duration-[120ms]",
            current === tab
              ? "border-primary text-on-surface"
              : "border-transparent text-on-surface-muted hover:text-on-surface",
          )}
        >
          {t(label)}
        </button>
      ))}
    </nav>
  );
}

function recommendationTitle(group: RecommendationDto): string {
  const name = group.BaselineItemName ?? "";
  switch (group.RecommendationType) {
    case "SimilarToRecentlyPlayed":
      return t("Because you watched {name}", { name });
    case "SimilarToLikedItem":
      return t("Because you liked {name}", { name });
    case "HasDirectorFromRecentlyPlayed":
    case "HasLikedDirector":
      return t("Directed by {name}", { name });
    case "HasActorFromRecentlyPlayed":
    case "HasLikedActor":
      return t("Starring {name}", { name });
    default:
      return name;
  }
}

/** "Because you watched…" rows from Jellyfin's movie recommendations. */
export function SuggestionsView({ view }: { view: BaseItemDto }) {
  const { api, user } = useSession();
  const { data, isPending, isError } = useQuery({
    queryKey: ["recommendations", user.Id, view.Id],
    queryFn: async ({ signal }) =>
      (
        await getMoviesApi(api).getMovieRecommendations(
          { userId: user.Id, parentId: view.Id, categoryLimit: 6, itemLimit: 16 },
          { signal },
        )
      ).data,
    staleTime: 10 * 60 * 1000,
  });
  if (isPending) return <Spinner className="flex justify-center py-12" />;
  if (isError)
    return (
      <p role="alert" className="py-12 text-body-md text-error">
        {t("Couldn't load suggestions.")}
      </p>
    );
  const groups = data.filter((group) => group.Items?.length);
  if (!groups.length)
    return (
      <p className="py-12 text-body-md text-on-surface-muted">
        {t("Watch a few movies and suggestions will appear here.")}
      </p>
    );
  return (
    <div className="-mx-page-x-mobile space-y-10 md:-mx-page-x">
      {groups.map((group) => (
        <MediaRow
          key={`${group.RecommendationType}-${group.BaselineItemName}`}
          title={recommendationTitle(group)}
          itemClassName="w-32 md:w-40"
        >
          {group.Items!.map((item) => (
            <PosterCard key={item.Id} item={item} />
          ))}
        </MediaRow>
      ))}
    </div>
  );
}

/** Episodes airing soon, grouped by air date. */
export function UpcomingView({ view }: { view: BaseItemDto }) {
  const { api, user } = useSession();
  const { data, isPending, isError } = useQuery({
    queryKey: ["upcoming", user.Id, view.Id],
    queryFn: async ({ signal }) =>
      (
        await getTvShowsApi(api).getUpcomingEpisodes(
          { userId: user.Id, parentId: view.Id, limit: 60, enableUserData: false },
          { signal },
        )
      ).data.Items ?? [],
  });
  if (isPending) return <Spinner className="flex justify-center py-12" />;
  if (isError)
    return (
      <p role="alert" className="py-12 text-body-md text-error">
        {t("Couldn't load upcoming episodes.")}
      </p>
    );
  if (!data.length)
    return (
      <p className="py-12 text-body-md text-on-surface-muted">
        {t(
          "Nothing scheduled. Upcoming episodes appear when Jellyfin knows their air dates (with “missing episodes” metadata).",
        )}
      </p>
    );
  const days = new Map<string, BaseItemDto[]>();
  for (const episode of data) {
    const day = episode.PremiereDate?.slice(0, 10) ?? "";
    days.set(day, [...(days.get(day) ?? []), episode]);
  }
  return (
    <div className="space-y-8">
      {[...days.entries()].map(([day, episodes]) => (
        <section key={day}>
          <h2 className="mb-3 text-title">{day ? formatDate(day) : t("Date unknown")}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-x-4 gap-y-6">
            {episodes.map((episode) => (
              <LandscapeCard key={episode.Id} item={episode} width={300} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * TV networks (studios of the shows in this library). Without `userId`:
 * Jellyfin 10.11 returns no studios when it is set (see api-notes).
 */
export function NetworksView({
  view,
  onPick,
}: {
  view: BaseItemDto;
  onPick: (id: string) => void;
}) {
  const { api } = useSession();
  const { data, isPending } = useQuery({
    queryKey: ["networks", view.Id],
    queryFn: async ({ signal }) =>
      (
        await getStudiosApi(api).getStudios(
          { parentId: view.Id, includeItemTypes: ["Series"], enableImages: false },
          { signal },
        )
      ).data.Items ?? [],
    staleTime: 10 * 60 * 1000,
  });
  if (isPending) return <Spinner className="flex justify-center py-12" />;
  if (!data?.length)
    return (
      <p className="py-12 text-body-md text-on-surface-muted">
        {t("No networks found for these shows.")}
      </p>
    );
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
      {data.map((network) => (
        <li key={network.Id}>
          <button
            type="button"
            onClick={() => onPick(network.Id!)}
            className="flex h-20 w-full items-center justify-center rounded-lg bg-surface px-4 text-center text-label-md hover:bg-surface-raised"
          >
            {network.Name}
          </button>
        </li>
      ))}
    </ul>
  );
}
