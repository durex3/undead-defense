import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { separateCrowd } from "../temp/tests/battle/CrowdMovement.mjs";
import { distance } from "../temp/tests/battle/SurvivalTypes.mjs";
const world = (stage = 16) => {
  const w = new SurvivalWorld(31, "ranger", stage);
  w.time = 400;
  w.player = { x: 0, y: 0 };
  return w;
};
test("ranged spacing holds during reload, releases ready casts and retreats for a bounded interval", () => {
  const w = world(),
    e = w.addEnemy("echoacolyte", -3.8, 0);
  e.state = "seek";
  e.attack = 1;
  assert(w.enemyTactics.step(e, 0.1));
  assert.equal(e.x, -3.8);
  assert.equal(e.attack, 0.9);
  e.attack = 0;
  assert(!w.enemyTactics.step(e, 0.1));
  e.x = -1;
  assert(w.enemyTactics.step(e, 0.1));
  assert(e.x < -1);
  w.time += 1.3;
  assert(!w.enemyTactics.step(e, 0.1));
  assert.equal(w.enemyTactics.ranged.stats.yields, 1);
});
test("ranged relocation routes around a real wall and eventually exposes an original cast opportunity", () => {
  const w = world(1);
  w.player = { x: -13, y: -8 };
  const e = w.addEnemy("siegebow", -5, -8);
  e.state = "seek";
  e.attack = 0;
  assert(w.stageStrategy.map.segment(e, w.player, 0.25));
  let released = false;
  for (let i = 0; i < 900; i++) {
    w.time += 1 / 30;
    const handled = w.enemyTactics.step(e, 1 / 30);
    assert(!w.stageStrategy.map.blocked(e, 0.349));
    if (!handled && !w.stageStrategy.map.segment(e, w.player, 0.25)) {
      released = true;
      break;
    }
  }
  assert(released, JSON.stringify(e));
  assert(w.enemyTactics.ranged.stats.searches < 150);
});
test("ranged actors never move a frozen body or alter a published warning", () => {
  const w = world(),
    e = w.addEnemy("echoacolyte", -1, 0);
  e.state = "seek";
  e.freezeUntil = 401;
  assert(!w.enemyTactics.step(e, 0.1));
  assert.equal(e.x, -1);
  e.freezeUntil = 0;
  const h = { source: e.id, until: 405, x: 2, y: 1, angle: 0.8 };
  w.hazards = [h];
  const old = JSON.stringify(h);
  assert(!w.enemyTactics.step(e, 0.1));
  assert.equal(e.x, -1);
  assert.equal(JSON.stringify(h), old);
});
test("a cached waypoint is discarded after seeking makes no progress", () => {
  const w = world(),
    e = w.addEnemy("ribwarden", -5, 0);
  e.state = "seek";
  e.navWaypoint = { x: 50, y: 50 };
  w.enemyTactics.step(e, 0.1);
  w.time += 1.3;
  w.enemyTactics.step(e, 0.1);
  assert.equal(e.navWaypoint, undefined);
  assert.equal(w.enemyTactics.stats.repaths, 1);
});
test("exactly stacked melee separate without exceeding their per-frame displacement budget", () => {
  const w = world();
  const a = w.addEnemy("gravegrub", 0, 0),
    b = w.addEnemy("gravegrub", 0, 0);
  a.state = b.state = "seek";
  separateCrowd(w, 1 / 30);
  assert(distance(a, b) > 0);
  assert(distance(a, { x: 0, y: 0 }) <= 0.040001);
  assert(distance(b, { x: 0, y: 0 }) <= 0.040001);
});
test("crowd pressure cannot displace frozen actors, committed warnings, or a body through a wall", () => {
  const w = world(1),
    a = w.addEnemy("siegebone", -10.76, -8),
    b = w.addEnemy("siegebone", -11, -8);
  a.state = b.state = "seek";
  for (let i = 0; i < 60; i++) {
    separateCrowd(w, 1 / 30);
    assert(!w.stageStrategy.map.blocked(a, 0.349));
    assert(!w.stageStrategy.map.blocked(b, 0.349));
  }
  a.freezeUntil = w.time + 1;
  const before = { x: a.x, y: a.y };
  separateCrowd(w, 0.1);
  assert.deepEqual({ x: a.x, y: a.y }, before);
  a.freezeUntil = 0;
  w.hazards = [{ source: a.id, until: w.time + 1 }];
  separateCrowd(w, 0.1);
  assert.deepEqual({ x: a.x, y: a.y }, before);
});
