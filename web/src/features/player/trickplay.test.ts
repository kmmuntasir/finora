import { describe, expect, it } from "vitest";
import { formatClock } from "./player-preferences";
import { trickplayFrame, trickplayInfo } from "./trickplay";

const info = {
  Width: 320,
  Height: 180,
  TileWidth: 10,
  TileHeight: 10,
  ThumbnailCount: 250,
  Interval: 10000,
};

describe("trickplay", () => {
  it("chooses a resolution for the media source", () => {
    expect(trickplayInfo({ Trickplay: { ms1: { "320": info } } }, "ms1")).toBe(info);
    expect(trickplayInfo({}, "ms1")).toBeNull();
  });

  it("locates the thumbnail inside the tile sheet", () => {
    const frame = trickplayFrame(info, 1234, "http://h", "item", "ms1", "tok");
    // 1234 s / 10 s = thumbnail 123 → sheet 1, offset 23 → column 3, row 2.
    expect(frame?.url).toBe(
      "http://h/Videos/item/Trickplay/320/1.jpg?mediaSourceId=ms1&ApiKey=tok",
    );
    expect(frame?.backgroundPosition).toBe("-960px -360px");
    expect(frame?.backgroundSize).toBe("3200px 1800px");
  });

  it("formats clock times", () => {
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});
