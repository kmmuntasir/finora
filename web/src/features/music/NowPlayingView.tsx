import { ChevronDown, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { imageUrl } from "@/api/images";
import { Artwork } from "@/components/media/Artwork";
import { useRuntimeConfig } from "@/config/context";
import { formatClock } from "@/features/player/player-preferences";
import { SeekBar } from "@/features/player/SeekBar";
import { cn } from "@/lib/cn";
import { useAudioClock } from "./audio-clock";
import { Lyrics } from "./Lyrics";
import { currentEntry, useQueue } from "./queue-store";
import { QueueList } from "./QueueList";
import { trackArt } from "./stream-url";
import { TransportControls } from "./TransportControls";

function Progress() {
  const current = useAudioClock((state) => state.current);
  const duration = useAudioClock((state) => state.duration);
  return (
    <div>
      <SeekBar
        current={current}
        duration={duration}
        buffered={0}
        chapters={[]}
        onSeek={(seconds) => useAudioClock.getState().seek(seconds)}
      />
      <div className="mt-1 flex justify-between text-caption text-on-surface-muted tabular-nums">
        <span>{formatClock(current)}</span>
        <span>{formatClock(duration)}</span>
      </div>
    </div>
  );
}

function Volume() {
  const volume = useAudioClock((state) => state.volume);
  const muted = useAudioClock((state) => state.muted);
  const { setVolume, toggleMute } = useAudioClock.getState();
  return (
    <div className="hidden items-center justify-center gap-2 [@media(pointer:fine)]:flex">
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        className="grid size-9 place-items-center rounded-full text-on-surface-muted hover:text-on-surface"
      >
        {muted || volume === 0 ? (
          <VolumeX aria-hidden className="size-5" />
        ) : (
          <Volume2 aria-hidden className="size-5" />
        )}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onChange={(event) => setVolume(Number(event.target.value))}
        aria-label="Volume"
        className="w-40 accent-primary"
      />
    </div>
  );
}

/** Full-screen now playing view with queue and lyrics. */
export function NowPlayingView() {
  const { config } = useRuntimeConfig();
  const entry = useQueue(currentEntry);
  const expanded = useQueue((state) => state.expanded);
  const setExpanded = useQueue((state) => state.setExpanded);
  const [tab, setTab] = useState<"queue" | "lyrics">("queue");

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded, setExpanded]);

  if (!expanded || !entry) return null;
  const item = entry.item;
  const art = trackArt(item);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      className="fixed inset-0 z-40 overflow-hidden bg-background animate-[fade-in_200ms_ease-out]"
    >
      {art && (
        <img
          src={imageUrl(config.jellyfinUrl, art, 200)}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full scale-125 object-cover opacity-30 blur-3xl"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-b from-background/40 to-background" />

      <div className="relative flex h-full flex-col px-page-x-mobile pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] md:px-page-x">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Close"
            className="grid size-11 place-items-center rounded-full hover:bg-white/10"
          >
            <ChevronDown aria-hidden className="size-6" />
          </button>
          {item.Album && (
            <p className="min-w-0 flex-1 truncate text-label-md text-on-surface-muted">
              Playing from{" "}
              {item.AlbumId ? (
                <Link
                  to={`/items/${item.AlbumId}`}
                  onClick={() => setExpanded(false)}
                  className="text-on-surface hover:underline"
                >
                  {item.Album}
                </Link>
              ) : (
                item.Album
              )}
            </p>
          )}
          <button
            type="button"
            onClick={() => useQueue.getState().clear()}
            className="ml-auto h-9 shrink-0 rounded-full px-4 text-label-md text-on-surface-muted hover:bg-white/10 hover:text-on-surface"
          >
            Clear queue
          </button>
        </div>

        <div className="mt-4 grid min-h-0 flex-1 gap-8 overflow-y-auto lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:overflow-hidden">
          <div className="mx-auto flex w-full max-w-md flex-col justify-center gap-6 lg:max-w-none">
            <Artwork
              image={art}
              shape="square"
              width={448}
              title={item.Name ?? ""}
              priority
              className="rounded-lg shadow-[0_24px_64px_-16px_rgb(0_0_0/0.8)]"
            />
            <div className="min-w-0">
              <h2 className="truncate text-headline-md">{item.Name}</h2>
              <p className="truncate text-body-lg text-on-surface-muted">
                {item.ArtistItems?.length
                  ? item.ArtistItems.map((artist, index) => (
                      <span key={artist.Id}>
                        {index > 0 && ", "}
                        <Link
                          to={`/items/${artist.Id}`}
                          onClick={() => setExpanded(false)}
                          className="hover:text-on-surface hover:underline"
                        >
                          {artist.Name}
                        </Link>
                      </span>
                    ))
                  : item.AlbumArtist}
              </p>
            </div>
            <Progress />
            <TransportControls size="lg" />
            <Volume />
          </div>

          <section className="flex min-h-0 flex-col">
            <div role="tablist" className="mb-4 flex gap-2">
              {(["queue", "lyrics"] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={tab === name}
                  onClick={() => setTab(name)}
                  className={cn(
                    "h-9 rounded-full px-4 text-label-md transition-colors duration-[120ms]",
                    tab === name
                      ? "bg-on-surface text-background"
                      : "bg-white/10 text-on-surface-muted hover:text-on-surface",
                  )}
                >
                  {name === "queue" ? "Up next" : "Lyrics"}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {tab === "queue" ? <QueueList /> : <Lyrics item={item} />}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
