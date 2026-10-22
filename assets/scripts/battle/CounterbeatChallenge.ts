import type { Skill } from "./SurvivalConfig";
/** Frozen launch roster. Later weapons must not enlarge these certifications. */
export const COUNTERBEAT_ROLES: readonly {
  name: string;
  skills: readonly Skill[];
}[] = [
  { name: "近身应对", skills: ["blade", "frost"] },
  { name: "锁点爆发", skills: ["fire", "holy"] },
  { name: "纵列打击", skills: ["bone", "wheel"] },
  { name: "分散追猎", skills: ["ghost", "lightning"] },
  { name: "布场引敌", skills: ["water", "mine"] },
  { name: "破甲协同", skills: ["hammer", "void", "lamp", "needle"] },
];
export const COUNTERBEAT_OPENERS = COUNTERBEAT_ROLES.flatMap((r) =>
  Array.from(r.skills),
);
export const counterbeatComplete = (skills: readonly string[]) =>
  COUNTERBEAT_ROLES.every(
    (r) => r.skills.filter((s) => skills.includes(s)).length >= 2,
  );
