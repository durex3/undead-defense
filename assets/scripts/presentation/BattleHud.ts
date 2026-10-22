import { stageHud } from "./StageHud";
import { mapRouteHint } from "../battle/MapEncounters";
import { siegeHint } from "../battle/SiegeSystem";
import { combatWeaponEntries } from "../battle/WeaponStatus";
import { bossTimeForStage } from "../battle/EncounterPacing";
import type { SurvivalWorld } from "../battle/SurvivalWorld";
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
  accountCoins?: number,
) {
  const bossTime = bossTimeForStage(w.stageId);
  const stats = `Lv.${w.level}        ${w.time >= bossTime ? "首领战 " + clock(w.time - bossTime) : clock(w.time) + " / " + clock(bossTime)}        击败 ${w.kills}        生命 ${Math.ceil(w.hp)}${accountCoins === undefined ? "" : ` · 金币 ${accountCoins}`}`;
  const entries = combatWeaponEntries(w);
  const weapons = entries
    .map((entry, i) => entry + (i % 3 === 2 ? "\n" : "    "))
    .join("")
    .trim();
  const boss = w.enemies.find(
    (e) =>
      e.kind === "boss" && (e.hp > 0 || w.stageStrategy.lifecycle?.keep(e)),
  );
  const lateHazard = w.hazards.find((h) => h.damageLabel);
  const bossHazard =
    boss &&
    w.hazards
      .filter(
        (h) =>
          h.source === boss.id &&
          h.created <= w.time &&
          h.until > w.time &&
          !h.lead?.cancelled &&
          !h.eclipse?.cancelled &&
          !h.edge?.cancelled &&
          !h.kiln?.cancelled &&
          !h.loom?.cancelled &&
          !h.library?.cancelled &&
          !h.wind?.cancelled,
      )
      .sort(
        (a, b) =>
          Number(a.due <= w.time) - Number(b.due <= w.time) || a.due - b.due,
      )[0];
  const stage = stageHud(w, boss, bossHazard || undefined);
  const hint =
    stage.hint ??
    (lateHazard
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
                  : encounterBeat(w.time).name);
  const nova =
    w.ultimate > 0
      ? `全收经验 ${Math.ceil(w.ultimate)}s`
      : touchMode
        ? "全收经验"
        : "全收经验 [空格]";
  const group=w.stageStrategy.encounter?.();
  const bossHealth = group ? {ratio:group.remaining,label:stage.bossLabel} : boss
    ? {
        ratio: Math.max(0, Math.min(1, boss.hp / Math.max(1, boss.maxHp))),
        label: stage.bossLabel,
      }
    : null;
  const bossHint = stage.action
    ? stage.action
    : bossHazard
      ? `${bossHazard.damageLabel || "首领技能"} · ${bossHazard.due > w.time ? `${(bossHazard.due - w.time).toFixed(1)}秒后释放` : "释放中"} · ${stage.advice}`
      : boss && bossExposed(w, boss)
        ? "破绽！伤害 +25% · 抓紧反击"
        : hint;
  return {
    stats,
    weapons,
    hint: stage.progress && boss ? bossHint + " · " + stage.progress : bossHint,
    nova,
    bossHealth,
  };
}
