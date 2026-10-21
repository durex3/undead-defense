import { SUPPORT_MODS, supportBase, applySupportMods } from "./SupportConfig";
import { gradeMultiplier } from "./WeaponGrade";
import { UNLOCK_MODS, unlockBase, applyUnlockMods } from "./UnlockConfig";
import {
  EXTRA_MODS,
  extraBase,
  applyExtraMods,
  ExtraSkill,
} from "./ExtraArmoryConfig";
import type { SurvivalWorld } from "./SurvivalWorld";
import { Skill, Passive, NAMES } from "./SurvivalConfig";
export interface WeaponMod {
  id: string;
  name: string;
  short: string;
  effect: string;
  cost: string;
  excludes?: string;
  glyph: string;
}
export const MODS: Record<Skill, readonly WeaponMod[]> = {
  ...EXTRA_MODS,
  ...SUPPORT_MODS,
  ...UNLOCK_MODS,
  blade: [
    {
      id: "orbit",
      name: "扩阵巡刃",
      short: "扩阵",
      effect: "环绕半径从1.9扩大到2.7，覆盖更外侧追兵",
      cost: "单刀伤害−20%；脚边仍需走位",
      excludes: "hunt",
      glyph: "◎",
    },
    {
      id: "hunt",
      name: "追猎穿刺",
      short: "追猎",
      effect: "刀刃离阵远射，追踪精英与远程，最多穿过2人",
      cost: "失去绕身刀阵；伤害−15%；转向速度有限",
      excludes: "orbit",
      glyph: "➤",
    },
    {
      id: "return",
      name: "往返切线",
      short: "往返",
      effect: "刀阵先扩张再收拢；追猎刀则沿锁定路线折返",
      cost: "单次伤害−20%；回程需安排走位",
      glyph: "↶",
    },
    {
      id: "shards",
      name: "碎刃散射",
      short: "碎刃",
      effect: "终结时沿刀刃当前飞行方向分出2把短程碎刃",
      cost: "主刀伤害−15%；碎刃每轮只出一组",
      glyph: "⋔",
    },
  ],
  fire: [
    {
      id: "heavy",
      name: "蓄能重爆",
      short: "重爆",
      effect: "内圈伤害×1.8，外圈×1.25，半径×1.5",
      cost: "攻击周期×1.3；先蓄能再发射",
      excludes: "salvo",
      glyph: "◉",
    },
    {
      id: "salvo",
      name: "连珠轰击",
      short: "连珠",
      effect: "一轮分三段连发，主火球数+2",
      cost: "每发伤害−48%，半径−15%",
      excludes: "heavy",
      glyph: "≋",
    },
    {
      id: "embers",
      name: "碎焰散射",
      short: "碎焰",
      effect: "主爆炸向外散出2枚燃烧碎片",
      cost: "主爆炸伤害−30%；碎片不再散射",
      glyph: "✹",
    },
    {
      id: "flame",
      name: "落地火海",
      short: "火海",
      effect: "主爆炸留2.6秒火区，敌人停留才受伤",
      cost: "即时爆炸伤害−25%；同源重叠不叠伤",
      glyph: "♨",
    },
  ],
  water: [
    {
      id: "spring",
      name: "圣泉扩张",
      short: "圣泉",
      effect: "固定水区由45%扩大到165%半径",
      cost: "起始范围小；转场后需重新铺设",
      excludes: "wave",
      glyph: "◌",
    },
    {
      id: "wave",
      name: "奔流推进",
      short: "奔流",
      effect: "水区变为向前推进的宽水波",
      cost: "每跳伤害−20%；不留在原落点",
      excludes: "spring",
      glyph: "≈",
    },
    {
      id: "recall",
      name: "潮汐回涌",
      short: "回涌",
      effect: "后半段回流；追上敌人后减速维持覆盖，保留完整持续时间",
      cost: "水区离开原落点；回收点锁定，不持续跟随玩家",
      glyph: "↩",
    },
    {
      id: "pulse",
      name: "水爆脉冲",
      short: "水爆",
      effect: "连续伤害改为每秒一次可见水爆",
      cost: "爆发之间没有伤害；不附加控制",
      glyph: "✧",
    },
  ],
};
export function modInfo(skill: Skill, id: string) {
  return MODS[skill].find((m) => m.id === id);
}
export function modReason(w: SurvivalWorld, skill: Skill, id: string) {
  const m = modInfo(skill, id);
  if (!m) return "无效改造";
  if (w.mods[skill].includes(id)) return "已安装";
  if (w.mods[skill].length >= 2) return "两个改造槽已满";
  if (m.excludes && w.mods[skill].includes(m.excludes))
    return `与${modInfo(skill, m.excludes)!.short}互斥`;
  return "";
}
export function playerAttributes(w: SurvivalWorld) {
  const p = w.passives;
  return {
    damage: Math.min(0.6, p.power * 0.1 + (w.character === "ranger" ? 0.1 : 0)),
    cooldown: Math.min(
      0.4,
      p.hourglass * 0.06 + (w.character === "necromancer" ? 0.08 : 0),
    ),
    area:
      1 +
      Math.min(0.6, p.area * 0.1 + (w.character === "alchemist" ? 0.15 : 0)),
    duration:
      1 +
      Math.min(
        0.6,
        p.duration * 0.1 + (w.character === "alchemist" ? 0.15 : 0),
      ),
    amount: p.amount,
    move: Math.min(0.4, p.boots * 0.08 + (w.character === "ranger" ? 0.1 : 0)),
    pickup: Math.max(
      0,
      p.magnet * 0.2 + (w.character === "necromancer" ? 0.2 : 0),
    ),
  };
}
export interface WeaponStats {
  damage: number;
  /** Ring-added attacks, after native level/mod counts. */
  replicaCount?: number;
  replicaRadiusScale?: number;
  count: number;
  cooldown: number;
  radius: number;
  duration: number;
  range: number;
  mods: readonly string[];
}
/** Evenly spaced independent knives maintain a steady orbit. */
export function orbitProgress(q: number) {
  const t=Math.max(0,Math.min(1,q));
  return t;
}
export function weaponStats(
  w: SurvivalWorld,
  skill: Skill,
  level = w.skills[skill],
): WeaponStats {
  const l = Math.max(0, Math.min(7, level - 1)),
    a = playerAttributes(w),
    m = [...w.mods[skill]];
  const data = {
    blade: {
      damage: [8, 10, 10, 10, 13, 13, 16, 16],
      count: [4, 4, 5, 5, 5, 6, 6, 6],
      cooldown: [1.6, 1.6, 1.6, 1.4, 1.4, 1.4, 1.4, 1.2],
      radius: 0.21,
      range: 7,
      duration: 0.95,
    },
    fire: {
      damage: [30, 38, 38, 38, 48, 48, 60, 60],
      count: [1, 1, 2, 2, 2, 3, 3, 3],
      cooldown: [2.6, 2.6, 2.6, 2.2, 2.2, 2.2, 2.2, 1.8],
      radius: 1.4 + (l >= 3 ? 0.2 : 0) + (l >= 7 ? 0.2 : 0),
      range: 13,
      duration: 2.6,
    },
    water: {
      damage: [9, 12, 12, 15, 18, 20, 23, 26],
      count: [1, 1, 2, 2, 2, 3, 3, 3],
      cooldown: [3.2, 3.2, 3.2, 2.8, 2.8, 2.8, 2.8, 2.2],
      radius: 1.5 + (l >= 3 ? 0.2 : 0) + (l >= 7 ? 0.2 : 0),
      range: 10,
      duration: 4 + (l >= 5 ? 1 : 0),
    },
    frost: extraBase("frost", l),
    lightning: extraBase("lightning", l),
    ghost: extraBase("ghost", l),
    bone: extraBase("bone", l),
    mine: extraBase("mine", l),
    void: extraBase("void", l),
    holy: extraBase("holy", l),
    hammer: unlockBase("hammer",l),
    wheel: unlockBase("wheel",l),
    lamp: supportBase("lamp",l),
    needle: supportBase("needle",l),
  }[skill];
  const s: WeaponStats = {
    damage: data.damage[l] * (1 + a.damage) * gradeMultiplier(skill, w.weaponGrades),
    count: data.count[l] + (skill === "lamp" || skill === "needle" ? 0 : a.amount),
    cooldown: data.cooldown[l] * (1 - a.cooldown),
    radius: data.radius * Math.sqrt(a.area),
    duration:
      data.duration *
      (["water", "fire", "mine", "void", "frost", "bone", "lamp", "needle"].includes(skill) ||
      (skill === "blade" && !m.includes("hunt"))
        ? a.duration
        : 1),
    range: data.range,
    mods: m,
  };
  if (skill === "blade") {
    if (!m.includes("hunt")) s.duration = s.cooldown;
    if (m.includes("orbit")) s.damage *= 0.8;
    if (m.includes("hunt")) s.damage *= 0.85;
    if (m.includes("return")) s.damage *= 0.8;
    if (m.includes("shards")) s.damage *= 0.85;
  }
  if (skill === "fire") {
    if (m.includes("heavy")) {
      s.damage *= 1.8;
      s.cooldown *= 1.3;
      s.radius *= 1.5;
    }
    if (m.includes("salvo")) {
      s.damage *= 0.52;
      s.radius *= 0.85;
      s.count += 2;
    }
    if (m.includes("embers")) s.damage *= 0.7;
    if (m.includes("flame")) s.damage *= 0.75;
  }
  if (skill === "water") {
    if (m.includes("wave")) s.damage *= 0.8;
  }
  if(skill==="hammer"||skill==="wheel")applyUnlockMods(skill,s);
  if (skill === "lamp" || skill === "needle") applySupportMods(skill,s);
  if (!["blade", "fire", "water", "hammer", "wheel", "lamp", "needle"].includes(skill))
    applyExtraMods(skill as ExtraSkill, s);
  s.replicaRadiusScale = ["fire","water","frost","lightning","mine","void","holy"].includes(skill) ? .8 : 1;
  s.replicaCount = skill === "lamp" || skill === "needle" ? 0 : Math.min(a.amount,Math.max(0,s.count-1));
  return s;
}
/** Extra ring attacks retain coverage with reduced damage. Native attacks and
 * level/mod additions keep their own existing budget; never attenuate twice. */
