import type { ProgressData } from "./ProgressData";
import { graveRecipe } from "../battle/GraveChallenge";
import { validGrade } from "../battle/WeaponGrade";
import { isLegalModPair } from "../battle/ArmoryConfig";
import { ALL_WEAPONS, Skill } from "../battle/SurvivalConfig";
import { ACHIEVEMENTS, STAGE_CLEAR_IDS } from "../battle/UnlockConfig";
import { STAGE_IDS } from "../battle/ProgressionConfig";
export const freshProgress = (): ProgressData => ({
  version: 1,
  rules: "armory-v1",
  revision: 0,
  coins: 0,
  purchasedWeapons: [],
  achievements: [],
  settledRuns: [],
  stages: [],
  stageBest: {},
  best: { kills: 0, time: 0, weapons: 0 },
});
export function decodeProgress(
  raw: unknown,
): { data: ProgressData; repaired: boolean } | null {
  try {
    let v: any = raw;
    for (let i = 0; i < 2 && typeof v === "string"; i++) v = JSON.parse(v);
    if (validProgress(v)) {
      const data = JSON.parse(JSON.stringify(v)) as ProgressData;
      const stages = new Set(data.stages);
      for (const [id, best] of Object.entries(data.stageBest))
        if (best.won) stages.add(Number(id));
      for (const id of data.achievements ?? []) {
        const stage = (STAGE_CLEAR_IDS as readonly string[]).indexOf(id);
        if (stage > 0) stages.add(stage);
      }
      const repaired = stages.size !== data.stages.length;
      data.stages = Array.from(stages);
      return { data, repaired };
    }
    if (v?.version !== 1 || v?.rules !== "armory-v1") return null;
    // Isolate optional/corrupt fields instead of discarding the account.
    if (
      v.coins !== undefined &&
      !(Number.isSafeInteger(v.coins) && v.coins >= 0)
    )
      return null;
    const d = freshProgress(),
      stage = (id: any) => (STAGE_IDS as readonly number[]).includes(id);
    d.revision =
      Number.isSafeInteger(v.revision) && v.revision >= 0 ? v.revision : 0;
    d.coins = Number.isSafeInteger(v.coins) && v.coins >= 0 ? v.coins : 0;
    d.stages = Array.isArray(v.stages)
      ? Array.from(new Set<number>(v.stages.filter(stage)))
      : [];
    for (const k of ["kills", "time", "weapons"] as const)
      if (Number.isFinite(v.best?.[k]) && v.best[k] >= 0) d.best[k] = v.best[k];
    if (
      v.stageBest &&
      typeof v.stageBest === "object" &&
      !Array.isArray(v.stageBest)
    )
      for (const [key, b] of Object.entries(v.stageBest) as [string, any][]) {
        if (
          !stage(Number(key)) ||
          !Number.isFinite(b?.time) ||
          b.time < 0 ||
          !Number.isInteger(b.phase) ||
          b.phase < 0 ||
          b.phase > 3 ||
          typeof b.won !== "boolean" ||
          !(
            b.bossRemaining === null ||
            (Number.isFinite(b.bossRemaining) &&
              b.bossRemaining >= 0 &&
              b.bossRemaining <= 100)
          )
        )
          continue;
        d.stageBest[key] = b;
        if (b.won && !d.stages.includes(Number(key)))
          d.stages.push(Number(key));
      }
    d.purchasedWeapons = Array.isArray(v.purchasedWeapons)
      ? Array.from(
          new Set<string>(
            v.purchasedWeapons.filter(
              (x: any) => x === "hammer" || x === "lamp",
            ),
          ),
        )
      : [];
    d.achievements = Array.isArray(v.achievements)
      ? Array.from(
          new Set<string>(
            v.achievements.filter((x: any) =>
              ACHIEVEMENTS.some((a) => a.id === x),
            ),
          ),
        )
      : [];
    d.settledRuns = Array.isArray(v.settledRuns)
      ? Array.from(
          new Set<string>(
            v.settledRuns.filter(
              (x: any) => typeof x === "string" && x.length < 120,
            ),
          ),
        )
      : [];
    d.grades = {};
    if (v.grades && typeof v.grades === "object")
      for (const skill of ALL_WEAPONS)
        if (validGrade(skill, v.grades[skill]))
          d.grades[skill] = v.grades[skill];
    if (Array.isArray(v.openerWins))
      d.openerWins = v.openerWins.filter(
        (x: any) => ALL_WEAPONS.includes(x?.skill) && stage(x.stage),
      );
    if (
      v.leadQualified &&
      typeof v.leadQualified === "object" &&
      !Array.isArray(v.leadQualified)
    ) {
      d.leadQualified = {};
      for (const skill of ALL_WEAPONS) {
        const pairs = v.leadQualified[skill];
        if (Array.isArray(pairs))
          d.leadQualified[skill] = Array.from(
            new Set<string>(
              pairs
                .filter(
                  (x: any) =>
                    typeof x === "string" &&
                    isLegalModPair(skill, x.split("+")),
                )
                .map((x: string) => x.split("+").sort().join("+")),
            ),
          );
      }
    }
    if (
      (v.graveQualifiedVersion === undefined ||
        v.graveQualifiedVersion === 1) &&
      v.graveQualified &&
      typeof v.graveQualified === "object" &&
      !Array.isArray(v.graveQualified)
    ) {
      d.graveQualified = {};
      d.graveQualifiedVersion = 1;
      for (const skill of ALL_WEAPONS) {
        const pairs = v.graveQualified[skill];
        if (Array.isArray(pairs))
          d.graveQualified[skill] = Array.from(
            new Set<string>(
              pairs
                .filter(
                  (x: any) =>
                    typeof x === "string" && graveRecipe(skill, x.split("+")),
                )
                .map((x: string) => x.split("+").sort().join("+")),
            ),
          );
      }
    }
    if (
      v.eclipseQualified &&
      typeof v.eclipseQualified === "object" &&
      !Array.isArray(v.eclipseQualified)
    ) {
      d.eclipseQualified = {};
      for (const skill of ALL_WEAPONS) {
        const pairs = v.eclipseQualified[skill];
        if (Array.isArray(pairs))
          d.eclipseQualified[skill] = Array.from(
            new Set<string>(
              pairs
                .filter(
                  (x: any) =>
                    typeof x === "string" &&
                    isLegalModPair(skill, x.split("+")),
                )
                .map((x: string) => x.split("+").sort().join("+")),
            ),
          );
      }
    }
    if (
      v.edgeQualified &&
      typeof v.edgeQualified === "object" &&
      !Array.isArray(v.edgeQualified)
    ) {
      d.edgeQualified = {};
      for (const skill of ALL_WEAPONS) {
        const pairs = v.edgeQualified[skill];
        if (Array.isArray(pairs))
          d.edgeQualified[skill] = Array.from(
            new Set<string>(
              pairs
                .filter(
                  (x: any) =>
                    typeof x === "string" &&
                    isLegalModPair(skill, x.split("+")),
                )
                .map((x: string) => x.split("+").sort().join("+")),
            ),
          );
      }
    }
    if (
      v.kilnQualified &&
      typeof v.kilnQualified === "object" &&
      !Array.isArray(v.kilnQualified)
    ) {
      d.kilnQualified = {};
      for (const skill of ALL_WEAPONS) {
        const pairs = v.kilnQualified[skill];
        if (Array.isArray(pairs))
          d.kilnQualified[skill] = Array.from(
            new Set<string>(
              pairs
                .filter(
                  (x: any) =>
                    typeof x === "string" &&
                    isLegalModPair(skill, x.split("+")),
                )
                .map((x: string) => x.split("+").sort().join("+")),
            ),
          );
      }
    }
    if (Array.isArray(v.loomQualifiedOpeners))
      d.loomQualifiedOpeners = Array.from(
        new Set<Skill>(
          v.loomQualifiedOpeners.filter((x: any) => ALL_WEAPONS.includes(x)),
        ),
      );
    if (Array.isArray(v.sealOpeners))
      d.sealOpeners = Array.from(
        new Set<Skill>(
          v.sealOpeners.filter((x: any) => ALL_WEAPONS.includes(x)),
        ),
      );
    if (v.modWins && typeof v.modWins === "object") {
      d.modWins = {};
      for (const skill of ALL_WEAPONS) {
        const history = v.modWins[skill];
        if (!history || typeof history !== "object" || Array.isArray(history))
          continue;
        const result: Record<string, number[]> = {};
        for (const [pair, stages] of Object.entries(history))
          if (isLegalModPair(skill, pair.split("+")) && Array.isArray(stages))
            result[pair.split("+").sort().join("+")] = Array.from(
              new Set<number>(stages.filter(stage)),
            );
        if (Object.keys(result).length) d.modWins[skill] = result;
      }
    }
    return validProgress(d) ? { data: d, repaired: true } : null;
  } catch {
    return null;
  }
}
export function validProgress(d: any): d is ProgressData {
  return (
    (d?.coins === undefined ||
      (Number.isSafeInteger(d.coins) && d.coins >= 0)) &&
    (d?.purchasedWeapons === undefined ||
      (Array.isArray(d.purchasedWeapons) &&
        d.purchasedWeapons.every(
          (v: unknown) => v === "hammer" || v === "lamp",
        ) &&
        new Set(d.purchasedWeapons).size === d.purchasedWeapons.length)) &&
    (d?.achievements === undefined ||
      (Array.isArray(d.achievements) &&
        d.achievements.every((v: unknown) =>
          ACHIEVEMENTS.some((a) => a.id === v),
        ) &&
        new Set(d.achievements).size === d.achievements.length)) &&
    (d?.settledRuns === undefined ||
      (Array.isArray(d.settledRuns) &&
        d.settledRuns.every(
          (v: unknown) => typeof v === "string" && v.length < 120,
        ) &&
        new Set(d.settledRuns).size === d.settledRuns.length)) &&
    (d?.grades === undefined ||
      (d.grades &&
        typeof d.grades === "object" &&
        !Array.isArray(d.grades) &&
        Object.entries(d.grades).every(
          ([skill, g]) =>
            (ALL_WEAPONS as readonly string[]).includes(skill) &&
            validGrade(skill as Skill, g),
        ))) &&
    (d?.openerWins === undefined ||
      (Array.isArray(d.openerWins) &&
        d.openerWins.every(
          (v: any) =>
            (ALL_WEAPONS as readonly string[]).includes(v?.skill) &&
            (STAGE_IDS as readonly number[]).includes(v?.stage),
        ))) &&
    (d?.leadQualified === undefined ||
      (d.leadQualified &&
        typeof d.leadQualified === "object" &&
        !Array.isArray(d.leadQualified) &&
        Object.entries(d.leadQualified).every(
          ([skill, pairs]: [string, any]) =>
            (ALL_WEAPONS as readonly string[]).includes(skill) &&
            Array.isArray(pairs) &&
            new Set(pairs).size === pairs.length &&
            pairs.every(
              (pair: any) =>
                typeof pair === "string" &&
                isLegalModPair(skill as Skill, pair.split("+")) &&
                pair === pair.split("+").sort().join("+"),
            ),
        ))) &&
    (d?.graveQualified === undefined ||
      (d.graveQualified &&
        typeof d.graveQualified === "object" &&
        !Array.isArray(d.graveQualified) &&
        Object.entries(d.graveQualified).every(
          ([skill, pairs]: [string, any]) =>
            (ALL_WEAPONS as readonly string[]).includes(skill) &&
            Array.isArray(pairs) &&
            new Set(pairs).size === pairs.length &&
            pairs.every(
              (pair: any) =>
                typeof pair === "string" &&
                graveRecipe(skill as Skill, pair.split("+")) &&
                pair === pair.split("+").sort().join("+"),
            ),
        ))) &&
    (d?.eclipseQualified === undefined ||
      (d.eclipseQualified &&
        typeof d.eclipseQualified === "object" &&
        !Array.isArray(d.eclipseQualified) &&
        Object.entries(d.eclipseQualified).every(
          ([skill, pairs]: [string, any]) =>
            (ALL_WEAPONS as readonly string[]).includes(skill) &&
            Array.isArray(pairs) &&
            new Set(pairs).size === pairs.length &&
            pairs.every(
              (pair: any) =>
                typeof pair === "string" &&
                isLegalModPair(skill as Skill, pair.split("+")) &&
                pair === pair.split("+").sort().join("+"),
            ),
        ))) &&
    (d?.edgeQualified === undefined ||
      (d.edgeQualified &&
        typeof d.edgeQualified === "object" &&
        !Array.isArray(d.edgeQualified) &&
        Object.entries(d.edgeQualified).every(
          ([skill, pairs]: [string, any]) =>
            (ALL_WEAPONS as readonly string[]).includes(skill) &&
            Array.isArray(pairs) &&
            new Set(pairs).size === pairs.length &&
            pairs.every(
              (pair: any) =>
                typeof pair === "string" &&
                isLegalModPair(skill as Skill, pair.split("+")) &&
                pair === pair.split("+").sort().join("+"),
            ),
        ))) &&
    (d?.kilnQualified === undefined ||
      (d.kilnQualified &&
        typeof d.kilnQualified === "object" &&
        !Array.isArray(d.kilnQualified) &&
        Object.entries(d.kilnQualified).every(
          ([skill, pairs]: [string, any]) =>
            (ALL_WEAPONS as readonly string[]).includes(skill) &&
            Array.isArray(pairs) &&
            new Set(pairs).size === pairs.length &&
            pairs.every(
              (pair: any) =>
                typeof pair === "string" &&
                isLegalModPair(skill as Skill, pair.split("+")) &&
                pair === pair.split("+").sort().join("+"),
            ),
        ))) &&
    (d?.loomQualifiedOpeners === undefined ||
      (Array.isArray(d.loomQualifiedOpeners) &&
        d.loomQualifiedOpeners.every((v: any) =>
          (ALL_WEAPONS as readonly string[]).includes(v),
        ) &&
        new Set(d.loomQualifiedOpeners).size ===
          d.loomQualifiedOpeners.length)) &&
    (d?.sealOpeners === undefined ||
      (Array.isArray(d.sealOpeners) &&
        d.sealOpeners.every((v: any) =>
          (ALL_WEAPONS as readonly string[]).includes(v),
        ) &&
        new Set(d.sealOpeners).size === d.sealOpeners.length)) &&
    (d?.modWins === undefined ||
      (d.modWins &&
        typeof d.modWins === "object" &&
        !Array.isArray(d.modWins) &&
        Object.entries(d.modWins).every(
          ([skill, combinations]: [string, any]) =>
            (ALL_WEAPONS as readonly string[]).includes(skill) &&
            combinations &&
            typeof combinations === "object" &&
            !Array.isArray(combinations) &&
            Object.entries(combinations).every(
              ([pair, stages]: [string, any]) =>
                isLegalModPair(skill as Skill, pair.split("+")) &&
                Array.isArray(stages) &&
                stages.every((id: any) =>
                  (STAGE_IDS as readonly number[]).includes(id),
                ),
            ),
        ))) &&
    d?.version === 1 &&
    d.rules === "armory-v1" &&
    Number.isSafeInteger(d.revision) &&
    d.revision >= 0 &&
    Array.isArray(d.stages) &&
    d.stages.every((id: number) =>
      (STAGE_IDS as readonly number[]).includes(id),
    ) &&
    new Set(d.stages).size === d.stages.length &&
    ["kills", "time", "weapons"].every(
      (k) => Number.isFinite(d.best?.[k]) && d.best[k] >= 0,
    ) &&
    d.stageBest &&
    typeof d.stageBest === "object" &&
    !Array.isArray(d.stageBest) &&
    Object.entries(d.stageBest).every(
      ([id, b]: [string, any]) =>
        (STAGE_IDS as readonly number[]).includes(Number(id)) &&
        Number.isFinite(b?.time) &&
        b.time >= 0 &&
        Number.isInteger(b.phase) &&
        b.phase >= 0 &&
        b.phase <= 3 &&
        typeof b.won === "boolean" &&
        (b.bossRemaining === null ||
          (Number.isFinite(b.bossRemaining) &&
            b.bossRemaining >= 0 &&
            b.bossRemaining <= 100)),
    )
  );
}
