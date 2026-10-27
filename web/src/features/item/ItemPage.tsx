import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { ExternalLink } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { backdropImage, imageUrl, logoImage, posterImage } from "@/api/images";
import { Button } from "@/components/Button";
import { Artwork } from "@/components/media/Artwork";
import { LandscapeCard, PosterCard } from "@/components/media/cards";
import { MediaRow } from "@/components/media/MediaRow";
import { Spinner } from "@/components/Spinner";
import { useRuntimeConfig } from "@/config/context";
import { episodeCode, runtime } from "@/lib/format";
import { CastRow } from "./CastRow";
import { ItemActions } from "./ItemActions";
import { MediaInfo } from "./MediaInfo";
import {
  useItemDetails,
  useLocalTrailers,
  useRelatedItems,
  useSeasons,
  useSeriesNextUp,
  useSimilar,
  useSpecialFeatures,
} from "./queries";
import { SeasonEpisodes } from "./SeasonEpisodes";
import { TrackList } from "./TrackList";
import { selectedSource, type PlaySelection } from "./selection";
import { TrackPickers } from "./TrackPickers";

export function ItemPage() {
  const { itemId } = useParams();
  const { data: item, isPending, isError, refetch } = useItemDetails(itemId);

  if (isPending) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Spinner />
      </div>
    );
  }
  if (isError || !item) {
    return (
      <div className="px-page-x-mobile py-12 md:px-page-x">
        <h1 className="text-headline-md">Couldn't load this item</h1>
        <p className="mt-2 text-body-md text-on-surface-muted">
          It may have been removed, or the server is unreachable.
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (item.Type === "Season" && item.SeriesId) {
    return <Navigate replace to={`/items/${item.SeriesId}?season=${item.Id}`} />;
  }
  return <ItemDetails key={item.Id} item={item} />;
}

function metaLine(item: BaseItemDto): string {
  const year =
    item.Type === "Series" && item.ProductionYear
      ? `${item.ProductionYear}${item.Status === "Continuing" ? "–" : item.EndDate ? `–${new Date(item.EndDate).getFullYear()}` : ""}`
      : item.ProductionYear;
  return [
    year,
    item.OfficialRating,
    item.Type !== "Series" ? runtime(item) : item.ChildCount ? `${item.ChildCount} seasons` : null,
    item.CommunityRating ? `★ ${item.CommunityRating.toFixed(1)}` : null,
    item.CriticRating ? `${item.CriticRating}% critics` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
}

function ItemDetails({ item }: { item: BaseItemDto }) {
  const { config } = useRuntimeConfig();
  const [selection, setSelection] = useState<PlaySelection>({});
  const [params, setParams] = useSearchParams();

  const isSeries = item.Type === "Series";
  const isEpisode = item.Type === "Episode";
  const seriesId = isSeries ? item.Id! : isEpisode ? (item.SeriesId ?? undefined) : undefined;
  const seasons = useSeasons(seriesId);
  const nextUp = useSeriesNextUp(isSeries ? item.Id! : undefined);
  const related = useRelatedItems(item);
  const similar = useSimilar(item);
  const extras = useSpecialFeatures(item);
  const trailers = useLocalTrailers(item);

  const seasonId = isEpisode
    ? (item.SeasonId ?? undefined)
    : (params.get("season") ?? nextUp.data?.SeasonId ?? seasons.data?.[0]?.Id ?? undefined);

  const backdrop = backdropImage(item);
  const logo = logoImage(item);
  const poster = posterImage(item);
  const source = selectedSource(item, selection);
  const playable =
    Boolean(item.MediaSources?.length) ||
    isSeries ||
    item.Type === "MusicAlbum" ||
    item.Type === "BoxSet" ||
    item.Type === "Playlist";
  const playTarget = isSeries ? (nextUp.data ?? seasons.data?.[0] ?? null) : playable ? item : null;
  const playLabel =
    isSeries && nextUp.data
      ? `${(nextUp.data.UserData?.PlaybackPositionTicks ?? 0) > 0 ? "Resume" : "Play"} ${episodeCode(nextUp.data) ?? ""}`.trim()
      : undefined;
  const square =
    item.Type === "MusicAlbum" || item.Type === "MusicArtist" || item.Type === "Playlist";
  const round = item.Type === "Person";

  return (
    <article className="pb-24">
      <section className="relative overflow-hidden">
        {backdrop ? (
          <img
            src={imageUrl(config.jellyfinUrl, backdrop, 1920)}
            alt=""
            className="absolute inset-0 size-full animate-[fade-in_400ms_ease-out] object-cover object-top"
          />
        ) : (
          poster && (
            <img
              src={imageUrl(config.jellyfinUrl, poster, 400)}
              alt=""
              aria-hidden
              className="absolute inset-0 size-full scale-125 object-cover opacity-30 blur-3xl"
            />
          )
        )}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/70 to-background/10" />
        <div className="absolute inset-0 bg-linear-to-r from-background/90 via-background/30 to-transparent" />

        <div
          className={`relative grid gap-8 px-page-x-mobile pb-8 md:px-page-x lg:grid-cols-[auto_1fr] lg:items-end ${
            backdrop ? "pt-[min(38vh,20rem)]" : "pt-12"
          }`}
        >
          {poster && (
            <div className={`hidden lg:block ${square || round ? "w-60" : "w-56"}`}>
              <Artwork
                image={poster}
                shape={square || round ? "square" : "poster"}
                width={240}
                title={item.Name ?? ""}
                priority
                className={`${round ? "rounded-full" : "rounded-lg"} shadow-[0_24px_48px_-16px_rgb(0_0_0/0.8)]`}
              />
            </div>
          )}
          <div className="min-w-0 max-w-3xl space-y-4">
            {isEpisode && item.SeriesId && (
              <Link
                to={`/items/${item.SeriesId}`}
                className="text-title text-on-surface-muted hover:text-on-surface"
              >
                {item.SeriesName}
              </Link>
            )}
            {logo && !isEpisode ? (
              <img
                src={imageUrl(config.jellyfinUrl, logo, 700)}
                alt={item.Name ?? ""}
                className="max-h-32 w-auto max-w-[min(100%,460px)] object-contain object-left drop-shadow-[0_2px_12px_rgb(0_0_0/0.6)] light:brightness-0 light:drop-shadow-none"
              />
            ) : (
              <h1 className="text-headline-lg md:text-display">
                {isEpisode && episodeCode(item) ? (
                  <span className="text-on-surface-muted">{episodeCode(item)} · </span>
                ) : null}
                {item.Name}
              </h1>
            )}
            {item.Type === "MusicAlbum" && item.AlbumArtists?.length ? (
              <p className="text-title">
                {item.AlbumArtists.map((artist, index) => (
                  <span key={artist.Id}>
                    {index > 0 && ", "}
                    <Link to={`/items/${artist.Id}`} className="hover:underline">
                      {artist.Name}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
            {metaLine(item) && (
              <p className="text-body-sm text-on-surface-muted">{metaLine(item)}</p>
            )}
            {item.Taglines?.[0] && (
              <p className="text-body-lg italic text-on-surface/90">{item.Taglines[0]}</p>
            )}
            {item.Overview && <Overview text={item.Overview} />}
            {item.GenreItems?.length ? (
              <p className="flex flex-wrap gap-2">
                {item.GenreItems.map((genre) => (
                  <Link
                    key={genre.Id}
                    to={`/browse?genre=${encodeURIComponent(genre.Name ?? "")}`}
                    className="rounded-full bg-white/10 light:bg-black/5 px-3 py-1 text-label-sm transition-colors duration-[120ms] hover:bg-white/20 light:hover:bg-black/10"
                  >
                    {genre.Name}
                  </Link>
                ))}
                {item.Studios?.slice(0, 3).map((studio) => (
                  <Link
                    key={studio.Id}
                    to={`/browse?studio=${encodeURIComponent(studio.Name ?? "")}`}
                    className="rounded-full px-3 py-1 text-label-sm text-on-surface-muted ring-1 ring-white/15 light:ring-black/15 transition-colors duration-[120ms] hover:bg-white/10 light:hover:bg-black/5 hover:text-on-surface"
                  >
                    {studio.Name}
                  </Link>
                ))}
              </p>
            ) : null}
            <ItemActions
              item={item}
              playTarget={playTarget}
              playLabel={playLabel}
              selection={selection}
            />
            {source && <TrackPickers item={item} selection={selection} onChange={setSelection} />}
          </div>
        </div>
      </section>

      <div className="mt-8 space-y-12">
        {seriesId && seasons.data && (
          <SeasonEpisodes
            series={isSeries ? item : { Id: seriesId }}
            seasons={
              isEpisode ? seasons.data.filter((season) => season.Id === seasonId) : seasons.data
            }
            seasonId={seasonId}
            onSeasonChange={(id) => setParams({ season: id }, { replace: true })}
          />
        )}

        {item.Type === "MusicAlbum" && related.data && (
          <TrackList album={item} tracks={related.data} />
        )}

        {(item.Type === "MusicArtist" ||
          item.Type === "Person" ||
          item.Type === "BoxSet" ||
          item.Type === "Playlist") && (
          <Section
            title={
              item.Type === "Person"
                ? "Filmography"
                : item.Type === "MusicArtist"
                  ? "Albums"
                  : "Items"
            }
          >
            {related.isPending ? (
              <Spinner />
            ) : related.data?.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-4 gap-y-6 md:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
                {related.data.map((child) => (
                  <PosterCard key={child.Id} item={child} />
                ))}
              </div>
            ) : (
              <p className="text-body-md text-on-surface-muted">Nothing here yet.</p>
            )}
          </Section>
        )}

        {[...(trailers.data ?? []), ...(extras.data ?? [])].length > 0 && (
          <MediaRow title="Trailers & extras" itemClassName="w-64 md:w-72">
            {[...(trailers.data ?? []), ...(extras.data ?? [])].map((extra) => (
              <LandscapeCard key={extra.Id} item={extra} width={288} subtitle={runtime(extra)} />
            ))}
          </MediaRow>
        )}

        {item.People?.length ? <CastRow people={item.People} /> : null}

        {similar.data?.length ? (
          <MediaRow title="More like this" itemClassName={square ? "w-36 md:w-44" : "w-32 md:w-40"}>
            {similar.data.map((other) => (
              <PosterCard key={other.Id} item={other} />
            ))}
          </MediaRow>
        ) : null}

        {source && item.Type !== "MusicAlbum" && (
          <Section title="Details">
            <div className="max-w-3xl space-y-4">
              <MediaInfo source={source} />
              <ExternalLinks item={item} />
            </div>
          </Section>
        )}
        {!source && (
          <div className="px-page-x-mobile md:px-page-x">
            <ExternalLinks item={item} />
          </div>
        )}
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-page-x-mobile md:px-page-x">
      <h2 className="mb-4 text-title">{title}</h2>
      {children}
    </section>
  );
}

/** Long overviews (people's biographies) start collapsed. */
function Overview({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 420;
  return (
    <div>
      <p
        className={`whitespace-pre-line text-body-lg text-on-surface/90 ${long && !expanded ? "line-clamp-4" : ""}`}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-label-md text-primary hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function ExternalLinks({ item }: { item: BaseItemDto }) {
  const links = item.ExternalUrls?.filter((link) => link.Url && link.Name) ?? [];
  if (!links.length) return null;
  return (
    <p className="flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          key={link.Url}
          href={link.Url!}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1.5 text-label-sm text-on-surface-muted hover:bg-surface-overlay hover:text-on-surface"
        >
          {link.Name}
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
      ))}
    </p>
  );
}
