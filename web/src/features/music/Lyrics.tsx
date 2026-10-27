import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getLyricsApi } from "@jellyfin/sdk/lib/utils/api/lyrics-api";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Spinner } from "@/components/Spinner";
import { useSession } from "@/features/auth/context";
import { cn } from "@/lib/cn";
import { useAudioClock } from "./audio-clock";

/** Lyrics for the current track; synced lyrics follow playback and can be tapped to seek. */
export function Lyrics({ item }: { item: BaseItemDto }) {
  const { api } = useSession();
  const { data, isPending } = useQuery({
    queryKey: ["lyrics", item.Id],
    queryFn: async ({ signal }) =>
      (await getLyricsApi(api).getLyrics({ itemId: item.Id! }, { signal })).data,
    enabled: Boolean(item.Id && item.HasLyrics),
    staleTime: Infinity,
  });
  const current = useAudioClock((state) => state.current);
  const activeRef = useRef<HTMLLIElement>(null);

  const lines = data?.Lyrics ?? [];
  const synced = lines.some((line) => line.Start != null);
  const activeIndex = synced
    ? lines.reduce(
        (found, line, index) =>
          (line.Start ?? Infinity) / 10_000_000 <= current + 0.25 ? index : found,
        -1,
      )
    : -1;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex]);

  if (!item.HasLyrics)
    return <p className="text-body-md text-on-surface-muted">No lyrics for this track.</p>;
  if (isPending) return <Spinner />;
  if (!lines.length)
    return <p className="text-body-md text-on-surface-muted">No lyrics for this track.</p>;

  return (
    <ol className="space-y-3 pb-24">
      {lines.map((line, index) => (
        <li key={index} ref={index === activeIndex ? activeRef : undefined}>
          <button
            type="button"
            disabled={!synced}
            onClick={() =>
              line.Start != null && useAudioClock.getState().seek(line.Start / 10_000_000)
            }
            className={cn(
              "text-left text-headline-md transition-colors duration-200",
              !synced
                ? "text-on-surface"
                : index === activeIndex
                  ? "text-on-surface"
                  : "text-on-surface-subtle hover:text-on-surface-muted",
            )}
          >
            {line.Text || "♪"}
          </button>
        </li>
      ))}
    </ol>
  );
}
