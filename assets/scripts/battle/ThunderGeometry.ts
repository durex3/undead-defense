import type { Hazard, Point } from "./SurvivalTypes";
import type { SurvivalWorld } from "./SurvivalWorld";
import { thunderMap } from "./ThunderMap";
/** Geometry shared by damage, warnings and time-dependent escape sampling. */
export function thunderContains(h: Hazard, p: Point, time: number, r = 0.3) {
  const t = h.thunder;
  if (!t || time < h.due || time >= h.until) return false;
  const dx = p.x - h.x,
    dy = p.y - h.y,
    c = Math.cos(h.angle),
    s = Math.sin(h.angle);
  const u = dx * c + dy * s,
    v = -dx * s + dy * c;
  if (t.shape === "wall") {
    const front = Math.min(
      t.travel ?? 6,
      Math.max(0, time - h.due) * (t.speed ?? 2.8),
    );
    return (
      Math.abs(u - front) <= h.width / 2 + r &&
      Math.abs(v) <= h.radius / 2 + r &&
      Math.abs(v - (t.gap ?? 0)) > 1.8 - r
    );
  }
  if (t.shape === "line")
    return Math.abs(u) <= h.radius / 2 + r && Math.abs(v) <= h.width + r;
  if (t.shape === "sector")
    return (
      Math.hypot(dx, dy) < h.radius + r &&
      Math.abs(Math.atan2(v, u)) < h.width / 2
    );
  return Math.hypot(dx, dy) < h.radius + r;
}
/** Fixed-speed time samples; an engineering check, not an exhaustive path proof. */
export function thunderEscape(w: SurvivalWorld, pending: readonly Hazard[]) {
  const hazards = [...w.hazards.filter((h) => h.until > w.time), ...pending];
  const horizon = Math.min(
    7,
    Math.max(1.5, ...hazards.map((h) => h.until - w.time)),
  );
  const targets: Point[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16;
    targets.push({
      x: w.player.x + Math.cos(a) * 4.2 * horizon,
      y: w.player.y + Math.sin(a) * 4.2 * horizon,
    });
  }
  // Include both fixed gap centers as additional straight-path destinations.
  for (const h of pending)
    if (h.thunder?.shape === "wall") {
      const c = Math.cos(h.angle),
        s = Math.sin(h.angle),
        gap = h.thunder.gap ?? 0;
      targets.push({ x: w.player.x - s * gap, y: w.player.y + c * gap });
    }
  targets.push({ ...w.player });
  return targets.some((target) => {
    let p = { ...w.player };
    for (let dt = 0.05; dt <= horizon + 0.001; dt += 0.05) {
      if (dt > 0.35) {
        const dx = target.x - p.x,
          dy = target.y - p.y,
          d = Math.hypot(dx, dy),
          m = Math.min(d, 4.2 * 0.05);
        if (d > 0) {
          p.x += (dx / d) * m;
          p.y += (dy / d) * m;
        }
      }
      if (
        Math.abs(p.x) > 22 ||
        Math.abs(p.y) > 26 ||
        thunderMap.blocked(p, 0.3)
      )
        return false;
      if (
        dt < 1.5 &&
        w.enemies.some(
          (e) =>
            e.hp > 0 &&
            e.state !== "arriving" &&
            e.kind !== "thunderanchor" &&
            e.kind !== "gridelectrode" &&
            Math.hypot(e.x - p.x, e.y - p.y) < 0.65,
        )
      )
        return false;
      if (hazards.some((h) => h.thunder && thunderContains(h, p, w.time + dt)))
        return false;
    }
    return true;
  });
}
