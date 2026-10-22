import type { SurvivalWorld } from "./SurvivalWorld";
import type { Enemy } from "./SurvivalTypes";
import { ENEMIES, isLarge } from "./SurvivalConfig";
/** Local, bounded separation. Committed attacks and frozen actors never drift. */
export function separateCrowd(w: SurvivalWorld, dt: number) {
  const map = w.stageStrategy.map,
    grid = new Map<string, Enemy[]>();
  const active = new Set(
    w.hazards.filter((h) => h.until > w.time).map((h) => h.source),
  );
  const movable = (e: Enemy) =>
    e.hp > 0 &&
    ENEMIES[e.kind].speed > 0 &&
    e.state === "seek" &&
    !e.immovable &&
    e.freezeUntil <= w.time &&
    !e.sand?.buried &&
    !active.has(e.id);
  const radius = (e: Enemy) => (isLarge(e.kind) ? 0.65 : 0.35);
  for (const e of w.enemies) {
    if (!movable(e)) continue;
    const key = Math.floor(e.x) + "," + Math.floor(e.y),
      list = grid.get(key) || [];
    list.push(e);
    grid.set(key, list);
  }
  const spent = new Map<number, number>(),
    limit = Math.max(0, dt) * 1.2;
  function displace(e: Enemy, x: number, y: number, length: number) {
    const amount = Math.min(
      length,
      Math.max(0, limit - (spent.get(e.id) || 0)),
    );
    if (amount <= 0) return;
    const p = {
      x: Math.max(-22 + radius(e), Math.min(22 - radius(e), e.x + x * amount)),
      y: Math.max(-26 + radius(e), Math.min(26 - radius(e), e.y + y * amount)),
    };
    // Reject pushes through a solid boundary rather than resolving across it.
    if (
      map.segment(e, p, radius(e) - 0.001) ||
      map.blocked(p, radius(e) - 0.001)
    )
      return;
    e.x = p.x;
    e.y = p.y;
    spent.set(e.id, (spent.get(e.id) || 0) + amount);
  }
  const forces = new Map<Enemy, { x: number; y: number }>();
  function add(e: Enemy, x: number, y: number) {
    const f = forces.get(e) || { x: 0, y: 0 };
    f.x += x;
    f.y += y;
    forces.set(e, f);
  }
  for (const e of w.enemies) {
    if (!movable(e)) continue;
    const x = Math.floor(e.x),
      y = Math.floor(e.y);
    for (let a = x - 1; a <= x + 1; a++)
      for (let b = y - 1; b <= y + 1; b++)
        for (const o of grid.get(a + "," + b) || []) {
          if (o.id <= e.id) continue;
          const dx = e.x - o.x,
            dy = e.y - o.y,
            d = Math.hypot(dx, dy),
            gap = Math.min(0.9, radius(e) + radius(o));
          if (d >= gap) continue;
          const angle =
            ((e.id * 0.754877666 + o.id * 0.569840291) % 1) * Math.PI * 2;
          const nx = d > 1e-5 ? dx / d : Math.cos(angle),
            ny = d > 1e-5 ? dy / d : Math.sin(angle),
            amount = (gap - d) * 0.5;
          add(e, nx * amount, ny * amount);
          add(o, -nx * amount, -ny * amount);
        }
  }
  for (const [e, f] of forces) {
    const d = Math.hypot(f.x, f.y);
    if (d > 1e-8) displace(e, f.x / d, f.y / d, d);
  }
}
