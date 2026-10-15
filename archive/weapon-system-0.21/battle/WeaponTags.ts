import { Skill, WeaponTag, WEAPON_TAGS } from "./SurvivalConfig";

export function hasWeaponTag(skill: Skill, tag: WeaponTag) {
  return WEAPON_TAGS[skill].includes(tag);
}

export function countTaggedSkills(skills: Partial<Record<Skill, number>>, tag: WeaponTag) {
  return (Object.keys(skills) as Skill[]).filter((s) => (skills[s] || 0) > 0 && hasWeaponTag(s, tag)).length;
}
