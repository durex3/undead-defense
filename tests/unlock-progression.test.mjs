import test from "node:test";
import assert from "node:assert/strict";
import {
  ProgressStore,
  PROGRESS_KEY,
} from "../temp/tests/platform/ProgressStore.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { ALL_WEAPONS, WEAPONS } from "../temp/tests/battle/SurvivalConfig.mjs";
const storage = () => {
  const m = new Map();
  return {
    m,
    getItem: (k) => m.get(k) || null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
};
function win(stage) {
  const w = new SurvivalWorld(31, "ranger", stage);
  w.state = "won";
  return w;
}
test("old armory progress retains stages and starts with no invented coins or challenge telemetry", () => {
  const s = storage(),
    d = new ProgressStore(s).data;
  for (const key of [
    "coins",
    "achievements",
    "settledRuns",
    "purchasedWeapons",
  ])
    delete d[key];
  d.stages = [1, 2, 3, 4];
  s.setItem(PROGRESS_KEY, JSON.stringify(d));
  const p = new ProgressStore(s);
  assert(p.unlockedStage(5));
  assert.equal(p.coins, 0);
  assert(!p.unlockedWeapon("wheel"));
  assert.deepEqual(p.data.stages, [1, 2, 3, 4]);
});
test("victory grants fixed coins once per run, failure grants none, repeat successful runs do grant coins", () => {
  const s = storage(),
    p = new ProgressStore(s),
    w = win(3);
  p.observe(w);
  p.observe(w);
  assert.equal(p.coins, 140);
  assert.equal(new ProgressStore(s).coins, 140);
  const lost = win(3);
  lost.state = "lost";
  p.observe(lost);
  assert.equal(p.coins, 140);
  p.observe(win(3));
  assert.equal(p.coins, 280);
});
test("gold purchase has no achievement or stage prerequisite, spends once, survives corrupt primary", () => {
  const s = storage(),
    p = new ProgressStore(s);
  assert.equal(p.buyHammer(), "insufficient");
  p.data.coins = 360;
  assert.equal(p.buyHammer(), "purchased");
  assert.equal(p.coins, 0);
  assert(p.unlockedWeapon("hammer"));
  assert(!p.hasAchievement("forge_mastery"));
  assert.equal(p.buyHammer(), "already");
  s.setItem(PROGRESS_KEY, "broken");
  assert(new ProgressStore(s).unlockedWeapon("hammer"));
});
test("failed purchase never changes in-memory ownership or balance; failed victory saves retry without duplicate rewards", () => {
  const s = storage();
  let fail = true;
  const p = new ProgressStore({
    ...s,
    setItem: (k, v) => {
      if (fail) throw Error("quota");
      s.setItem(k, v);
    },
  });
  p.data.coins = 360;
  assert.equal(p.buyHammer(), "save-failed");
  assert.equal(p.coins, 360);
  assert(!p.unlockedWeapon("hammer"));
  const w = win(1);
  p.observe(w);
  p.observe(w);
  assert.equal(p.coins, 460);
  assert(p.pending);
  fail = false;
  assert(p.flush());
  assert.equal(new ProgressStore(s).coins, 460);
});
test("achievement requires real third-stage victory with level-eight double mods, never charges coins", () => {
  const p = new ProgressStore(storage()),
    w = win(3);
  w.skills.blade = 8;
  w.mods.blade = ["orbit"];
  p.observe(w);
  assert(!p.unlockedWeapon("wheel"));
  const q = win(3);
  q.skills.blade = 8;
  q.mods.blade = ["orbit", "return"];
  p.observe(q);
  assert(p.unlockedWeapon("wheel"));
  assert(p.hasAchievement("forge_mastery"));
  assert.equal(p.coins, 280);
  assert(!p.unlockedWeapon("hammer"));
  const before = p.coins;
  p.observe(q);
  assert.equal(p.coins, before);
});
test("stage five unlock uses prior clear only, not currency, flywheel, hammer or achievement", () => {
  const p = new ProgressStore(storage());
  p.data.stages = [4];
  assert(p.unlockedStage(5));
  assert(!p.unlockedWeapon("wheel"));
  assert(!p.unlockedWeapon("hammer"));
});
test("both new weapons are filtered from locked random pools, and unlocked pools remain random with misses", () => {
  const p = new ProgressStore(storage());
  let hammer = 0,
    miss = 0;
  for (let i = 1; i <= 100; i++) {
    const w = new SurvivalWorld(i * 7919);
    w.availableWeapons = p.availableWeapons;
    w.offerStartingWeapons();
    assert.equal(w.startingWeapons.length, 3);
    assert(w.startingWeapons.every((s) => WEAPONS.includes(s)));
    const u = new SurvivalWorld(i * 7919);
    u.availableWeapons = [...WEAPONS, "hammer"];
    u.offerStartingWeapons();
    if (u.startingWeapons.includes("hammer")) hammer++;
    else miss++;
    u.chooseStartingWeapon(u.startingWeapons[0]);
    assert(!u.upgrades.legal().includes("wheel"));
  }
  assert(hammer > 0 && miss > 0);
  assert.equal(ALL_WEAPONS.length, 14);
});
test("invalid account data falls back to valid backup rather than granting counterfeit unlocks", () => {
  const s = storage(),
    p = new ProgressStore(s);
  p.observe(win(1));
  s.setItem(
    PROGRESS_KEY,
    JSON.stringify({
      ...p.data,
      revision: 99,
      coins: -1,
      purchasedWeapons: ["wheel"],
    }),
  );
  const q = new ProgressStore(s);
  assert.equal(q.coins, 100);
  assert(!q.unlockedWeapon("wheel"));
});
test("duplicate or mutually exclusive modification snapshots cannot award flywheel", () => {
  for (const mods of [
    ["orbit", "orbit"],
    ["orbit", "hunt"],
    ["fake", "return"],
  ]) {
    const p = new ProgressStore(storage()),
      w = win(3);
    w.skills.blade = 8;
    w.mods.blade = mods;
    p.observe(w);
    assert(!p.unlockedWeapon("wheel"));
  }
});
