import type { Enemy, Hazard, Point } from "./SurvivalTypes";
import { distance, segmentDistance } from "./SurvivalTypes";
import type { SurvivalWorld } from "./SurvivalWorld";
import { traceMap } from "./TraceCourtMap";
import { graveImpact, type GravePulse } from "./EchoGraveGeometry";
import type { TraceDirection } from "./TraceHistory";
export interface TraceLeg {
  from: Point;
  to: Point;
  due: number;
  end: number;
  pass: number;
}
export interface TraceHazard {
  legs: TraceLeg[];
  radius: number;
  last: number;
  player: Point;
  action: string;
  life: number;
  genuine: boolean;
  historical?: boolean;
  direction?: TraceDirection;
  hitPasses: number[];
  sweep?: GravePulse;
  pending?: "return" | "sweep";
  route: Point[];
  cancelled?: boolean;
  interrupted?: boolean;
  damaged?: boolean;
  cutAt?: number;
}
const lerp = (a: Point, z: Point, k: number) => ({
  x: a.x + (z.x - a.x) * k,
  y: a.y + (z.y - a.y) * k,
});
export function traceLegs(
  points: Point[],
  due: number,
  speed: number,
  pass = 1,
  pause = 0,
): TraceLeg[] {
  const legs: TraceLeg[] = [];
  for (let i = 1; i < points.length; i++) {
    const from = { ...points[i - 1] },
      to = { ...points[i] },
      end = due + distance(from, to) / speed;
    legs.push({ from, to, due, end, pass });
    due = end + pause;
  }
  return legs;
}
export function tracePosition(h: Hazard, time: number): Point {
  const b = h.trace!;
  let p = { x: h.x, y: h.y };
  const t = Math.min(time, b.cutAt ?? Infinity);
  for (const f of b.legs) {
    if (t < f.due) break;
    p = lerp(
      f.from,
      f.to,
      Math.max(0, Math.min(1, (t - f.due) / (f.end - f.due || 1))),
    );
    if (t < f.end) break;
  }
  return p;
}
/** Continuous relative motion on each affine body leg, never the warning corridor. */
export function traceImpacts(
  h: Hazard,
  p: Point,
  time: number,
  previous = time,
  old = p,
): number[] {
  const b = h.trace!,
    hits: number[] = [];
  if (time < previous) return hits;
  const at = (t: number) =>
    time === previous ? p : lerp(old, p, (t - previous) / (time - previous));
  if (!b.cancelled)
    for (const f of b.legs) {
      const end = Math.min(f.end, b.cutAt ?? Infinity);
      if (time < f.due || previous >= end) continue;
      const a = Math.max(previous, f.due),
        z = Math.min(time, end - 1e-10);
      if (z < a) continue;
      const body = (t: number) =>
        lerp(f.from, f.to, (t - f.due) / (f.end - f.due));
      const u = at(a),
        v = at(z),
        x = body(a),
        y = body(z);
      if (
        segmentDistance(
          { x: 0, y: 0 },
          { x: u.x - x.x, y: u.y - x.y },
          { x: v.x - y.x, y: v.y - y.y },
        ) <=
          b.radius + 0.3 + 1e-9 &&
        !hits.includes(f.pass)
      )
        hits.push(f.pass);
    }
  if (b.sweep && graveImpact(b.sweep, p, time, previous, old)) hits.push(3);
  return hits;
}
export function traceCut(h: Hazard, time: number) {
  const b = h.trace!;
  b.interrupted = true;
  b.pending = undefined;
  b.cutAt = time;
  if (b.sweep && b.sweep.due <= time && b.sweep.end > time) {
    h.until = b.sweep.end;
    return;
  }
  if (b.sweep) b.sweep.cancelled = true;
  b.cancelled = true;
  h.until = time;
}
export function traceMove(
  p: Point,
  v: Point,
  dt: number,
  r: number,
  time: number,
  visit?: (a: Point, z: Point, from: number, to: number) => void,
) {
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(v.x * dt), Math.abs(v.y * dt), dt * 4) / 0.05),
  );
  for (let i = 0; i < steps; i++)
    for (let axis = 0; axis < 2; axis++) {
      const a = { x: p.x, y: p.y },
        from = time - dt + (dt * (2 * i + axis)) / (2 * steps),
        to = from + dt / (2 * steps);
      if (!axis)
        p.x = Math.max(-22 + r, Math.min(22 - r, p.x + (v.x * dt) / steps));
      else p.y = Math.max(-26 + r, Math.min(26 - r, p.y + (v.y * dt) / steps));
      traceMap.resolve(p, r);
      visit?.(a, { x: p.x, y: p.y }, from, to);
    }
}
/** Conservative joint base-speed reaction paths; no boots, freeze or invulnerability. */
export function traceEscape(w: SurvivalWorld, extra: Hazard[]) {
  const hs = [
      ...w.hazards.filter(
        (h) => h.trace && !h.trace.cancelled && h.until > w.time,
      ),
      ...extra,
    ],
    until = Math.max(w.time, ...hs.map((h) => h.until));
  const actors = w.enemies.filter(
    (e) =>
      e.hp > 0 &&
      e.state === "seek" &&
      !e.immovable &&
      !extra.some((h) => h.source === e.id) &&
      distance(e, w.player) < 8,
  );
  for (let i = -1; i < 24; i++)
    for (const turn of [0, -Math.PI / 2, Math.PI / 2]) {
      if (i < 0 && turn) continue;
      const p = { ...w.player };
      let safe = true;
      for (let t = w.time; t < until - 1e-8 && safe;) {
        const dt = Math.min(0.08, until - t),
          elapsed = t - w.time,
          a = (i * Math.PI) / 12 + (elapsed >= 1.3 ? turn : 0),
          speed = i < 0 || elapsed < 0.35 ? 0 : 4.2;
        traceMove(
          p,
          { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
          dt,
          0.3,
          t + dt,
          (old, z, from, to) => {
            if (
              hs.some((h) => traceImpacts(h, z, to, from, old).length) ||
              actors.some((e) => segmentDistance(e, old, z) < 0.6)
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
export function traceBodySync(e: Enemy, h: Hazard, time: number) {
  const p = tracePosition(h, time);
  e.x = p.x;
  e.y = p.y;
  const leg = h.trace!.legs.find((f) => time >= f.due && time < f.end);
  if (leg) e.facing = Math.atan2(leg.to.y - leg.from.y, leg.to.x - leg.from.x);
}
