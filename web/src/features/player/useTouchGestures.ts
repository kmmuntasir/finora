import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent } from "react";

export type SwipeKind = "brightness" | "volume";
export type Side = "left" | "right";

/** Picture brightness range: the web can't change the screen's backlight, so this filters the video. */
export const BRIGHTNESS_RANGE = { min: 0.2, max: 1.5 } as const;
const VOLUME_RANGE = { min: 0, max: 1 } as const;
/** Swiping this share of the screen height moves through the whole range. */
const FULL_SWIPE = 0.75;
/** Travel before a touch counts as a swipe rather than a tap. */
const SLOP_PX = 12;
/** Taps closer together than this, on the same half, seek. */
const DOUBLE_TAP_MS = 300;
export const SEEK_STEP_S = 10;

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

interface Handlers {
  brightness: number;
  volume: number;
  setBrightness: (value: number) => void;
  setVolume: (value: number) => void;
  seekBy: (seconds: number) => void;
  /** iOS ignores scripted volume changes, so that swipe is left out there. */
  volumeAdjustable: boolean;
}

export type GestureIndicator =
  { kind: SwipeKind; value: number } | { kind: "seek"; side: Side; seconds: number };

interface Touch {
  pointerId: number;
  side: Side;
  x: number;
  y: number;
  /** Brightness or volume when the touch began. */
  start: number;
  swiping: boolean;
  moved: boolean;
}

/**
 * Touch gestures on the video, as in phone video apps:
 * - double tap the left half to go back 10 s, the right half to go forward
 *   (each further quick tap adds 10 s);
 * - in landscape, swipe up or down on the left half for brightness and on
 *   the right half for volume.
 */
export function useTouchGestures(handlers: Handlers) {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  const touch = useRef<Touch | null>(null);
  const lastTap = useRef<{ side: Side; time: number; seconds: number } | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const [indicator, setIndicator] = useState<GestureIndicator | null>(null);

  const show = useCallback((next: GestureIndicator) => {
    window.clearTimeout(hideTimer.current);
    setIndicator(next);
  }, []);
  const hideSoon = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setIndicator(null), 700);
  }, []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch") return;
    const side: Side = event.clientX < window.innerWidth / 2 ? "left" : "right";
    touch.current = {
      pointerId: event.pointerId,
      side,
      x: event.clientX,
      y: event.clientY,
      start: side === "left" ? latest.current.brightness : latest.current.volume,
      swiping: false,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const current = touch.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const rise = current.y - event.clientY;
      const sideways = event.clientX - current.x;
      if (!current.swiping) {
        if (Math.hypot(rise, sideways) >= SLOP_PX) current.moved = true;
        if (Math.abs(rise) < SLOP_PX || Math.abs(rise) < Math.abs(sideways) * 1.5) return;
        const landscape = window.matchMedia("(orientation: landscape)").matches;
        const volume = current.side === "right";
        if (!landscape || (volume && !latest.current.volumeAdjustable)) return;
        current.swiping = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      const kind: SwipeKind = current.side === "left" ? "brightness" : "volume";
      const range = kind === "brightness" ? BRIGHTNESS_RANGE : VOLUME_RANGE;
      const value = swipeValue(current.start, rise, window.innerHeight, range);
      if (kind === "brightness") latest.current.setBrightness(value);
      else latest.current.setVolume(value);
      show({ kind, value });
    },
    [show],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const current = touch.current;
      if (!current || current.pointerId !== event.pointerId) return;
      touch.current = null;
      if (current.swiping || current.moved) {
        lastTap.current = null;
        hideSoon();
        return;
      }
      const now = event.timeStamp;
      const previous = lastTap.current;
      if (previous && previous.side === current.side && now - previous.time < DOUBLE_TAP_MS) {
        const step = current.side === "left" ? -SEEK_STEP_S : SEEK_STEP_S;
        latest.current.seekBy(step);
        const seconds = previous.seconds + SEEK_STEP_S;
        lastTap.current = { side: current.side, time: now, seconds };
        show({ kind: "seek", side: current.side, seconds });
        hideSoon();
      } else {
        lastTap.current = { side: current.side, time: now, seconds: 0 };
      }
    },
    [hideSoon, show],
  );

  const onPointerCancel = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (touch.current?.pointerId !== event.pointerId) return;
      touch.current = null;
      hideSoon();
    },
    [hideSoon],
  );

  return {
    indicator,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}

/** Whether this browser lets scripts change a media element's volume (not on iOS). */
export function canAdjustVolume(): boolean {
  const probe = document.createElement("audio");
  probe.volume = 0.5;
  return probe.volume === 0.5;
}
