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
  if (w.stageId === 4) {
    w.moon.stepEnemy(e, dt);
    return;
  }
  if (w.stageId === 3) {
    w.thunder.stepEnemy(e, dt);
    return;
  }
  if (w.stageId === 2) {
    w.sand.stepEnemy(e, dt);
    return;
  }
  w.siege.stepBoss(e, dt);
}
