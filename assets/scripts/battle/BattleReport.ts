import { STAGES } from "./StageRules";
import { weaponStatus } from "./WeaponStatus";
import type { SurvivalWorld } from "./SurvivalWorld";
import { WEAPONS, NAMES, ENEMIES, EVOLUTIONS, Kind, WEAPON_TAGS, SYNTHESIS_RECIPES } from "./SurvivalConfig";
export function battleReport(w: SurvivalWorld) {
  const total = Object.values(w.damage).reduce((a, b) => a + b, 0);
  const rows = WEAPONS.filter((s) => w.skills[s] > 0)
    .map((s) => ({
      skill: s,
      name: NAMES[s],
      damage: w.damage[s] || 0,
      kills: w.weaponKills[s] || 0,
      share: total > 0 ? (w.damage[s] || 0) / total : 0,
      stage: `${w.skills[s]}级${weaponStatus(w,s).branch ? " "+weaponStatus(w,s).icons+weaponStatus(w,s).branch : ""}`,
      status: weaponStatus(w,s),
      tags: WEAPON_TAGS[s],
    }))
    .sort((a, b) => b.damage - a.damage);
  const combinations = Object.entries(w.combinations.stats).map(([skill, stats]) => ({
    skill: skill as keyof typeof SYNTHESIS_RECIPES,
    name: `${NAMES[skill as keyof typeof SYNTHESIS_RECIPES]}＋${NAMES[SYNTHESIS_RECIPES[skill as keyof typeof SYNTHESIS_RECIPES]!]}`,
    damage: stats.damage,
    triggers: stats.triggers,
  })).sort((a,b)=>b.damage-a.damage);
  const comboDamage = combinations.reduce((sum,row)=>sum+row.damage,0);
  const comboTriggers = combinations.reduce((sum,row)=>sum+row.triggers,0);
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
    retryTip: w.stageId === 10 ? "星痕锁定旧路线，换线时避免立刻折返；坠星落地后贴近反击，基座不挡星痕" : w.stageId === 9 ? "旗手加速不叠加，可绕侧拆除；弩线锁定后横移，统领扫击侧后与插旗时可反击" : w.stageId === 8 ? "成排敌人可绕侧或贯穿；落锚锁定后离圈，船长撞货堆后可反击" : w.stageId === 6
      ? (/熔|锻/.test(w.lastDamageSource) ? "熔流预警后横向离开；尝试随身圣潮维持移动输出" : boss ? "监工恢复时集中输出；尝试幽灵＋蝙蝠，持续伤害可绕过蓄力护甲" : "盾兵正面会格挡；尝试圣水＋毒雾或骨矛＋地雷清群")
      : w.stageId === 7
      ? (/裂|夜/.test(w.lastDamageSource) ? "空心环内侧安全，实心圆需向外躲；两次预警分别判断" : boss ? "织主恢复时追击；尝试幽灵＋蝙蝠或雷电＋冰环" : "横移躲箭，控制与分散清群可减压；尝试雷电＋冰环或镰刀＋战斧")
      : /毒|火|焰|钟|震|碎骨/.test(w.lastDamageSource)
      ? "离开亮起的危险区域，持续移动"
      : /箭|mage|archer/.test(w.lastDamageSource)
        ? "横向移动躲开远程攻击，优先清理射手"
        : "沿怪群边缘绕行，利用全收经验补充成长",
    deathSource: losses.find(l=>l.key===w.lastDamageSource)?.name || w.lastDamageSource,
    phase: boss?.bossPhase || 0,
    bossRemaining: boss ? Math.ceil(boss.hp / boss.maxHp * 100) : null,
    total,
    combinations,
    comboDamage,
    comboTriggers,
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
