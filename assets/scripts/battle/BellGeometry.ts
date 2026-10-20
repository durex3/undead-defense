import { bellMap, bellCovered } from "./BellMap";
import { angleDelta, distance, segmentDistance } from "./SurvivalTypes";
import type { Point, Hazard } from "./SurvivalTypes";
import type { SurvivalWorld } from "./SurvivalWorld";
export interface BellHazard {
  shape: "wave" | "wax" | "dash";
  order: number;
  hit: boolean;
  last: number;
  from: Point;
  to: Point;
  speed: number;
}
/** Same clock and shape are used by collision, safety checks and rendering. */
export function bellHit(
  h: Hazard,
  p: Point,
  t: number,
  previous = t - 0.05,
  r = 0.3,
) {
  const b = h.bell!;
  if (t < h.due || previous > h.until) return false;
  if (b.shape === "wax") return distance(p, h) < h.radius + r;
  if (b.shape === "dash") {
    const total = distance(b.from, b.to),
      a = Math.max(0, Math.min(total, (previous - h.due) * b.speed)),
      c = Math.max(0, Math.min(total, (t - h.due) * b.speed)),
      angle = h.angle;
    return (
      segmentDistance(
        p,
        {
          x: b.from.x + Math.cos(angle) * a,
          y: b.from.y + Math.sin(angle) * a,
        },
        {
          x: b.from.x + Math.cos(angle) * c,
          y: b.from.y + Math.sin(angle) * c,
        },
      ) <
      h.width + r
    );
  }
  const d = distance(h, p),
    lo = Math.max(0, (previous - h.due) * b.speed),
    hi = Math.min(h.radius, Math.max(0, t - h.due) * b.speed);
  return (
    d >= lo - h.width - r &&
    d <= hi + h.width + r &&
    Math.abs(angleDelta(Math.atan2(p.y - h.y, p.x - h.x), h.angle)) <=
      h.widthAngle! / 2 + Math.asin(Math.min(1, r / Math.max(r, d))) &&
    !bellCovered(h, p, r)
  );
}
/** Conservative finite paths; not a proof of human reachability in moving crowds. */
export function bellEscape(w: SurvivalWorld, candidates: Hazard[]) {
  const hazards = [
    ...w.hazards.filter((h) => h.bell && h.until > w.time),
    ...candidates,
  ];
  const until = Math.max(w.time, ...hazards.map((h) => h.until));
  for (let dir = -1; dir < 32; dir++) {
    const a = (dir * Math.PI) / 16;
    let safe = true;
    for (let t = w.time; t <= until + 0.025; t += 0.05) {
      const move = Math.max(0, t - w.time - 0.35) * 4.2,
        p =
          dir < 0
            ? { ...w.player }
            : {
                x: Math.max(-22, Math.min(22, w.player.x + Math.cos(a) * move)),
                y: Math.max(-26, Math.min(26, w.player.y + Math.sin(a) * move)),
              };
      if (
        bellMap.blocked(p, 0.3) ||
        bellMap.segment(w.player, p, 0.3) ||
        hazards.some((h) => bellHit(h, p, t)) ||
        w.enemies.some(
          (e) => e.hp > 0 && e.state === "seek" && distance(p, e) < 0.6,
        )
      ) {
        safe = false;
        break;
      }
    }
    if (safe) return true;
  }
  return false;
}
