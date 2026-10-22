import test from "node:test";
import assert from "node:assert/strict";
import { auditContent } from "../tools/content-audit.mjs";
import { ACHIEVEMENTS } from "../temp/tests/battle/UnlockConfig.mjs";
import { STAGES } from "../temp/tests/battle/StageRules.mjs";
import { WEAPON_BALANCE } from "../temp/tests/battle/WeaponBalance.mjs";
import { CATALOG_STAGE_KINDS } from "../temp/tests/presentation/art/EnemyCatalog.mjs";
import { drawWeaponGlyph } from "../temp/tests/presentation/art/WeaponGlyph.mjs";
test("all current content has executable strategies, reward routes and drawable art", () => {
  const result = auditContent();
  assert.deepEqual(result.issues, []);
  assert(result.ok);
  assert(
    result.counts.stages >= 16 &&
      result.counts.weapons >= 14 &&
      result.counts.weaponForms >= 30,
  );
});
test("omitted stage registration, budget and silently blank glyph are rejected with their content ID", () => {
  const stages = { ...STAGES };
  delete stages[16];
  const budgets = { ...WEAPON_BALANCE };
  delete budgets.fire;
  const result = auditContent({
    stages,
    budgets,
    glyph: (g, s, grade) => {
      if (s !== "water") drawWeaponGlyph(g, s, grade);
    },
  });
  assert(!result.ok);
  assert(result.issues.some((v) => v.startsWith("stage 16:")));
  assert(result.issues.some((v) => v.startsWith("weapon fire:")));
  assert(result.issues.some((v) => v.startsWith("weapon water:")));
});
test("enemy art membership assigned to the wrong stage is rejected against live gameplay dispatch", () => {
  const result = auditContent({
    stageKinds: {
      ...CATALOG_STAGE_KINDS,
      16: [...CATALOG_STAGE_KINDS[16], "siegebow"],
    },
  });
  assert(!result.ok);
  assert(result.issues.some((v) => v.startsWith("stage 16:")));
});

test("a catalog achievement with no settlement rule reference is rejected instead of silently becoming unattainable", () => {
  const result = auditContent({
    achievements: [
      ...ACHIEVEMENTS,
      {
        id: "unregistered_future_challenge",
        name: "未来挑战",
        condition: "条件",
        reward: "奖励",
        weapon: null,
        category: "机制挑战",
      },
    ],
  });
  assert(!result.ok);
  assert(
    result.issues.some((v) =>
      v.startsWith("achievement unregistered_future_challenge:"),
    ),
  );
});
