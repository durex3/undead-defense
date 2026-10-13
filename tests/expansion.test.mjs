import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { stepEnemies, stepHazards } from "../temp/tests/battle/EnemySystem.mjs";
const make = () => {
  const w = new SurvivalWorld(1);
  w.director.nextGroup = 1e9;
  w.director.nextSpecial = 1e9;
  w.director.elites = [true, true];
  return w;
};
const enemy = (w, kind, x, y = 0) => {
  const e = w.addEnemy(kind, x, y);
  assert.ok(e);
  return e;
};
const tick = (w, n) => {
  for (let i = 0; i < n; i++) {
    w.time += 1 / 60;
    w.expansion.step(1 / 60);
  }
};
const ready = (w, e) => {
  w.time = 10;
  e.attack = 0;
  e.visibleSince = 8;
};
test("holy water respects landing delay and overlapping pools share a damage gate", () => {
  const w = make();
  w.skills.water = 4;
  const e = enemy(w, "minion", 2);
  e.hp = 1000;
  w.expansion.cast("water");
  w.expansion.cast("water");
  w.cooldowns.water = 100;
  tick(w, 20);
  assert.equal(e.hp, 1000);
  tick(w, 2);
  assert.equal(e.hp, 990);
  tick(w, 31);
  assert.equal(e.hp, 980);
});
test("poison places once on learning, needs actual travel, and cannot spam at the world edge", () => {
  const w = make();
  w.skills.poison = 1;
  tick(w, 300);
  assert.equal(w.castCounts.poison, 1);
  w.player.x = 3.1;
  tick(w, 1);
  assert.equal(w.castCounts.poison, 2);
  tick(w, 300);
  assert.equal(w.castCounts.poison, 2);
  w.player.x = 22;
  tick(w, 1);
  const casts = w.castCounts.poison;
  w.setMove(1, 0);
  for (let i = 0; i < 180; i++) w.step(1 / 60);
  assert.equal(w.castCounts.poison, casts);
});
test("plague deaths burst at most four times per second and cannot recurse", () => {
  const w = make();
  w.skills.poison = 4;
  w.evolutions.poison = "plague";
  tick(w, 1);
  for (let i = 0; i < 8; i++)
    w.hit(enemy(w, "minion", 0, 0.1 * i), 1000, "blade");
  const survivor = enemy(w, "minion", 0.3, 0.3);
  survivor.hp = 1000;
  tick(w, 1);
  assert.equal(
    w.effects.filter((e) => e.type === "explosion" && e.skill === "poison")
      .length,
    4,
  );
  assert.ok(w.damage.poison >= 40);
  assert.equal(w.damage.poisonBurst, undefined);
  w.hit(survivor, 1000, "poisonBurst");
  tick(w, 1);
  assert.equal(
    w.effects.filter((e) => e.type === "explosion" && e.skill === "poison")
      .length,
    4,
  );
});
test("mines arm after half a second, expire, cap at 24 and chain at most four per frame", () => {
  const w = make();
  w.skills.mine = 1;
  w.expansion.cast("mine");
  w.cooldowns.mine = 100;
  enemy(w, "minion", 0);
  tick(w, 29);
  assert.equal(w.expansion.mines.length, 1);
  tick(w, 2);
  assert.equal(w.expansion.mines.length, 0);
  w.enemies = [];
  for (let i = 0; i < 30; i++) w.expansion.cast("mine");
  assert.equal(w.expansion.mines.length, 24);
  w.time += 9;
  w.expansion.step(0);
  assert.equal(w.expansion.mines.length, 0);
  w.skills.mine = 4;
  w.evolutions.mine = "network";
  for (let i = 0; i < 4; i++) w.expansion.cast("mine");
  for (const m of w.expansion.mines) m.armed = w.time;
  w.expansion.mines[0].queued = true;
  w.expansion.step(0);
  assert.equal(w.expansion.mines.length, 4);
  w.expansion.step(0);
  assert.equal(w.expansion.mines.length, 0);
});
test("black hole keeps first cast until a safe target exists and overlapping pulls do not stack", () => {
  const w = make();
  w.skills.void = 4;
  const e = enemy(w, "minion", 1);
  tick(w, 1);
  assert.equal(w.castCounts.void, undefined);
  assert.equal(w.cooldowns.void, 0);
  e.x = 4;
  tick(w, 1);
  assert.equal(w.castCounts.void, 1);
  w.expansion.cast("void");
  e.x = 4.5;
  const boss = enemy(w, "boss", 4.5);
  boss.state = "seek";
  w.expansion.step(0.1);
  assert.ok(Math.abs(e.x - 4.43) < 1e-6);
  assert.equal(boss.x, 4.5);
});
test("bone fans gain a second volley at L4 and evolved ram knocks back only once per target", () => {
  const w = make();
  w.skills.bone = 4;
  const e = enemy(w, "minion", 5);
  e.hp = 10000;
  tick(w, 1);
  assert.equal(w.shots.length, 3);
  tick(w, 16);
  assert.equal(w.shots.length, 6);
  w.shots = [];
  w.evolutions.bone = "ram";
  w.expansion.cast("bone");
  const p = w.shots[0];
  for (let i = 0; i < 30; i++) w.stepShot(p, 1 / 60);
  assert.equal(e.hp, 9940);
  assert.ok(Math.abs(e.x - 5.7) < 1e-6);
  assert.equal(p.hit.filter((id) => id === e.id).length, 1);
});
test("bats must hit and return to heal, obey batch cap, and clean up missed flights", () => {
  const w = make();
  w.skills.bat = 4;
  w.evolutions.bat = "bloodmoon";
  w.hp = 60;
  const e = enemy(w, "minion", 3);
  e.hp = 10000;
  w.expansion.cast("bat");
  w.cooldowns.bat = 100;
  tick(w, 100);
  assert.equal(w.hp, 61);
  assert.equal(w.expansion.bats.length, 0);
  w.expansion.cast("bat");
  w.enemies = [];
  tick(w, 400);
  assert.equal(w.hp, 61);
  assert.equal(w.expansion.bats.length, 0);
  assert.equal(w.expansion.batBatches.size, 0);
});
test("slime splits once into two arriving children with no experience, respecting population cap", () => {
  const w = make();
  const e = enemy(w, "slime", 4);
  w.hit(e, 1000, "bone");
  const children = w.enemies.filter((e) => e.kind === "slimeling");
  assert.equal(children.length, 2);
  assert.ok(children.every((e) => e.state === "arriving" && e.summoned));
  w.gems = [];
  for (const c of children) {
    c.state = "seek";
    w.hit(c, 1000, "bone");
  }
  assert.equal(w.gems.length, 0);
  assert.equal(w.enemies.length, 3);
  const full = make();
  const slime = enemy(full, "slime", 4);
  for (let i = 0; i < 99; i++) enemy(full, "minion", 10);
  full.hit(slime, 1000, "bone");
  assert.equal(full.enemies.filter((e) => e.hp > 0).length, 100);
});
test("archer locks a telegraphed arrow and moving sideways dodges it", () => {
  const w = make();
  const e = enemy(w, "archer", 6);
  ready(w, e);
  stepEnemies(w, 1 / 60);
  const h = w.hazards[0];
  assert.equal(h.kind, "arrow");
  assert.ok(Math.abs(h.due - w.time - 0.65) < 1e-6);
  stepHazards(w);
  assert.equal(w.hp, 100);
  w.player.y = 2;
  for (let i = 0; i < 160; i++) {
    w.time += 1 / 60;
    stepHazards(w);
  }
  assert.equal(w.hp, 100);
  assert.ok(Math.abs(h.angle - Math.PI) < 1e-6);
  const hit = make();
  const a = enemy(hit, "archer", 6);
  ready(hit, a);
  stepEnemies(hit, 1 / 60);
  for (let i = 0; i < 125; i++) {
    hit.time += 1 / 60;
    stepHazards(hit);
  }
  assert.equal(hit.hp, 90);
});
test("banshee uses a fixed 70-degree cone and wisp shares the single charge permit", () => {
  const w = make();
  const e = enemy(w, "banshee", 3.5);
  ready(w, e);
  stepEnemies(w, 1 / 60);
  assert.ok(Math.abs(w.hazards[0].width - (Math.PI * 70) / 180) < 1e-8);
  w.player.y = 4;
  w.time += 1.01;
  stepHazards(w);
  assert.equal(w.hp, 100);
  const w2 = make();
  const a = enemy(w2, "wisp", 3),
    b = enemy(w2, "boar", 4, 2);
  ready(w2, a);
  ready(w2, b);
  stepEnemies(w2, 1 / 60);
  assert.equal(w2.hazards.filter((h) => h.kind === "line").length, 1);
  assert.equal(a.state, "windup");
  assert.equal(w2.hazards[0].radius, 3);
});
test("drummer aura increases ordinary seeking speed by 20 percent without stacking", () => {
  const distance = (drums) => {
    const w = make();
    const e = enemy(w, "minion", 6);
    for (let i = 0; i < drums; i++) enemy(w, "drummer", 7, i * 0.8);
    stepEnemies(w, 0.1);
    return 6 - e.x;
  };
  assert.ok(Math.abs(distance(1) / distance(0) - 1.2) < 1e-8);
  assert.ok(Math.abs(distance(2) - distance(1)) < 1e-8);
});
test("summoner owns at most four no-XP minions, uses spawn warning and cannot summon offscreen", () => {
  const w = make();
  const e = enemy(w, "summoner", 6);
  ready(w, e);
  for (let i = 0; i < 4; i++) {
    e.attack = 0;
    stepEnemies(w, 1 / 60);
  }
  const children = w.enemies.filter((o) => o.owner === e.id);
  assert.equal(children.length, 4);
  assert.ok(children.every((o) => o.summoned && o.state === "arriving"));
  w.gems = [];
  for (const c of children) {
    c.state = "seek";
    w.hit(c, 1000, "bone");
  }
  assert.equal(w.gems.length, 0);
  w.camera.x = 30;
  e.attack = 0;
  stepEnemies(w, 1 / 60);
  assert.equal(w.enemies.filter((o) => o.owner === e.id && o.hp > 0).length, 0);
});
