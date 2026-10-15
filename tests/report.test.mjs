import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { battleReport } from "../temp/tests/battle/BattleReport.mjs";
test("received damage excludes lethal overkill and invulnerable hits; empty report is finite", () => {
  const w = new SurvivalWorld();
  assert.ok(battleReport(w).rows.every((r) => r.share === 0));
  w.hp = 3;
  w.hurt(20, "archer");
  w.hurt(20, "archer");
  assert.equal(battleReport(w).losses[0].damage, 3);
  assert.equal(battleReport(w).losses[0].name, "骨弓猎手");
  assert.equal(new SurvivalWorld().weaponKills.archer, undefined);
});
