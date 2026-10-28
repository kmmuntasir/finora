import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAudioClock } from "./audio-clock";
import { useQueue } from "./queue-store";
import { t } from "@/i18n";

const BUTTON =
  "grid place-items-center rounded-full text-on-surface-muted transition-colors duration-[120ms] hover:text-on-surface disabled:opacity-40";

/** Shuffle, previous, play/pause, next, repeat. */
export function TransportControls({
  size = "md",
  showModes = true,
}: {
  size?: "md" | "lg";
  showModes?: boolean;
}) {
  const playing = useQueue((state) => state.playing);
  const shuffled = useQueue((state) => state.unshuffled !== null);
  const repeat = useQueue((state) => state.repeat);
  const hasNext = useQueue(
    (state) => state.index + 1 < state.queue.length || state.repeat !== "off",
  );
  const { setPlaying, next, previous, toggleShuffle, cycleRepeat } = useQueue.getState();
  const large = size === "lg";

  const onPrevious = () => {
    // Like most players: restart the track unless we are at its very beginning.
    if (useAudioClock.getState().current > 3) useAudioClock.getState().seek(0);
    else previous();
  };

  return (
    <div className={cn("flex items-center justify-center", large ? "gap-6" : "gap-3")}>
      {showModes && (
        <button
          type="button"
          onClick={toggleShuffle}
          aria-pressed={shuffled}
          aria-label={t("Shuffle")}
          title={t("Shuffle")}
          className={cn(
            BUTTON,
            large ? "size-11" : "size-9",
            shuffled && "text-primary hover:text-primary",
          )}
        >
          <Shuffle aria-hidden className={large ? "size-5" : "size-4"} />
        </button>
      )}
      <button
        type="button"
        onClick={onPrevious}
        aria-label={t("Previous")}
        className={cn(BUTTON, "text-on-surface", large ? "size-12" : "size-9")}
      >
        <SkipBack aria-hidden className={cn("fill-current", large ? "size-7" : "size-5")} />
      </button>
      <button
        type="button"
        onClick={() => setPlaying(!playing)}
        aria-label={playing ? t("Pause") : t("Play")}
        className={cn(
          "grid place-items-center rounded-full bg-on-surface text-background transition-transform duration-[120ms] active:scale-95",
          large ? "size-16" : "size-10",
        )}
      >
        {playing ? (
          <Pause aria-hidden className={cn("fill-current", large ? "size-7" : "size-5")} />
        ) : (
          <Play
            aria-hidden
            className={cn("translate-x-px fill-current", large ? "size-7" : "size-5")}
          />
        )}
      </button>
      <button
        type="button"
        onClick={next}
        disabled={!hasNext}
        aria-label={t("Next")}
        className={cn(BUTTON, "text-on-surface", large ? "size-12" : "size-9")}
      >
        <SkipForward aria-hidden className={cn("fill-current", large ? "size-7" : "size-5")} />
      </button>
      {showModes && (
        <button
          type="button"
          onClick={cycleRepeat}
          aria-label={
            repeat === "off"
              ? t("Repeat: off")
              : repeat === "all"
                ? t("Repeat: all")
                : t("Repeat: one")
          }
          title={
            repeat === "off"
              ? t("Repeat off")
              : repeat === "all"
                ? t("Repeat all")
                : t("Repeat one")
          }
          className={cn(
            BUTTON,
            large ? "size-11" : "size-9",
            repeat !== "off" && "text-primary hover:text-primary",
          )}
        >
          {repeat === "one" ? (
            <Repeat1 aria-hidden className={large ? "size-5" : "size-4"} />
          ) : (
            <Repeat aria-hidden className={large ? "size-5" : "size-4"} />
          )}
        </button>
      )}
    </div>
  );
}
