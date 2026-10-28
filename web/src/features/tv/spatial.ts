export type Direction = "up" | "down" | "left" | "right";

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Index of the box nearest to `from` in `direction`, or -1. Boxes must lie
 * beyond `from`'s edge on that side and roughly in line with it (within a
 * cone of about 27° either side), so pressing down on the last row doesn't
 * jump to the far corner of the screen. Distance along the direction counts
 * once and sideways offset three times, so moving down a column beats
 * jumping diagonally to a closer neighbour.
 */
export function nearestInDirection(from: Box, boxes: Box[], direction: Direction): number {
  const cx = (box: Box) => (box.left + box.right) / 2;
  const cy = (box: Box) => (box.top + box.bottom) / 2;
  let best = -1;
  let bestScore = Infinity;
  boxes.forEach((box, index) => {
    const horizontal = direction === "left" || direction === "right";
    let along: number;
    switch (direction) {
      case "right":
        along = box.left - from.right;
        break;
      case "left":
        along = from.left - box.right;
        break;
      case "down":
        along = box.top - from.bottom;
        break;
      case "up":
        along = from.top - box.bottom;
        break;
    }
    const across = horizontal ? Math.abs(cy(box) - cy(from)) : Math.abs(cx(box) - cx(from));
    // Sideways gap between the two boxes' spans (0 when they overlap).
    const gap = horizontal
      ? Math.max(0, box.top - from.bottom, from.top - box.bottom)
      : Math.max(0, box.left - from.right, from.left - box.right);
    // A little overlap is fine (cards in a row share borders).
    if (along < -4) return;
    if (gap > Math.max(0, along) * 0.5 + 16) return;
    const score = Math.max(0, along) + across * 3;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}
