import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Clapperboard, Film, Folder, Info, Music, Tv } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { backdropImage, imageUrl, logoImage, wideArtwork } from "@/api/images";
import { Artwork } from "@/components/media/Artwork";
import { PlayButton } from "@/components/media/PlayButton";
import { ProgressBar } from "@/components/media/ProgressBar";
import { useRuntimeConfig } from "@/config/context";
import { useSession } from "@/features/auth/context";
import { usePreferences } from "@/features/preferences/preferences";
import { HomeLayoutMenu } from "./HomeLayoutMenu";
import { cn } from "@/lib/cn";
import {
  cardSubtitle,
  cardTitle,
  continueSubtitle,
  progress,
  runtime,
  timeLeft,
} from "@/lib/format";
import { itemHref } from "@/lib/routes";
import { ContinueWatchingRow } from "./ContinueWatchingRow";
import { ContinueListeningRow, LatestRows, NextUpRow } from "./LibraryRows";
import { useLatest, useResumeItems, useUserViews } from "./queries";
import { RowSkeleton } from "./RowSkeleton";
import { parseHomeSections, type HomeSectionId } from "./sections";

/** Home page in the layout the user picked (saved per user in Jellyfin). */
export function HomePage() {
  const { preferences, isLoading } = usePreferences();
  if (isLoading) return null;
  const layout = preferences.homeLayout;
  return (
    <div className="relative">
      <div className="absolute top-4 right-page-x-mobile z-10 md:right-page-x">
        <HomeLayoutMenu current={layout} />
      </div>
      {layout === "spotlight" && <SpotlightHome />}
      {layout === "dashboard" && <DashboardHome />}
      {layout === "focus" && <FocusHome />}
    </div>
  );
}

function metaLine(item: BaseItemDto): string {
  return [
    item.ProductionYear,
    item.OfficialRating,
    runtime(item),
    item.CommunityRating ? `★ ${item.CommunityRating.toFixed(1)}` : null,
    item.Genres?.slice(0, 2).join(", "),
  ]
    .filter(Boolean)
    .join("  ·  ");
}

function Rows({ children }: { children: React.ReactNode }) {
  return <div className="space-y-10 pb-24">{children}</div>;
}

/**
 * The user's home rows in their chosen order (Settings → Home). Each layout
 * supplies its own Continue Watching block; the other rows are shared.
 */
function OrderedSections({
  resume,
  first,
}: {
  resume: React.ReactNode;
  /** Wraps whichever row comes first (Spotlight overlaps it with the hero). */
  first?: (row: React.ReactNode) => React.ReactNode;
}) {
  const { preferences } = usePreferences();
  const rows: Record<HomeSectionId, React.ReactNode> = {
    resume,
    nextup: <NextUpRow />,
    listening: <ContinueListeningRow />,
    latest: <LatestRows />,
  };
  const visible = parseHomeSections(preferences.homeRows).filter((section) => section.visible);
  return (
    <>
      {visible.map((section, index) => (
        <Fragment key={section.id}>
          {index === 0 && first ? first(rows[section.id]) : rows[section.id]}
        </Fragment>
      ))}
    </>
  );
}

/* ───────────────────────── A · Spotlight ───────────────────────── */

function useFeatured(): { items: BaseItemDto[]; loading: boolean } {
  const { data: views } = useUserViews();
  const movies = views?.find((view) => view.CollectionType === "movies");
  const shows = views?.find((view) => view.CollectionType === "tvshows");
  const latestMovies = useLatest(movies ?? {}, 12);
  const latestShows = useLatest(shows ?? {}, 12);
  const items = useMemo(() => {
    const pool = [...(latestMovies.data ?? []), ...(latestShows.data ?? [])];
    // Only items with real backdrop artwork and an overview make a good spotlight.
    return pool.filter((item) => backdropImage(item) && item.Overview).slice(0, 6);
  }, [latestMovies.data, latestShows.data]);
  // Disabled queries (no such library) never load, so only wait for enabled ones.
  const loading =
    !views ||
    (Boolean(movies) && latestMovies.isPending) ||
    (Boolean(shows) && latestShows.isPending);
  return { items, loading };
}

