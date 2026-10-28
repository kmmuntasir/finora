import { describe, expect, it } from "vitest";
import {
  cardSubtitle,
  cardTitle,
  formatDate,
  formatMinutes,
  progress,
  setDisplayLocale,
  timeLeft,
} from "./format";

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

import { relativeTime } from "./format";

describe("relativeTime", () => {
  const now = Date.parse("2026-10-28T12:00:00Z");
  it("describes past times", () => {
    expect(relativeTime("2026-10-28T11:59:40Z", now)).toBe("Just now");
    expect(relativeTime("2026-10-28T09:00:00Z", now)).toMatch(/3 hours ago/);
    expect(relativeTime(null, now)).toBe("Never");
  });
});

describe("formatDate", () => {
  it("uses the chosen locale", () => {
    setDisplayLocale("en-GB");
    expect(formatDate("2026-10-28T12:00:00Z")).toBe("28 Oct 2026");
    setDisplayLocale("en-US");
    expect(formatDate("2026-10-28T12:00:00Z")).toBe("Oct 28, 2026");
    setDisplayLocale("auto");
    expect(formatDate(null)).toBe("");
  });
});

describe("timeLeft", () => {
  it("says so when less than a minute is left", () => {
    expect(
      timeLeft({ RunTimeTicks: 300_000_000, UserData: { PlaybackPositionTicks: 120_000_000 } }),
    ).toBe("Less than a minute left");
  });
});
