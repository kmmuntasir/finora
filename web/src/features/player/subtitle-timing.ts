import { t } from "@/i18n";

/** The minimal cue shape we touch; VTTCue in browsers. */
interface AdjustableCue {
  startTime: number;
  endTime: number;
  line?: number | "auto";
  snapToLines?: boolean;
}

interface Original {
  start: number;
  end: number;
  line: number | "auto" | undefined;
}

/** Original timings and positions, so repeated adjustments never accumulate. */
const originals = new WeakMap<AdjustableCue, Original>();

/**
 * Shifts every cue by `offset` seconds (positive shows subtitles later) and
 * optionally raises them above the bottom edge. Jellyfin's WebVTT puts
 * cues at `line:90%` (percent positioning), so raising works in either mode.
 */
export function adjustCues(
  cues: ArrayLike<AdjustableCue> | null | undefined,
  offset: number,
  raised: boolean,
): void {
  if (!cues) return;
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i]!;
    let original = originals.get(cue);
    if (!original) {
      original = { start: cue.startTime, end: cue.endTime, line: cue.line };
      originals.set(cue, original);
    }
    cue.startTime = Math.max(0, original.start + offset);
    cue.endTime = Math.max(0, original.end + offset);
    if (!("line" in cue)) continue;
    if (!raised) cue.line = original.line ?? "auto";
    else if (cue.snapToLines === false)
      cue.line = Math.max(0, (typeof original.line === "number" ? original.line : 100) - 12);
    else cue.line = -4;
  }
}

/** -0.5 → "−0.5 s (earlier)"; 0 → "In sync". */
export function offsetLabel(offset: number): string {
  if (offset === 0) return t("In sync");
  const seconds = Math.abs(offset);
  return offset > 0
    ? t("+{seconds} s (later)", { seconds })
    : t("−{seconds} s (earlier)", { seconds });
}

export const SUBTITLE_OFFSETS = [-5, -3, -2, -1, -0.5, -0.25, 0, 0.25, 0.5, 1, 2, 3, 5];
