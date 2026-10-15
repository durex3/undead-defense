import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import {
  ProgressStore,
  PROGRESS_KEY,
} from "../temp/tests/platform/ProgressStore.mjs";
import { stepEnemies } from "../temp/tests/battle/EnemySystem.mjs";
import {
  resolveGarden,
  GARDEN_STONES,
} from "../temp/tests/battle/GardenMap.mjs";
function storage() {
  const m = new Map();
  return {
    m,
    getItem: (k) => m.get(k) || null,
    setItem: (k, v) => m.set(k, v),
  };
}
test("malformed duplicate achievements cannot unlock heroes", () => {
  const s = storage();
  s.m.set(
    PROGRESS_KEY,
    JSON.stringify({
      version: 1,
      revision: 2,
      achievements: ["level", "level", "level"],
      evolutions: [],
      winners: [],
      stages: [],
    }),
  );
  assert.equal(new ProgressStore(s).data.achievements.length, 0);
});
test("character starting weapons are exclusive and passives apply only to intended weapons", () => {
  const a = new SurvivalWorld(1, "alchemist");
  assert.equal(a.weaponCount, 1);
  assert.equal(a.skills.water, 1);
  assert.equal(a.bladeCount, 0);
  a.expansion.cast("water");
  assert.ok(
    Math.abs(a.expansion.fields[0].until - a.expansion.fields[0].due - 4.8) <
      1e-8,
  );
  const n = new SurvivalWorld(1, "necromancer");
  assert.equal(n.skills.ghost, 1);
  assert.equal(n.bladeCount, 0);
  assert.equal(n.cooldownFactor("ghost"), 0.9);
  assert.equal(n.cooldownFactor("bat"), 0.9);
  assert.equal(n.cooldownFactor("fire"), 1);
  n.level = 2;
  n.roll();
  assert.ok(n.cards.includes("ghost"));
});
test("garden obstacles resolve overlap and guardian uses fixed tombstone target", () => {
  const p = { ...GARDEN_STONES[0] };
  resolveGarden(p);
  assert.ok(
    Math.hypot(p.x - GARDEN_STONES[0].x, p.y - GARDEN_STONES[0].y) >=
      1.35 - 1e-8,
  );
  const w = new SurvivalWorld(1, "ranger", 2);
  w.time = 250;
  const boss = w.addEnemy("boss", 6, 0);
  boss.state = "seek";
  boss.pattern = 1;
  boss.attack = 0;
  boss.visibleSince = 248;
  stepEnemies(w, 1 / 60);
  const h = w.hazards[0];
  assert.equal(h.kind, "circle");
  assert.equal(h.x, 0);
  assert.equal(h.y, 0);
  w.player.x = 4;
  assert.equal(h.x, 0);
  assert.equal(h.radius, 1.35);
});
test("alchemist aims holy water at nearby pursuing enemies even while moving away", () => {
  const w = new SurvivalWorld(1, "alchemist");
  w.setMove(1, 0);
  w.addEnemy("minion", -2, 0);
  w.expansion.cast("water");
  assert.equal(w.expansion.fields[0].x, -2);
  const ranger = new SurvivalWorld();
  ranger.skills.water = 1;
  ranger.setMove(1, 0);
  ranger.addEnemy("minion", -2, 0);
  ranger.expansion.cast("water");
  assert.equal(ranger.expansion.fields[0].x, -2);
});
