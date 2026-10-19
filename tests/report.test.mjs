import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { battleReport } from "../temp/tests/battle/BattleReport.mjs";
import { ENEMIES } from "../temp/tests/battle/SurvivalConfig.mjs";
test("received damage excludes lethal overkill and invulnerable hits; empty report is finite", () => {
  const w = new SurvivalWorld();
  assert.ok(battleReport(w).rows.every((r) => r.share === 0));
  w.hp = 3;
  w.hurt(20, "siegebow");
  w.hurt(20, "siegebow");
  assert.equal(battleReport(w).losses[0].damage, 3);
  assert.equal(battleReport(w).losses[0].name, ENEMIES.siegebow.name);
  assert.equal(new SurvivalWorld().weaponKills.siegebow, undefined);
});
