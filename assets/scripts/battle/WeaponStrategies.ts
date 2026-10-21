import type { Armory } from "./Armory";
import type { Skill } from "./SurvivalConfig";
export type WeaponFamily="support"|"extra"|"unlocked"|"core";
export interface WeaponStrategy { readonly family:WeaponFamily; cast(dt:number):void; }
export type WeaponStrategyTable=Record<Skill,WeaponStrategy>;
/** Family phases preserve mark -> damage, pooling and same-source overlap order. */
export const WEAPON_FAMILY_ORDER:readonly WeaponFamily[]=["support","extra","unlocked","core"];
/** Executable function strategies, created once per world. New Skill IDs require
 * an implementation here and a budget in WeaponBalance, enforced by TypeScript. */
export function createWeaponStrategies(a:Armory):WeaponStrategyTable {
 return {
  lamp:{family:"support",cast:dt=>a.support.castWeapon("lamp",dt)},
  needle:{family:"support",cast:dt=>a.support.castWeapon("needle",dt)},
  frost:{family:"extra",cast:dt=>a.extra.castWeapon("frost",dt)},
  lightning:{family:"extra",cast:dt=>a.extra.castWeapon("lightning",dt)},
  ghost:{family:"extra",cast:dt=>a.extra.castWeapon("ghost",dt)},
  bone:{family:"extra",cast:dt=>a.extra.castWeapon("bone",dt)},
  mine:{family:"extra",cast:dt=>a.extra.castWeapon("mine",dt)},
  void:{family:"extra",cast:dt=>a.extra.castWeapon("void",dt)},
  holy:{family:"extra",cast:dt=>a.extra.castWeapon("holy",dt)},
  hammer:{family:"unlocked",cast:dt=>a.unlocked.castWeapon("hammer",dt)},
  wheel:{family:"unlocked",cast:dt=>a.unlocked.castWeapon("wheel",dt)},
  blade:{family:"core",cast:dt=>a.castWeapon("blade",dt)},
  fire:{family:"core",cast:dt=>a.castWeapon("fire",dt)},
  water:{family:"core",cast:dt=>a.castWeapon("water",dt)},
 };
}
