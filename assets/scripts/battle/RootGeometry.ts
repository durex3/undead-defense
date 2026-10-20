import type { Hazard, Point } from "./SurvivalTypes";
import { distance, segmentDistance } from "./SurvivalTypes";
import type { SurvivalWorld } from "./SurvivalWorld";
import { rootMap } from "./RootMap";
export interface RootHazard {
  shape: "arm" | "ring" | "disk";
  inner: number;
  turn: number;
  order: number;
  last: number;
  player: Point;
  hit: boolean;
  cancelled?: boolean;
}
export function rootAngle(h: Hazard, t: number) {
  return (
    h.angle +
    h.root!.turn * Math.max(0, Math.min(1, (t - h.due) / (h.until - h.due)))
  );
}
export function rootArm(h: Hazard, t: number): [Point, Point] {
  const a = rootAngle(h, t),
    c = Math.cos(a),
    s = Math.sin(a);
  return [
    { x: h.x + c * h.root!.inner, y: h.y + s * h.root!.inner },
    { x: h.x + c * h.radius, y: h.y + s * h.radius },
  ];
}
function segmentGap(a: Point, b: Point, c: Point, d: Point) {
  const cross = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const ca = cross(a, b, c),
    da = cross(a, b, d),
    ac = cross(c, d, a),
    bc = cross(c, d, b);
  if (
    ca * da <= 0 &&
    ac * bc <= 0 &&
    Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <=
      Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) &&
    Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <=
      Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y))
  )
    return 0;
  return Math.min(
    segmentDistance(a, c, d),
    segmentDistance(b, c, d),
    segmentDistance(c, a, b),
    segmentDistance(d, a, b),
  );
}
/** Exact annulus sweep; rotating-frame chord has a conservative <=0.005 world-unit error. */
export function rootHit(
  h: Hazard,
  p: Point,
  t: number,
  previous = t - 0.05,
  old: Point = p,
) {
  const b = h.root!;
  if (b.cancelled || t < h.due || previous >= h.until || h.until <= h.due)
    return false;
  const from = Math.max(previous, h.due),
    to = Math.min(t, h.until);
  if (from > to) return false;
  const at = (v: number) => {
    const f =
      t === previous
        ? 1
        : Math.max(0, Math.min(1, (v - previous) / (t - previous)));
    return { x: old.x + (p.x - old.x) * f, y: old.y + (p.y - old.y) * f };
  };
  const a = at(from),
    z = at(to);
  if (b.shape !== "arm") {
    const min = segmentDistance(h, a, z),
      max = Math.max(distance(h, a), distance(h, z));
    return (
      min <= h.radius + 0.3 && (b.shape === "disk" || max >= b.inner - 0.3)
    );
  }
  const omega = Math.abs(b.turn) / (h.until - h.due),
    v = distance(a, z) / Math.max(1e-9, to - from),
    rad = Math.max(distance(h, a), distance(h, z));
  const curvature = omega * omega * rad + 2 * omega * v,
    n = Math.max(
      1,
      Math.ceil(Math.sqrt((curvature * (to - from) ** 2) / (8 * 0.005))),
    );
  const rotate = (q: Point, time: number) => {
    const angle = rootAngle(h, time),
      dx = q.x - h.x,
      dy = q.y - h.y;
    return {
      x: dx * Math.cos(angle) + dy * Math.sin(angle),
      y: -dx * Math.sin(angle) + dy * Math.cos(angle),
    };
  };
  let start = rotate(a, from);
  for (let i = 1; i <= n; i++) {
    const time = from + ((to - from) * i) / n,
      end = rotate(at(time), time),
      error = (curvature * ((to - from) / n) ** 2) / 8;
    if (
      segmentGap(start, end, { x: b.inner, y: 0 }, { x: h.radius, y: 0 }) <=
      h.width + 0.3 + error
    )
      return true;
    start = end;
  }
  return false;
}
export function rootEscape(w: SurvivalWorld, extra: Hazard[]) {
  const hazards = [
      ...w.hazards.filter((h) => h.root && h.until > w.time),
      ...extra,
    ],
    until = Math.max(w.time + 0.1, ...hazards.map((h) => h.until));
  const actors = w.enemies.filter(
    (e) =>
      e.hp > 0 &&
      !e.immovable &&
      e.state === "seek" &&
      distance(e, w.player) < 8,
  );
  const paths = [{ angle: 0, turn: 0, stop: 0 }];
  for (let i = 0; i < 24; i++) {
    for (const stop of [1.4, 2.4, Infinity])
      paths.push({ angle: (i * Math.PI) / 12, turn: 0, stop });
    for (const turn of [-Math.PI / 2, Math.PI / 2])
      paths.push({ angle: (i * Math.PI) / 12, turn, stop: Infinity });
  }
  for (const route of paths) {
    let p = { ...w.player },
      safe = true;
    for (let time = w.time + 0.05; time < until + 0.05; time += 0.05) {
      const t = Math.min(until, time),
        dt = t - (time - 0.05),
        elapsed = t - w.time,
        old = { ...p };
      if (elapsed > 0.35 && elapsed < route.stop) {
        const a = route.angle + (elapsed > 1.6 ? route.turn : 0);
        p = {
          x: p.x + Math.cos(a) * 4.2 * dt,
          y: p.y + Math.sin(a) * 4.2 * dt,
        };
      }
      if (
        Math.abs(p.x) > 21.7 ||
        Math.abs(p.y) > 25.7 ||
        rootMap.blocked(p, 0.3) ||
        rootMap.segment(old, p, 0.3) ||
        actors.some((e) => distance(e, p) < 0.6) ||
        hazards.some((h) => rootHit(h, p, t, time - 0.05, old))
      ) {
        safe = false;
        break;
      }
    }
    if (safe) return true;
  }
  return false;
}
