import type { Hazard, Point } from "./SurvivalTypes";
import type { SurvivalWorld } from "./SurvivalWorld";
import { distance } from "./SurvivalTypes";
import { edgeMap } from "./EdgeCourtMap";
import { libraryLocal, libraryRoundedEnter } from "./LibraryGeometry";
export interface EdgeFlight {
  from: Point;
  to: Point;
  due: number;
  end: number;
  angle: number;
  halfLength: number;
  radius: number;
  index: number;
  hit: boolean;
  cancelled?: boolean;
}
export interface EdgeHazard {
  shape: "blade" | "body";
  flights: EdgeFlight[];
  group: number;
  phase: number;
  bossC: boolean;
  order: number;
  last: number;
  player: Point;
  cancelled?: boolean;
  interrupted?: boolean;
  damaged?: boolean;
}
export function edgePosition(f: EdgeFlight, t: number): Point {
  const p = Math.max(0, Math.min(1, (t - f.due) / (f.end - f.due)));
  return {
    x: f.from.x + (f.to.x - f.from.x) * p,
    y: f.from.y + (f.to.y - f.from.y) * p,
  };
}
export function edgeFlight(h: Hazard, t: number) {
  return h.edge!.flights.find((f) => !f.cancelled && t >= f.due && t < f.end);
}
export function edgeRestPosition(h: Hazard, t: number) {
  const fs = h.edge!.flights.filter((f) => !f.cancelled);
  let p = fs[0]?.from ?? h;
  for (const f of fs) {
    if (t < f.due) break;
    p = edgePosition(f, t);
  }
  return { ...p };
}
/** Exact relative swept capsule, clipped to each released flight; parked blade is harmless. */
export function edgeImpacts(
  h: Hazard,
  p: Point,
  t: number,
  previous = t,
  old = p,
): number[] {
  const b = h.edge!;
  if (b.cancelled || t < previous) return [];
  const at = (time: number) => {
    const f =
      t === previous
        ? 1
        : Math.max(0, Math.min(1, (time - previous) / (t - previous)));
    return { x: old.x + (p.x - old.x) * f, y: old.y + (p.y - old.y) * f };
  };
  const out: number[] = [];
  for (const f of b.flights) {
    if (f.cancelled || t < f.due || previous >= f.end) continue;
    const a = Math.max(previous, f.due),
      z = Math.min(t, f.end);
    if (a > z) continue;
    const x = libraryLocal(at(a), edgePosition(f, a), f.angle),
      y = libraryLocal(at(z), edgePosition(f, z), f.angle);
    if (
      libraryRoundedEnter(x, y, { x: f.halfLength, y: 0 }, f.radius + 0.3) !==
      null
    )
      out.push(f.index);
  }
  return out;
}
/** Keep only an already released single flight. Dead bodies stop; detached blades finish that leg. */
export function edgeCut(h: Hazard, time: number, dead = false) {
  const b = h.edge!;
  b.interrupted = true;
  for (const f of b.flights)
    if (f.due > time || (f.end > time && b.shape === "body" && dead))
      f.cancelled = true;
  h.until = Math.max(
    time,
    ...b.flights.filter((f) => !f.cancelled).map((f) => f.end),
  );
  if (b.flights.every((f) => f.cancelled)) b.cancelled = true;
}
export function edgeEnvelope(h: Hazard): Point[] {
  return h
    .edge!.flights.filter((f) => !f.cancelled)
    .flatMap((f) =>
      [f.from, f.to].flatMap((p) =>
        [-1, 1].flatMap((s) =>
          [-1, 1].flatMap((x) =>
            [-1, 1].map((y) => ({
              x: p.x + Math.cos(f.angle) * f.halfLength * s + x * f.radius,
              y: p.y + Math.sin(f.angle) * f.halfLength * s + y * f.radius,
            })),
          ),
        ),
      ),
    );
}
export function edgeSolid(h: Hazard) {
  return h.edge!.flights.some((f) => {
    const x = Math.cos(f.angle) * f.halfLength,
      y = Math.sin(f.angle) * f.halfLength,
      a = { x: f.from.x - x, y: f.from.y - y },
      z = { x: f.to.x + x, y: f.to.y + y },
      r = h.edge!.shape === "body" ? 0.7 : f.radius;
    return (
      [a, z].some((p) => Math.abs(p.x) > 22 - r || Math.abs(p.y) > 26 - r) ||
      edgeMap.segment(a, z, r)
    );
  });
}
export function edgeMove(
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
      edgeMap.resolve(p, r);
      visit?.(a, { ...p }, from, to);
    }
}
/** Joint base-speed escape, with reaction delay, wall sliding and current crowd. Does not use counters, speed upgrades or invulnerability. */
export function edgeEscape(w: SurvivalWorld, extra: Hazard[]) {
  const hazards = [
      ...w.hazards.filter(
        (h) => h.edge && !h.edge.cancelled && h.until > w.time,
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
        edgeMove(
          p,
          { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
          dt,
          0.3,
          t + dt,
          (old, z, from, to) => {
            if (
              safe &&
              (actors.some((e) => distance(e, z) < 0.65) ||
                hazards.some((h) => edgeImpacts(h, z, to, from, old).length))
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
