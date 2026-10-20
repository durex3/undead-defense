import type { Point, Hazard } from "./SurvivalTypes";
import { distance, segmentDistance } from "./SurvivalTypes";
import type { PrismPath } from "./PrismMap";
import { prismMap } from "./PrismMap";
import type { SurvivalWorld } from "./SurvivalWorld";
export interface PrismHazard {
  shape: "bolt" | "core";
  path: PrismPath;
  speed: number;
  order: number;
  last: number;
  player: Point;
  hit: boolean;
  entity?: number;
  cut?: number;
  preview?: boolean;
}
export function prismHead(h: Hazard, t: number): Point {
  const b = h.prism!,
    p = b.path;
  let d = Math.min(b.cut ?? p.total, Math.max(0, t - h.due) * b.speed);
  for (let i = 0; i < p.lengths.length; i++) {
    if (d <= p.lengths[i] || i === p.lengths.length - 1) {
      const a = p.points[i],
        z = p.points[i + 1],
        f = Math.min(1, d / p.lengths[i]);
      return { x: a.x + (z.x - a.x) * f, y: a.y + (z.y - a.y) * f };
    }
    d -= p.lengths[i];
  }
  return { ...p.points[0] };
}
/** Split at the exact reflection time, sweeping the player against each moving leg. */
export function prismHit(
  h: Hazard,
  p: Point,
  t: number,
  previous = t - 0.05,
  old: Point = p,
) {
  const b = h.prism!;
  if (t < h.due || previous > h.until) return false;
  const from = Math.max(previous, h.due),
    to = Math.min(t, h.until);
  if (from > to) return false;
  const times = [from, to];
  let length = 0;
  for (const n of b.path.lengths) {
    length += n;
    const at = h.due + length / b.speed;
    if (at > from && at < to && (b.cut === undefined || length < b.cut))
      times.push(at);
  }
  times.sort((a, b) => a - b);
  const player = (at: number) => {
    const f =
      t === previous
        ? 1
        : Math.max(0, Math.min(1, (at - previous) / (t - previous)));
    return { x: old.x + (p.x - old.x) * f, y: old.y + (p.y - old.y) * f };
  };
  for (let i = 0; i < times.length - 1; i++) {
    const a = prismHead(h, times[i]),
      z = prismHead(h, times[i + 1]),
      pa = player(times[i]),
      pz = player(times[i + 1]);
    if (
      segmentDistance(
        { x: 0, y: 0 },
        { x: a.x - pa.x, y: a.y - pa.y },
        { x: z.x - pz.x, y: z.y - pz.y },
      ) <=
      h.width + 0.3
    )
      return true;
  }
  if (from === to) return distance(prismHead(h, from), p) <= h.width + 0.3;
  return false;
}
export function prismEscape(w: SurvivalWorld, extra: Hazard[]) {
  const hazards = [
      ...w.hazards.filter((h) => h.prism && h.until > w.time),
      ...extra,
    ],
    until = Math.max(w.time + 0.1, ...hazards.map((h) => h.until)),
    actors = w.enemies.filter(
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
  for (const a of paths) {
    let p = { ...w.player },
      safe = true;
    for (let t = w.time; t <= until + 0.025; t += 0.05) {
      const old = { ...p },
        elapsed = t - w.time;
      if (elapsed > 0.35 && elapsed < a.stop) {
        const angle = a.angle + (elapsed > 1.6 ? a.turn : 0);
        p = {
          x: p.x + Math.cos(angle) * 4.2 * 0.05,
          y: p.y + Math.sin(angle) * 4.2 * 0.05,
        };
      }
      if (
        Math.abs(p.x) > 22 ||
        Math.abs(p.y) > 26 ||
        prismMap.blocked(p, 0.3) ||
        prismMap.segment(old, p, 0.3) ||
        actors.some((e) => distance(e, p) < 0.6) ||
        hazards.some((h) => prismHit(h, p, t, t - 0.05, old))
      ) {
        safe = false;
        break;
      }
    }
    if (safe) return true;
  }
  return false;
}
