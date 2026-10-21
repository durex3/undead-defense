import { ALL_WEAPONS, NAMES, Skill } from "./SurvivalConfig";
export type WeaponGrade = 1 | 2 | 3 | 4;
export const GRADE_NAMES = ["", "普通", "精良", "稀有", "史诗"] as const;
export const GRADE_COLORS = ["", "#d3d7db", "#94d6a4", "#84bbef", "#c19aef"] as const;
export const GRADE_PRICE = [0, 0, 360, 720, 1440] as const;
const forms: Partial<Record<Skill, readonly string[]>> = {
  blade: ["飞刀", "旋纹飞刃", "银月环刃", "星陨刃阵"],
  wheel: ["", "裂甲飞轮", "断纬棘轮", "裁界环轮"],
  hammer: ["", "镇钟重锤", "裂钟符锤", "震庭鸣钟"],
};
export function initialGrade(s: Skill): WeaponGrade {
  return s === "needle" ? 4 : s === "lamp" ? 3 : s === "hammer" || s === "wheel" ? 2 : 1;
}
export function validGrade(s: Skill, grade: unknown): grade is WeaponGrade {
  return Number.isInteger(grade) && Number(grade) >= initialGrade(s) && Number(grade) <= (forms[s] ? 4 : initialGrade(s));
}
export function gradeOf(s: Skill, grades: Partial<Record<Skill, WeaponGrade>> = {}): WeaponGrade {
  return validGrade(s, grades[s]) ? grades[s]! : initialGrade(s);
}
export function weaponName(s: Skill, grades: Partial<Record<Skill, WeaponGrade>> = {}) {
  return forms[s]?.[gradeOf(s, grades) - 1] || NAMES[s];
}
export function gradeMultiplier(s: Skill, grades: Partial<Record<Skill, WeaponGrade>> = {}) {
  const g = gradeOf(s, grades);
  return s === "blade" ? [0, 1, 1.25, 1.6, 2.05][g] : s === "hammer" || s === "wheel" ? [0, 1, 1, 1.28, 1.64][g] : 1;
}
export function nextGrade(s: Skill, grades: Partial<Record<Skill, WeaponGrade>> = {}): WeaponGrade | null {
  const g = gradeOf(s, grades);
  return forms[s] && g < 4 ? (g + 1) as WeaponGrade : null;
}
export function initialGrades(): Record<Skill, WeaponGrade> {
  return Object.fromEntries(ALL_WEAPONS.map(s => [s, initialGrade(s)])) as Record<Skill, WeaponGrade>;
}
