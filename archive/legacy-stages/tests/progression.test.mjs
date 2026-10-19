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
