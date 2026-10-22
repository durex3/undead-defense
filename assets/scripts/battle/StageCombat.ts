import type { SurvivalWorld } from "./SurvivalWorld";
import type { Enemy, Point } from "./SurvivalTypes";
import { ENEMIES, isElite, isLarge, Kind } from "./SurvivalConfig";
import { bossExposed } from "./BossSystem";
import { siegeProjectileFactor } from "./SiegeSystem";
import {
  BOSS_FRACTURE_PER_LAYER,
  NORMAL_FRACTURE_PER_LAYER,
} from "./StageGrowth";
/** Stage-owned rules run before shared HP/statistics/death settlement. */
export interface StageCombat {
  incoming(
    e: Enemy,
    amount: number,
    origin: Point,
    projectile: boolean,
  ): number;
  onHit?(e: Enemy, source: string, dealt: number): void;
}
const exposure = (w: SurvivalWorld, e: Enemy) => (bossExposed(w, e) ? 1.25 : 1);
export function siegeCombat(w: SurvivalWorld): StageCombat {
  return {
    incoming(e, amount, origin, projectile) {
      amount *= bossExposed(w, e) && !e.siegeWall ? 1.25 : 1;
      if (
        w.tacticalBlessings.includes("skirmisher") &&
        Math.hypot(w.move.x, w.move.y) > 0.1
      )
        amount *= 1.25;
      if (w.tacticalBlessings.includes("slayer") && isLarge(e.kind))
        amount *= 1.3;
      if (projectile) {
        const factor = siegeProjectileFactor(w, e, origin);
        amount *= factor;
        if (factor < 1) w.effects.push({ type: "block", ...e });
      }
      if (e.siegeWall && e.state === "recover" && isLarge(e.kind))
        amount *= 1.25;
      if (
        (e.siegeShield ?? 0) > 0 &&
        (e.siegeShieldUntil ?? 0) > w.time &&
        w.enemies.some((o) => o.id === e.siegeShieldOwner && o.hp > 0)
      ) {
        const absorbed = Math.min(amount, e.siegeShield!);
        e.siegeShield! -= absorbed;
        amount -= absorbed;
      }
      return amount;
    },
  };
}
export function legacyCombat(
  w: SurvivalWorld,
  vulnerable: (e: Enemy) => boolean,
  eliteOnly = false,
): StageCombat {
  return {
    incoming(e, amount) {
      amount *= exposure(w, e);
      if (
        e.state === "recover" &&
        vulnerable(e) &&
        (eliteOnly ? isElite(e.kind) : !bossExposed(w, e))
      )
        amount *= 1.25;
      return amount;
    },
  };
}
export function armoredCombat(
  w: SurvivalWorld,
  faction: (kind: Kind) => boolean,
  vulnerable: (e: Enemy) => boolean,
  onHit?: StageCombat["onHit"],
  armorOverride?: (e:Enemy)=>number|undefined,
): StageCombat {
  return {
    onHit,
    incoming(e, amount) {
      amount *= exposure(w, e);
      const exposed = vulnerable(e),
        base = armorOverride?.(e) ?? (
          e.kind === "boss"
            ? 0.55
            : isElite(e.kind)
              ? 0.5
              : (ENEMIES[e.kind].armor ?? (faction(e.kind) ? 0.35 : 0)));
      const fracture = (e.fractureUntil ?? 0) > w.time ? (e.fracture ?? 0) : 0;
      const armor = Math.max(
        0,
        base -
          fracture *
            (e.kind === "boss"
              ? BOSS_FRACTURE_PER_LAYER
              : NORMAL_FRACTURE_PER_LAYER),
      );
      amount *=
        1 -
        Math.min(
          armor,
          e.state === "recover" && exposed
            ? e.kind === "boss"
              ? 0.15
              : 0.2
            : 1,
        );
      if (isElite(e.kind) && exposed && e.state === "recover") amount *= 1.25;
      return amount;
    },
  };
}
