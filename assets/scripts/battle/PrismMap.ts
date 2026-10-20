import { rectArena } from "./RectArena";
import type { Point } from "./SurvivalTypes";
export const PRISM_BASES = [
  { x: -10, y: 7, halfWidth: 1.6, halfHeight: 3 },
  { x: 10, y: -7, halfWidth: 1.6, halfHeight: 3 },
  { x: -6, y: -17, halfWidth: 3.2, halfHeight: 1.4 },
  { x: 6, y: 17, halfWidth: 3.2, halfHeight: 1.4 },
  { x: -15, y: -11, halfWidth: 1.5, halfHeight: 2 },
  { x: 15, y: 11, halfWidth: 1.5, halfHeight: 2 },
];
export const PRISM_ROUTES = [
  { x: 0, y: -8 },
  { x: 0, y: 0 },
  { x: -15, y: 0 },
  { x: 15, y: 0 },
  { x: 0, y: 12 },
  { x: 0, y: -12 },
];
export const prismMap = rectArena(PRISM_BASES, 1.6, 3);
export interface PrismMirror extends Point {
  id: number;
  axis: "x" | "y";
}
export interface PrismPath {
  points: Point[];
  lengths: number[];
  total: number;
  mirror?: number;
}
interface Surface extends Point {
  halfWidth: number;
  halfHeight: number;
  id?: number;
}
export function prismSurfaces(mirrors: PrismMirror[]): Surface[] {
  return [
    ...PRISM_BASES,
    ...mirrors.map((m) => ({
      ...m,
      halfWidth: m.axis === "x" ? 0.12 : 0.7,
      halfHeight: m.axis === "x" ? 0.7 : 0.12,
    })),
  ];
}
function firstHit(
  origin: Point,
  d: Point,
  limit: number,
  r: number,
  surfaces: Surface[],
) {
  let first:
    | {
        at: number;
        normal: Point;
        corner: boolean;
        id?: number;
        boundary?: boolean;
      }
    | undefined;
  for (const b of surfaces) {
    let lo = -Infinity,
      hi = Infinity,
      normal = { x: 0, y: 0 },
      corner = false;
    for (const [start, dir, center, half, axis] of [
      [origin.x, d.x, b.x, b.halfWidth + r, 0],
      [origin.y, d.y, b.y, b.halfHeight + r, 1],
    ]) {
      if (Math.abs(dir) < 1e-9) {
        if (Math.abs(start - center) > half) {
          lo = Infinity;
          break;
        }
      } else {
        const a = (center - half - start) / dir,
          z = (center + half - start) / dir,
          entry = Math.min(a, z);
        if (Math.abs(entry - lo) < 1e-7) corner = true;
        if (entry > lo) {
          lo = entry;
          normal =
            axis === 0
              ? { x: dir > 0 ? -1 : 1, y: 0 }
              : { x: 0, y: dir > 0 ? -1 : 1 };
        }
        hi = Math.min(hi, Math.max(a, z));
      }
    }
    if (
      lo <= hi &&
      hi >= 0 &&
      lo <= limit &&
      lo >= -1e-6 &&
      (!first || lo < first.at - 1e-7)
    )
      first = { at: Math.max(0, lo), normal, corner, id: b.id };
  }
  for (const [p, v, b] of [
    [origin.x, d.x, 22.3 - r],
    [origin.y, d.y, 26.3 - r],
  ])
    if (Math.abs(v) > 1e-9) {
      const at = ((v > 0 ? b : -b) - p) / v;
      if (at >= 0 && at <= limit && (!first || at < first.at))
        first = { at, normal: { x: 0, y: 0 }, corner: false, boundary: true };
    }
  return first;
}
/** Circle-expanded first contact; a second obstacle stops the projectile, never adds a hidden bounce. */
export function prismTrace(
  origin: Point,
  angle: number,
  range: number,
  r: number,
  mirrors: PrismMirror[] = [],
  reflect = true,
): PrismPath | undefined {
  if (
    Math.abs(origin.x) > 22.3 - r ||
    Math.abs(origin.y) > 26.3 - r ||
    prismSurfaces(mirrors).some(
      (b) =>
        Math.abs(origin.x - b.x) < b.halfWidth + r - 1e-6 &&
        Math.abs(origin.y - b.y) < b.halfHeight + r - 1e-6,
    )
  )
    return;
  const d = { x: Math.cos(angle), y: Math.sin(angle) },
    surfaces = prismSurfaces(mirrors),
    first = firstHit(origin, d, range, r, surfaces),
    travel = first?.at ?? range;
  if (first?.corner || travel < 0.05) return;
  const bend = { x: origin.x + d.x * travel, y: origin.y + d.y * travel },
    path: PrismPath = {
      points: [{ ...origin }, bend],
      lengths: [travel],
      total: travel,
    };
  if (!first || first.boundary || !reflect || travel >= range - 0.02)
    return path;
  const dot = d.x * first.normal.x + d.y * first.normal.y,
    rebound = {
      x: d.x - 2 * dot * first.normal.x,
      y: d.y - 2 * dot * first.normal.y,
    },
    nextOrigin = { x: bend.x + rebound.x * 1e-5, y: bend.y + rebound.y * 1e-5 },
    second = firstHit(nextOrigin, rebound, range - travel - 1e-5, r, surfaces),
    remaining = (second?.at ?? range - travel - 1e-5) + 1e-5;
  if (remaining < 0.05) return path;
  path.points.push({
    x: bend.x + rebound.x * remaining,
    y: bend.y + rebound.y * remaining,
  });
  path.lengths.push(remaining);
  path.total += remaining;
  path.mirror = first.id;
  return path;
}
export function prismAim(
  origin: Point,
  target: Point,
  r: number,
  range: number,
  mirrors: PrismMirror[] = [],
  alternate = false,
): PrismPath | undefined {
  const choices: { path: PrismPath; score: number }[] = [];
  for (const b of prismSurfaces(mirrors))
    for (const axis of ["x", "y"] as const)
      for (const side of [-1, 1]) {
        const plane =
            b[axis] + side * ((axis === "x" ? b.halfWidth : b.halfHeight) + r),
          image = { ...target, [axis]: 2 * plane - target[axis] },
          a = Math.atan2(image.y - origin.y, image.x - origin.x),
          path = prismTrace(origin, a, range, r, mirrors);
        if (!path || path.points.length !== 3) continue;
        const p = path.points[1],
          z = path.points[2],
          dx = z.x - p.x,
          dy = z.y - p.y,
          len = Math.hypot(dx, dy),
          along = ((target.x - p.x) * dx + (target.y - p.y) * dy) / len,
          cross = Math.abs((target.x - p.x) * dy - (target.y - p.y) * dx) / len;
        if (
          cross < 0.01 &&
          along > 0.1 &&
          along <= len &&
          !choices.some(
            (c) =>
              Math.hypot(c.path.points[1].x - p.x, c.path.points[1].y - p.y) <
              0.01,
          )
        )
          choices.push({ path, score: path.lengths[0] + along });
      }
  choices.sort((a, b) => a.score - b.score);
  return choices[alternate && choices.length > 1 ? 1 : 0]?.path;
}
