import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import {
  bellMap,
  BELL_BASES,
  bellCovered,
} from "../temp/tests/battle/BellMap.mjs";
import { bellHit } from "../temp/tests/battle/BellGeometry.mjs";
import { STAGE_IDS } from "../temp/tests/battle/ProgressionConfig.mjs";
import { enemyArt } from "../temp/tests/presentation/art/EnemyCatalog.mjs";
import { BELL_KINDS } from "../temp/tests/battle/BellSystem.mjs";
function world() {
  const w = new SurvivalWorld(31, "ranger", 5);
  w.enemies = [];
  w.player = { x: 0, y: -4 };
  w.armory.step = () => {};
  return w;
}
function wave() {
  return {
    id: 1,
    source: 1,
    kind: "bellRing",
    x: 0,
    y: 0,
    created: 0,
    due: 1,
    until: 3,
    radius: 8,
    angle: 0,
    width: 0.25,
    widthAngle: Math.PI / 2,
    damage: 26,
    fired: false,
    next: 0,
    bell: {
      shape: "wave",
      hit: false,
      last: 1,
      order: 1,
      from: { x: 0, y: 0 },
      to: { x: 8, y: 0 },
      speed: 6,
    },
  };
}
test("fifth strategy supplies real map collision and covers every wax silhouette", () => {
  const w = world();
  assert.equal(w.stageStrategy.map, bellMap);
  assert(STAGE_IDS.includes(5));
  for (const k of [...BELL_KINDS, "boss"])
    assert.equal(enemyArt(5, k).stage, 5);
  for (const b of BELL_BASES) {
    assert(bellMap.blocked(b, 0.3));
    w.player = { x: b.x - b.halfWidth - 0.5, y: b.y };
    w.move = { x: 1, y: 0 };
    w.director.step = () => {};
    w.step(2);
    assert(w.player.x <= b.x - b.halfWidth - 0.299);
  }
});
test("clocked wave uses swept annulus, finite sector, body radius and solid cover", () => {
  const h = wave();
  assert(bellHit(h, { x: 4, y: 0 }, 1.8, 1.5));
  assert(!bellHit(h, { x: 0, y: 4 }, 1.8, 1.5));
  assert(!bellHit(h, { x: 4, y: 0 }, 0.9));
  h.x = 0;
  h.y = -8;
  h.angle = Math.PI;
  h.radius = 20;
  h.until = 5;
  assert(bellCovered(h, { x: -13, y: -8 }));
  assert(!bellHit(h, { x: -13, y: -8 }, 3.3, 2.9));
  assert(!bellCovered(h, { x: -13, y: -3 }));
});
test("wax passes cover; dashes stop at real clock bases", () => {
  const h = wave();
  h.bell.shape = "wax";
  h.x = -13;
  h.y = -8;
  h.radius = 1.3;
  assert(bellHit(h, { x: -13, y: -8 }, 1.05));
  const w = world();
  w.player = { x: -14, y: -8 };
  const e = w.addEnemy("waxporter", -5, -8);
  e.state = "seek";
  e.bell = {
    action: "charge",
    step: 0,
    next: 0,
    recover: 3,
    reserved: 2,
    vulnerable: false,
  };
  w.bell.reserve(e, 2);
  w.bell.publish(e, "dash", 1);
  for (const hazard of w.hazards)
    assert(!bellMap.blocked(hazard.bell.to, 0.64));
});
test("armor is uniform, fracture precedes damage and expires, recovery gives a base-pool opening", () => {
  const w = world(),
    e = w.addEnemy("boss", 0, 0);
  e.state = "seek";
  const max = e.hp;
  w.hit(e, 100, "blade");
  assert(Math.abs(max - e.hp - 45) < 1e-6);
  w.fracture(e);
  const hp = e.hp;
  w.hit(e, 100, "wheel");
  assert(Math.abs(hp - e.hp - 80) < 1e-6);
  w.fracture(e);
  const hp2 = e.hp;
  w.hit(e, 100, "fire");
  assert(Math.abs(hp2 - e.hp - 100) < 1e-6);
  w.time = 4;
  e.state = "recover";
  e.bell = {
    action: "A",
    step: 0,
    next: 0,
    recover: 3,
    reserved: 0,
    vulnerable: true,
  };
  const hp3 = e.hp;
  w.hit(e, 100, "blade");
  assert(Math.abs(hp3 - e.hp - 106.25) < 1e-6);
  const other = new SurvivalWorld(31, "ranger", 4),
    o = other.addEnemy("thornrunner");
  o.state = "seek";
  other.fracture(o, 2);
  const before = o.hp;
  other.hit(o, 10, "wheel");
  assert.equal(before - o.hp, 10);
});
test("unfired attacks cancel on death, fired waves survive, body dashes cancel", () => {
  const w = world(),
    e = w.addEnemy("bellacolyte", 0, 0);
  e.state = "seek";
  const pending = wave();
  pending.source = e.id;
  const fired = {
    ...wave(),
    id: 2,
    source: e.id,
    fired: true,
    bell: { ...wave().bell },
  };
  w.hazards = [pending, fired];
  e.hp = 0;
  w.bell.onDeath(e);
  assert.equal(pending.until, w.time);
  assert(fired.until > w.time);
  assert.equal(w.bell.slots, 1);
  const d = {
    ...wave(),
    id: 3,
    source: e.id,
    fired: true,
    bell: { ...wave().bell, shape: "dash" },
  };
  w.hazards = [d];
  w.bell.onDeath(e);
  assert.equal(d.until, w.time);
});
test("reservation never admits a third danger and freeze preserves full unpublished warning", () => {
  const w = world(),
    e = w.addEnemy("boss", 0, 0),
    other = w.addEnemy("bellacolyte", 1, 1);
  e.state = "seek";
  other.state = "seek";
  assert(w.bell.reserve(e, 2));
  assert(!w.bell.reserve(other, 1));
  assert.equal(w.bell.slots, 2);
  const h = wave();
  h.source = e.id;
  w.hazards = [h];
  e.bell = {
    action: "A",
    step: 1,
    next: 3.4,
    recover: 3,
    reserved: 2,
    vulnerable: false,
  };
  e.freezeUntil = 1;
  w.bell.stepEnemy(e, 0.5);
  assert.equal(h.due, 1.5);
  assert.equal(e.bell.next, 3.9);
});
test("boss completes all patterns, maintains two-slot budget and enters phase without healing", () => {
  const w = world(),
    e = w.addEnemy("boss", 0, 0);
  e.state = "seek";
  e.attack = 0;
  w.director.step = () => {};
  w.hp = w.maxHp = 1e8;
  for (let i = 0; i < 4200; i++) {
    w.step(1 / 60);
    assert(w.bell.slots <= 2);
  }
  assert(w.bell.stats.boss >= 3);
  assert(w.bell.stats.waves > 0);
  assert(w.bell.stats.wax > 0);
  e.hp = e.maxHp * 0.49;
  const hp = e.hp;
  w.step(1 / 60);
  assert.equal(e.bossPhase, 2);
  assert.equal(e.hp, hp);
  assert.equal(e.bell.action, "transition");
});
test("six-minute director preserves live elite at boss handoff and entity limits", () => {
  const w = world();
  w.hp = w.maxHp = 1e8;
  w.time = 359.99;
  const elite = w.addEnemy("twinbell", 6, 0);
  elite.state = "seek";
  for (let i = 0; i < 300; i++) w.step(1 / 60);
  assert(w.enemies.includes(elite));
  const b = w.enemies.find((e) => e.kind === "boss");
  assert(b);
  assert.equal(w.bell.stats.boss, 0);
  assert(w.enemies.length <= 100);
  elite.hp = 0;
  w.bell.onDeath(elite);
  for (let i = 0; i < 170; i++) w.step(1 / 60);
  assert.equal(w.bell.stats.boss, 0);
});
test("frozen launched body stops moving while emitted sound continues its own clock", () => {
  const w = world(),
    e = w.addEnemy("waxporter", 0, 0);
  e.state = "charge";
  e.freezeUntil = 5;
  e.bell = {
    action: "charge",
    step: 1,
    next: 3,
    recover: 3,
    reserved: 2,
    vulnerable: false,
  };
  const h = wave();
  h.source = e.id;
  h.fired = true;
  h.due = 0;
  h.until = 3;
  h.bell.shape = "dash";
  w.hazards = [h];
  w.time = 1;
  e.freezeUntil = 0;
  w.bell.stepHazard(h);
  e.freezeUntil = 5;
  const at = { x: e.x, y: e.y };
  w.time = 1.5;
  w.bell.stepEnemy(e, 0.5);
  w.bell.stepHazard(h);
  assert.deepEqual({ x: e.x, y: e.y }, at);
});
