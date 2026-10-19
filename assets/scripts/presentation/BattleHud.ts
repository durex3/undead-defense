import { moonHint } from "../battle/MoonSystem";
import { thunderHint } from "../battle/ThunderSystem";
import { mapRouteHint } from "../battle/MapEncounters";
import { sandHint } from "../battle/SandSystem";
import { siegeHint } from "../battle/SiegeSystem";
import { combatWeaponEntries } from "../battle/WeaponStatus";
import { bossTimeForStage } from "../battle/EncounterPacing";
import type { SurvivalWorld } from "../battle/SurvivalWorld";
import {
  WEAPONS as SKILLS,
  isElite,
  NAMES as names,
} from "../battle/SurvivalConfig";
import { STAGES } from "../battle/StageRules";
import { bossExposed } from "../battle/BossSystem";
import { encounterBeat } from "../battle/EncounterPacing";

export function clock(t: number) {
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
}
/** Pure HUD content, independent of Cocos nodes and input handling. */
export function battleHud(
  w: SurvivalWorld,
  touchMode: boolean,
  visiblePotions: readonly { x: number; y: number }[],
) {
  const bossTime = bossTimeForStage(w.stageId);
  const stats = `Lv.${w.level}                 ${w.time >= bossTime ? "首领战 " + clock(w.time - bossTime) : clock(w.time) + " / " + clock(bossTime)}                 击败 ${w.kills}                 生命 ${Math.ceil(w.hp)}`;
  const entries = combatWeaponEntries(w);
  const weapons = entries
    .map((entry, i) => entry + (i % 3 === 2 ? "\n" : "    "))
    .join("")
    .trim();
  const boss = w.enemies.find((e) => e.kind === "boss" && e.hp > 0);
  const lateHazard = w.hazards.find((h) => h.damageLabel);
  const hint = w.stageId === 4
    ? moonHint(w)
    : w.stageId === 3
      ? thunderHint(w)
      : lateHazard
        ? `${lateHazard.damageLabel} · 预警位置已锁定，横向离开`
        : boss
          ? `${STAGES[w.stageId].boss} · ${boss.bossPhase === 2 ? "狂怒" : "第一阶段"} · 生命 ${Math.ceil((boss.hp / boss.maxHp) * 100)}%  |  ${bossExposed(w, boss) ? "破绽！伤害 +25%" : boss.state === "windup" ? "蓄力中 · 准备躲避" : "留意预警，等待反击机会"}`
          : !w.hazards.length &&
              w.hp >= w.maxHp &&
              visiblePotions.some(
                (p) => Math.hypot(p.x - w.player.x, p.y - w.player.y) < 1.2,
              )
            ? "生命已满 · 药水可留待受伤后拾取"
            : w.time < 12
              ? touchMode
                ? "拖动移动 · 靠近绿色结晶升级 · 自动攻击"
                : "WASD移动 · 靠近绿色结晶升级 · 自动攻击"
              : w.time < 30 && w.weaponCount < 2
                ? "下一次升级可学习副武器 · 也可继续专修主武器"
                : w.stageId === 2
                  ? mapRouteHint(2, w.time)
                  : w.stageId === 1
                    ? siegeHint(w.time)
                    : encounterBeat(w.time).name;
  const nova =
    w.ultimate > 0
      ? `全收经验 ${Math.ceil(w.ultimate)}s`
      : touchMode
        ? "全收经验"
        : "全收经验 [空格]";
  const bossHealth = boss
    ? {
        ratio: Math.max(0, Math.min(1, boss.hp / Math.max(1, boss.maxHp))),
        label: `${STAGES[w.stageId].boss} · ${boss.bossPhase >= 2 ? "狂怒" : "第一阶段"} · ${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)}`,
      }
    : null;
  return { stats, weapons, hint, nova, bossHealth };
}
