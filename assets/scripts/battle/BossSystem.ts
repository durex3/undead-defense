import { isElite } from "./SurvivalConfig";
import type { SurvivalWorld } from "./SurvivalWorld";
import { Enemy } from "./SurvivalTypes";

export function bossExposed(w: SurvivalWorld, e: Enemy) {
  return (
    e.kind === "boss" &&
    e.state === "recover" &&
    !w.hazards.some((h) => h.source === e.id && h.until > w.time)
  );
}

/** Each playable stage owns its boss behaviour. */
export function stepBoss(w: SurvivalWorld, e: Enemy, dt: number) {
  if (w.enemies.some((o) => o.hp > 0 && isElite(o.kind))) {
    w.bossEliteRestUntil = w.time + 3;
    return;
  }
  if (w.time < w.bossEliteRestUntil) return;
  w.stageStrategy.stepBoss(e, dt);
}
