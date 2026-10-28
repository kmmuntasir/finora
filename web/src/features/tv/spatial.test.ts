import { describe, expect, it } from "vitest";
import { nearestInDirection, type Box } from "./spatial";

const box = (left: number, top: number, size = 100): Box => ({
  left,
  top,
  right: left + size,
  bottom: top + size,
});

describe("nearestInDirection", () => {
  // A 3×2 grid of cards, 120 px apart.
  const grid = [box(0, 0), box(120, 0), box(240, 0), box(0, 120), box(120, 120), box(240, 120)];

  it("moves along rows and columns", () => {
    expect(nearestInDirection(grid[0]!, grid, "right")).toBe(1);
    expect(nearestInDirection(grid[1]!, grid, "down")).toBe(4);
    expect(nearestInDirection(grid[4]!, grid, "left")).toBe(3);
    expect(nearestInDirection(grid[5]!, grid, "up")).toBe(2);
  });

  it("returns -1 at the edge", () => {
    expect(nearestInDirection(grid[2]!, grid, "right")).toBe(-1);
    expect(nearestInDirection(grid[0]!, grid, "up")).toBe(-1);
  });

  it("prefers straight ahead over a nearer diagonal", () => {
    const from = box(0, 0);
    const diagonal = box(110, 60);
    const straight = box(200, 0);
    expect(nearestInDirection(from, [diagonal, straight], "right")).toBe(1);
  });
});

describe("nearestInDirection cone", () => {
  it("ignores controls far off to the side", () => {
    const card = box(474, 240, 180);
    const sidebarButton = box(181, 808, 48);
    expect(nearestInDirection(card, [sidebarButton], "down")).toBe(-1);
  });
});
