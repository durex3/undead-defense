import { rectArena } from "./RectArena";
import type { Point } from "./SurvivalTypes";
export const BELL_BASES = [
  { x: -9, y: -8, halfWidth: 1.6, halfHeight: 2.4 },
  { x: 9, y: -8, halfWidth: 1.6, halfHeight: 2.4 },
  { x: -9, y: 9, halfWidth: 1.6, halfHeight: 2.4 },
  { x: 9, y: 9, halfWidth: 1.6, halfHeight: 2.4 },
];
export const bellMap = rectArena(BELL_BASES, 1.6, 2.4);
/** Every sampled part of the player's body must be behind solid geometry. */
export function bellCovered(source: Point, p: Point, r = 0.3) {
  const a = Math.atan2(p.y - source.y, p.x - source.x),
    dx = -Math.sin(a) * r,
    dy = Math.cos(a) * r;
  return [{ x: p.x + dx, y: p.y + dy }, { x: p.x - dx, y: p.y - dy }, p].every(
    (q) => bellMap.segment(source, q, 0),
  );
}
