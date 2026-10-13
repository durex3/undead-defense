import type { SurvivalWorld } from "./SurvivalWorld";
import { EVOLUTIONS, MAX_SKILL_LEVEL, NAMES, SYNTHESIS_RECIPES, Skill, WEAPONS, independentBranch } from "./SurvivalConfig";

export const COMBINATION_NAMES: Partial<Record<Skill,string>> = {
  fire:"烈焰刀轮", lightning:"冰雷碎击", scythe:"双月收割", ghost:"噬魂军势",
  water:"水毒净化", meteor:"陨星坍缩", bone:"骨雷震爆", chain:"天火审判", totem:"亡魂祭坛",
};
export function combinationLabel(main: Skill) {
  return `${NAMES[main]}＋${NAMES[SYNTHESIS_RECIPES[main]!]!} → ${COMBINATION_NAMES[main]}`;
}
export function combinationRecipes(w: SurvivalWorld) {
  return WEAPONS.filter(main=>!!SYNTHESIS_RECIPES[main]).map(main=>({
    main, partner:SYNTHESIS_RECIPES[main]!, name:COMBINATION_NAMES[main]!,
    blocked:!w.combinations.eligible(main), label:combinationLabel(main), ready:w.combinations.ready(main),
    progress:`${w.skills[main]}/10＋${w.skills[SYNTHESIS_RECIPES[main]!]}/10`,
  }));
}
export function combatWeaponEntries(w:SurvivalWorld) {
  const used=new Set<Skill>(),entries:string[]=[];
  for(const skill of WEAPONS){
    if(!w.skills[skill]||used.has(skill))continue;
    const main=SYNTHESIS_RECIPES[skill]?skill:WEAPONS.find(s=>SYNTHESIS_RECIPES[s]===skill);
    if(main&&w.combinations.ready(main)){
      used.add(main);used.add(SYNTHESIS_RECIPES[main]!);
      entries.push(`${COMBINATION_NAMES[main]} ∞`);
    }else{used.add(skill);entries.push(`${NAMES[skill]} ${w.skills[skill]}级${weaponStatus(w,skill).icons}`);}
  }
  return entries;
}

/** Branch selection and two-weapon synergy are independent facts. */
export function weaponStatus(w: SurvivalWorld, skill: Skill) {
  const main = SYNTHESIS_RECIPES[skill] ? skill : WEAPONS.find(s=>SYNTHESIS_RECIPES[s]===skill);
  const partner = main ? (main === skill ? SYNTHESIS_RECIPES[main] : main) : undefined;
  const branch = EVOLUTIONS[skill].find(e=>e.id===w.evolutions[skill]);
  const combined = !!main && w.combinations.ready(main);
  const independent=independentBranch(skill,w.evolutions[skill]);
  const icons = `${independent ? "◆" : branch ? "◇" : ""}${combined ? "∞" : ""}`;
  const condition = independent ? "◆ 独立进化 · 不参与组合" : main && !w.combinations.eligible(main) ? "配方伙伴已选独立进化，不参与组合" : combined ? `∞ ${combinationLabel(main!)}`
    : partner ? `组合需双方10级：${NAMES[partner]} ${w.skills[partner]}/${MAX_SKILL_LEVEL}` : "";
  return { level: w.skills[skill], branch: branch?.name, combined, icons, condition };
}

/** Upgrade-card recipe hint, symmetric for either member of a pair. */
export function upgradeSynergy(w: SurvivalWorld, skill: Skill) {
  const main=SYNTHESIS_RECIPES[skill]?skill:WEAPONS.find(s=>SYNTHESIS_RECIPES[s]===skill);
  if(!main)return {owned:false,text:""};
  const partner=main===skill?SYNTHESIS_RECIPES[main]!:main;
  const owned=w.skills[partner]>0;
  if(!w.combinations.eligible(main))return {owned,text:"◆ 已选独立进化\n此配方不再触发超武联动"};
  return {owned,text:`${owned?"已拥有":"搭配"} ${NAMES[partner]}${owned?` ${w.skills[partner]}级`:""}\n∞ ${COMBINATION_NAMES[main]} · 双方第一分支＋10级联动`};
}

export function upgradeInventory(w: SurvivalWorld) {
  const entries=WEAPONS.filter(s=>w.skills[s]>0).map(s=>`${NAMES[s]} ${w.skills[s]}级${weaponStatus(w,s).icons}`);
  return `已装备 ${entries.length}/${w.weaponSlots} · ${entries.slice(0,3).join("   ")}${entries.length>3?"\n"+entries.slice(3).join("   "):""}`;
}
