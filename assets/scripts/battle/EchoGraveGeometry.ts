import type { Point, Hazard } from "./SurvivalTypes";
import { segmentDistance, angleDelta } from "./SurvivalTypes";
import type { SurvivalWorld } from "./SurvivalWorld";
import { graveMap } from "./EchoGraveMap";
export interface GravePulse extends Point {
  angle: number;
  radius: number;
  half: number;
  due: number;
  end: number;
  hit: boolean;
  old: boolean;
  cancelled?: boolean;
}
export interface GraveHazard {
  pulses: GravePulse[];
  group: number;
  life: number;
  action: string;
  order: number;
  last: number;
  player: Point;
  interrupted?: boolean;
  cancelled?: boolean;
  damaged?: boolean;
  dual?: boolean;
}
/** Euclidean distance to the filled finite sector, including its radial edges and arc. */
export function graveDistance(f: GravePulse, p: Point) {
  const q = { x: p.x - f.x, y: p.y - f.y },
    r = Math.hypot(q.x, q.y),
    delta = Math.abs(angleDelta(Math.atan2(q.y, q.x), f.angle));
  if (f.half >= Math.PI - 1e-9) return Math.max(0, r - f.radius);
  if (delta <= f.half && r <= f.radius) return 0;
  let d = Infinity;
  for (const a of [f.angle - f.half, f.angle + f.half])
    d = Math.min(
      d,
      segmentDistance(
        q,
        { x: 0, y: 0 },
        { x: Math.cos(a) * f.radius, y: Math.sin(a) * f.radius },
      ),
    );
  if (delta <= f.half) d = Math.min(d, Math.abs(r - f.radius));
  return d;
}
/** Distance to convex sector along a line is convex; minimize continuously, not endpoint sampling. */
export function graveImpact(
  f: GravePulse,
  p: Point,
  t: number,
  previous = t,
  old = p,
) {
  if (f.cancelled || t < f.due || previous >= f.end || t < previous)
    return false;
  const lo = Math.max(previous, f.due),
    hi = Math.min(t, f.end - 1e-10);
  if (hi < lo) return false;
  const at = (v: number) =>
    t === previous
      ? p
      : {
          x: old.x + ((p.x - old.x) * (v - previous)) / (t - previous),
          y: old.y + ((p.y - old.y) * (v - previous)) / (t - previous),
        };
  const q = at(lo),
    r = at(hi);
  if (segmentDistance(f, q, r) > f.radius + 0.3 + 1e-9) return false;
  if (Math.hypot(q.x - r.x, q.y - r.y) < 1e-10)
    return graveDistance(f, q) <= 0.3 + 1e-9;
  let a = lo,
    z = hi;
  for (let i = 0; i < 42; i++) {
    const x = a + (z - a) / 3,
      y = z - (z - a) / 3;
    if (graveDistance(f, at(x)) < graveDistance(f, at(y))) z = y;
    else a = x;
  }
  return (
    Math.min(
      graveDistance(f, at(lo)),
      graveDistance(f, at(hi)),
      graveDistance(f, at((a + z) / 2)),
    ) <=
    0.3 + 1e-9
  );
}
export function graveCut(h: Hazard, t: number) {
  const b = h.grave!;
  b.interrupted = true;
  for (const f of b.pulses) if (f.due > t) f.cancelled = true;
  h.until = Math.max(
    t,
    ...b.pulses.filter((f) => !f.cancelled).map((f) => f.end),
  );
  b.cancelled = b.pulses.every((f) => f.cancelled);
}
export function graveMove(
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
      graveMap.resolve(p, r);
      visit?.(a, { ...p }, from, to);
    }
}
/** Joint base-speed escape, with reaction delay, wall sliding and current crowd. Does not use counters, speed upgrades or invulnerability. */
export function graveEscape(w: SurvivalWorld, extra: Hazard[]) {
  const hazards = [
      ...w.hazards.filter(
        (h) => h.grave && !h.grave.cancelled && h.until > w.time,
      ),
      ...extra,
    ],
    until = Math.max(w.time, ...hazards.map((h) => h.until));
  const actors = w.enemies.filter(
    (e) =>
      e.hp > 0 &&
      e.state === "seek" &&
      !e.immovable &&
      Math.hypot(e.x - w.player.x, e.y - w.player.y) < 8,
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
        graveMove(
          p,
          { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
          dt,
          0.3,
          t + dt,
          (old, z, from, to) => {
            if (
              safe &&
              (actors.some((e) => Math.hypot(e.x - z.x, e.y - z.y) < 0.65) ||
                hazards.some((h) =>
                  h.grave!.pulses.some((f) => graveImpact(f, z, to, from, old)),
                ))
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
