/**
 * Pin snapping for touch wiring.
 *
 * A fingertip is ~40 px wide and hides what it touches, so while a wire is
 * being drawn a touch that lands NEXT to a pin must still connect to it. This
 * is the pure part: given the hit boxes of every pin overlay (screen px) and a
 * touch point, pick the pin to connect to.
 *
 * Distance is measured to the box EDGE, not its centre, so a touch inside a
 * box always wins (distance 0); among equally near boxes the nearer centre
 * wins. Nothing farther than `radius` from any box snaps.
 */
export interface PinBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** How far (screen px) beyond a pin's box a touch may land and still snap. */
export const PIN_SNAP_RADIUS_PX = 24;

export function pickNearestPin<T extends PinBox>(
  boxes: readonly T[],
  x: number,
  y: number,
  radius: number = PIN_SNAP_RADIUS_PX,
): T | null {
  let best: T | null = null;
  let bestEdge = Infinity;
  let bestCentre = Infinity;
  for (const r of boxes) {
    if (r.right - r.left <= 0) continue; // not laid out
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const edge = Math.hypot(dx, dy);
    if (edge > radius) continue;
    const centre = Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2);
    if (edge < bestEdge || (edge === bestEdge && centre < bestCentre)) {
      best = r;
      bestEdge = edge;
      bestCentre = centre;
    }
  }
  return best;
}
