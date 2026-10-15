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
  blade: [
    {
      id: "orbit",
      name: "环绕护身",
      short: "环绕",
      effect: "短暂绕身刀阵，清理贴身敌人",
      cost: "失去远程攻击；每轮刀阵有空档",
      excludes: "hunt",
      glyph: "◎",
    },
    {
      id: "hunt",
      name: "追猎穿刺",
      short: "追猎",
      effect: "追踪精英与远程，最多穿过2人",
      cost: "单次伤害−15%；转向速度有限",
      excludes: "orbit",
      glyph: "➤",
    },
    {
      id: "return",
      name: "往返切线",
      short: "往返",
      effect: "刀刃折返；刀阵向外扩张后回收",
      cost: "单次伤害−20%；回程需安排走位",
      glyph: "↶",
    },
    {
      id: "shards",
      name: "碎刃散射",
      short: "碎刃",
      effect: "终结时向前散出2把短程碎刃",
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
      cost: "主爆炸伤害−20%；碎片不再散射",
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
      effect: "后半段锁定玩家位置并沿路线回流",
      cost: "持续时间−15%；不会一直跟随玩家",
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
  count: number;
  cooldown: number;
  radius: number;
  duration: number;
  range: number;
  mods: readonly string[];
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
      damage: [16, 20, 20, 20, 26, 26, 32, 32],
      count: [2, 2, 3, 3, 3, 4, 4, 4],
      cooldown: [1.6, 1.6, 1.6, 1.4, 1.4, 1.4, 1.4, 1.2],
      radius: 0.21,
      range: 7,
      duration: 1.1,
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
      damage: [7, 9, 9, 9, 12, 12, 15, 15],
      count: [1, 1, 2, 2, 2, 3, 3, 3],
      cooldown: [3.2, 3.2, 3.2, 2.8, 2.8, 2.8, 2.8, 2.4],
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
  }[skill];
  const s: WeaponStats = {
    damage: data.damage[l] * (1 + a.damage),
    count: data.count[l] + a.amount,
    cooldown: data.cooldown[l] * (1 - a.cooldown),
    radius: data.radius * a.area,
    duration:
      data.duration *
      (["water", "fire", "mine", "void", "frost", "bone"].includes(skill) ||
      m.includes("orbit")
        ? a.duration
        : 1),
    range: data.range,
    mods: m,
  };
  if (skill === "blade") {
    if (m.includes("orbit"))
      s.duration = Math.min(s.duration, s.cooldown * 0.9);
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
    if (m.includes("embers")) s.damage *= 0.8;
    if (m.includes("flame")) s.damage *= 0.75;
  }
  if (skill === "water") {
    if (m.includes("wave")) s.damage *= 0.8;
    if (m.includes("recall")) s.duration *= 0.85;
  }
  if (!["blade", "fire", "water"].includes(skill))
    applyExtraMods(skill as ExtraSkill, s);
  return s;
}
export const PASSIVE_LABELS: Record<Passive, string> = {
  power: "伤害",
  hourglass: "冷却缩减",
  area: "攻击范围",
  duration: "持续时间",
  amount: "主攻击数量",
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
  return stage === 17 ? "猎原：去回程之外换道，躲跃扑后绕背；落剑、重爆抓收招，贯阵清出退路" : stage === 16 ? "机庭：拆电极断线，向电栅缺口换道；贯阵清路、追猎拆点、落剑抓恢复" : stage === 14
    ? "围城：短墙侧路切后排；追猎/往返穿阵，火海引敌封路"
    : "虫巢：斜向沙道转场；碎焰清虫、奔流清路，重爆抓出土";
}
