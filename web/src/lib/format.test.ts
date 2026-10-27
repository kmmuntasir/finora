import { describe, expect, it } from "vitest";
import { cardSubtitle, cardTitle, formatMinutes, progress, timeLeft } from "./format";

describe("format", () => {
  it("formats minutes", () => {
    expect(formatMinutes(42)).toBe("42 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(135)).toBe("2 h 15 min");
  });

  it("computes time left and progress", () => {
    const item = {
      RunTimeTicks: 60 * 600_000_000,
      UserData: { PlaybackPositionTicks: 15 * 600_000_000, PlayedPercentage: 25 },
    };
    expect(timeLeft(item)).toBe("45 min left");
    expect(progress(item)).toBe(0.25);
    expect(progress({})).toBeNull();
  });

  it("titles episodes by series", () => {
    const episode = {
      Type: "Episode",
      SeriesName: "Shōgun",
      Name: "Anjin",
      ParentIndexNumber: 1,
      IndexNumber: 1,
    } as const;
    expect(cardTitle(episode)).toBe("Shōgun");
    expect(cardSubtitle(episode)).toBe("S1:E1 · Anjin");
    expect(cardSubtitle({ Type: "Movie", ProductionYear: 1996 })).toBe("1996");
  });
});
