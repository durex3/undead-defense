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
test("achievements count once, require staged character unlocks, survive defeat and reload", () => {
  const s = storage(),
    p = new ProgressStore(s),
    w = new SurvivalWorld();
  w.level = 2;
  w.skills.fire = 1;
  w.skills.water = 1;
  w.skills.bone = 1;
  assert.equal(p.observe(w).length, 3);
  assert.equal(p.unlockedCharacter("alchemist"), false);
  assert.equal(p.unlockedCharacter("necromancer"), false);
  assert.deepEqual(p.observe(w), []);
  w.evolutions.fire = "meteor";
  w.eliteKills = 1;
  w.time = 180;
  assert.equal(p.observe(w).length, 3);
  w.state = "lost";
  p.observe(w);
  const restored = new ProgressStore(s);
  assert.equal(restored.unlockedCharacter("necromancer"), false);
  assert.equal(restored.data.achievements.length, 6);
  assert.equal(restored.unlockedStage(2), false);
});
test("evolutions accumulate across failed runs; wins unlock garden and two-character achievement", () => {
  const p = new ProgressStore(storage());
  for (const skill of ["fire", "water", "bone"]) {
    const w = new SurvivalWorld();
    w.evolutions[skill] = "test";
    w.state = "lost";
    p.observe(w);
  }
  assert.ok(p.data.achievements.includes("three"));
  const w = new SurvivalWorld();
  w.state = "won";
  p.observe(w);
  assert.ok(p.unlockedStage(2));
  const other = new SurvivalWorld(1, "alchemist", 2);
  other.state = "won";
  p.observe(other);
  assert.ok(p.data.achievements.includes("heroes"));
  assert.equal(p.data.winners.length, 2);
  p.observe(other);
  assert.equal(p.data.winners.length, 2);
});
test("corrupt primary restores backup; failed storage retains pending progress and retries", () => {
  const s = storage(),
    p = new ProgressStore(s),
    w = new SurvivalWorld();
  w.level = 2;
  p.observe(w);
  s.m.set(PROGRESS_KEY, "broken");
  assert.equal(new ProgressStore(s).data.achievements.length, 1);
  let fail = true;
  const broken = {
    getItem: () => null,
    setItem: () => {
      if (fail) throw Error("quota");
    },
  };
  const q = new ProgressStore(broken);
  q.observe(w);
  assert.ok(q.pending);
  assert.equal(q.data.achievements.length, 1);
  fail = false;
  assert.ok(q.flush());
  assert.equal(q.pending, false);
});
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

test("v1 saves migrate without losing unlocks and progress never adds kills across runs", () => {
  const s = storage();
  s.m.set(
    PROGRESS_KEY,
    JSON.stringify({
      version: 1,
      revision: 4,
      achievements: ["level", "learn", "four"],
      evolutions: ["fire", "water"],
      winners: ["ranger"],
      stages: [1],
    }),
  );
  const p = new ProgressStore(s);
  assert.equal(p.data.version, 3);
  assert.ok(p.unlockedCharacter("alchemist"));
  assert.equal(p.progressLine("three"), "已进化 2/3 种");
  for (const kills of [187, 140]) {
    const w = new SurvivalWorld();
    w.kills = kills;
    w.state = "lost";
    p.observe(w);
  }
  assert.equal(p.data.best.kills, 187);
  assert.equal(p.data.achievements.includes("kills"), false);
  assert.equal(new ProgressStore(s).data.best.kills, 187);
  const w = new SurvivalWorld();
  w.kills = 25;
  assert.ok(p.progressLine("kills", w).includes("本局 25/300"));
  assert.ok(p.progressLine("kills", w).includes("最佳 187"));
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
