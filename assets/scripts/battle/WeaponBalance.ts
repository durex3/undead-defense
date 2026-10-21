import type { Skill } from "./SurvivalConfig";
import type { WeaponGrade } from "./WeaponGrade";
/** Acceptance budgets, never a hidden runtime damage cap. Reference: 8th level,
 * ranger, no passives/mods, 30s high-HP target, native grade, armory only.
 * Utility weapons reserve damage budget for control, fracture or team effects. */
export const BALANCE_GRADE_FACTOR = [0,1,1.25,1.6,2.05] as const;
export const WEAPON_BALANCE: Record<Skill,{role:string; scene:"near"|"moving"; min:number; max:number}> = {
 blade:{role:"近身持续",scene:"near",min:70,max:120},
 fire:{role:"范围爆发",scene:"near",min:70,max:120},
 water:{role:"持续封路",scene:"near",min:60,max:100},
 frost:{role:"近身控制",scene:"near",min:40,max:65},
 lightning:{role:"分散清群",scene:"near",min:60,max:100},
 ghost:{role:"单体追杀",scene:"near",min:85,max:125},
 bone:{role:"纵列贯穿",scene:"near",min:85,max:125},
 mine:{role:"引怪陷阱",scene:"moving",min:75,max:115},
 void:{role:"聚怪辅助",scene:"near",min:30,max:45},
 holy:{role:"锁点重击",scene:"near",min:85,max:125},
 hammer:{role:"近身破甲",scene:"near",min:65,max:90},
 wheel:{role:"往返破甲",scene:"near",min:80,max:100},
 lamp:{role:"团队增伤",scene:"near",min:18,max:25},
 needle:{role:"传伤辅助",scene:"near",min:45,max:65},
};
export function weaponBalanceBand(skill: Skill, grade: WeaponGrade) {
 const p=WEAPON_BALANCE[skill],factor=BALANCE_GRADE_FACTOR[grade];
 return {min:p.min*factor,max:p.max*factor};
}
