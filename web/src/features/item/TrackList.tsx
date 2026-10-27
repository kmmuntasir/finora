import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { runtime } from "@/lib/format";

function duration(item: BaseItemDto): string {
  const ticks = item.RunTimeTicks;
  if (!ticks) return "";
  const seconds = Math.round(ticks / 10_000_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Album track listing, grouped by disc when there is more than one. */
export function TrackList({ album, tracks }: { album: BaseItemDto; tracks: BaseItemDto[] }) {
  const discs = new Set(tracks.map((track) => track.ParentIndexNumber ?? 1));
  const multiDisc = discs.size > 1;
  const albumArtist = album.AlbumArtist;

  return (
    <section aria-label="Tracks" className="px-page-x-mobile md:px-page-x">
      <ol className="divide-y divide-border/60 rounded-lg bg-surface">
        {tracks.map((track, index) => {
          const disc = track.ParentIndexNumber ?? 1;
          const previousDisc = index > 0 ? (tracks[index - 1]?.ParentIndexNumber ?? 1) : null;
          const header = multiDisc && disc !== previousDisc ? `Disc ${disc}` : null;
          const artists = track.Artists?.join(", ");
          return (
            <li key={track.Id}>
              {header && (
                <p className="px-4 pt-4 pb-1 text-label-sm text-on-surface-subtle">{header}</p>
              )}
              <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 px-4 py-3">
                <span className="text-right text-body-sm text-on-surface-muted tabular-nums">
                  {track.IndexNumber ?? ""}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-body-md">{track.Name}</span>
                  {artists && artists !== albumArtist && (
                    <span className="block truncate text-caption text-on-surface-muted">
                      {artists}
                    </span>
                  )}
                </span>
                <span
                  className="text-body-sm text-on-surface-muted tabular-nums"
                  title={runtime(track) ?? undefined}
                >
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
