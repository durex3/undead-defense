import { rankDamage, WEAPON_ROLES } from "./BuildProgression";
import type { SurvivalWorld } from "./SurvivalWorld";
import { Card, DESCRIPTIONS, BREAKTHROUGH_DESCRIPTIONS, EVOLUTIONS, MAX_SKILL_LEVEL, NAMES, SYNTHESIS_RECIPES, Skill, WEAPONS, independentBranch } from "./SurvivalConfig";

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

/** Compact upgrade copy: base-hit rank multiplier, not a promise of identical hit damage. */
export function upgradeChanges(w: SurvivalWorld, card: Card): string {
  if (card === "repair") return `生命 ${Math.round(w.hp)} → ${Math.round(Math.min(w.maxHp,w.hp+20))}`;
  if (!WEAPONS.includes(card as Skill)) {
    const lv=w.passives[card as keyof typeof w.passives];
    const values=card==="magnet"?[100,135,170]:[100,110,118];
    const cooldown=[100,90,82];
    const data=card==="hourglass"?cooldown:values;
    return `${card==="magnet"?"拾取范围":card==="boots"?"移动速度":"冷却时间"} ${data[lv]}% → ${data[Math.min(2,lv+1)]}%`;
  }
  const skill=card as Skill, lv=w.skills[skill], next=Math.min(10,lv+1);
  if(lv>=10)return "选择最终分支";
  if(!lv)return WEAPON_ROLES[skill]+"\n"+DESCRIPTIONS[skill][0];
  const lines:string[]=[];
  if(rankDamage(lv)!==rankDamage(next))lines.push(`伤害倍率 ${rankDamage(lv)} → ${rankDamage(next)}`);
  const early: Partial<Record<Skill,string[]>> = {
    water:["","圣水瓶 1 → 2 瓶","半径 1.6 → 1.9\n持续 4 → 5 秒","圣水瓶 2 → 3 瓶"],
    chain:["","最多连接 2 → 3 段","跳转距离 3 → 4\n锁链长度 4.8 → 6","持续 2.4 → 3.6 秒"],
    soul:["","最多连接 1 → 2 段","减速 25% → 40%\n跳转距离 3 → 4","持续 2.4 → 3.6 秒"],
    pillar:["","最多标记 1 → 2 处","半径 1.5 → 1.875","基础间隔 4.2 → 3.36 秒"],
    meteor:["","最多落点 1 → 2 处","半径 2 → 2.5","基础间隔 6 → 4.8 秒"],
    totem:["","图腾 1 → 2 座","射击间隔 1 → 0.75 秒","持续 5 → 7 秒"],
  };
  if(next<=4)lines.push(...(early[skill]?.[next-1]||DESCRIPTIONS[skill][next-1]).split("\n").slice(0,2));
  if(skill==="blade"&&next===5)lines.push("飞刀 3 → 4 把");
  if(next===7)lines.push(BREAKTHROUGH_DESCRIPTIONS[skill][1].replace("7级：","觉醒："));
  if(next===10)lines.push("解锁最终分支选择");
  return lines.slice(0,3).join("\n");
}

export function compactSynergy(w: SurvivalWorld, skill: Skill): string {
  const recipe=combinationRecipes(w).find(r=>r.main===skill||r.partner===skill);
  if(!recipe)return "";
  if(recipe.blocked)return "◆ 独立路线 · 不参与组合";
  const partner=recipe.main===skill?recipe.partner:recipe.main;
  return `${w.skills[partner]?"已拥有":"搭配"}${NAMES[partner]} → ${recipe.name}`;
}

export function weaponDetails(w: SurvivalWorld, skill: Skill): string {
  const status=weaponStatus(w,skill), lv=w.skills[skill];
  const branch=EVOLUTIONS[skill].find(e=>e.id===w.evolutions[skill]);
  const recipe=combinationRecipes(w).find(r=>r.main===skill||r.partner===skill);
  return [WEAPON_ROLES[skill],
    branch?`${status.icons} ${branch.name}\n${branch.description}`:["基础机制（1级）："+DESCRIPTIONS[skill][0],lv>=7?BREAKTHROUGH_DESCRIPTIONS[skill][1]:lv>1?DESCRIPTIONS[skill][lv-1]:""].filter(Boolean).join("\n"),
    `当前伤害倍率 ${rankDamage(lv)}（各次攻击另有系数）`,
    recipe?`${recipe.label}\n${status.condition}\n${recipe.progress} · ${recipe.blocked?"独立路线不参与组合":"双方第一分支满10级自动组合"}`:"",
  ].filter(Boolean).join("\n\n");
}
