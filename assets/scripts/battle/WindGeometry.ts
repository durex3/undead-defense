import type { Hazard, Point } from "./SurvivalTypes";
import { distance, segmentDistance } from "./SurvivalTypes";
import type { SurvivalWorld } from "./SurvivalWorld";
import { windMap } from "./WindMap";
export interface WindHazard {
  shape: "wind" | "feather" | "glide";
  points: Point[];
  lengths: number[];
  speed: number;
  order: number;
  last: number;
  player: Point;
  hit: boolean;
  cancelled?: boolean;
  pair?: number;
}
/** Subdivide until the control polygon's deviation is <= .001 world units. */
export function windCurve(a: Point, c: Point, z: Point): Point[] {
  const out: Point[] = [{ ...a }];
  const mid = (p: Point, q: Point) => ({
    x: (p.x + q.x) / 2,
    y: (p.y + q.y) / 2,
  });
  function split(p: Point, q: Point, r: Point, depth: number) {
    if (depth > 16 || segmentDistance(q, p, r) <= 0.001) {
      out.push({ ...r });
      return;
    }
    const x = mid(p, q),
      y = mid(q, r),
      m = mid(x, y);
    split(p, x, m, depth + 1);
    split(m, y, r, depth + 1);
  }
  split(a, c, z, 0);
  return out;
}
export function windLengths(points: Point[]) {
  let n = 0;
  return points.map((p, i) => (i ? (n += distance(points[i - 1], p)) : 0));
}
export function windPosition(h: Hazard, time: number): Point {
  const b = h.wind!,
    ls = b.lengths;
  let travel = Math.max(0, time - h.due) * b.speed;
  if (b.shape === "glide" && travel > ls[1])
    travel = Math.max(ls[1], travel - 0.35 * b.speed);
  travel = Math.min(travel, h.radius);
  let i = 1;
  while (i < ls.length - 1 && ls[i] < travel) i++;
  const f = Math.max(
      0,
      Math.min(1, (travel - ls[i - 1]) / (ls[i] - ls[i - 1] || 1)),
    ),
    a = b.points[i - 1],
    z = b.points[i];
  return { x: a.x + (z.x - a.x) * f, y: a.y + (z.y - a.y) * f };
}
export function inWind(h: Hazard, p: Point) {
  const dx = p.x - h.x,
    dy = p.y - h.y,
    c = Math.cos(h.angle),
    s = Math.sin(h.angle);
  return Math.abs(dx * c + dy * s) <= 3.5 && Math.abs(-dx * s + dy * c) <= 1.6;
}
export function windVelocity(hazards: Hazard[], p: Point, time: number) {
  const h = hazards.find(
    (h) =>
      h.wind?.shape === "wind" &&
      !h.wind.cancelled &&
      time >= h.due &&
      time < h.until &&
      inWind(h, p),
  );
  return h
    ? { x: Math.cos(h.angle) * 0.8, y: Math.sin(h.angle) * 0.8 }
    : { x: 0, y: 0 };
}
/** Shared input/AI + wind integration, small axis steps with sliding and radius-aware boundaries. */
export function windMove(
  p: Point,
  velocity: Point,
  dt: number,
  r: number,
  hazards: Hazard[],
  time: number,
) {
  const n = Math.max(
    1,
    Math.ceil(((Math.hypot(velocity.x, velocity.y) + 0.8) * dt) / 0.05),
  );
  for (let i = 0; i < n; i++) {
    const at = time - dt + ((i + 0.5) * dt) / n,
      v = windVelocity(hazards, p, at);
    p.x = Math.max(
      -22 + r,
      Math.min(22 - r, p.x + ((velocity.x + v.x) * dt) / n),
    );
    windMap.resolve(p, r);
    p.y = Math.max(
      -26 + r,
      Math.min(26 - r, p.y + ((velocity.y + v.y) * dt) / n),
    );
    windMap.resolve(p, r);
  }
}
export function windHit(
  h: Hazard,
  p: Point,
  t: number,
  previous = t - 0.05,
  old: Point = p,
) {
  const b = h.wind!;
  if (b.cancelled || b.shape === "wind" || t < h.due || previous >= h.until)
    return false;
  const from = Math.max(previous, h.due),
    to = Math.min(t, h.until);
  // At <= .005s per segment the relative-motion chord error is below the geometry tolerance.
  const n = Math.max(1, Math.ceil((to - from) / 0.005));
  const player = (time: number) => {
    const f = (time - previous) / (t - previous || 1);
    return { x: old.x + (p.x - old.x) * f, y: old.y + (p.y - old.y) * f };
  };
  let a = windPosition(h, from),
    pa = player(from);
  for (let i = 1; i <= n; i++) {
    const time = from + ((to - from) * i) / n,
      z = windPosition(h, time),
      pz = player(time);
    if (
      segmentDistance(
        { x: 0, y: 0 },
        { x: a.x - pa.x, y: a.y - pa.y },
        { x: z.x - pz.x, y: z.y - pz.y },
      ) <=
      h.width + 0.3 + 0.002
    )
      return true;
    a = z;
    pa = pz;
  }
  return false;
}
export function windEscape(w: SurvivalWorld, extra: Hazard[]) {
  const hazards = [
    ...w.hazards.filter((h) => h.wind && !h.wind.cancelled && h.until > w.time),
    ...extra,
  ];
  const until = Math.max(w.time + 0.1, ...hazards.map((h) => h.until));
  const actors = w.enemies.filter(
    (e) =>
      e.hp > 0 &&
      !e.immovable &&
      e.state === "seek" &&
      distance(e, w.player) < 8,
  );
  const paths = [{ a: 0, turn: 0, stop: 0 }];
  for (let i = 0; i < 24; i++) {
    for (const stop of [1.4, 2.4, Infinity])
      paths.push({ a: (i * Math.PI) / 12, turn: 0, stop });
    for (const turn of [-Math.PI / 2, Math.PI / 2])
      paths.push({ a: (i * Math.PI) / 12, turn, stop: Infinity });
  }
  for (const path of paths) {
    let p = { ...w.player },
      safe = true;
    for (let time = w.time; time < until;) {
      const dt = Math.min(0.05, until - time),
        old = { ...p },
        elapsed = time - w.time;
      const a = path.a + (elapsed > 1.6 ? path.turn : 0),
        speed = elapsed >= 0.35 && elapsed < path.stop ? w.speed : 0;
      windMove(
        p,
        { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
        dt,
        0.3,
        hazards,
        time + dt,
      );
      if (
        actors.some((e) => distance(e, p) < 0.65) ||
        hazards.some((h) => windHit(h, p, time + dt, time, old))
      ) {
        safe = false;
        break;
      }
      time += dt;
    }
    if (safe) return true;
  }
  return false;
}
