import type { Hazard, Point } from "./SurvivalTypes";
import { distance } from "./SurvivalTypes";
import type { SurvivalWorld } from "./SurvivalWorld";
import { libraryMap, LIBRARY_BASES } from "./LibraryMap";
export interface LibraryHazard {
  shape: "imprint" | "page" | "clamp";
  half: Point;
  velocity: Point;
  seal: Point;
  order: number;
  published: number;
  last: number;
  player: Point;
  hit: boolean;
  cancelled?: boolean;
  countered?: boolean;
  cancelledAt?: number;
}
const lerp = (a: Point, b: Point, f: number): Point => ({
  x: a.x + (b.x - a.x) * f,
  y: a.y + (b.y - a.y) * f,
});
export function libraryPosition(h: Hazard, t: number): Point {
  const b = h.library!,
    dt = Math.max(0, Math.min(t, h.until) - h.due);
  return { x: h.x + b.velocity.x * dt, y: h.y + b.velocity.y * dt };
}
export function libraryLocal(p: Point, center: Point, angle: number): Point {
  const x = p.x - center.x,
    y = p.y - center.y,
    c = Math.cos(angle),
    s = Math.sin(angle);
  return { x: x * c + y * s, y: -x * s + y * c };
}
export function libraryCorners(h: Hazard, t: number): Point[] {
  const p = libraryPosition(h, t),
    b = h.library!,
    c = Math.cos(h.angle),
    s = Math.sin(h.angle);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, y]) => ({
    x: p.x + x * b.half.x * c - y * b.half.y * s,
    y: p.y + x * b.half.x * s + y * b.half.y * c,
  }));
}
export function libraryHull(points: Point[]): Point[] {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y),
    cross = (a: Point, b: Point, c: Point) =>
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (list: Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (
        out.length >= 2 &&
        cross(out[out.length - 2], out[out.length - 1], p) <= 0
      )
        out.pop();
      out.push(p);
    }
    return out;
  };
  return [
    ...half(sorted).slice(0, -1),
    ...half(sorted.slice().reverse()).slice(0, -1),
  ];
}
export function libraryEnvelope(h: Hazard) {
  return libraryHull([
    ...libraryCorners(h, h.due),
    ...libraryCorners(h, h.until),
  ]);
}
export function libraryPolygonsOverlap(a: Point[], b: Point[]) {
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i],
        q = poly[(i + 1) % poly.length],
        nx = p.y - q.y,
        ny = q.x - p.x,
        project = (v: Point[]) => v.map((p) => p.x * nx + p.y * ny),
        pa = project(a),
        pb = project(b);
      if (
        Math.max(...pa) < Math.min(...pb) - 1e-9 ||
        Math.max(...pb) < Math.min(...pa) - 1e-9
      )
        return false;
    }
  return true;
}
export function librarySolid(h: Hazard) {
  const hull = libraryEnvelope(h);
  return (
    hull.some((p) => Math.abs(p.x) > 22 || Math.abs(p.y) > 26) ||
    LIBRARY_BASES.some((b) =>
      libraryPolygonsOverlap(hull, [
        { x: b.x - b.halfWidth, y: b.y - b.halfHeight },
        { x: b.x + b.halfWidth, y: b.y - b.halfHeight },
        { x: b.x + b.halfWidth, y: b.y + b.halfHeight },
        { x: b.x - b.halfWidth, y: b.y + b.halfHeight },
      ]),
    )
  );
}
export function libraryCircleEnter(
  a: Point,
  b: Point,
  center: Point,
  r: number,
): number | null {
  const x = a.x - center.x,
    y = a.y - center.y,
    dx = b.x - a.x,
    dy = b.y - a.y,
    cc = x * x + y * y - r * r;
  if (cc <= 1e-12) return 0;
  const aa = dx * dx + dy * dy;
  if (aa < 1e-16) return null;
  const bb = 2 * (x * dx + y * dy),
    d = bb * bb - 4 * aa * cc;
  if (d < 0) return null;
  const t = (-bb - Math.sqrt(d)) / (2 * aa);
  return t >= -1e-9 && t <= 1 + 1e-9 ? Math.max(0, Math.min(1, t)) : null;
}
function slab(a: Point, b: Point, hx: number, hy: number): number | null {
  let lo = 0,
    hi = 1;
  for (const [start, delta, half] of [
    [a.x, b.x - a.x, hx],
    [a.y, b.y - a.y, hy],
  ]) {
    if (Math.abs(delta) < 1e-12) {
      if (Math.abs(start) > half) return null;
    } else {
      let t = (-half - start) / delta,
        z = (half - start) / delta;
      if (t > z) [t, z] = [z, t];
      lo = Math.max(lo, t);
      hi = Math.min(hi, z);
      if (lo > hi) return null;
    }
  }
  return lo <= 1 && hi >= 0 ? Math.max(0, lo) : null;
}
/** Exact segment against a rectangle expanded by a circle: two strips and four round corners. */
export function libraryRoundedEnter(
  a: Point,
  b: Point,
  half: Point,
  r = 0.3,
): number | null {
  const hits = [slab(a, b, half.x + r, half.y), slab(a, b, half.x, half.y + r)];
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      hits.push(libraryCircleEnter(a, b, { x: x * half.x, y: y * half.y }, r));
  const finite = hits.filter((x): x is number => x !== null);
  return finite.length ? Math.min(...finite) : null;
}
export function libraryImpact(
  h: Hazard,
  p: Point,
  t: number,
  previous = t - 0.05,
  old: Point = p,
): number | null {
  const b = h.library!;
  if (b.cancelled || t < h.due || previous >= h.until || t < previous)
    return null;
  const from = Math.max(previous, h.due),
    to = Math.min(t, h.until);
  if (from > to) return null;
  const at = (time: number) =>
    lerp(
      old,
      p,
      t === previous
        ? 1
        : Math.max(0, Math.min(1, (time - previous) / (t - previous))),
    );
  const a = libraryLocal(at(from), libraryPosition(h, from), h.angle),
    z = libraryLocal(at(to), libraryPosition(h, to), h.angle),
    hit = libraryRoundedEnter(a, z, b.half);
  return hit === null ? null : from + (to - from) * hit;
}
export function librarySealTime(
  h: Hazard,
  a: Point,
  z: Point,
  from: number,
  to: number,
): number | null {
  const b = h.library!;
  if (b.cancelled || h.fired || from > h.due + 1e-9 || to < b.published)
    return null;
  const start = Math.max(from, b.published),
    end = Math.min(to, h.due);
  if (start > end + 1e-9) return null;
  const at = (time: number) =>
    lerp(
      a,
      z,
      to === from ? 1 : Math.max(0, Math.min(1, (time - from) / (to - from))),
    );
  const hit = libraryCircleEnter(at(start), at(end), b.seal, 0.5);
  return hit === null ? null : start + (end - start) * hit;
}
/** Same collision/sliding and axis timing for runtime and escape prediction. */
export function libraryMove(
  p: Point,
  v: Point,
  dt: number,
  r: number,
  time: number,
  visit?: (a: Point, z: Point, from: number, to: number) => void,
) {
  const n = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(v.x * dt), Math.abs(v.y * dt)) / 0.05),
  );
  for (let i = 0; i < n; i++)
    for (let axis = 0; axis < 2; axis++) {
      const a = { ...p },
        from = time - dt + (dt * (2 * i + axis)) / (2 * n),
        to = from + dt / (2 * n);
      if (axis === 0)
        p.x = Math.max(-22 + r, Math.min(22 - r, p.x + (v.x * dt) / n));
      else p.y = Math.max(-26 + r, Math.min(26 - r, p.y + (v.y * dt) / n));
      libraryMap.resolve(p, r);
      visit?.(a, { ...p }, from, to);
    }
}
/** Shortest center-to-swept-rectangle gap for a stationary seal, exact for fixed orientation translation. */
export function librarySealGap(h: Hazard, seal: Point) {
  const a = libraryLocal(seal, libraryPosition(h, h.due), h.angle),
    z = libraryLocal(seal, libraryPosition(h, h.until), h.angle),
    half = h.library!.half;
  // Axis-aligned local translation sweeps one larger rectangle exactly (all authored page motions).
  if (Math.abs(a.x - z.x) < 1e-9 || Math.abs(a.y - z.y) < 1e-9) {
    const x = (a.x + z.x) / 2,
      y = (a.y + z.y) / 2,
      hx = half.x + Math.abs(a.x - z.x) / 2,
      hy = half.y + Math.abs(a.y - z.y) / 2;
    return (
      Math.hypot(Math.max(0, Math.abs(x) - hx), Math.max(0, Math.abs(y) - hy)) -
      0.5
    );
  }
  // Minimize convex squared point-to-AABB distance along a segment (ternary convergence < 1e-8).
  const gap = (f: number) => {
    const p = lerp(a, z, f);
    return Math.hypot(
      Math.max(0, Math.abs(p.x) - half.x),
      Math.max(0, Math.abs(p.y) - half.y),
    );
  };
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 48; i++) {
    const x = lo + (hi - lo) / 3,
      y = hi - (hi - lo) / 3;
    if (gap(x) < gap(y)) hi = y;
    else lo = x;
  }
  return Math.min(gap(0), gap(1), gap((lo + hi) / 2)) - 0.5;
}
export function libraryEscape(
  w: SurvivalWorld,
  extra: Hazard[],
  counter = false,
) {
  const hazards = [
      ...w.hazards.filter(
        (h) => h.library && !h.library.cancelled && h.until > w.time,
      ),
      ...extra,
    ],
    until = Math.max(w.time + 0.1, ...hazards.map((h) => h.until));
  const actors = w.enemies.filter(
    (e) =>
      e.hp > 0 &&
      e.state === "seek" &&
      !e.immovable &&
      distance(e, w.player) < 8,
  );
  const paths = [{ a: 0, turn: 0, stop: 0, turnAt: 1.3 }];
  for (let i = 0; i < 24; i++) {
    for (const stop of [1.3, 2.1, Infinity])
      paths.push({ a: (i * Math.PI) / 12, turn: 0, stop, turnAt: 1.3 });
    for (const turn of [-Math.PI / 2, Math.PI / 2])
      paths.push({ a: (i * Math.PI) / 12, turn, stop: Infinity, turnAt: 1.3 });
  }
  if (counter)
    for (const h of hazards)
      if (!h.fired)
        for (const turn of [0, -Math.PI / 2, Math.PI / 2])
          paths.push({
            a: Math.atan2(
              h.library!.seal.y - w.player.y,
              h.library!.seal.x - w.player.x,
            ),
            turn,
            stop: Infinity,
            turnAt: 0.35 + distance(w.player, h.library!.seal) / w.speed,
          });
  for (const path of paths) {
    const p = { ...w.player },
      cancelled = new Set<number>();
    let safe = true;
    for (let time = w.time; time < until;) {
      const dt = Math.min(0.05, until - time),
        elapsed = time - w.time,
        a = path.a + (elapsed >= path.turnAt ? path.turn : 0),
        speed = elapsed >= 0.35 && elapsed < path.stop ? w.speed : 0;
      libraryMove(
        p,
        { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
        dt,
        0.3,
        time + dt,
        (old, z, from, to) => {
          if (!safe) return;
          if (counter)
            for (const h of hazards)
              if (
                !cancelled.has(h.id) &&
                librarySealTime(h, old, z, from, to) !== null
              )
                cancelled.add(h.id);
          if (
            actors.some((e) => distance(e, z) < 0.65) ||
            hazards.some(
              (h) =>
                !cancelled.has(h.id) &&
                libraryImpact(h, z, to, from, old) !== null,
            )
          )
            safe = false;
        },
      );
      if (!safe) break;
      time += dt;
    }
    if (safe && (!counter || extra.some((h) => cancelled.has(h.id))))
      return true;
  }
  return false;
}
