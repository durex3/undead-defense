import {observatoryHint} from "../battle/ObservatorySystem";
import {arsenalHint} from "../battle/ArsenalSystem";
import {harborHint} from "../battle/HarborSystem";
import { furnaceForecast } from "../battle/FurnaceEncounters";
import { BOSS_TIME } from "../battle/EncounterPacing";
import type { SurvivalWorld } from "../battle/SurvivalWorld";
import { WEAPONS as SKILLS, EVOLUTIONS, NAMES as names } from "../battle/SurvivalConfig";
import { STAGES } from "../battle/StageRules";
import { KING_PHASES } from "../battle/KingBossSystem";
import { bossExposed } from "../battle/BossSystem";
import { encounterBeat } from "../battle/EncounterPacing";

export function clock(t: number) {
  return `${Math.floor(t / 60).toString().padStart(2, "0")}:${Math.floor(t % 60).toString().padStart(2, "0")}`;
}
/** Pure HUD content, independent of Cocos nodes and input handling. */
export function battleHud(w: SurvivalWorld, touchMode: boolean, visiblePotions: readonly {x: number; y: number}[]) {
    const stats = `Lv.${w.level}                 ${w.time >= BOSS_TIME ? "首领战 " + clock(w.time - BOSS_TIME) : clock(w.time) + " / 08:00"}                 击败 ${w.kills}                 生命 ${Math.ceil(w.hp)}`;
    const weapons = SKILLS.filter((k) => w.skills[k])
      .map((k) => `${w.evolutions[k] ? EVOLUTIONS[k].find(e => e.id === w.evolutions[k])?.name || names[k] : names[k]} ${w.evolutions[k] ? "★" : w.skills[k]}`)
      .join("    ");
    const boss = w.enemies.find((e) => e.kind === "boss" && e.hp > 0);
    const lateHazard = w.stageId >= 6 ? w.hazards.find(h=>h.damageLabel) : undefined;
    const furnaceHint=w.stageId===6 ? furnaceForecast(w.time,w.furnaceRoute) : null;
    const hint = lateHazard ? `${lateHazard.damageLabel} · ${lateHazard.kind === "starLeap" ? "落点已锁定，落地后反击" : lateHazard.kind === "starTrace" ? (lateHazard.damageLabel === "断路星刃" ? "有限星线，离开亮起边界" : "旧路线已锁定，避免立即折返") : lateHazard.kind === "bellRing" ? "空心环内侧安全" : lateHazard.kind === "bellPulse" ? "实心圆向外躲避" : "预警位置已锁定，横向离开"}` : boss
      ? `${STAGES[w.stageId].boss} · ${w.stageId===5 ? KING_PHASES[boss.bossPhase] : boss.bossPhase === 2 ? "狂怒" : "第一阶段"} · 生命 ${Math.ceil((boss.hp / boss.maxHp) * 100)}%  |  ${bossExposed(w, boss) ? "破绽！伤害 +25%" : boss.state === "windup" ? "蓄力中 · 准备躲避" : "留意预警，等待反击机会"}`
      : w.stageId >= 4 && w.hazards.some(h=>h.kind==="bellRing") ? "幽钟共振 · 内圈和环带外侧安全"
      : (w.stageId === 3 || w.stageId === 5) && w.hazards.some(h=>h.kind==="flame") ? "祭坛熔火 · 避开亮起的火区" : !w.hazards.length && w.hp >= w.maxHp && visiblePotions.some(p=>Math.hypot(p.x-w.player.x,p.y-w.player.y)<1.2) ? "生命已满 · 药水可留待受伤后拾取" : w.time < 12 ? (touchMode ? "拖动移动 · 靠近绿色结晶升级 · 自动攻击" : "WASD移动 · 靠近绿色结晶升级 · 自动攻击") : w.time < 30 && w.weaponCount < 2 ? "下一次升级可学习副武器 · 也可继续专修主武器" : furnaceHint || (w.stageId===10?observatoryHint(w.time):w.stageId===9?arsenalHint(w.time):w.stageId===8?harborHint(w.time):encounterBeat(w.time).name);
    const nova =
      w.ultimate > 0 ? `全收经验 ${Math.ceil(w.ultimate)}s` : touchMode ? "全收经验" : "全收经验 [空格]";
  return {stats, weapons, hint, nova};
}