export function replicaStats(s:WeaponStats,index:number):WeaponStats {
 return index>=s.count-(s.replicaCount||0)?{...s,damage:s.damage*.4,radius:s.radius*(s.replicaRadiusScale??1)}:s;
}
export const PASSIVE_LABELS: Record<Passive, string> = {
  power: "伤害",
  hourglass: "冷却缩减",
  area: "覆盖面积",
  duration: "持续时间",
  amount: "追加攻击（40%伤害）",
  boots: "移动速度",
  vitality: "最大生命",
  magnet: "拾取半径",
};
export function passiveValue(p: Passive, l: number) {
  return p === "amount"
    ? `+${l}`
    : p === "vitality"
      ? `+${l * 15}`
      : `${p === "hourglass" ? "−" : "+"}${Math.round(l * ({ power: 10, hourglass: 6, area: 10, duration: 10, boots: 8, magnet: 20 }[p] ?? 0))}%`;
}
export function modSummary(w: SurvivalWorld, s: Skill) {
  return (
    w.mods[s]
      .map((id) => modInfo(s, id)?.short)
      .filter(Boolean)
      .join(" · ") || "未改造"
  );
}
export function stageBuildHint(stage: number) {
  if(stage===10)return "禁库：直接躲开或提前踩签撤一招；两夹页保留中缝与端头，三阶段仍有收招窗口";
  if(stage===9)return "风廊：先看风向借风换位，沿曲羽侧移；击破一名精英减压，收招时反击";
  if (stage === 8) return "温室：看摆向绕端换侧；空心可进，实心须出；收招开缝时反击";
  if (stage === 7) return "矿窟：看完整折线与折点；晶核可击碎或绕过，收招时甲缝暴露";
  if (stage === 6) return "船坞：货垛截潮截锚，绳无伤；厚蜡甲可裂解，收舷时甲缝暴露";
  if (stage === 5) return "钟庭：钟台挡声浪不挡蜡印，换侧后抓甲缝；新武器裂甲，全配装受益";
  if (stage === 4) return "猎原：去回程之外换道，躲跃扑后绕背；落剑、重爆抓收招，贯阵清出退路";
  if (stage === 3) return "机庭：拆电极断线，向电栅缺口换道；贯阵清路、追猎拆点、落剑抓恢复";
  if (stage === 1) return "围城：短墙侧路切后排；追猎/往返穿阵，火海引敌封路";
  return "虫巢：斜向沙道转场；碎焰清虫、奔流清路，重爆抓出土";
}
