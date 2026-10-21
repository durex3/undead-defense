import type { WeaponMod, WeaponStats } from "./ArmoryConfig";
export const UNLOCK_WEAPONS = ["hammer", "wheel"] as const;
export type UnlockSkill = (typeof UNLOCK_WEAPONS)[number];
export const HAMMER_PRICE = 360;
export const CLEAR_COINS = [0, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300] as const;
export const STAGE_CLEAR_IDS = ["", "siege_clear", "sand_clear", "thunder_clear", "moon_clear", "bellcourt_clear", "tideworks_clear", "prismvault_clear", "rootglass_clear", "windcloister_clear", "library_clear", "emberloom_clear"] as const;
export interface Achievement { id: string; name: string; condition: string; reward: string; weapon: import("./SurvivalConfig").Skill | null; category: "通关记录" | "机制挑战" | "配装挑战"; }
export const ACHIEVEMENTS: readonly Achievement[] = [
  ...["围城初破","赤砂脱困","雷庭止鸣","逐月归来","钟庭来客","潮间过客","棱间行者","温室回生","借风过廊","禁库开卷","织坊断经"].map((name,i):Achievement=>({id:STAGE_CLEAR_IDS[i+1],name,condition:`通关第${i+1}关`,reward:"图鉴完成标记",weapon:null,category:"通关记录"})),
  {id:"loom_eight_paths",name:"八途解织",condition:"用8种不同起手通关第十一关；每局Boss三阶段各穿越同组两条松线，且不受Boss来源伤害",reward:"断纬者称号与织纹徽章",weapon:null,category:"机制挑战"},
  {id:"forge_mastery",name:"破阵熟手",condition:"通关第三关，至少一把武器8级并有两项合法改造",reward:"精良裂甲飞轮",weapon:"wheel",category:"机制挑战"},
  {id:"device_tactician",name:"拆阵有方",condition:"同局亲自摧毁4个不同电锚或电极，并通关第三关",reward:"挑战完成章",weapon:null,category:"机制挑战"},
  {id:"seal_pathfinder",name:"解签留路",condition:"用6种不同起手各通关第十关；每局Boss三阶段各踩断一枚Boss封签，且不受Boss来源伤害",reward:"史诗缚影缝针",weapon:"needle",category:"机制挑战"},
  {id:"triple_mastery",name:"三核齐鸣",condition:"通关第七至十关任一关，至少三把武器8级且各有两项合法改造",reward:"挑战完成章",weapon:null,category:"配装挑战"},
  {id:"five_openers",name:"五路起手",condition:"用5种不同实际起手通关，成功记录覆盖至少3个关卡",reward:"挑战完成章",weapon:null,category:"配装挑战"},
  {id:"modification_paths",name:"改造异途",condition:"同一系列以3种不同合法双改组合通关，成功记录覆盖至少2个关卡",reward:"挑战完成章",weapon:null,category:"配装挑战"},
];
const m = (
  id: string,
  name: string,
  effect: string,
  cost: string,
  excludes?: string,
): WeaponMod => ({
  id,
  name,
  short: name,
  glyph:
    (
      {
        heavy: "⬟",
        sweep: "⌒",
        rift: "ϟ",
        return: "↶",
        twin: "◎",
        grind: "✳",
        curve: "↷",
      } as Record<string, string>
    )[id] ?? "◆",
  effect,
  cost,
  excludes,
});
export const UNLOCK_MODS: Record<UnlockSkill, readonly WeaponMod[]> = {
  hammer: [
    m(
      "heavy",
      "重槌破阵",
      "伤害×1.65、半径×1.2，一击两层裂甲",
      "周期×1.35",
      "sweep",
    ),
    m(
      "sweep",
      "横扫连槌",
      "两个方向先后横扫，分别施加裂甲",
      "每击伤害−35%",
      "heavy",
    ),
    m(
      "rift",
      "震纹推进",
      "主击后前进裂纹造成45%伤害",
      "主击−15%；裂纹不加裂甲",
    ),
    m(
      "return",
      "回摆追槌",
      "整轮结束0.6秒后反向回摆，65%伤害",
      "主击−20%；只回摆一次",
    ),
  ],
  wheel: [
    m(
      "heavy",
      "重齿切甲",
      "伤害×1.45，去程命中两层裂甲",
      "周期×1.25；速度降为5.5",
      "twin",
    ),
    m("twin", "双轮分进", "两枚飞轮沿宽角分开后回收", "每轮伤害−35%", "heavy"),
    m(
      "grind",
      "端点绞切",
      "末端停留0.9秒，额外两次40%绞切",
      "主击−15%；绞切不加裂甲",
    ),
    m(
      "curve",
      "侧弧归轮",
      "回程走侧向弧线，回程伤害×1.35",
      "去程伤害−15%；回收点锁定",
    ),
  ],
};
export function unlockBase(skill: UnlockSkill, l: number) {
  const base =
    skill === "hammer" ? [46, 2.8, 3, 1, 4, 0.53] : [24, 2.2, 0.3, 1, 6, 0.25];
  return {
    damage: Array.from(
      { length: 8 },
      (_, i) => base[0] * [1, 1.25, 1.25, 1.25, 1.6, 1.6, 2, 2][i],
    ),
    count: Array.from(
      { length: 8 },
      (_, i) => base[3] + (i >= 2 ? 1 : 0) + (i >= 5 ? 1 : 0),
    ),
    cooldown: Array.from(
      { length: 8 },
      (_, i) => base[1] * (i >= 7 ? 0.75 : i >= 3 ? 0.88 : 1),
    ),
    radius: base[2] * (l >= 3 ? 1.12 : 1) * (l >= 7 ? 1.1 : 1),
    range: base[4],
    duration: base[5],
  };
}
export function applyUnlockMods(skill: UnlockSkill, s: WeaponStats) {
  const has = (id: string) => s.mods.includes(id);
  if (skill === "hammer") {
    if (has("heavy")) {
      s.damage *= 1.65;
      s.radius *= 1.2;
      s.cooldown *= 1.35;
    }
    if (has("sweep")) s.damage *= 0.65;
    if (has("rift")) s.damage *= 0.85;
    if (has("return")) s.damage *= 0.8;
  } else {
    if (has("heavy")) {
      s.damage *= 1.45;
      s.cooldown *= 1.25;
    }
    if (has("twin")) {
      s.damage *= 0.65;
      s.count *= 2;
    }
    if (has("grind")) s.damage *= 0.85;
    if (has("curve")) s.damage *= 0.85;
  }
}
