import type { Hazard, Point } from "./SurvivalTypes";
import type { SurvivalWorld } from "./SurvivalWorld";
import { distance } from "./SurvivalTypes";
import { kilnMap } from "./KilnMap";
import { libraryLocal, libraryCircleEnter } from "./LibraryGeometry";
export interface KilnHazard {
  shape: "straight" | "fork" | "bend";
  path: Point[];
  preview: Point[];
  valve?: Point;
  valveId?: number;
  length: number;
  limit: number;
  fork: number;
  halfWidth: number;
  speed: number;
  body: number;
  phase: number;
  boss: boolean;
  order: number;
  last: number;
  player: Point;
  hit: boolean;
  counterClosed?: boolean;
  cancelled?: boolean;
  cutAt?: number;
}
const lerp = (a: Point, b: Point, f: number) => ({
  x: a.x + (b.x - a.x) * f,
  y: a.y + (b.y - a.y) * f,
});
export function kilnNodes(h: Hazard) {
  const out = [0],
    p = h.kiln!.path;
  for (let i = 1; i < p.length; i++)
    out.push(out[i - 1] + distance(p[i - 1], p[i]));
  return out;
}
export function kilnPoint(h: Hazard, s: number): Point {
  const p = h.kiln!.path,
    n = kilnNodes(h);
  for (let i = 1; i < p.length; i++)
    if (s <= n[i])
      return lerp(
        p[i - 1],
        p[i],
        Math.max(0, (s - n[i - 1]) / (n[i] - n[i - 1])),
      );
  return { ...p[p.length - 1] };
}
/** The renderer and collision share these finite, arc-length clipped segments. */
export function kilnSegments(h: Hazard, t: number): [Point, Point][] {
  const b = h.kiln!;
  if (b.cancelled || t < h.due || t >= h.until) return [];
  const s = b.speed * (t - h.due),
    lo = Math.max(0, s - b.body),
    hi = Math.min(s, b.limit),
    n = kilnNodes(h),
    out: [Point, Point][] = [];
  if (lo > hi) return out;
  for (let i = 1; i < n.length; i++) {
    const a = Math.max(lo, n[i - 1]),
      z = Math.min(hi, n[i]);
    if (a <= z && a <= b.limit) out.push([kilnPoint(h, a), kilnPoint(h, z)]);
  }
  return out;
}
/** Split at every head/tail node. In each interval both capsule ends move affinely.
 * Solve its rectangular strip as four linear inequalities and its round moving caps quadratically.
 * No timestep approximation and no chord across a bend. */
