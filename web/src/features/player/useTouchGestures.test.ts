import { describe, expect, it } from "vitest";
import { BRIGHTNESS_RANGE, swipeValue } from "./useTouchGestures";

describe("swipeValue", () => {
  const volume = { min: 0, max: 1 };

  it("moves through the whole range over three quarters of the screen", () => {
    expect(swipeValue(0, 300, 400, volume)).toBeCloseTo(1);
    expect(swipeValue(0.5, 150, 400, volume)).toBeCloseTo(1);
    expect(swipeValue(0.5, -75, 400, volume)).toBeCloseTo(0.25);
  });

  it("stays inside the range", () => {
    expect(swipeValue(0.9, 1000, 400, volume)).toBe(1);
    expect(swipeValue(1, -1000, 400, BRIGHTNESS_RANGE)).toBe(BRIGHTNESS_RANGE.min);
  });
});
