import test from "node:test";
import assert from "node:assert/strict";
import { BattleWorld } from "../temp/tests/battle/BattleWorld.mjs";
import { SaveStore } from "../temp/tests/platform/SaveStore.mjs";
import { stageWaves, XP } from "../temp/tests/battle/Config.mjs";
test("wave totals and experience match design", () => {
  const waves = stageWaves(1);
  assert.equal(waves.slice(0, 9).flat().length, 192);
  assert.equal(
    XP.reduce((a, b) => a + b),
    248,
  );
});
test("death awards experience once and armor reduces physical damage", () => {
  const w = new BattleWorld();
  const e = w.addEnemy("warrior", 0, 5);
  w.hit(e, 20, "gun", false);
  assert.equal(e.hp, 166);
  w.hit(e, 999, "fire", false);
  w.hit(e, 999, "fire", false);
  assert.equal(w.xp, 3);
  assert.equal(w.kills, 1);
});
test("pause reasons compose and block time", () => {
  const w = new BattleWorld();
  w.pause("background", true);
  w.pause("user", true);
  w.pause("user", false);
  w.step(1);
  assert.equal(w.time, 0);
  w.pause("background", false);
  w.step(1 / 30);
  assert.ok(w.time > 0);
});
test("cards never duplicate or offer a fourth skill or capped stats", () => {
  for (let seed = 1; seed < 100; seed++) {
    const w = new BattleWorld(1, 0, 0, seed);
    w.skills = { fire: 5, ice: 3, lightning: 2, ballista: 0 };
    w.power = 3;
    w.haste = 3;
    w.xp = 8;
    w.step(1 / 30);
    assert.equal(w.state, "upgrade");
    assert.equal(new Set(w.cards).size, w.cards.length);
    assert.ok(
      w.cards.every((c) => !["fire", "ballista", "power", "haste"].includes(c)),
    );
  }
});
test("upgrade overflow queues; invalid choices do not mutate", () => {
  const w = new BattleWorld();
  w.xp = 30;
  w.step(1 / 30);
  assert.equal(w.level, 2);
  assert.equal(w.choose("gold"), false);
  assert.ok(w.choose(w.cards[0]));
  assert.equal(w.level, 3);
  assert.equal(w.state, "upgrade");
});
test("fast swept projectile hits target once", () => {
  const w = new BattleWorld();
  w.addEnemy("minion", 0, 3);
  w.shots.push({
    id: 90,
    skill: "gun",
    x: 0,
    y: 0,
    vx: 0,
    vy: 300,
    damage: 20,
    left: 1,
    hit: [],
    target: 1,
    ttl: 1,
  });
  w.step(1 / 30);
  assert.ok(w.enemies.find((e) => e.id === 1).hp <= 40);
  assert.ok(!w.shots.some((p) => p.id === 90));
});
test("simultaneous wall loss has priority", () => {
  const w = new BattleWorld();
  w.hp = 0;
  w.step(1 / 30);
  assert.equal(w.state, "lost");
});
test("settlement and first win are idempotent; corrupt primary restores backup", () => {
  const m = new Map();
  const port = {
    getItem: (k) => m.get(k) || null,
    setItem: (k, v) => m.set(k, v),
  };
  const s = new SaveStore(port);
  assert.equal(s.settle("run-a", 1, true, 10), 300);
  assert.equal(s.settle("run-a", 1, true, 10), 0);
  assert.equal(s.data.coins, 300);
  assert.ok(s.buy("weapon"));
  assert.equal(s.data.weapon, 1);
  assert.equal(s.data.coins, 200);
  m.set("undead-defense-v1", "broken");
  assert.equal(new SaveStore(port).data.coins, 300);
});
test("failed storage write does not mutate live balance", () => {
  const s = new SaveStore({
    getItem: () => null,
    setItem: () => {
      throw Error("quota");
    },
  });
  assert.throws(() => s.settle("x", 1, true, 10));
  assert.equal(s.data.coins, 0);
});
