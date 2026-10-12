import { Skill } from "./SurvivalConfig";
export const CHARACTERS = {
  ranger: {
    name: "飞刀游侠",
    need: 0,
    stage: 0,
    weapon: "blade" as Skill,
    description: "环绕飞刀开局 · 灵活收割",
  },
  alchemist: {
    name: "炼金术士",
    need: 5,
    stage: 1,
    weapon: "water" as Skill,
    description: "圣水开局，近敌瞄准 · 圣水、毒雾持续 +20%",
  },
  necromancer: {
    name: "亡灵使者",
    need: 9,
    stage: 2,
    weapon: "ghost" as Skill,
    description: "幽灵开局 · 幽灵伤害 +20%，幽灵、蝙蝠冷却 -10%",
  },
};
export type CharacterId = keyof typeof CHARACTERS;
export type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const ACHIEVEMENTS = [
  { id: "level", name: "初次觉醒", description: "首次升级" },
  { id: "learn", name: "秘术学徒", description: "首次学习一把新武器" },
  { id: "four", name: "全副武装", description: "单局装备 4 把武器" },
  { id: "evolve", name: "突破极限", description: "首次完成武器进化" },
  { id: "elite", name: "精英猎手", description: "首次击败一名精英" },
  { id: "survive", name: "长夜行者", description: "单局存活 3 分钟" },
  { id: "win", name: "黎明将至", description: "首次通关任意关卡" },
  { id: "kills", name: "亡潮收割者", description: "单局击败 300 个敌人" },
  { id: "three", name: "秘术博学", description: "累计进化 3 种不同武器" },
  { id: "heroes", name: "百变幸存者", description: "用 2 个不同角色通关" },
  { id: "altar", name: "熔火余生", description: "通关第三关熔骨祭坛" },
  { id: "garden", name: "庭院净化", description: "通关第二关" },
  { id: "gardenNoBat", name: "独立续航", description: "不学蝙蝠通关第二关" },
  { id: "altarNoHeal", name: "熔火试炼", description: "无任何回复通关第三关" },
  { id: "allStages", name: "三境远征", description: "完成前三关" },
  { id: "church", name: "钟声止息", description: "通关第四关幽钟教堂" },
  { id: "quietChurch", name: "静谧回廊", description: "通关第四关且未受环境钟伤害" },
  { id: "king", name: "王冠落地", description: "通关第五关亡者王庭" },
  { id: "fiveStages", name: "五境远征", description: "累计通关第一至第五关" },
  { id: "kingNoLeech", name: "无血之冠", description: "不学习蝙蝠通关第五关" },
] as const;
