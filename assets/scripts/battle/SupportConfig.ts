import type { WeaponMod, WeaponStats } from "./ArmoryConfig";
export const LAMP_PRICE = 1440;
export type SupportSkill = "lamp" | "needle";
const mod = (id: string, name: string, effect: string, cost: string, excludes?: string): WeaponMod => ({id, name, short: name, effect, cost, excludes, glyph: "◆"});
export const SUPPORT_MODS: Record<SupportSkill, readonly WeaponMod[]> = {
  lamp: [
    mod("focus", "聚焰照魂", "烙魂增伤从12%提高至18%", "最多标记3人", "wide"),
    mod("wide", "展灯广照", "最多标记10人，灯区半径+25%", "自身伤害−25%", "focus"),
    mod("linger", "余烬留痕", "离区标记保留1.2秒", "灯区持续−20%"),
    mod("pulse", "魂焰震荡", "每跳自身伤害×2", "伤害间隔从0.5秒变为1秒"),
  ],
  needle: [
    mod("deep", "深缝传伤", "传递比例提高至30%，每段预算+25%", "基础针击−25%", "swift"),
    mod("swift", "疾针连缝", "攻击周期−25%", "针击及传递上限−20%", "deep"),
    mod("long", "长线引缝", "断线距离+30%，持续+0.5秒", "针击−15%"),
    mod("barb", "倒刺穿针", "基础针击+40%", "每段传递预算−25%"),
  ],
};
export function supportBase(s: SupportSkill, l: number) {
  const damage = s === "lamp" ? [6,8,8,8,10,10,13,13] : [28,35,35,35,45,45,56,56];
  return {damage, count: Array(8).fill(1), cooldown: s === "lamp" ? [5,5,5,4.6,4.6,4.6,4.6,4.2] : [4,4,4,3.7,3.7,3.7,3.7,3.4],
    radius: s === "lamp" ? (l >= 6 ? 2.5 : 2.2) : .2, range: s === "lamp" ? 8 : 10, duration: s === "lamp" ? 3 : 2.5};
}
export function applySupportMods(s: SupportSkill, a: WeaponStats) {
  const has = (id: string) => a.mods.includes(id);
  if(s === "lamp") {
    if(has("wide")) {a.radius *= 1.25; a.damage *= .75;}
    if(has("linger")) a.duration *= .8;
    if(has("pulse")) a.damage *= 2;
  } else {
    if(has("deep")) a.damage *= .75;
    if(has("swift")) {a.cooldown *= .75; a.damage *= .8;}
    if(has("long")) {a.duration += .5; a.damage *= .85;}
    if(has("barb")) a.damage *= 1.4;
  }
}
