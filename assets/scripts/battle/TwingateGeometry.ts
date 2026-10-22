import type { Enemy, Hazard, Point } from "./SurvivalTypes";
import { distance, segmentDistance } from "./SurvivalTypes";
import type { SurvivalWorld } from "./SurvivalWorld";
import type { GateRole } from "./TwingateChallenge";
import { graveImpact, graveDistance } from "./EchoGraveGeometry";
import { twingateMap } from "./TwingateMap";
export type GateMove = "charge" | "bolt" | "split" | "sweep";
export interface GatePart extends Point {
  kind: GateMove;
  angle: number;
  length: number;
  speed: number;
  radius: number;
  half: number;
  locked: number;
  due: number;
  end: number;
  to: Point;
  damage: number;
  threatens: boolean;
  hit: boolean;
  cancelled?: boolean;
  cutAt?: number;
}
export interface GateHazard {
  parts: GatePart[];
  action: "A" | "B";
  role: GateRole;
  boss: boolean;
  solo: boolean;
  last: number;
  player: Point;
  pendingAt?: number;
  follow?: GateMove;
  pair?: number;
  collided?: boolean;
  interrupted?: boolean;
  cancelled?: boolean;
  proved?: boolean;
}
export const gateLerp = (a: Point, b: Point, k: number) => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
});
export function gateBody(h: Hazard, t: number) {
  let p: Point = { x: h.x, y: h.y };
  for (const f of h.twin!.parts)
    if (f.kind === "charge" && !f.cancelled && t >= f.due)
      p = gateLerp(
        f,
        f.to,
        Math.max(
          0,
          Math.min(
            1,
            (Math.min(t, f.cutAt ?? Infinity) - f.due) / (f.end - f.due),
          ),
        ),
      );
  return p;
}
export function gateHeads(f: GatePart, t: number) {
  return (
    f.kind === "split" ? [(-28 * Math.PI) / 180, (28 * Math.PI) / 180] : [0]
  ).map((turn) => ({
    x:
      f.x +
      Math.cos(f.angle + turn) *
        Math.max(0, Math.min(f.length, (t - f.due) * f.speed)),
    y:
      f.y +
      Math.sin(f.angle + turn) *
        Math.max(0, Math.min(f.length, (t - f.due) * f.speed)),
  }));
}
const sweep = (f: GatePart) => ({ ...f, radius: f.length, old: false });
export function gateThreat(f: GatePart, p: Point) {
  if (f.kind === "sweep") return graveDistance(sweep(f), p) <= 0.3;
  if (f.kind === "charge") return segmentDistance(p, f, f.to) <= f.radius + 0.3;
  return (
    f.kind === "split" ? [(-28 * Math.PI) / 180, (28 * Math.PI) / 180] : [0]
  ).some(
    (turn) =>
      segmentDistance(p, f, {
        x: f.x + Math.cos(f.angle + turn) * f.length,
        y: f.y + Math.sin(f.angle + turn) * f.length,
      }) <=
      f.radius + 0.3,
  );
}
/** Continuous relative affine motion per real body/bolt; never the preview corridor. */
export function gateImpact(
  f: GatePart,
  p: Point,
  time: number,
  previous = time,
  old = p,
) {
  const end = Math.min(f.end, f.cutAt ?? Infinity);
  if (f.cancelled || time < previous || time < f.due || previous >= end)
    return false;
  if (f.kind === "sweep") return graveImpact(sweep(f), p, time, previous, old);
  const lo = Math.max(previous, f.due),
    hi = Math.min(time, end - 1e-10);
  if (hi < lo) return false;
  const at = (t: number) =>
    time === previous
      ? p
      : gateLerp(old, p, (t - previous) / (time - previous));
  const a = at(lo),
    b = at(hi),
    first =
      f.kind === "charge"
        ? [gateLerp(f, f.to, (lo - f.due) / (f.end - f.due))]
        : gateHeads(f, lo),
    last =
      f.kind === "charge"
        ? [gateLerp(f, f.to, (hi - f.due) / (f.end - f.due))]
        : gateHeads(f, hi);
  return first.some(
    (x, i) =>
      segmentDistance(
        { x: 0, y: 0 },
        { x: a.x - x.x, y: a.y - x.y },
        { x: b.x - last[i].x, y: b.y - last[i].y },
      ) <=
      f.radius + 0.3 + 1e-9,
  );
}
export function gateCut(h: Hazard, time: number, stopBody = true) {
  const b = h.twin!;
  b.interrupted = true;
  b.pendingAt = undefined;
  b.follow = undefined;
  for (const f of b.parts) {
    if (time < f.due) f.cancelled = true;
    else if (stopBody && f.kind === "charge" && time < f.end)
      f.cutAt = Math.min(f.cutAt ?? Infinity, time);
  }
  const ends = b.parts
    .filter(
      (f) =>
        !f.cancelled &&
        (!stopBody || f.kind !== "charge") &&
        f.due <= time &&
        f.end > time,
    )
    .map((f) => f.end);
  h.until = ends.length ? Math.max(...ends) : time;
  b.cancelled = !ends.length;
}
export function gateMove(
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
        from = time - dt + (dt * (i * 2 + axis)) / (n * 2);
      if (!axis)
        p.x = Math.max(-22 + r, Math.min(22 - r, p.x + (v.x * dt) / n));
      else p.y = Math.max(-26 + r, Math.min(26 - r, p.y + (v.y * dt) / n));
      twingateMap.resolve(p, r);
      visit?.(old, { ...p }, from, from + dt / (n * 2));
    }
}
/** Both bodies include their committed movement and stationary endpoints. */
export function gateConflict(
  h: Hazard,
  other: Point,
  otherHazard: Hazard | undefined,
  now: number,
) {
  const end = Math.max(h.until, otherHazard?.until ?? now),
    knots = [
      now,
      end,
      ...h
        .twin!.parts.filter((f) => f.kind === "charge")
        .flatMap((f) => [f.due, f.end, f.cutAt ?? f.end]),
      ...(otherHazard?.twin?.parts ?? [])
        .filter((f) => f.kind === "charge")
        .flatMap((f) => [f.due, f.end, f.cutAt ?? f.end]),
    ]
      .filter((t) => t >= now && t <= end)
      .sort((a, b) => a - b);
  for (let i = 1; i < knots.length; i++) {
    const a = gateBody(h, knots[i - 1]),
      b = gateBody(h, knots[i]),
      x = otherHazard ? gateBody(otherHazard, knots[i - 1]) : other,
      z = otherHazard ? gateBody(otherHazard, knots[i]) : other;
    if (
      segmentDistance(
        { x: 0, y: 0 },
        { x: a.x - x.x, y: a.y - x.y },
        { x: b.x - z.x, y: b.y - z.y },
      ) <
      1.4 - 1e-6
    )
      return true;
  }
  return false;
}
export function gateEscape(w: SurvivalWorld, extra: Hazard[]) {
  const ids = new Set(extra.map((h) => h.id)),
    hs = [
      ...w.hazards.filter(
        (h) =>
          h.twin && !ids.has(h.id) && !h.twin.cancelled && h.until > w.time,
      ),
      ...extra,
    ],
    until = Math.max(w.time, ...hs.map((h) => h.until));
  const actors = w.enemies.filter(
    (e) =>
      e.hp > 0 &&
      distance(e, w.player) < 8 &&
      !hs.some((h) => h.source === e.id) &&
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
          a = (d * Math.PI) / 12 + (elapsed >= 1.3 ? turn : 0),
          speed = d < 0 || elapsed < 0.35 ? 0 : 4.2;
        gateMove(
          p,
          { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
          dt,
          0.3,
          t + dt,
          (old, z, from, to) => {
            if (
              hs.some((h) =>
                h.twin!.parts.some((f) => gateImpact(f, z, to, from, old)),
              ) ||
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
