import type { SurvivalWorld } from "./SurvivalWorld";
import type { ProgressData } from "../platform/ProgressData";
import type { StageId } from "./ProgressionConfig";
import { ALL_WEAPONS, Skill } from "./SurvivalConfig";
import { isLegalModPair } from "./ArmoryConfig";
import { graveRecipe } from "./GraveChallenge";
import { ACHIEVEMENTS, STAGE_CLEAR_IDS, CLEAR_COINS } from "./UnlockConfig";
type OpenerRule = (
  next: ProgressData,
  w: SurvivalWorld,
  opener: Skill,
  earned: Set<string>,
) => void;
type PairField =
  | "graveQualified"
  | "leadQualified"
  | "eclipseQualified"
  | "edgeQualified"
  | "kilnQualified";
type PhaseField =
  | "leadPhases"
  | "eclipsePhases"
  | "edgePhases"
  | "kilnPhases"
  | "loomPhases"
  | "bossSealPhases";
const phases = (w: SurvivalWorld, key: PhaseField) =>
  w.challenge.bossHits === 0 &&
  [1, 2, 3].every((phase) => w.challenge[key].has(phase));
function pairRule(
  field: PairField,
  pairs: number,
  openers: number,
  achievement: string,
  qualifies: (w: SurvivalWorld, opener: Skill) => boolean,
): OpenerRule {
  return (next, w, opener, earned) => {
    if (!qualifies(w, opener)) return;
    if (field === "graveQualified") next.graveQualifiedVersion = 1;
    const progress = next[field] ?? (next[field] = {}),
      key = Array.from(w.mods[opener]).sort().join("+");
    progress[opener] = Array.from(new Set([...(progress[opener] ?? []), key]));
    if (
      Object.values(progress).filter((v) => v && v.length >= pairs).length >=
      openers
    )
      earned.add(achievement);
  };
}
function phasePairs(
  field: PairField,
  pairs: number,
  openers: number,
  achievement: string,
  phase: PhaseField,
): OpenerRule {
  return pairRule(
    field,
    pairs,
    openers,
    achievement,
    (w, opener) =>
      w.skills[opener] === 8 &&
      isLegalModPair(opener, w.mods[opener]) &&
      phases(w, phase),
  );
}
function openerRule(
  field: "sealOpeners" | "loomQualifiedOpeners",
  count: number,
  achievement: string,
  phase: PhaseField,
): OpenerRule {
  return (next, w, opener, earned) => {
    if (!phases(w, phase)) return;
    next[field] = Array.from(new Set([...(next[field] ?? []), opener]));
    if (next[field]!.length >= count) earned.add(achievement);
  };
}
/** New encounter qualifications register here instead of adding settlement branches to the store. */
const openerRules: Partial<Record<StageId, OpenerRule>> = {
  10: openerRule("sealOpeners", 6, "seal_pathfinder", "bossSealPhases"),
  11: openerRule("loomQualifiedOpeners", 8, "loom_eight_paths", "loomPhases"),
  12: phasePairs("kilnQualified", 2, 10, "kiln_ten_paths", "kilnPhases"),
  13: phasePairs("edgeQualified", 2, 12, "edge_twelve_paths", "edgePhases"),
  14: phasePairs(
    "eclipseQualified",
    3,
    12,
    "eclipse_twelve_paths",
    "eclipsePhases",
  ),
  15: phasePairs("leadQualified", 4, 12, "lead_twelve_paths", "leadPhases"),
  16: pairRule(
    "graveQualified",
    5,
    12,
    "grave_twelve_paths",
    (w, opener) =>
      w.skills[opener] === 8 &&
      graveRecipe(opener, w.mods[opener]) &&
      ["1A", "1B", "2B"].every((key) => w.challenge.graveGroups.has(key)) &&
      w.challenge.bossHits === 0,
  ),
};
/** Mutates only a candidate account snapshot. The store owns atomic commit/recovery. */
export function settleVictory(next: ProgressData, w: SurvivalWorld): string[] {
  if (w.state !== "won" || next.settledRuns?.includes(w.runId)) return [];
  next.coins = (next.coins ?? 0) + CLEAR_COINS[w.stageId];
  next.settledRuns = [...(next.settledRuns ?? []), w.runId];
  const notices = [`通关金币 +${CLEAR_COINS[w.stageId]}`],
    earned = new Set(next.achievements ?? []);
  const mastered = ALL_WEAPONS.filter(
    (s) => w.skills[s] === 8 && isLegalModPair(s, w.mods[s]),
  );
  if (w.stageId === 3 && mastered.length) earned.add("forge_mastery");
  if (w.stageId === 3 && w.challenge.devices.size >= 4)
    earned.add("device_tactician");
  earned.add(STAGE_CLEAR_IDS[w.stageId]);
  if (w.stageId >= 7 && w.stageId <= 10 && mastered.length >= 3)
    earned.add("triple_mastery");
  if (w.startingWeapon) {
    const opener = w.startingWeapon;
    next.openerWins ??= [];
    if (
      !next.openerWins.some((v) => v.skill === opener && v.stage === w.stageId)
    )
      next.openerWins.push({ skill: opener, stage: w.stageId });
    if (
      new Set(next.openerWins.map((v) => v.skill)).size >= 5 &&
      new Set(next.openerWins.map((v) => v.stage)).size >= 3
    )
      earned.add("five_openers");
    openerRules[w.stageId]?.(next, w, opener, earned);
  }
  next.modWins ??= {};
  for (const skill of ALL_WEAPONS)
    if (w.skills[skill] > 0 && isLegalModPair(skill, w.mods[skill])) {
      const key = Array.from(w.mods[skill]).sort().join("+"),
        history = next.modWins[skill] ?? (next.modWins[skill] = {});
      history[key] = Array.from(new Set([...(history[key] ?? []), w.stageId]));
    }
  for (const history of Object.values(next.modWins))
    if (
      history &&
      Object.keys(history).length >= 3 &&
      new Set(Object.values(history).flat()).size >= 2
    )
      earned.add("modification_paths");
  for (const id of Array.from(earned))
    if (!(next.achievements ?? []).includes(id))
      notices.push(ACHIEVEMENTS.find((a) => a.id === id)!.name);
  next.achievements = Array.from(earned);
  return notices;
}
