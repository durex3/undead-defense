import type { Point, Hazard } from "./SurvivalTypes";
import type { SurvivalWorld } from "./SurvivalWorld";
import { leadMap } from "./LeadFoundryMap";
export interface LeadLeg {
  from: Point;
  to: Point;
  launch: number;
  due: number;
  end: number;
  mount: number;
  index: number;
  hit: boolean;
  cancelled?: boolean;
  cross?: { side: number; near: boolean; last: number };
  crossed?: boolean;
}
export interface LeadHazard {
  body: Point;
  origin: Point;
  legs: LeadLeg[];
  group: number;
  phase: number;
  bossC: boolean;
  order: number;
  last: number;
  player: Point;
  interrupted?: boolean;
  cancelled?: boolean;
  damaged?: boolean;
}
export function leadPosition(f: LeadLeg, t: number) {
  const u = Math.max(0, Math.min(1, (t - f.launch) / 0.8));
  return {
    x: f.from.x + (f.to.x - f.from.x) * u,
    y: f.from.y + (f.to.y - f.from.y) * u,
    z: f.mount * (1 - u) + 5.6 * u * (1 - u),
  };
}
function lerp(a: Point, z: Point, k: number) {
  return { x: a.x + (z.x - a.x) * k, y: a.y + (z.y - a.y) * k };
}
function nearest(a: Point, z: Point) {
  const dx = z.x - a.x,
    dy = z.y - a.y,
    k = Math.max(
      0,
      Math.min(1, -(a.x * dx + a.y * dy) / (dx * dx + dy * dy || 1)),
    );
  return Math.hypot(a.x + dx * k, a.y + dy * k);
}
/** Only the actual half-open landing window, never the airborne trajectory. */
export function leadImpact(
  f: LeadLeg,
  p: Point,
  t: number,
  previous = t,
  old = p,
) {
  if (f.cancelled || t < f.due || previous >= f.end || t < previous)
    return false;
  const a = Math.max(previous, f.due),
    z = Math.min(t, f.end - 1e-10);
  if (z < a) return false;
  const at = (v: number) =>
      t === previous ? p : lerp(old, p, (v - previous) / (t - previous)),
    x = at(a),
    y = at(z);
  return (
    nearest(
      { x: x.x - f.to.x, y: x.y - f.to.y },
      { x: y.x - f.to.x, y: y.y - f.to.y },
    ) <=
    1.1 + 1e-9
  );
}
/** Exact relative linear crossing, clipped to the parabola's continuous height>=.9 window. */
export function leadCross(
  f: LeadLeg,
  a: Point,
  z: Point,
  from: number,
  to: number,
) {
  if (f.cancelled || to <= from) return;
  const B = 5.6 - f.mount,
    disc = B * B - 22.4 * (0.9 - f.mount);
  if (disc < 0) return;
  const low = f.launch + (0.8 * (B - Math.sqrt(disc))) / 11.2,
    high = f.launch + (0.8 * (B + Math.sqrt(disc))) / 11.2;
  const lo = Math.max(from, low, f.launch),
    hi = Math.min(to, high, f.due);
  if (hi <= lo) {
    if (to > high) f.cross = undefined;
    return;
  }
  const dx = f.to.x - f.from.x,
    dy = f.to.y - f.from.y,
    d = Math.hypot(dx, dy);
  if (d < 0.05) return;
  const at = (t: number) => lerp(a, z, (t - from) / (to - from)),
    rel = (t: number) => {
      const p = at(t),
        q = leadPosition(f, t);
      return { x: p.x - q.x, y: p.y - q.y };
    };
  const x = rel(lo),
    y = rel(hi),
    signed = (p: Point) => (-dy * p.x + dx * p.y) / d,
    s0 = signed(x),
    s1 = signed(y);
  if (!f.cross || Math.abs(f.cross.last - lo) > 1e-6)
    f.cross = {
      side: Math.abs(s0) >= 0.45 ? Math.sign(s0) : 0,
      near: false,
      last: lo,
    };
  const c = f.cross;
  if (!c.side) {
    if (Math.abs(s0) >= 0.45) c.side = Math.sign(s0);
    else if (Math.abs(s1) >= 0.45) {
      c.side = Math.sign(s1);
      c.near = false;
      c.last = hi;
      return;
    }
  }
  if (c.side) {
    c.near ||= nearest(x, y) <= 0.4 + 1e-9;
    if (c.near && s1 * c.side <= -0.45) f.crossed = true;
  }
  c.last = hi;
}
/** An airborne released leg completes its promised landing. All future launches cancel. */
export function leadCut(h: Hazard, t: number) {
  const b = h.lead!;
  b.interrupted = true;
  for (const f of b.legs)
    if (f.launch > t) {
      f.cancelled = true;
      f.cross = undefined;
      f.crossed = false;
    }
  h.until = Math.max(
    t,
    ...b.legs.filter((f) => !f.cancelled).map((f) => f.end),
  );
  b.cancelled = b.legs.every((f) => f.cancelled);
}

export function leadMove(
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
      leadMap.resolve(p, r);
      visit?.(a, { ...p }, from, to);
    }
}
/** Joint base-speed escape, with reaction delay, wall sliding and current crowd. Does not use counters, speed upgrades or invulnerability. */
export function leadEscape(w: SurvivalWorld, extra: Hazard[]) {
  const hazards = [
      ...w.hazards.filter(
        (h) => h.lead && !h.lead.cancelled && h.until > w.time,
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
        leadMove(
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
                  h.lead!.legs.some((f) => leadImpact(f, z, to, from, old)),
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
