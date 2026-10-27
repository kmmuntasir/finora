import { describe, expect, it } from "vitest";
import { adjustCues, offsetLabel } from "./subtitle-timing";

describe("adjustCues", () => {
  it("shifts from the original timing every time", () => {
    const cue = { startTime: 10, endTime: 12, line: "auto" as number | "auto" };
    adjustCues([cue], 1.5, false);
    expect(cue.startTime).toBe(11.5);
    adjustCues([cue], -1, true);
    expect(cue.startTime).toBe(9);
    expect(cue.endTime).toBe(11);
    expect(cue.line).toBe(-4);
    adjustCues([cue], 0, false);
    expect(cue.startTime).toBe(10);
    expect(cue.line).toBe("auto");
  });

  it("never moves cues before zero", () => {
    const cue = { startTime: 0.5, endTime: 1 };
    adjustCues([cue], -2, false);
    expect(cue.startTime).toBe(0);
  });

  it("labels offsets", () => {
    expect(offsetLabel(0)).toBe("In sync");
    expect(offsetLabel(0.5)).toBe("+0.5 s (later)");
    expect(offsetLabel(-1)).toBe("−1 s (earlier)");
  });
});

describe("adjustCues with percent positioning", () => {
  it("raises percent-positioned cues and restores them", () => {
    const cue = { startTime: 1, endTime: 2, line: 90 as number | "auto", snapToLines: false };
    adjustCues([cue], 0, true);
    expect(cue.line).toBe(78);
    adjustCues([cue], 0, false);
    expect(cue.line).toBe(90);
  });
});
