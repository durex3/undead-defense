import type { SurvivalWorld } from "./SurvivalWorld";
import { EVOLUTIONS, MAX_SKILL_LEVEL, NAMES, SYNTHESIS_RECIPES, Skill, WEAPONS } from "./SurvivalConfig";

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
    label:combinationLabel(main), ready:w.combinations.ready(main),
    progress:`${w.skills[main]}/10＋${w.skills[SYNTHESIS_RECIPES[main]!]}/10`,
  }));
}

/** Branch selection and two-weapon synergy are independent facts. */
export function weaponStatus(w: SurvivalWorld, skill: Skill) {
  const main = SYNTHESIS_RECIPES[skill] ? skill : WEAPONS.find(s=>SYNTHESIS_RECIPES[s]===skill);
  const partner = main ? (main === skill ? SYNTHESIS_RECIPES[main] : main) : undefined;
  const branch = EVOLUTIONS[skill].find(e=>e.id===w.evolutions[skill]);
  const combined = !!main && w.combinations.ready(main);
  const icons = `${branch ? "◇" : ""}${combined ? "∞" : ""}`;
  const condition = combined ? `∞ ${combinationLabel(main!)}`
    : partner ? `组合需双方10级：${NAMES[partner]} ${w.skills[partner]}/${MAX_SKILL_LEVEL}` : "";
  return { level: w.skills[skill], branch: branch?.name, combined, icons, condition };
}
