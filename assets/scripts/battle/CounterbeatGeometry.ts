import type { Point, Hazard } from "./SurvivalTypes";
import { distance, segmentDistance } from "./SurvivalTypes";
import type { SurvivalWorld } from "./SurvivalWorld";
import { graveDistance, graveImpact } from "./EchoGraveGeometry";
import { counterbeatMap } from "./CounterbeatMap";
export interface CounterPulse extends Point {
  shape: "sweep" | "thrust";
  angle: number;
  radius: number;
  half: number;
  width: number;
  due: number;
  end: number;
  damage: number;
  order: number;
  threatens: boolean;
  hit: boolean;
  cancelled?: boolean;
}
export interface CounterHazard {
  pulses: CounterPulse[];
  action: "A" | "B" | "C";
  last: number;
  player: Point;
  pendingAt?: number;
  second?: boolean;
  pair?: number;
  interrupted?: boolean;
  collided?: boolean;
  cancelled?: boolean;
  proved?: boolean;
}
export const counterEnd = (p: CounterPulse) => ({
  x: p.x + Math.cos(p.angle) * p.radius,
  y: p.y + Math.sin(p.angle) * p.radius,
});
export function counterDistance(f: CounterPulse, p: Point) {
  return f.shape === "sweep"
    ? graveDistance({ ...f, old: false }, p)
    : Math.max(0, segmentDistance(p, f, counterEnd(f)) - f.width);
}
/** Continuous player sweep through a static finite capsule/sector, clipped to its actual window. */
export function counterImpact(
  f: CounterPulse,
  p: Point,
  time: number,
  previous = time,
  old = p,
) {
  if (f.cancelled || time < previous || time < f.due || previous >= f.end)
    return false;
  if (f.shape === "sweep")
    return graveImpact({ ...f, old: false }, p, time, previous, old);
  const lo = Math.max(previous, f.due),
    hi = Math.min(time, f.end - 1e-10);
  if (hi < lo) return false;
  const at = (t: number) =>
    time === previous
      ? p
      : {
          x: old.x + ((p.x - old.x) * (t - previous)) / (time - previous),
          y: old.y + ((p.y - old.y) * (t - previous)) / (time - previous),
        };
  let a = lo,
    z = hi;
  for (let i = 0; i < 38; i++) {
    const x = a + (z - a) / 3,
      y = z - (z - a) / 3;
    if (counterDistance(f, at(x)) < counterDistance(f, at(y))) z = y;
    else a = x;
  }
  return (
    Math.min(
      counterDistance(f, at(lo)),
      counterDistance(f, at(hi)),
      counterDistance(f, at((a + z) / 2)),
    ) <=
    0.3 + 1e-9
  );
}
export function counterCut(h: Hazard, time: number) {
  const b = h.counter!;
  b.interrupted = true;
  b.pendingAt = undefined;
  for (const f of b.pulses) if (time < f.due) f.cancelled = true;
  const active = b.pulses.filter(
    (f) => !f.cancelled && f.due <= time && f.end > time,
  );
  h.until = active.length ? Math.max(...active.map((f) => f.end)) : time;
  b.cancelled = !active.length;
}
export function counterMove(
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
      const old = { ...p },
        from = time - dt + (dt * (2 * i + axis)) / (2 * n),
        to = from + dt / (2 * n);
      if (!axis)
        p.x = Math.max(-22 + r, Math.min(22 - r, p.x + (v.x * dt) / n));
      else p.y = Math.max(-26 + r, Math.min(26 - r, p.y + (v.y * dt) / n));
      counterbeatMap.resolve(p, r);
      visit?.(old, { ...p }, from, to);
    }
}
/** Conservative candidate paths with real terrain, current crowds, and no equipped mobility. */
export function counterEscape(w: SurvivalWorld, extra: Hazard[]) {
  const ids = new Set(extra.map((h) => h.id)),
    hs = [
      ...w.hazards.filter(
        (h) =>
          h.counter &&
          !ids.has(h.id) &&
          !h.counter.cancelled &&
          h.until > w.time,
      ),
      ...extra,
    ];
  const until = Math.max(w.time, ...hs.map((h) => h.until));
  const actors = w.enemies.filter(
    (e) =>
      e.hp > 0 &&
      distance(e, w.player) < 8 &&
      !extra.some((h) => h.source === e.id) &&
      e.state === "seek" &&
      !e.immovable,
  );
  for (let d = -1; d < 24; d++)
    for (const turn of [0, -Math.PI / 2, Math.PI / 2]) {
      if (d < 0 && turn) continue;
      const p = { ...w.player };
      let safe = true;
      for (let t = w.time; t < until - 1e-8 && safe;) {
        const dt = Math.min(0.08, until - t),
          elapsed = t - w.time,
          angle = (d * Math.PI) / 12 + (elapsed >= 1.3 ? turn : 0),
          speed = d < 0 || elapsed < 0.35 ? 0 : 4.2;
        counterMove(
          p,
          { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          dt,
          0.3,
          t + dt,
          (a, z, from, to) => {
            if (
              hs.some((h) =>
                h.counter!.pulses.some((f) => counterImpact(f, z, to, from, a)),
              ) ||
              actors.some((e) => segmentDistance(e, a, z) < 0.6)
            )
              safe = false;
          },
        );
        t += dt;
      }
      if (safe) return true;
    }
  return false;
}
