import type { ChapterInfo } from "@jellyfin/sdk/lib/generated-client/models";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatClock } from "./player-preferences";
import type { TrickplayFrame } from "./trickplay";

interface SeekBarProps {
  current: number;
  duration: number;
  buffered: number;
  chapters: ChapterInfo[];
  onSeek: (seconds: number) => void;
  /** Thumbnail for a time, when trickplay images exist. */
  frameAt?: (seconds: number) => TrickplayFrame | null;
}

const TICKS_PER_SECOND = 10_000_000;

/** Accessible seek slider with hover previews (trickplay) and chapter marks. */
export function SeekBar({ current, duration, buffered, chapters, onSeek, frameAt }: SeekBarProps) {
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const safeDuration = duration > 0 ? duration : 1;
  const shown = dragging ?? current;

  const timeAt = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * safeDuration;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(timeAt(event.clientX));
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const time = timeAt(event.clientX);
    setHover(time);
    if (dragging !== null) setDragging(time);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging === null) return;
    onSeek(timeAt(event.clientX));
    setDragging(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowLeft: -5,
      ArrowRight: 5,
      PageDown: -60,
      PageUp: 60,
    };
    if (event.key in steps) {
      event.preventDefault();
      event.stopPropagation();
      onSeek(Math.min(safeDuration, Math.max(0, current + steps[event.key]!)));
    } else if (event.key === "Home") {
      event.preventDefault();
      onSeek(0);
    }
  };

  const preview = hover ?? dragging;
  const frame = preview !== null && frameAt ? frameAt(preview) : null;
  const previewChapter =
    preview !== null
      ? [...chapters]
          .reverse()
          .find((chapter) => (chapter.StartPositionTicks ?? 0) / TICKS_PER_SECOND <= preview)
      : undefined;
  const previewLeft = preview !== null ? (preview / safeDuration) * 100 : 0;

  return (
    <div className="group/seek relative">
      {preview !== null && (
        <div
          className="pointer-events-none absolute bottom-full mb-3 flex -translate-x-1/2 flex-col items-center gap-1.5"
          style={{ left: `clamp(5rem, ${previewLeft}%, calc(100% - 5rem))` }}
        >
          {frame && (
            <div
              className="overflow-hidden rounded-md shadow-[0_8px_24px_rgb(0_0_0/0.6)] ring-1 ring-white/20"
              style={{
                width: frame.width * 0.75,
                height: frame.height * 0.75,
                backgroundImage: `url("${frame.url}")`,
                backgroundPosition: frame.backgroundPosition
                  .split(" ")
                  .map((value) => `${parseFloat(value) * 0.75}px`)
                  .join(" "),
                backgroundSize: frame.backgroundSize
                  .split(" ")
                  .map((value) => `${parseFloat(value) * 0.75}px`)
                  .join(" "),
              }}
            />
          )}
          <span className="rounded-md bg-black/80 px-2 py-1 text-label-sm tabular-nums">
            {previewChapter?.Name ? `${previewChapter.Name} · ` : ""}
            {formatClock(preview)}
          </span>
        </div>
      )}
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(safeDuration)}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={`${formatClock(shown)} of ${formatClock(duration)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
        className="relative flex h-6 cursor-pointer touch-none items-center"
      >
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/25 transition-[height] duration-150 group-hover/seek:h-1.5">
          <div
            className="absolute inset-y-0 left-0 bg-white/35"
            style={{ width: `${(buffered / safeDuration) * 100}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-linear-to-r from-brand-cyan to-brand-blue"
            style={{ width: `${(shown / safeDuration) * 100}%` }}
          />
          {chapters.slice(1).map((chapter, index) => (
            <span
              key={index}
              aria-hidden
              className="absolute inset-y-0 w-0.5 bg-black/60"
              style={{
                left: `${((chapter.StartPositionTicks ?? 0) / TICKS_PER_SECOND / safeDuration) * 100}%`,
              }}
            />
          ))}
        </div>
        <span
          aria-hidden
          className="absolute size-3.5 -translate-x-1/2 rounded-full bg-white shadow scale-0 transition-transform duration-150 group-hover/seek:scale-100 group-focus-visible/seek:scale-100"
          style={{ left: `${(shown / safeDuration) * 100}%` }}
        />
      </div>
    </div>
  );
}
