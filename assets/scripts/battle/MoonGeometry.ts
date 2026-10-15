import { Point, segmentDistance } from "./SurvivalTypes";
import { moonMap } from "./MoonMap";
/** One clock and fixed control points are shared by rendering, collision and escape checks. */
export interface MoonMotion {
  shape: "blade" | "sweep" | "landing" | "claw";
  start: Point;
  end: Point;
  control: Point;
  home: Point;
  returnControl: Point;
  due: number;
  out: number;
  hover: number;
  back: number;
  radius: number;
  width: number;
  angle: number;
  turn: number;
}
export interface MoonPose {
  point: Point;
  tip?: Point;
  inner?: Point;
  leg: 0 | 1 | 2;
  progress: number;
}
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export function moonCurve(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}
export function moonEnd(m: MoonMotion) {
  return m.due + m.out + m.hover + m.back;
}
export function moonPose(m: MoonMotion, time: number): MoonPose {
  const t = time - m.due;
  if (m.shape === "blade") {
    if (t < 0) return { point: m.start, leg: 0, progress: 0 };
    if (t < m.out)
      return {
        point: moonCurve(m.start, m.control, m.end, clamp(t / m.out)),
        leg: 1,
        progress: clamp(t / m.out),
      };
    if (t < m.out + m.hover) return { point: m.end, leg: 0, progress: 0 };
    if (t < m.out + m.hover + m.back)
      return {
        point: moonCurve(
          m.end,
          m.returnControl,
          m.home,
          clamp((t - m.out - m.hover) / m.back),
        ),
        leg: 2,
        progress: clamp((t - m.out - m.hover) / m.back),
      };
    return { point: m.home, leg: 0, progress: 1 };
  }
  const u = clamp(t / m.out),
    point = moonCurve(m.start, m.control, m.end, u);
  if (m.shape === "landing")
    return { point: m.end, leg: t >= 0 && t < m.out ? 1 : 0, progress: u };
  const a = m.angle + m.turn * u;
  return {
    point,
    inner: { x: point.x + Math.cos(a) * 0.6, y: point.y + Math.sin(a) * 0.6 },
    tip: {
      x: point.x + Math.cos(a) * m.radius,
      y: point.y + Math.sin(a) * m.radius,
    },
    leg: t >= 0 && t < m.out ? 1 : 0,
    progress: u,
  };
}
export function moonContains(m: MoonMotion, p: Point, time: number, r = 0.3) {
  const v = moonPose(m, time);
  if (!v.leg) return false;
  if (m.shape === "claw") {
    const dx = p.x - v.point.x,
      dy = p.y - v.point.y,
      d = Math.hypot(dx, dy);
    const delta = Math.atan2(
      Math.sin(Math.atan2(dy, dx) - (m.angle + m.turn / 2)),
      Math.cos(Math.atan2(dy, dx) - (m.angle + m.turn / 2)),
    );
    if (
      d <= r ||
      (d <= m.radius + r && Math.abs(delta) <= Math.abs(m.turn) / 2)
    )
      return true;
    return [m.angle, m.angle + m.turn].some(
      (a) =>
        segmentDistance(p, v.point, {
          x: v.point.x + Math.cos(a) * m.radius,
          y: v.point.y + Math.sin(a) * m.radius,
        }) <= r,
    );
  }
  return m.shape === "sweep"
    ? segmentDistance(p, v.inner!, v.tip!) <= m.width + r
    : Math.hypot(p.x - v.point.x, p.y - v.point.y) <= m.radius + r;
}
/** Relative swept samples include moving players; step adapts to speed/angular travel. */
export function moonSwept(
  m: MoonMotion,
  a: Point,
  b: Point,
  from: number,
  to: number,
  r = 0.3,
  leg?: 1 | 2,
) {
  const lo = Math.max(from, m.due),
    hi = Math.min(to, moonEnd(m));
  if (hi < lo) return false;
  const speed =
    (Math.hypot(m.end.x - m.start.x, m.end.y - m.start.y) +
      2 * Math.hypot(m.control.x - m.start.x, m.control.y - m.start.y)) /
      m.out +
    (Math.abs(m.turn) * m.radius) / m.out;
  const n = Math.max(
    1,
    Math.ceil(
      (hi - lo) *
        Math.max(
          100,
          speed /
            Math.max(0.025, (r + Math.min(m.radius, m.width || m.radius)) / 3),
        ),
    ),
  );
  for (let i = 0; i <= n; i++) {
    const t = lo + ((hi - lo) * i) / n,
      u = to === from ? 1 : clamp((t - from) / (to - from));
    const p = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    if (
      (leg === undefined || moonPose(m, t).leg === leg) &&
      moonContains(m, p, t, r)
    )
      return true;
  }
  return false;
}
export function moonFootprint(m: MoonMotion): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    if (m.shape === "blade")
      out.push(
        moonCurve(m.start, m.control, m.end, u),
        moonCurve(m.end, m.returnControl, m.home, u),
      );
    else if (m.shape === "landing") out.push(m.end);
    else {
      const v = moonPose(m, m.due + m.out * u - 1e-7);
      out.push(v.point, v.tip!);
    }
  }
  return out;
}
export interface MoonEscapeContext {
  time: number;
  player: Point;
  enemies: readonly (Point & { hp: number; state: string; kind: string })[];
}
/** Conservative finite route search, not a proof: straight, stop, and one turn. */
export function moonEscape(
  w: MoonEscapeContext,
  motions: readonly MoonMotion[],
): boolean {
  const horizon = Math.max(0.5, ...motions.map((m) => moonEnd(m) - w.time));
  const directions = Array.from({ length: 16 }, (_, i) => (i * Math.PI) / 8);
  const routes: [number, number, number][] = [[NaN, NaN, 0]];
  for (const a of directions) {
    routes.push([a, a, Infinity]);
    for (const cut of [1, 2, 3]) {
      routes.push([a, NaN, cut]);
      for (const delta of [-Math.PI / 2, Math.PI / 2, Math.PI])
        routes.push([a, a + delta, cut]);
    }
  }
  return routes.some(([first, second, cut]) => {
    let p = { ...w.player };
    for (let t = 0.05; t <= horizon + 0.05; t += 0.05) {
      const before = p;
      p = { ...p };
      if (t > 0.35) {
        const a = t - 0.35 < cut ? first : second;
        if (Number.isFinite(a)) {
          p.x += Math.cos(a) * 4.2 * 0.05;
          p.y += Math.sin(a) * 4.2 * 0.05;
        }
      }
      if (
        Math.abs(p.x) > 22 ||
        Math.abs(p.y) > 26 ||
        moonMap.segment(before, p, 0.3) ||
        moonMap.blocked(p, 0.3)
      )
        return false;
      if (
        t < 1.5 &&
        w.enemies.some(
          (e) =>
            e.hp > 0 &&
            e.state === "seek" &&
            Math.hypot(e.x - p.x, e.y - p.y) <
              (e.kind === "boss" ? 0.95 : 0.65),
        )
      )
        return false;
      if (
        motions.some((m) =>
          moonSwept(m, before, p, w.time + t - 0.05, w.time + t),
        )
      )
        return false;
    }
    return true;
  });
}
