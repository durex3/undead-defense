/** Offline reference budgets. Fixed stage values never inspect the player's loadout
 * or live DPS. Reference DPS includes expected attack uptime and mitigation.
 * Recalibrate caps when equipment tiers change; do not extend an exponential
 * forever after the available equipment has reached its ceiling. */
export const STAGE_GROWTH = {
 normal:{baseHealth:1.65,outputGain:.4,timeStart:2,timeLimit:2.8,scale:6},
 elite:{baseHealth:1.85,outputGain:.4,timeStart:8,timeLimit:12,scale:6},
 boss:{dpsStart:343,dpsLimit:560,outputScale:5,timeStart:60,timeLimit:120,timeScale:6},
} as const;
const approach=(stage:number,scale:number)=>-Math.expm1(-(stage-1)/scale);
/** Design targets, not timers, hard kill limits or guarantees for every build. */
export function stageReference(stage:number) {
 if(!Number.isSafeInteger(stage)||stage<1)throw Error("Invalid stage growth index");
 const {normal,elite,boss}=STAGE_GROWTH;
 const normalProgress=approach(stage,normal.scale),eliteProgress=approach(stage,elite.scale);
 return {
  normalOutput:1+normal.outputGain*normalProgress,
  normalSeconds:normal.timeStart+(normal.timeLimit-normal.timeStart)*normalProgress,
  eliteOutput:1+elite.outputGain*eliteProgress,
  eliteSeconds:elite.timeStart+(elite.timeLimit-elite.timeStart)*eliteProgress,
  bossDps:boss.dpsStart+(boss.dpsLimit-boss.dpsStart)*approach(stage,boss.outputScale),
  bossSeconds:boss.timeStart+(boss.timeLimit-boss.timeStart)*approach(stage,boss.timeScale),
 };
}
export function stageGrowth(stage:number) {
 const r=stageReference(stage),{normal,elite}=STAGE_GROWTH;
 return {
  // Normalized output × time, anchored to the existing normal/elite baseline.
  // Spawn-time growth and enemy archetype coefficients still apply once.
  health:normal.baseHealth*r.normalOutput*r.normalSeconds/normal.timeStart,
  elite:elite.baseHealth*r.eliteOutput*r.eliteSeconds/elite.timeStart,
  bossHealth:r.bossDps*r.bossSeconds/(2800*3),
 };
}
/** Boss armor cannot be completely erased by carrying two fracture weapons. */
export const BOSS_FRACTURE_PER_LAYER=.15;
export const NORMAL_FRACTURE_PER_LAYER=.35;
