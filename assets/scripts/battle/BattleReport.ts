import { weaponName, gradeOf, GRADE_NAMES } from "./WeaponGrade";
import { STAGES } from "./StageRules";
import { weaponStatus } from "./WeaponStatus";
import type { SurvivalWorld } from "./SurvivalWorld";
import { ALL_WEAPONS as WEAPONS, NAMES, ENEMIES, Kind } from "./SurvivalConfig";
export function battleReport(w: SurvivalWorld) {
  const total = Object.values(w.damage).reduce((a, b) => a + b, 0);
  const rows = WEAPONS.filter((s) => w.skills[s] > 0)
    .map((s) => ({
      skill: s,
      name: `${GRADE_NAMES[gradeOf(s,w.weaponGrades)]} · ${weaponName(s,w.weaponGrades)}`,
      damage: w.damage[s] || 0,
      kills: w.weaponKills[s] || 0,
      share: total > 0 ? (w.damage[s] || 0) / total : 0,
      stage: `${w.skills[s]}级${weaponStatus(w,s).branch ? " "+weaponStatus(w,s).icons+weaponStatus(w,s).branch : ""}`,
      status: weaponStatus(w,s),

    }))
    .sort((a, b) => b.damage - a.damage);
  const losses = Object.entries(w.losses)
    .filter(([, v]) => v > 0)
    .map(([key, damage]) => ({
      key,
      name:
        (key === "boss"
          ? STAGES[w.stageId].boss
          : ENEMIES[key as Kind]?.name) ||
        (
          {
            boar冲锋: "野猪冲锋",
            charger冲锋: "铁蹄冲锋",
            wisp冲锋: "幽魂冲刺",
          } as Record<string, string>
        )[key] ||
        key,
      damage,
    }))
    .sort((a, b) => b.damage - a.damage);
  const boss = w.enemies.find(e=>e.kind === "boss" && e.hp > 0);
  return {
    retryTip: w.stageId===8?"看支点与摆向换侧；空心环刺可进内圈，实心花爆须退出；收招开缝时反击":w.stageId===7?"看折点与反射出口，晶核可打碎或侧移；别把反射柱当挡弹掩体，抓甲缝反击":w.stageId===6?"绕过潮墙端点回切；货垛截锚，细绳无伤；裂甲或收舷暴露时反击":w.stageId===5?"借钟台挡声浪，换侧避蜡印；收招时甲缝暴露，新武器裂甲可提高全队输出":w.stageId===4?'看回程双箭头，躲落点后准备换向；绕开正在旋转的角刃，猎王收招时反击':w.stageId===3?'电栅缺口提前锁定；拆电极断线，连续锁线逐拍横移，恢复时靠近反击':w.stageId===1?'弩线锁定后横移；绕盾侧面，利用骑将冲撞后的空档反击':'潜沙时换线；清理虫卵，抓住虫后出土的反击空档',
    deathSource: losses.find(l=>l.key===w.lastDamageSource)?.name || w.lastDamageSource,
    phase: boss?.bossPhase || 0,
    bossRemaining: boss ? Math.ceil(boss.hp / boss.maxHp * 100) : null,
    total,
    rows,
    losses,
    otherDamage: Math.max(
      0,
      total - rows.reduce((sum, r) => sum + r.damage, 0),
    ),
    otherKills: Math.max(
      0,
      w.kills - rows.reduce((sum, r) => sum + r.kills, 0),
    ),
  };
}
