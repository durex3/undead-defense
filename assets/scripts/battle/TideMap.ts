import { rectArena } from "./RectArena";
import type { Point } from "./SurvivalTypes";
export const TIDE_BASES = [
  { x: -10, y: 9, halfWidth: 1.8, halfHeight: 2.8 },
  { x: 10, y: -9, halfWidth: 1.8, halfHeight: 2.8 },
  { x: -6, y: -17, halfWidth: 3, halfHeight: 1.2 },
  { x: 6, y: 17, halfWidth: 3, halfHeight: 1.2 },
];
export const TIDE_ROUTES = [
  { x: 0, y: -8 },
  { x: 0, y: 0 },
  { x: -15, y: 0 },
  { x: 15, y: 0 },
  { x: 0, y: -12 },
  { x: 0, y: 12 },
];
export const tideMap = rectArena(TIDE_BASES, 1.8, 2.8);
/** First obstruction along a ray. Cross-strip expansion conservatively includes partially struck crates. */
export function tideStop(
  origin: Point,
  angle: number,
  length: number,
  r = 0,
  stripHalf = 0,
) {
  if (Math.abs(origin.x) > 22.3 - r || Math.abs(origin.y) > 26.3 - r) return 0;
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  let stop = length;
  for (const b of TIDE_BASES) {
    let lo = 0,
      hi = length;
    for (const [start, dir, c, half] of [
      [origin.x, dx, b.x, b.halfWidth + r + Math.abs(dy) * stripHalf],
      [origin.y, dy, b.y, b.halfHeight + r + Math.abs(dx) * stripHalf],
    ]) {
      if (Math.abs(dir) < 1e-9) {
        if (Math.abs(start - c) > half) {
          lo = Infinity;
          break;
        }
      } else {
        const a = (c - half - start) / dir,
          z = (c + half - start) / dir;
        lo = Math.max(lo, Math.min(a, z));
        hi = Math.min(hi, Math.max(a, z));
      }
    }
    if (lo <= hi && hi >= 0) stop = Math.min(stop, Math.max(0, lo));
  }
  for (const [start, dir, bound] of [
    [origin.x, dx, 22.3 - r],
    [origin.y, dy, 26.3 - r],
  ])
    if (Math.abs(dir) > 1e-9) {
      const at = ((dir > 0 ? bound : -bound) - start) / dir;
      if (at >= 0) stop = Math.min(stop, at);
    }
  return Math.max(0, stop);
}