export function kilnImpact(
  h: Hazard,
  p: Point,
  t: number,
  previous = t,
  old = p,
): boolean {
  const b = h.kiln!;
  if (b.cancelled || t < h.due || previous >= h.until || t < previous)
    return false;
  const start = Math.max(previous, h.due),
    end = Math.min(t, h.until),
    nodes = kilnNodes(h),
    cuts = [start, end];
  for (const s of [...nodes, b.limit])
    for (const d of [0, b.body]) {
      const at = h.due + (s + d) / b.speed;
      if (at > start && at < end) cuts.push(at);
    }
  cuts.sort((a, z) => a - z);
  const at = (v: number) =>
    lerp(old, p, t === previous ? 1 : (v - previous) / (t - previous));
  for (let k = 1; k < cuts.length; k++) {
    const from = cuts[k - 1],
      to = cuts[k],
      mid = (from + to) / 2,
      head = b.speed * (mid - h.due),
      lo = Math.max(0, head - b.body),
      hi = Math.min(head, b.limit);
    if (lo > hi) continue;
    for (let i = 1; i < nodes.length; i++) {
      if (Math.max(lo, nodes[i - 1]) > Math.min(hi, nodes[i])) continue;
      const origin = b.path[i - 1],
        angle = Math.atan2(b.path[i].y - origin.y, b.path[i].x - origin.x),
        size = nodes[i] - nodes[i - 1],
        r = b.halfWidth + 0.3;
      const bounds = (time: number) => {
        const s = b.speed * (time - h.due);
        return [
          Math.max(0, s - b.body - nodes[i - 1]),
          Math.min(size, s - nodes[i - 1], b.limit - nodes[i - 1]),
        ];
      };
      const a = libraryLocal(at(from), origin, angle),
        z = libraryLocal(at(to), origin, angle),
        u = bounds(from),
        v = bounds(to);
      let l = 0,
        q = 1,
        possible = true;
      for (const [x, y] of [
        [a.x - u[0], z.x - v[0]],
        [u[1] - a.x, v[1] - z.x],
        [r - a.y, r - z.y],
        [r + a.y, r + z.y],
      ]) {
        const d = y - x;
        if (Math.abs(d) < 1e-12) {
          if (x < 0) possible = false;
        } else if (d > 0) l = Math.max(l, -x / d);
        else q = Math.min(q, -x / d);
      }
      if (possible && l <= q && q >= 0 && l <= 1) return true;
      for (let cap = 0; cap < 2; cap++)
        if (
          libraryCircleEnter(
            { x: a.x - u[cap], y: a.y },
            { x: z.x - v[cap], y: z.y },
            { x: 0, y: 0 },
            r,
          ) !== null
        )
          return true;
    }
  }
  // An instantaneous query still uses exactly the live geometry.
  if (start === end)
    return kilnSegments(h, t).some(([a, z]) => {
      const angle = Math.atan2(z.y - a.y, z.x - a.x),
        q = libraryLocal(p, a, angle),
        len = distance(a, z);
      return (
        Math.hypot(q.x - Math.max(0, Math.min(len, q.x)), q.y) <=
        b.halfWidth + 0.3
      );
    });
  return false;
}
/** Cancels only segments whose head has not entered; the released segment drains its full tail. */
export function kilnCut(h: Hazard, time: number) {
  const b = h.kiln!;
  if (b.cancelled || time >= h.until) return;
  if (time < h.due) {
    b.cancelled = true;
    h.until = time;
    return;
  }
  const s = b.speed * (time - h.due),
    n = kilnNodes(h),
    end = n.find((v) => v > s + 1e-9) ?? b.limit;
  b.limit = Math.min(b.limit, end);
  b.cutAt = time;
  h.until = Math.min(h.until, h.due + (b.limit + b.body) / b.speed);
}
export function kilnEnvelope(h: Hazard): Point[] {
  const b = h.kiln!;
  return [...b.path, ...b.preview, ...(b.valve ? [b.valve] : [])].flatMap((p) =>
    [-1, 1].flatMap((x) =>
      [-1, 1].map((y) => ({ x: p.x + x * 0.36, y: p.y + y * 0.36 })),
    ),
  );
}
export function kilnSolid(h: Hazard) {
  const b = h.kiln!,
    p = b.path;
  return (
    [...p, ...b.preview].some(
      (p) => Math.abs(p.x) > 21.78 || Math.abs(p.y) > 25.78,
    ) ||
    p.slice(1).some((z, i) => kilnMap.segment(p[i], z, b.halfWidth)) ||
    b.preview
      .slice(1)
      .some((z, i) => kilnMap.segment(b.preview[i], z, b.halfWidth)) ||
    (!!b.valve &&
      (kilnMap.blocked(b.valve, 0.4) ||
        Math.abs(b.valve.x) > 21.6 ||
        Math.abs(b.valve.y) > 25.6))
  );
}
export function kilnMove(
  p: Point,
  v: Point,
  dt: number,
  r: number,
  time: number,
  visit?: (a: Point, z: Point, from: number, to: number) => void,
) {
  const n = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(v.x * dt), Math.abs(v.y * dt), dt * 4) / 0.05),
  );
  for (let i = 0; i < n; i++)
    for (let axis = 0; axis < 2; axis++) {
      const a = { ...p },
        from = time - dt + (dt * (2 * i + axis)) / (2 * n),
        to = from + dt / (2 * n);
      if (axis === 0)
        p.x = Math.max(-22 + r, Math.min(22 - r, p.x + (v.x * dt) / n));
      else p.y = Math.max(-26 + r, Math.min(26 - r, p.y + (v.y * dt) / n));
      kilnMap.resolve(p, r);
      visit?.(a, { ...p }, from, to);
    }
}
/** Joint base-speed escape, with reaction delay, wall sliding and current crowd. Never breaks valves. */
export function kilnEscape(w: SurvivalWorld, extra: Hazard[]) {
  const hazards = [
      ...w.hazards.filter(
        (h) => h.kiln && !h.kiln.cancelled && h.until > w.time,
      ),
      ...extra,
    ],
    until = Math.max(w.time, ...hazards.map((h) => h.until));
  const actors = w.enemies.filter(
    (e) =>
      e.hp > 0 &&
      e.state === "seek" &&
      !e.immovable &&
      distance(e, w.player) < 8,
  );
  for (let i = -1; i < 24; i++)
    for (const turn of [0, -Math.PI / 2, Math.PI / 2]) {
      if (i === -1 && turn !== 0) continue;
      const p = { ...w.player };
      let safe = true;
      for (let t = w.time; t < until - 1e-8;) {
        const dt = Math.min(0.08, until - t),
          elapsed = t - w.time,
          a = (i * Math.PI) / 12 + (elapsed >= 1.3 ? turn : 0),
          speed = i < 0 || elapsed < 0.35 ? 0 : 4.2;
        kilnMove(
          p,
          { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
          dt,
          0.3,
          t + dt,
          (old, z, from, to) => {
            if (
              safe &&
              (actors.some((e) => distance(e, z) < 0.65) ||
                hazards.some((h) => kilnImpact(h, z, to, from, old)))
            )
              safe = false;
          },
        );
        if (!safe) break;
        t += dt;
      }
      if (safe) return true;
    }
  return false;
}
