import type { ExtraAttack } from "./ExtraArmory";
import type { WeaponStats } from "./ArmoryConfig";
import type { Enemy, Point } from "./SurvivalTypes";
export type ExtraDamageBucket = Map<number, { a: ExtraAttack; damage: number }>;
export interface ExtraBehaviorPort {
  enemies(origin: Point, range: number): Enemy[];
  damage(
    enemy: Enemy,
    amount: number,
    attack: ExtraAttack,
    origin?: Point,
  ): void;
  attacks(): readonly ExtraAttack[];
}
export interface ExtraCastContext {
  target: Enemy;
  targets: Enemy[];
  count: number;
  stats: WeaponStats;
}
/** Weapon hooks operate on pooled attacks; the coordinator owns allocation and update order. */
export interface ExtraBehavior {
  count?(stats: WeaponStats): number;
  prefersThreat?(stats: WeaponStats): boolean;
  aim?(stats: WeaponStats, target: Enemy): number;
  initialize?(attack: ExtraAttack, context: ExtraCastContext): void;
  step(
    attack: ExtraAttack,
    dt: number,
    ticks: ExtraDamageBucket,
    ends: ExtraDamageBucket,
  ): void;
}
