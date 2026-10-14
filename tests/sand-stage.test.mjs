import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { ENEMIES, isElite } from "../temp/tests/battle/SurvivalConfig.mjs";
import { sandMap, SAND_ROCKS } from "../temp/tests/battle/SandMap.mjs";
import { stepEnemies, stepHazards } from "../temp/tests/battle/EnemySystem.mjs";
import { stepGarden } from "../temp/tests/battle/GardenMap.mjs";
import { STAGES } from "../temp/tests/battle/StageRules.mjs";
import { ProgressStore } from "../temp/tests/platform/ProgressStore.mjs";
const world = () => {
  const w = new SurvivalWorld(19, "ranger", 15, 6);
  w.time = 140;
  w.player = { x: 0, y: 0 };
  w.camera = { x: 0, y: 0 };
  for (const k of Object.keys(w.skills)) w.skills[k] = 0;
  return w;
};
const enemy = (w, k, x = 4, y = 0) => {
  const e = w.addEnemy(k, x, y);
  e.visibleSince = 0;
  e.attack = 0;
  e.state = "seek";
  return e;
};
function advance(w, seconds) {
  for (let t = 0; t < seconds - 1e-6; t += 0.01) {
    w.time += 0.01;
    w.invulnerable = Math.max(0, w.invulnerable - 0.01);
    stepEnemies(w, 0.01);
    stepHazards(w);
  }
}
test("sand stage unlocks after fourteen and has new elite roles and stronger base multipliers", () => {
  const store = new Map(),
    storage = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, v),
    };
  let p = new ProgressStore(storage);
  assert(!p.unlockedStage(15));
  const w = world();
  w.stageId = 14;
  w.state = "won";
  p.observe(w);
  p = new ProgressStore(storage);
  assert(p.unlockedStage(15));
  assert(isElite("broodelite") && isElite("breakerelite"));
  assert.equal(ENEMIES.broodelite.health, 20);
  assert.equal(ENEMIES.breakerelite.contact, 20);
  assert.equal(ENEMIES.sandspitter.health, 1.8);
  assert(STAGES[15].bossHealth > STAGES[14].bossHealth);
  assert.deepEqual(new SurvivalWorld(1, "ranger", 15).player, { x: 0, y: -8 });
});
test("sand variable rock geometry is shared by collision and navigation", () => {
  const w = world();
  for (const p of SAND_ROCKS) {
    Object.assign(w.player, p);
    stepGarden(w, 0);
    assert(!sandMap.blocked(w.player, 0.299));
  }
  assert(!sandMap.blocked({ x: 0, y: 0 }, 6));
  assert(sandMap.blocked({ x: 0, y: 15 }));
  assert(!sandMap.blocked({ x: 0, y: 18 }, 0.3));
  const e = enemy(w, "sandworker", -15, 0),
    target = { x: 15, y: 0 };
  for (
    let i = 0;
    i < 1800 && Math.hypot(e.x - target.x, e.y - target.y) > 0.2;
    i++
  ) {
    const a = sandMap.heading(e, target);
    e.x += Math.cos(a) * 0.05;
    e.y += Math.sin(a) * 0.05;
    sandMap.resolve(e, 0.35);
  }
  assert(Math.hypot(e.x - target.x, e.y - target.y) < 0.3);
});
test("worker split conserves experience and delayed larvae remain attackable without contact damage", () => {
  const w = world(),
    e = enemy(w, "sandworker", 0, 0);
  w.hit(e, 1e6, "test");
  const larvae = w.enemies.filter((e) => e.kind === "sandlarva");
  assert.equal(larvae.length, 2);
  assert(larvae.every((e) => e.state === "windup"));
  assert.equal(
    w.gems.reduce((n, g) => n + g.value, 0),
    0.5 * 0.85,
  );
  advance(w, 0.2);
  assert.equal(w.hp, 100);
  for (const child of larvae) w.hit(child, 1e6, "test");
  assert.equal(
    w.gems.reduce((n, g) => n + g.value, 0),
    0.85,
  );
  assert.equal(w.gold, 1);
});
test("split cap falls back to parent gem instead of deleting experience", () => {
  const w = world();
  for (let i = 0; i < 20; i++) enemy(w, "sandlarva", 10 + i * 0.01, 10);
  const e = enemy(w, "sandworker");
  w.hit(e, 1e6, "test");
  assert.equal(
    w.enemies.filter((e) => e.hp > 0 && e.kind === "sandlarva").length,
    20,
  );
  assert.equal(
    w.gems.reduce((n, g) => n + g.value, 0),
    0.85,
  );
});
test("boss reinforcements and their split children share half experience and no potion or gold", () => {
  const w = world(),
    e = enemy(w, "sandworker");
  e.summoned = true;
  e.bossReinforcement = true;
  w.hit(e, 1e6, "test");
  for (const child of w.enemies.filter((e) => e.kind === "sandlarva"))
    w.hit(child, 1e6, "test");
  assert.equal(
    w.gems.reduce((n, g) => n + g.value, 0),
    0.425,
  );
  assert.equal(w.gold, 0);
  assert.equal(w.potions.length, 0);
});
test("summoned brood workers cannot manufacture split experience", () => {
  const w = world(),
    e = enemy(w, "sandworker");
  e.summoned = true;
  w.hit(e, 1e6, "test");
  for (const c of w.enemies.filter((e) => e.kind === "sandlarva"))
    w.hit(c, 1e6, "test");
  assert.equal(w.gems.length, 0);
  assert.equal(w.gold, 0);
});
test("roller shows second warning, keeps predetermined turn, and can hit only once per chain", () => {
  const w = world(),
    e = enemy(w, "shellroller");
  assert(w.sand.startRoll(e));
  const turn = e.sand.angle;
  advance(w, 1.02);
  assert.equal(e.state, "charge");
  advance(w, 0.84);
  assert.equal(e.state, "windup");
  assert.equal(e.sand.step, 1);
  assert.equal(e.lockedAngle, turn);
  assert(w.hazards.some((h) => h.source === e.id && h.due - w.time > 0.8));
  const hp = w.hp;
  e.sand.hit = true;
  w.invulnerable = 0;
  advance(w, 1.6);
  assert.equal(w.hp, hp);
  assert.equal(e.state, "recover");
});
test("roller wall impact cancels second attack and exposes armor", () => {
  const w = world();
  w.player = { x: 6, y: 0 };
  const e = enemy(w, "shellroller", 4, 0);
  assert(w.sand.startRoll(e));
  advance(w, 1.8);
  assert.equal(e.state, "recover");
  assert(e.sand.vulnerable);
  assert.equal(w.hazards.filter((h) => h.source === e.id).length, 0);
  const hp = e.hp;
  w.hit(e, 10, "test");
  assert.equal(hp - e.hp, 12.5);
});
test("burrow has full warning, no teleport, stops targeting new hits, and surfaces vulnerable", () => {
  const w = world(),
    e = enemy(w, "sandstalker");
  assert(w.sand.startBurrow(e));
  const h = w.hazards[0];
  assert(Math.abs(h.due - h.created - 1.65) < 1e-6);
  advance(w, 0.46);
  assert(e.sand.buried);
  const hp = e.hp;
  w.hit(e, 10, "test", false, e, false);
  assert.equal(e.hp, hp);
  assert.equal(w.target(), undefined);
  advance(w, 0.3);
  assert(e.x < 4 && e.x > 0);
  w.player.y = 4;
  advance(w, 1.05);
  assert(!e.sand.buried);
  assert.equal(e.state, "recover");
  assert(e.sand.vulnerable);
  assert.equal(w.hp, 100);
});
test("existing damage over time can kill buried stalker and cancel its emergence", () => {
  const w = world(),
    e = enemy(w, "sandstalker");
  assert(w.sand.startBurrow(e));
  advance(w, 0.46);
  w.hit(e, 1e6, "fire", false, e, false, undefined, 1, false, true);
  assert(e.hp <= 0);
  stepHazards(w);
  assert.equal(w.hazards.length, 0);
  assert.equal(w.sand.reserved(), 0);
});
test("burrow refuses a route through rock and freeze pauses its warning before diving", () => {
  const w = world();
  w.player = { x: 14, y: 0 };
  w.camera = { x: 9, y: 0 };
  const e = enemy(w, "sandstalker", 6, 0);
  assert(!w.sand.startBurrow(e));
  assert.equal(w.sand.reserved(), 0);
  const q = world(),
    b = enemy(q, "sandstalker");
  assert(q.sand.startBurrow(b));
  const due = q.hazards[0].due;
  q.slow(b, true);
  advance(q, 0.2);
  assert.equal(b.x, 4);
  assert(!b.sand.buried);
  assert(q.hazards[0].due > due + 0.19);
});
test("destroyed eggs never hatch and owner death removes remaining eggs", () => {
  const w = world(),
    e = enemy(w, "broodelite");
  w.sand.stepEnemy(e, 0);
  const eggs = w.enemies.filter((o) => o.kind === "sandegg");
  assert(eggs.length > 0);
  w.hit(eggs[0], 1e6, "test");
  advance(w, 3.3);
  assert(
    !w.enemies.some(
      (o) =>
        o.hp > 0 &&
        o.kind === "sandworker" &&
        Math.hypot(o.x - eggs[0].x, o.y - eggs[0].y) < 0.01,
    ),
  );
  const q = world(),
    m = enemy(q, "broodelite");
  q.sand.stepEnemy(m, 0);
  assert(q.enemies.some((e) => e.kind === "sandegg"));
  q.hit(m, 1e6, "test");
  assert(q.enemies.filter((e) => e.kind === "sandegg").every((e) => e.hp <= 0));
  advance(q, 4);
  assert(!q.enemies.some((e) => e.kind === "sandworker"));
});
test("egg hatch is bounded, attackable, and summons no reward worker", () => {
  const w = world(),
    e = enemy(w, "broodelite");
  w.sand.stepEnemy(e, 0);
  const eggs = w.enemies.filter((e) => e.kind === "sandegg");
  for (const egg of eggs) assert(egg.hp < e.hp);
  w.player.y = 5;
  advance(w, 3.4);
  const children = w.enemies.filter((o) => o.kind === "sandworker");
  assert(children.length <= 3 && children.length > 0);
  assert(
    children.every((o) => o.summoned && o.sandXp === 0 && o.owner === e.id),
  );
  assert.equal(w.sand.stats.hatch, children.length);
});
test("boss second cross locks a new point and phase two rift damage is throttled", () => {
  const w = world(),
    e = enemy(w, "boss", -4);
  e.bossPhase = 2;
  assert(w.sand.startBoss(e, 1));
  w.player.y = 3;
  advance(w, 1.61);
  const h = w.hazards.find((h) => h.source === e.id);
  assert(h.sandRift);
  assert(h.y > 3);
  assert(h.due - w.time > 0.9);
  w.player = { x: (h.x + h.endX) / 2, y: (h.y + h.endY) / 2 };
  w.time = h.due;
  w.invulnerable = 0;
  stepHazards(w);
  const hp = w.hp;
  w.invulnerable = 0;
  w.time += 0.2;
  stepHazards(w);
  assert.equal(w.hp, hp);
  w.time += 0.41;
  stepHazards(w);
  assert.equal(w.hp, hp - 6);
});
test("boss launched eggs survive caster freeze and transition while unlaunched plans cancel", () => {
  const w = world(),
    e = enemy(w, "boss");
  assert(w.sand.startBoss(e, 2));
  const h = w.hazards[0];
  advance(w, 0.3);
  assert(h.siegeLaunched);
  const due = h.due;
  e.hp = e.maxHp * 0.5;
  w.sand.stepEnemy(e, 0);
  assert.equal(e.bossPhase, 2);
  assert.equal(e.bossAction, "transition");
  assert(w.hazards.includes(h));
  w.slow(e, true);
  advance(w, 0.1);
  assert.equal(h.due, due);
  const q = world(),
    b = enemy(q, "boss");
  assert(q.sand.startBoss(b, 2));
  b.hp = b.maxHp * 0.5;
  q.sand.stepEnemy(b, 0);
  assert.equal(q.hazards.length, 0);
  assert.equal(q.sand.reserved(), 0);
});
test("boss cannot teleport when phase threshold is crossed underground", () => {
  const w = world(),
    e = enemy(w, "boss");
  assert(w.sand.startBurrow(e));
  advance(w, 0.5);
  const x = e.x;
  e.hp = e.maxHp * 0.5;
  w.sand.stepEnemy(e, 0);
  assert.equal(e.bossPhase, 1);
  assert(e.sand.pendingPhase);
  assert.equal(e.x, x);
  w.player.y = 5;
  advance(w, 1.4);
  assert.equal(e.bossPhase, 2);
  assert.equal(e.bossAction, "transition");
  assert(!e.sand.buried);
  assert(Math.abs(e.x) < 0.1);
});
test("recovering elites and boss do not deal contact damage; reserved slots die with owners", () => {
  const w = world(),
    e = enemy(w, "breakerelite", 0, 0);
  e.state = "recover";
  e.timer = 1;
  w.sand.stepEnemy(e, 0.2);
  assert.equal(w.hp, 100);
  e.state = "seek";
  e.attack = 0;
  e.x = 4;
  w.sand.stepEnemy(e, 0);
  assert.equal(w.sand.reserved(), 2);
  e.hp = 0;
  w.sand.clean();
  assert.equal(w.sand.reserved(), 0);
});