function SpotlightHome() {
  const { items: featured, loading } = useFeatured();
  const resume = useResumeItems();
  return (
    <>
      {(loading || featured.length > 0) && <Hero items={featured} />}
      <Rows>
        <OrderedSections
          first={(row) => <div className={featured.length ? "relative -mt-20" : "pt-16"}>{row}</div>}
          resume={
            resume.isPending ? (
              <RowSkeleton shape="landscape" />
            ) : (
              <ContinueWatchingRow items={resume.data ?? []} />
            )
          }
        />
      </Rows>
    </>
  );
}

function Hero({ items }: { items: BaseItemDto[] }) {
  const { config } = useRuntimeConfig();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const item = items[index % Math.max(1, items.length)];

  // Rotates every 8 s; pauses while hovered or focused, when the tab is
  // hidden, and never moves for people who prefer reduced motion.
  useEffect(() => {
    if (paused || items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        setIndex((current) => (current + 1) % items.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [paused, items.length]);
  if (!item)
    return (
      <div className="h-[min(60vh,560px)] animate-pulse bg-surface motion-reduce:animate-none" />
    );

  const backdrop = backdropImage(item);
  const logo = logoImage(item);
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      className="relative h-[min(78vh,680px)] min-h-[440px] overflow-hidden"
    >
      {backdrop && (
        <img
          key={item.Id}
          src={imageUrl(config.jellyfinUrl, backdrop, 1920)}
          alt=""
          className="absolute inset-0 size-full animate-[fade-in_400ms_ease-out] object-cover object-top"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-background via-background/30 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-r from-background/95 via-background/40 to-transparent" />

      <div className="relative flex h-full flex-col justify-end gap-4 px-page-x-mobile pb-28 md:px-page-x">
        {logo ? (
          <img
            src={imageUrl(config.jellyfinUrl, logo, 600)}
            alt={item.Name ?? ""}
            className="max-h-28 w-auto max-w-[min(80%,420px)] object-contain object-left drop-shadow-[0_2px_12px_rgb(0_0_0/0.6)] light:brightness-0 light:drop-shadow-none"
          />
        ) : (
          <h1 className="max-w-2xl text-display">{item.Name}</h1>
        )}
        <p className="text-body-sm text-on-surface-muted">{metaLine(item)}</p>
        <p className="line-clamp-3 max-w-xl text-body-lg text-on-surface/90">{item.Overview}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <PlayButton />
          <Link
            to={itemHref(item)}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-white/15 light:bg-black/10 px-5 text-label-md backdrop-blur-sm hover:bg-white/25 light:hover:bg-black/15"
          >
            <Info aria-hidden className="size-5" />
            More info
          </Link>
        </div>
        {items.length > 1 && (
          <div className="mt-4 flex gap-2 md:absolute md:right-page-x md:bottom-28 md:mt-0">
            {items.map((entry, position) => (
              <button
                key={entry.Id}
                type="button"
                aria-label={`Show ${entry.Name}`}
                aria-current={position === index}
                onClick={() => setIndex(position)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  position === index
                    ? "w-8 bg-on-surface"
                    : "w-3 bg-on-surface/40 hover:bg-on-surface/70",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── B · Dashboard ───────────────────────── */

const VIEW_ICONS: Record<string, typeof Film> = {
  movies: Film,
  tvshows: Tv,
  music: Music,
  homevideos: Clapperboard,
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function DashboardHome() {
  const { user } = useSession();
  const { data: views } = useUserViews();
  const resume = useResumeItems();
  const { preferences } = usePreferences();
  const showResume = parseHomeSections(preferences.homeRows).some(
    (section) => section.id === "resume" && section.visible,
  );
  const [first, ...rest] = showResume ? (resume.data ?? []) : [];
  const spotlight = showResume ? (resume.data?.slice(0, 3) ?? []) : [];

  return (
    <Rows>
      <header className="px-page-x-mobile pt-8 md:px-page-x md:pt-10">
        <h1 className="text-headline-lg">
          {greeting()}, {user.Name}
        </h1>
        <nav aria-label="Libraries" className="mt-5 flex flex-wrap gap-2">
          {views
            ?.filter((view) => !user.Configuration?.MyMediaExcludes?.includes(view.Id ?? ""))
            .map((view) => {
              const Icon = VIEW_ICONS[view.CollectionType ?? ""] ?? Folder;
              return (
                <Link
                  key={view.Id}
                  to={`/libraries/${view.Id}`}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-surface-raised px-4 text-label-md text-on-surface-muted transition-colors duration-[120ms] hover:bg-surface-overlay hover:text-on-surface"
                >
                  <Icon aria-hidden className="size-4" />
                  {view.Name}
                </Link>
              );
            })}
        </nav>
      </header>

      {first && (
        <section aria-labelledby="dash-continue" className="px-page-x-mobile md:px-page-x">
          <h2 id="dash-continue" className="mb-3 text-title">
            Continue watching
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {spotlight.map((item) => (
              <Link
                key={item.Id}
                to={itemHref(item)}
                className="group block overflow-hidden rounded-lg bg-surface"
              >
                <div className="relative">
                  <Artwork
                    {...wideArtwork(item, true)}
                    shape="landscape"
                    width={560}
                    title={cardTitle(item)}
                    priority
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-surface via-transparent to-transparent" />
                </div>
                <div className="relative -mt-10 p-4">
                  <p className="truncate text-title">{cardTitle(item)}</p>
                  <p className="truncate text-body-sm text-on-surface-muted">
                    {continueSubtitle(item)}
                  </p>
                  {progress(item) !== null && (
                    <ProgressBar value={progress(item)!} className="mt-3" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      <OrderedSections
        resume={
          rest.length > 2 && <ContinueWatchingRow items={rest.slice(2)} title="More in progress" />
        }
      />
    </Rows>
  );
}

/* ───────────────────────── C · Focus ───────────────────────── */

function FocusHome() {
  const { config } = useRuntimeConfig();
  const resume = useResumeItems();
  const [focus, ...others] = resume.data ?? [];
  const artwork = focus ? wideArtwork(focus, true) : null;
  const backdrop = artwork?.image ?? null;
  const watched = focus ? progress(focus) : null;

  return (
    <Rows>
      {focus && (
        <section aria-labelledby="focus-title" className="relative overflow-hidden">
          {backdrop && (
            <img
              src={imageUrl(config.jellyfinUrl, backdrop, 1280)}
              alt=""
              aria-hidden
              className="absolute inset-0 size-full scale-110 object-cover opacity-25 blur-2xl"
            />
          )}
          <div className="absolute inset-0 bg-linear-to-b from-transparent to-background" />
          <div className="relative grid items-center gap-6 px-page-x-mobile pt-8 pb-4 md:px-page-x md:pt-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10">
            <Link
              to={itemHref(focus)}
              className="relative block overflow-hidden rounded-lg shadow-[0_24px_48px_-16px_rgb(0_0_0/0.7)]"
            >
              <Artwork
                image={backdrop}
                letterbox={artwork?.letterbox}
                shape="landscape"
                width={900}
                title={cardTitle(focus)}
                priority
              />
              {watched !== null && (
                <ProgressBar value={watched} className="absolute inset-x-4 bottom-4 h-1.5" />
              )}
            </Link>
            <div>
              <p className="text-label-sm uppercase text-primary">Pick up where you left off</p>
              <h1 id="focus-title" className="mt-2 text-headline-lg">
                {cardTitle(focus)}
              </h1>
              {focus.Type === "Episode" && (
                <p className="mt-1 text-title text-on-surface-muted">{cardSubtitle(focus)}</p>
              )}
              <p className="mt-3 text-body-sm text-on-surface-muted">{metaLine(focus)}</p>
              {focus.Overview && (
                <p className="mt-4 line-clamp-4 text-body-md text-on-surface/90">
                  {focus.Overview}
                </p>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <PlayButton label="Resume" />
                <span className="text-body-sm text-on-surface-muted">{timeLeft(focus)}</span>
              </div>
            </div>
          </div>
        </section>
      )}
      {resume.isPending && <RowSkeleton shape="landscape" />}
      <OrderedSections resume={<ContinueWatchingRow items={others} title="Also in progress" />} />
    </Rows>
  );
}
