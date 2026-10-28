import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { ListEnd, ListStart, Play } from "lucide-react";
import { currentEntry, useQueue } from "@/features/music/queue-store";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";

function duration(item: BaseItemDto): string {
  const ticks = item.RunTimeTicks;
  if (!ticks) return "";
  const seconds = Math.round(ticks / 10_000_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const ACTION =
  "grid size-8 place-items-center rounded-full text-on-surface-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:text-on-surface focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100";

/** Album track listing, grouped by disc; click a track to play the album from there. */
export function TrackList({ album, tracks }: { album: BaseItemDto; tracks: BaseItemDto[] }) {
  const playingId = useQueue((state) => currentEntry(state)?.item.Id);
  const discs = new Set(tracks.map((track) => track.ParentIndexNumber ?? 1));
  const multiDisc = discs.size > 1;
  const albumArtist = album.AlbumArtist;

  return (
    <section aria-label={t("Tracks")} className="px-page-x-mobile md:px-page-x">
      <ol className="divide-y divide-border/60 rounded-lg bg-surface">
        {tracks.map((track, index) => {
          const disc = track.ParentIndexNumber ?? 1;
          const previousDisc = index > 0 ? (tracks[index - 1]?.ParentIndexNumber ?? 1) : null;
          const header = multiDisc && disc !== previousDisc ? t("Disc {disc}", { disc }) : null;
          const artists = track.Artists?.join(", ");
          const current = track.Id === playingId;
          return (
            <li key={track.Id}>
              {header && (
                <p className="px-4 pt-4 pb-1 text-label-sm text-on-surface-subtle">{header}</p>
              )}
              <div className="group grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 px-4 py-2.5 hover:bg-white/5 light:hover:bg-black/5">
                <span className="grid place-items-center text-body-sm text-on-surface-muted tabular-nums">
                  <span className="group-hover:hidden">
                    {current ? "♪" : (track.IndexNumber ?? "")}
                  </span>
                  <Play
                    aria-hidden
                    className="hidden size-4 fill-current text-on-surface group-hover:block"
                  />
                </span>
                <button
                  type="button"
                  onClick={() => useQueue.getState().play(tracks, index)}
                  className="min-w-0 text-left"
                  aria-label={t("Play {title}", { title: track.Name ?? "" })}
                >
                  <span className={cn("block truncate text-body-md", current && "text-primary")}>
                    {track.Name}
                  </span>
                  {artists && artists !== albumArtist && (
                    <span className="block truncate text-caption text-on-surface-muted">
                      {artists}
                    </span>
                  )}
                </button>
                <span className="flex">
                  <button
                    type="button"
                    onClick={() => useQueue.getState().playNext([track])}
                    aria-label={t("Play {title} next", { title: track.Name ?? "" })}
                    title={t("Play next")}
                    className={ACTION}
                  >
                    <ListStart aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => useQueue.getState().addToQueue([track])}
                    aria-label={t("Add {title} to queue", { title: track.Name ?? "" })}
                    title={t("Add to queue")}
                    className={ACTION}
                  >
                    <ListEnd aria-hidden className="size-4" />
                  </button>
                </span>
                <span className="text-body-sm text-on-surface-muted tabular-nums">
                  {duration(track)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
