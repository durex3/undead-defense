import { siegeMap } from "./SiegeMap";
import { sandMap } from "./SandMap";
import { hazardLaneContains } from "./HazardLane";
import { thunderMap } from "./ThunderMap";
import { angleDelta, segmentDistance } from "./SurvivalTypes";
import type { Hazard, Point } from "./SurvivalTypes";
import type { SurvivalWorld } from "./SurvivalWorld";

/** True when a hazard covers the point right now. Shared by all four stages. */
export function hazardContains(h: Hazard, p: Point) {
  if(h.kind==="frontierLane"||h.kind==="frontierImpact")return hazardLaneContains(h,p);
  const dx = p.x - h.x,
    dy = p.y - h.y,
    d = Math.hypot(dx, dy);
  if (h.kind === "flameLine")
    return (
      dx * Math.cos(h.angle) + dy * Math.sin(h.angle) >= 0 &&
      dx * Math.cos(h.angle) + dy * Math.sin(h.angle) <= h.radius &&
      Math.abs(-dx * Math.sin(h.angle) + dy * Math.cos(h.angle)) < h.width
    );
  if (h.kind === "sector")
    return d < h.radius && Math.abs(angleDelta(Math.atan2(dy, dx), h.angle)) < h.width / 2;
  return ["circle", "flame", "pool"].includes(h.kind) && d < h.radius;
}

function timedHit(h: Hazard, p: Point, time: number) {
  const age = Math.max(0, time - h.due),
    dx = Math.cos(h.angle),
    dy = Math.sin(h.angle);
  if (h.kind === "arrow" || h.kind === "line") {
    const speed =
      h.kind === "arrow" ? (h.projectileSpeed ?? 4.5) : h.radius / (h.until - h.due);
    const a = Math.max(0, age - 0.05) * speed,
      b = Math.min(h.radius, age * speed);
    return (
      segmentDistance(
        p,
        { x: h.x + dx * a, y: h.y + dy * a },
        { x: h.x + dx * b, y: h.y + dy * b },
      ) <
      (h.kind === "arrow"
        ? h.fixedDamage
          ? h.width
          : 0.4
        : h.siegeCharge
          ? h.width
          : 0.75)
    );
  }
  if (h.kind === "burst")
    return Array.from({ length: 8 }, (_, i) => h.angle + (i * Math.PI) / 4).some(
      (a) => Math.hypot(p.x - h.x - Math.cos(a) * age * 3, p.y - h.y - Math.sin(a) * age * 3) < 0.45,
    );
  return hazardContains(h, p);
}

/** Conservative straight-path sampling at base speed; no prediction of moving enemies. */
export function crownEscape(w: SurvivalWorld, candidates: Hazard[], avoidCrowd = false) {
  const blockers = avoidCrowd
    ? w.enemies.filter(
        (e) =>
          e.hp > 0 &&
          e.kind !== "boss" &&
          e.state !== "arriving" &&
          Math.hypot(e.x - w.player.x, e.y - w.player.y) < 8,
      )
    : [];
  const hazards = [...w.hazards, ...candidates];
  const horizon = Math.max(0.1, ...candidates.map((h) => h.until - w.time));
  const speed = Math.min(4.2, w.speed);
  for (let direction = -1; direction < 32; direction++) {
    const angle = direction * (Math.PI / 16);
    let safe = true;
    for (let t = 0; t <= horizon; t += 0.05) {
      const p = {
        x: w.player.x + (direction < 0 ? 0 : Math.cos(angle) * speed * t),
        y: w.player.y + (direction < 0 ? 0 : Math.sin(angle) * speed * t),
      };
      if (
        Math.abs(p.x) > 22 ||
        Math.abs(p.y) > 26 ||
        w.stageStrategy.map.blocked(p, 0.3)
      ) {
        safe = false;
        break;
      }
      if (
        t > 0.2 &&
        t < 1.5 &&
        Math.round(t / 0.05) % 4 === 0 &&
        blockers.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 1)
      ) {
        safe = false;
        break;
      }
      if (hazards.some((h) => w.time + t >= h.due && w.time + t < h.until && timedHit(h, p, w.time + t))) {
        safe = false;
        break;
      }
    }
    if (safe) return true;
  }
  return false;
}
