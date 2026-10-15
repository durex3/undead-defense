import { EXTRA_RULES, ExtraSkill } from "./ExtraArmoryConfig";
import type { SurvivalWorld } from "./SurvivalWorld";
import {
  Skill,
  Card,
  Passive,
  WEAPONS,
  PASSIVES,
  NAMES,
  WEAPON_ROLES,
  PASSIVE_MAX,
} from "./SurvivalConfig";
import {
  weaponStats,
  modInfo,
  modSummary,
  passiveValue,
  PASSIVE_LABELS,
} from "./ArmoryConfig";
const n = (v: number) => Number(v.toFixed(2));
export function weaponStatus(w: SurvivalWorld, s: Skill) {
  return {
    branch: modSummary(w, s),
    icons: w.mods[s].map((id) => modInfo(s, id)?.glyph || "").join(""),
    condition: "4级、8级各免费选择一次改造",
  };
}
export function combatWeaponEntries(w: SurvivalWorld) {
  return WEAPONS.filter((s) => w.skills[s]).map(
    (s) =>
      `${NAMES[s]} ${w.skills[s]}级 ${weaponStatus(w, s).icons} ${modSummary(w, s)}`,
  );
}
export function weaponDetails(w: SurvivalWorld, s: Skill) {
  const a = weaponStats(w, s);
  return [
    WEAPON_ROLES[s],
    `${w.skills[s]}/8级 · ${a.count}次主攻击 · 周期 ${n(a.cooldown)}秒`,
    `${s === "water" ? "每跳伤害" : "单次伤害"} ${n(a.damage)} · 范围 ${n(a.radius)}${["water", "mine", "void", "frost", "bone"].includes(s) ? ` · 持续 ${n(a.duration)}秒` : ""}`,
    ...w.mods[s].map((id) => {
      const m = modInfo(s, id)!;
      return `${m.glyph} ${m.name}：${m.effect}\n代价：${m.cost}`;
    }),
    "4级、8级各一次改造；两个改造共同改变攻击形态。",
    s === "blade"
      ? "飞刀数量增加主刀；碎刃每轮固定2把。"
      : s === "fire"
        ? "数量增加本轮主球总数；碎焰每主球2枚；火海同源重叠不叠伤。"
        : s === "water"
          ? "每0.4秒一跳；水爆改为每秒×2.5伤害；同源重叠不叠伤。"
          : EXTRA_RULES[s as ExtraSkill],
    "被动仅增加通用属性，不与武器组成配方。",
  ].join("\n");
}
export function upgradeChanges(w: SurvivalWorld, c: Card) {
  if (c === "repair")
    return `生命 ${n(w.hp)} → ${n(Math.min(w.maxHp, w.hp + 20))}`;
  if (c === "continue") return "当前成长已满，继续战斗";
  if (WEAPONS.includes(c as Skill)) {
    const s = c as Skill,
      l = w.skills[s],
      a = weaponStats(w, s),
      b = weaponStats(w, s, l + 1);
    if (!l)
      return `${WEAPON_ROLES[s]}\n伤害 ${n(b.damage)} · 数量 ${b.count}\n周期 ${n(b.cooldown)}秒`;
    const changes = [
      a.damage !== b.damage ? `伤害 ${n(a.damage)} → ${n(b.damage)}` : "",
      a.count !== b.count ? `数量 ${a.count} → ${b.count}` : "",
      a.cooldown !== b.cooldown
        ? `周期 ${n(a.cooldown)} → ${n(b.cooldown)}秒`
        : "",
      a.radius !== b.radius ? `范围 ${n(a.radius)} → ${n(b.radius)}` : "",
      a.duration !== b.duration
        ? `持续 ${n(a.duration)} → ${n(b.duration)}秒`
        : "",
    ];
    if (l + 1 === 4 || l + 1 === 8) changes.push("升级后：免费选择一次改造");
    return changes.filter(Boolean).join("\n");
  }
  const p = c as Passive,
    l = w.passives[p];
  return `${PASSIVE_LABELS[p]}\n${passiveValue(p, l)} → ${passiveValue(p, l + 1)}\n${l + 1}/${PASSIVE_MAX[p]}级`;
}
export function upgradeInventory(w: SurvivalWorld) {
  return (
    combatWeaponEntries(w).join("\n") +
    "\n" +
    PASSIVES.filter((p) => w.passives[p])
      .map((p) => `${NAMES[p]} ${w.passives[p]}级`)
      .join(" · ")
  );
}
