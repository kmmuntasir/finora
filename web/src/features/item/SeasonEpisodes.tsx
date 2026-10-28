import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { CircleCheck } from "lucide-react";
import { Link } from "react-router";
import { landscapeImage } from "@/api/images";
import { Artwork } from "@/components/media/Artwork";
import { ProgressBar } from "@/components/media/ProgressBar";
import { Spinner } from "@/components/Spinner";
import { cn } from "@/lib/cn";
import { formatDate, progress, runtime } from "@/lib/format";
import { itemHref } from "@/lib/routes";
import { CardPlayButton } from "./CardPlayButton";
import { useEpisodes } from "./queries";
import { t } from "@/i18n";

interface SeasonEpisodesProps {
  series: BaseItemDto;
  seasons: BaseItemDto[];
  seasonId: string | undefined;
  onSeasonChange: (seasonId: string) => void;
}

export function SeasonEpisodes({ series, seasons, seasonId, onSeasonChange }: SeasonEpisodesProps) {
  const episodes = useEpisodes(series.Id ?? undefined, seasonId);

  return (
    <section aria-labelledby="episodes-title" className="px-page-x-mobile md:px-page-x">
      <h2 id="episodes-title" className="sr-only">
        {t("Episodes")}
      </h2>
      {seasons.length > 1 && (
        <div
          role="tablist"
          aria-label={t("Seasons")}
          className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
        >
          {seasons.map((season) => (
            <button
              key={season.Id}
              type="button"
              role="tab"
              aria-selected={season.Id === seasonId}
              onClick={() => season.Id && onSeasonChange(season.Id)}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-label-md transition-colors duration-[120ms]",
                season.Id === seasonId
                  ? "bg-on-surface text-background"
                  : "bg-surface-raised text-on-surface-muted hover:bg-surface-overlay hover:text-on-surface",
              )}
            >
              {season.Name}
            </button>
          ))}
        </div>
      )}

      {episodes.isPending ? (
        <Spinner />
      ) : (
        <ol className="space-y-3">
          {episodes.data?.map((episode) => {
            const watched = progress(episode);
            return (
              <li key={episode.Id} className="group relative">
                <Link
                  to={itemHref(episode)}
                  className="grid grid-cols-[8.5rem_1fr] gap-4 rounded-lg p-2 transition-colors duration-[120ms] hover:bg-surface sm:grid-cols-[13rem_1fr]"
                >
                  <div className="relative">
                    <Artwork
                      image={landscapeImage(episode)}
                      shape="landscape"
                      width={208}
                      title={episode.Name ?? ""}
                      className="rounded-md"
                    />
                    {watched !== null && (
                      <ProgressBar value={watched} className="absolute inset-x-2 bottom-2" />
                    )}
                  </div>
                  <div className="min-w-0 py-1">
                    <p className="flex items-start gap-2 text-label-md">
                      <span className="text-on-surface-muted">{episode.IndexNumber ?? "–"}.</span>
                      <span className="line-clamp-2">{episode.Name}</span>
                      {episode.UserData?.Played && (
                        <CircleCheck
                          aria-label={t("Watched")}
                          className="ml-auto size-4 shrink-0 text-success"
                        />
                      )}
                    </p>
                    <p className="mt-0.5 text-caption text-on-surface-muted">
                      {[
                        runtime(episode),
                        episode.PremiereDate ? formatDate(episode.PremiereDate) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {episode.Overview && (
                      <p className="mt-1.5 line-clamp-2 hidden text-body-sm text-on-surface-muted sm:block">
                        {episode.Overview}
                      </p>
                    )}
                  </div>
                </Link>
                {/* Over the thumbnail: same column width and padding as the link's grid. */}
                <div className="pointer-events-none absolute top-2 left-2 grid aspect-video w-[8.5rem] place-items-center sm:w-[13rem]">
                  <CardPlayButton item={episode} compact />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
