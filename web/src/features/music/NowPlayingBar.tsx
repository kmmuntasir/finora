import { ChevronUp, ListMusic, Volume2, VolumeX } from "lucide-react";
import { Artwork } from "@/components/media/Artwork";
import { formatClock } from "@/features/player/player-preferences";
import { useAudioClock } from "./audio-clock";
import { currentEntry, useQueue } from "./queue-store";
import { trackArt } from "./stream-url";
import { TransportControls } from "./TransportControls";
import { t } from "@/i18n";

function ThinProgress() {
  const current = useAudioClock((state) => state.current);
  const duration = useAudioClock((state) => state.duration);
  return (
    <div className="h-0.5 w-full bg-white/10 light:bg-black/5">
      <div
        className="h-full bg-linear-to-r from-brand-cyan to-brand-blue"
        style={{ width: `${duration ? Math.min(100, (current / duration) * 100) : 0}%` }}
      />
    </div>
  );
}

function Times() {
  const current = useAudioClock((state) => state.current);
  const duration = useAudioClock((state) => state.duration);
  return (
    <span className="text-caption text-on-surface-muted tabular-nums">
      {formatClock(current)} / {formatClock(duration)}
    </span>
  );
}

function VolumeControl() {
  const volume = useAudioClock((state) => state.volume);
  const muted = useAudioClock((state) => state.muted);
  const { setVolume, toggleMute } = useAudioClock.getState();
  return (
    <div className="hidden items-center gap-1 lg:flex">
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? t("Unmute") : t("Mute")}
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
        aria-label={t("Volume")}
        className="w-24 accent-primary"
      />
    </div>
  );
}

/** Persistent mini player shown while music is loaded. */
export function NowPlayingBar() {
  const entry = useQueue(currentEntry);
  const setExpanded = useQueue((state) => state.setExpanded);
  if (!entry) return null;
  const item = entry.item;
  const artist = item.Artists?.join(", ") || item.AlbumArtist || "";

  return (
    <div
      role="region"
      aria-label={t("Now playing")}
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface/95 backdrop-blur md:bottom-0 md:left-[var(--spacing-sidebar)]"
    >
      <ThinProgress />
      <div className="grid h-[calc(var(--spacing-player-bar)-2px)] grid-cols-[1fr_auto] items-center gap-3 px-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-5">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex min-w-0 items-center gap-3 rounded-md text-left"
          aria-label={t("Open now playing")}
        >
          <Artwork
            image={trackArt(item)}
            shape="square"
            width={56}
            title={item.Name ?? ""}
            className="w-12 shrink-0 rounded-sm"
          />
          <span className="min-w-0">
            <span className="block truncate text-label-md">{item.Name}</span>
            <span className="block truncate text-caption text-on-surface-muted">{artist}</span>
          </span>
        </button>
        <div className="flex flex-col items-center">
          <div className="md:hidden">
            <TransportControls showModes={false} />
          </div>
          <div className="hidden md:block">
            <TransportControls />
          </div>
        </div>
        <div className="hidden items-center justify-end gap-2 md:flex">
          <Times />
          <VolumeControl />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label={t("Queue")}
            className="grid size-9 place-items-center rounded-full text-on-surface-muted hover:text-on-surface"
          >
            <ListMusic aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label={t("Expand player")}
            className="grid size-9 place-items-center rounded-full text-on-surface-muted hover:text-on-surface"
          >
            <ChevronUp aria-hidden className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
