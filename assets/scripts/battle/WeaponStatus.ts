import { weaponName, gradeOf, GRADE_NAMES } from "./WeaponGrade";
import { EXTRA_RULES, ExtraSkill } from "./ExtraArmoryConfig";
import type { SurvivalWorld } from "./SurvivalWorld";
import {
  Skill,
  Card,
  Passive,
  ALL_WEAPONS as WEAPONS,
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
      `${GRADE_NAMES[gradeOf(s,w.weaponGrades)]} · ${weaponName(s,w.weaponGrades)} ${w.skills[s]}级 ${weaponStatus(w, s).icons} ${modSummary(w, s)}`,
  );
}
export function weaponDetails(w: SurvivalWorld, s: Skill) {
  const a = weaponStats(w, s);
  const countLabel=s==="ghost"?"名伙伴":s==="blade"?"把飞刀":s==="lightning"?"道落雷上限":"次主攻击";
  const damageLabel=s==="ghost"?"单爪伤害":s==="blade"?"单刀伤害":s==="water"?"每跳伤害":s==="lightning"?"每道落雷伤害":"单次伤害";
  const rangeLabel=s==="blade"&&!a.mods.includes("hunt")?`环绕半径 ${n((a.mods.includes("orbit")?2.7:1.9)*a.radius/.21)}`:
    s==="ghost"?`爪击半径 ${n(a.radius+.45)}`:`范围 ${n(a.radius)}`;
  return [
    `${GRADE_NAMES[gradeOf(s,w.weaponGrades)]} · ${weaponName(s,w.weaponGrades)}`,
    WEAPON_ROLES[s],
    `${w.skills[s]}/8级 · ${a.count}${countLabel} · ${s==="blade"&&!a.mods.includes("hunt")?"旋转一周":"周期"} ${n(a.cooldown)}秒`,
    `${damageLabel} ${n(a.damage)} · ${rangeLabel}${["water", "mine", "void", "frost"].includes(s) ? ` · 持续 ${n(a.duration)}秒` : ""}`,
    ...w.mods[s].map((id) => {
      const m = modInfo(s, id)!;
      return `${m.glyph} ${m.name}：${m.effect}\n代价：${m.cost}`;
    }),
    ...(w.passives.amount && s!=="lamp" && s!=="needle" ? [s==="hammer"||s==="wheel"?"重锤/飞轮保留首击，所有追加攻击为40%伤害。":"指环追加攻击为40%伤害；复制范围技半径80%，原有攻击不减伤。"] : []),
    "4级、8级各一次改造；两个改造共同改变攻击形态。",
    s === "blade"
      ? "数把实体飞刀持续等距环绕，每刀每目标每周一次；扩阵覆盖外圈，追猎替换为远射；往返每周多一个命中段，碎刃每周固定2把。持续属性不改变转速。"
      : s === "fire"
        ? "数量增加本轮主球总数；碎焰每主球2枚；火海同源重叠不叠伤。"
        : s === "water"
          ? "每0.4秒一跳；水爆改为每秒×2.5伤害；同源重叠不叠伤。"
          : s === "hammer" ? "首锤全额、同轮追加锤40%伤害；主击施加裂甲，裂纹继承锤伤且不递归；首领每层仅减15个百分点护甲。" : s === "wheel" ? "首轮全额、同轮追加飞轮40%伤害；去回各命中一次并裂甲，绞切不额外裂甲；回收点固定；首领每层仅减15个百分点护甲。" : s === "lamp" ? "一个灯区，有限目标烙魂增伤16%；聚焰22%，不叠层。" : s === "needle" ? "最多一对缝线；传递有间隔与预算，不递归；单目标仍有针击。" : EXTRA_RULES[s as ExtraSkill],
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
      return `${WEAPON_ROLES[s]}\n伤害 ${n(b.damage)} · ${s==="lightning"?"落雷数量上限":"数量"} ${b.count}\n周期 ${n(b.cooldown)}秒`;
    const changes = [
      a.damage !== b.damage ? `${s==="ghost"?"单爪伤害":s==="blade"?"单刀伤害":"伤害"} ${n(a.damage)} → ${n(b.damage)}` : "",
      a.count !== b.count ? `${s==="ghost"?"伙伴数":s==="blade"?"飞刀数":s==="lightning"?"落雷数量上限":"数量"} ${a.count} → ${b.count}` : "",
      a.cooldown !== b.cooldown
        ? `周期 ${n(a.cooldown)} → ${n(b.cooldown)}秒`
        : "",
      a.radius !== b.radius ? `范围 ${n(a.radius)} → ${n(b.radius)}` : "",
      a.duration !== b.duration && s !== "blade"
        ? `持续 ${n(a.duration)} → ${n(b.duration)}秒`
        : "",
    ];
    if (l + 1 === 4 || l + 1 === 8) changes.push("升级后：免费选择一次改造");
    return changes.filter(Boolean).join("\n");
  }
  const p = c as Passive,
    l = w.passives[p];
  return `${PASSIVE_LABELS[p]}${p==="area"?"（半径按面积换算）":p==="amount"?"；原有攻击不减伤，复制范围技半径80%":""}\n${passiveValue(p, l)} → ${passiveValue(p, l + 1)}\n${l + 1}/${PASSIVE_MAX[p]}级`;
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
