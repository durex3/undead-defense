import type { Hazard, Point } from "./SurvivalTypes";
import { distance, segmentDistance } from "./SurvivalTypes";
import { tideMap, tideStop } from "./TideMap";
import type { SurvivalWorld } from "./SurvivalWorld";
export const TIDE_STRIPS = 24;
export interface TideHazard {
  shape: "tide" | "fork" | "hook";
  order: number;
  speed: number;
  halfSpan: number;
  stops: number[];
  hit: boolean;
  last: number;
  from: Point;
  to: Point;
  chainFrom: Point;
  stopped: boolean;
  player: Point;
  preview?: boolean;
}
export function tideStrips(
  origin: Point,
  angle: number,
  halfSpan: number,
  travel: number,
) {
  const step = (halfSpan * 2) / TIDE_STRIPS,
    nx = -Math.sin(angle),
    ny = Math.cos(angle);
  return Array.from({ length: TIDE_STRIPS }, (_, i) => {
    const side = -halfSpan + (i + 0.5) * step;
    return tideStop(
      { x: origin.x + nx * side, y: origin.y + ny * side },
      angle,
      travel,
      0,
      step / 2,
    );
  });
}
export function tideHead(h: Hazard, t: number): Point {
  const b = h.tide!,
    length = distance(b.from, b.to),
    d = Math.min(length, Math.max(0, t - h.due) * b.speed);
  return {
    x: b.from.x + Math.cos(h.angle) * d,
    y: b.from.y + Math.sin(h.angle) * d,
  };
}
function segmentBox(
  a: Point,
  b: Point,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  r: number,
) {
  const point = (p: Point) =>
    Math.hypot(
      Math.max(x0 - p.x, 0, p.x - x1),
      Math.max(y0 - p.y, 0, p.y - y1),
    ) <= r;
  if (point(a) || point(b)) return true;
  let lo = 0,
    hi = 1;
  for (const [p, d, min, max] of [
    [a.x, b.x - a.x, x0, x1],
    [a.y, b.y - a.y, y0, y1],
  ]) {
    if (Math.abs(d) < 1e-9) {
      if (p < min || p > max) {
        lo = Infinity;
        break;
      }
    } else {
      const q = (min - p) / d,
        z = (max - p) / d;
      lo = Math.max(lo, Math.min(q, z));
      hi = Math.min(hi, Math.max(q, z));
    }
  }
  if (lo <= hi) return true;
  return [
    { x: x0, y: y0 },
    { x: x0, y: y1 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
  ].some((p) => segmentDistance(p, a, b) <= r);
}
/** Swept player-circle against the actual moving strip/point. Expired water and rope never hit. */
export function tideHit(
  h: Hazard,
  p: Point,
  t: number,
  previous = t - 0.05,
  r = 0.3,
  oldPlayer: Point = p,
) {
  const b = h.tide!;
  if (t < h.due || previous > h.until) return false;
  const from = Math.max(h.due, previous),
    to = Math.min(t, h.until);
  if (to < from) return false;
  const ratioAt = (at: number) =>
    t === previous
      ? 1
      : Math.max(0, Math.min(1, (at - previous) / (t - previous)));
  const pointAt = (at: number) => ({
    x: oldPlayer.x + (p.x - oldPlayer.x) * ratioAt(at),
    y: oldPlayer.y + (p.y - oldPlayer.y) * ratioAt(at),
  });
  const startPlayer = pointAt(from);
  const dx = Math.cos(h.angle),
    dy = Math.sin(h.angle),
    local = (q: Point, at: number) => ({
      x:
        (q.x - h.x) * dx + (q.y - h.y) * dy - Math.max(0, at - h.due) * b.speed,
      y: -(q.x - h.x) * dy + (q.y - h.y) * dx,
    });
  if (b.shape !== "tide") {
    const a = tideHead(h, from),
      z = tideHead(h, to);
    return (
      segmentDistance(
        { x: 0, y: 0 },
        { x: a.x - startPlayer.x, y: a.y - startPlayer.y },
        { x: z.x - pointAt(to).x, y: z.y - pointAt(to).y },
      ) <=
      h.width + r
    );
  }
  const step = (b.halfSpan * 2) / TIDE_STRIPS;
  for (let i = 0; i < TIDE_STRIPS; i++) {
    const stop = b.stops[i];
    if (stop <= 0 || from >= h.due + stop / b.speed) continue;
    const end = Math.min(to, h.due + stop / b.speed - 1e-7),
      ratio =
        t === previous
          ? 1
          : Math.max(0, Math.min(1, (end - previous) / (t - previous)));
    const endPlayer = {
      x: oldPlayer.x + (p.x - oldPlayer.x) * ratio,
      y: oldPlayer.y + (p.y - oldPlayer.y) * ratio,
    };
    if (end < from) continue;
    if (
      segmentBox(
        local(startPlayer, from),
        local(endPlayer, end),
        -h.width,
        0,
        -b.halfSpan + i * step,
        -b.halfSpan + (i + 1) * step,
        r,
      )
    )
      return true;
  }
  return false;
}
/** Finite safety search: base-speed paths with reaction delay, optional one turn, real crates and occupied cells. */
export function tideEscape(w: SurvivalWorld, candidates: Hazard[]) {
  const hazards = [
    ...w.hazards.filter((h) => h.tide && h.until > w.time),
    ...candidates,
  ];
  const until = Math.max(w.time + 0.1, ...hazards.map((h) => h.until)),
    blockers = w.enemies.filter(
      (e) => e.hp > 0 && e.state === "seek" && distance(e, w.player) < 8,
    );
  const attempts: { angle: number; turn: number; at: number; stop: number }[] =
    [{ angle: 0, turn: 0, at: Infinity, stop: 0 }];
  for (let i = 0; i < 24; i++)
    for (const stop of [1.4, 2.4, Infinity])
      attempts.push({ angle: (i * Math.PI) / 12, turn: 0, at: Infinity, stop });
  for (let i = 0; i < 24; i++)
    for (const turn of [Math.PI / 2, -Math.PI / 2])
      attempts.push({
        angle: (i * Math.PI) / 12,
        turn,
        at: turn === 0 ? Infinity : 1.6,
        stop: Infinity,
      });
  for (const a of attempts) {
    let p = { ...w.player },
      safe = true;
    for (let t = w.time; t <= until + 0.025; t += 0.05) {
      const elapsed = t - w.time,
        old = { ...p };
      if (elapsed > 0.35 && elapsed < a.stop) {
        const angle = a.angle + (elapsed > a.at ? a.turn : 0);
        p = {
          x: p.x + Math.cos(angle) * 4.2 * 0.05,
          y: p.y + Math.sin(angle) * 4.2 * 0.05,
        };
      }
      if (
        Math.abs(p.x) > 22 ||
        Math.abs(p.y) > 26 ||
        tideMap.blocked(p, 0.3) ||
        tideMap.segment(old, p, 0.3) ||
        blockers.some((e) => distance(p, e) < 0.6) ||
        hazards.some((h) => tideHit(h, p, t, t - 0.05, 0.3, old))
      ) {
        safe = false;
        break;
      }
    }
    if (safe) return true;
  }
  return false;
}
