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
  const adaptive=w.stageStrategy.adaptiveBossPositioning;
  if(adaptive&&w.bossTactics.approach(e,dt))return;
  const pattern=e.pattern,wasSeeking=e.state==="seek";
  w.stageStrategy.stepBoss(e, dt);
  // A geometrically impossible beat must not pin the boss to that same beat forever.
  if(adaptive&&wasSeeking&&e.state==="recover"&&e.pattern===pattern&&!w.hazards.some(h=>h.source===e.id&&h.until>w.time))e.pattern++;

}
