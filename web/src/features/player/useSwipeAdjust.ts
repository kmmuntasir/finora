import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent } from "react";

export type SwipeKind = "brightness" | "volume";

/** Picture brightness range: the web can't change the screen's backlight, so this filters the video. */
export const BRIGHTNESS_RANGE = { min: 0.2, max: 1.5 } as const;
const VOLUME_RANGE = { min: 0, max: 1 } as const;
/** Swiping this share of the screen height moves through the whole range. */
const FULL_SWIPE = 0.75;
/** Vertical travel before a touch counts as a swipe rather than a tap. */
const SLOP_PX = 12;

/** The value after swiping up by `rise` pixels (negative = down) on a screen `height` tall. */
export function swipeValue(
  start: number,
  rise: number,
  height: number,
  range: { min: number; max: number },
): number {
  const next = start + (rise / (height * FULL_SWIPE)) * (range.max - range.min);
  return Math.min(range.max, Math.max(range.min, next));
}

interface Adjusters {
  brightness: number;
  volume: number;
  setBrightness: (value: number) => void;
  setVolume: (value: number) => void;
  /** iOS ignores scripted volume changes, so the gesture is left out there. */
  volumeAdjustable: boolean;
}

interface Swipe {
  pointerId: number;
  kind: SwipeKind;
  x: number;
  y: number;
  start: number;
  active: boolean;
}

/**
 * Touch swipes on the video in landscape, as in phone video apps: up or down
 * on the left half changes brightness, on the right half volume.
 */
export function useSwipeAdjust(adjusters: Adjusters) {
  const latest = useRef(adjusters);
  useLayoutEffect(() => {
    latest.current = adjusters;
  });
  const swipe = useRef<Swipe | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const [indicator, setIndicator] = useState<{ kind: SwipeKind; value: number } | null>(null);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch") return;
    if (!window.matchMedia("(orientation: landscape)").matches) return;
    const kind: SwipeKind = event.clientX < window.innerWidth / 2 ? "brightness" : "volume";
    if (kind === "volume" && !latest.current.volumeAdjustable) return;
    swipe.current = {
      pointerId: event.pointerId,
      kind,
      x: event.clientX,
      y: event.clientY,
      start: latest.current[kind],
      active: false,
    };
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const current = swipe.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const rise = current.y - event.clientY;
    if (!current.active) {
      const sideways = Math.abs(event.clientX - current.x);
      if (Math.abs(rise) < SLOP_PX || Math.abs(rise) < sideways * 1.5) return;
      current.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      window.clearTimeout(hideTimer.current);
    }
    const range = current.kind === "brightness" ? BRIGHTNESS_RANGE : VOLUME_RANGE;
    const value = swipeValue(current.start, rise, window.innerHeight, range);
    if (current.kind === "brightness") latest.current.setBrightness(value);
    else latest.current.setVolume(value);
    setIndicator({ kind: current.kind, value });
  }, []);

  const onPointerEnd = useCallback((event: PointerEvent<HTMLElement>) => {
    if (swipe.current?.pointerId !== event.pointerId) return;
    swipe.current = null;
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setIndicator(null), 700);
  }, []);

  return {
    indicator,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  };
}

/** Whether this browser lets scripts change a media element's volume (not on iOS). */
export function canAdjustVolume(): boolean {
  const probe = document.createElement("audio");
  probe.volume = 0.5;
  return probe.volume === 0.5;
}
