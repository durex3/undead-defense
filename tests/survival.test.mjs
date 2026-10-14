import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { stepEnemies, stepHazards } from "../temp/tests/battle/EnemySystem.mjs";
import { WEAPONS, EVOLUTIONS, SYNTHESIS_RECIPES } from "../temp/tests/battle/SurvivalConfig.mjs";
function isolated(seed = 1) {
  const w = new SurvivalWorld(seed);
  w.director.nextGroup = 1e9;
  w.director.nextSpecial = 1e9;
  w.director.elites = [true, true];
  return w;
}
function step(w, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) w.step(1 / 60);
}
function offer(w, c) {
  w.state = "upgrade";
  w.cards = [c];
  assert.equal(w.choose(c), true);
}
function enemy(w, kind, x, y) {
  const e = w.addEnemy(kind, x, y);
  assert.ok(e);
  return e;
}
test("single blade start, no free ranged shots; diagonal speed and pause", () => {
  const w = isolated();
  enemy(w, "minion", 7, 7);
  w.setMove(1, 1);
  step(w, 1);
  assert.ok(Math.abs(Math.hypot(w.player.x, w.player.y) - 4.2) < 1e-6);
  assert.equal(w.shots.length, 0);
  assert.equal(w.blades.length, 1);
  assert.equal(w.weaponCount, 1);
  w.pause("menu", true);
  const t = w.time;
  step(w, 1);
  assert.equal(w.time, t);
  assert.deepEqual(w.move, { x: 0, y: 0 });
});
test("kills award experience only when collected, and only once", () => {
  const w = isolated();
  const e = enemy(w, "minion", 5, 5);
  w.hit(e, 1000, "blade");
  w.hit(e, 1000, "blade");
  assert.equal(w.kills, 1);
  assert.equal(w.xp, 0);
  assert.equal(w.gems.length, 1);
  w.player = { x: 5, y: 5 };
  step(w, 0.1);
  assert.equal(w.xp, 1);
});
test("global invulnerability prevents stacked contact damage", () => {
  const w = isolated();
  for (let i = 0; i < 12; i++) enemy(w, "minion", 0, 0.1);
  w.step(1 / 60);
  assert.equal(w.hp, 92);
  w.step(1 / 60);
  assert.equal(w.hp, 92);
});
test("first upgrade offers three legal distinct choices and cannot apply twice", () => {
  const w = isolated();
  w.xp = 8;
  w.step(1 / 60);
  assert.equal(w.state, "upgrade");
  assert.ok(w.cards.some((c) => WEAPONS.includes(c) && c !== "blade"));
  assert.equal(new Set(w.cards).size, 3);
  const t = w.time;
  step(w, 1);
  assert.equal(w.time, t);
  const card=w.cards[0];
  assert.equal(w.choose(card),true);
  assert.equal(w.choose(card),false);
});
test("weapon/passive slots, caps and evolution availability hold across seeds", () => {
  for (let seed = 1; seed < 80; seed++) {
    const w = isolated(seed);
    Object.assign(w.skills, { blade: 4, fire: 1, ice: 1, ghost: 1 });
    Object.assign(w.passives, { boots: 2, magnet: 1 });
    const legal = w.legal();
    assert.ok(!legal.includes("scythe"));
    assert.ok(!legal.includes("lightning"));
    assert.ok(!legal.includes("hourglass"));
    assert.ok(!legal.includes("boots"));
    w.level = 8;
    w.roll();
      assert.equal(new Set(w.cards).size, w.cards.length);
  }
});
test("evolution back preserves choices; branch consumes exactly once", () => {
  const w = isolated();
  w.skills.blade = 10;
  w.state = "upgrade";
  w.cards = ["blade", "fire", "ice"];
  w.choose("blade");
  assert.equal(w.state, "evolution");
  w.back();
  assert.deepEqual(w.cards, ["blade", "fire", "ice"]);
  assert.equal(w.bladeCount, 6);
  w.choose("blade");
  assert.equal(w.evolve("invalid"), false);
  assert.equal(w.evolve("ring"), true);
  assert.equal(w.bladeCount, 6);
  assert.equal(w.weaponCount, 1);
  assert.equal(w.evolve("return"), false);
  assert.ok(!w.legal().includes("blade"));
});
test("learning ranged skills waits for a target then casts on first active frame", () => {
  for (const skill of ["fire", "lightning", "scythe", "ghost"]) {
    const w = isolated();
    offer(w, skill);
    step(w, 0.5);
    assert.equal(w.castCounts[skill] || 0, 0);
    enemy(w, "minion", 5, 0);
    w.step(1 / 60);
    assert.equal(w.castCounts[skill], 1);
    assert.ok(w.damage[skill] > 0 || w.shots.some((p) => p.skill === skill));
    w.pause("menu", true);
    step(w, 4);
    assert.equal(w.castCounts[skill], 1);
  }
});
test("returning weapons acquire enemies behind the player without requiring a facing change", () => {
  const w = isolated();
  w.skills.axe = 1;
  w.setMove(1, 0);
  enemy(w, "minion", -4, 0);
  w.step(1 / 60);
  const shot = w.shots.find((p) => p.skill === "axe");
  assert.ok(shot);
  assert.ok(shot.vx < 0);
});
test("upgrade refreshes cast without replaying on menu open", () => {
  const w = isolated();
  w.skills.fire = 1;
  const e = enemy(w, "minion", 5, 0);
  e.hp = e.maxHp = 10000;
  step(w, 0.3);
  assert.equal(w.castCounts.fire, 1);
  offer(w, "fire");
  w.step(1 / 60);
  assert.equal(w.castCounts.fire, 2);
  w.pause("menu", true);
  w.pause("menu", false);
  w.step(1 / 60);
  assert.equal(w.castCounts.fire, 2);
});
test("L2 fire volley has two distinct projectiles and ghosts become two", () => {
  const w = isolated();
  w.skills.fire = 2;
  w.skills.ghost = 2;
  enemy(w, "minion", 7, 0);
  enemy(w, "minion", 7, 2);
  step(w, 0.22);
  assert.equal(w.ghostCount, 2);
  assert.equal(w.shots.filter((p) => p.skill === "fire").length, 2);
});
test("double lightning never repeats a target within a cast", () => {
  const w = isolated();
  w.skills.lightning = 3;
  for (let i = 0; i < 6; i++) {
    const e = enemy(w, "minion", 4 + i * 0.1, 0);
    e.hp = e.maxHp = 1000;
  }
  w.step(1 / 60);
  const ids = w.effects
    .filter((e) => e.type === "hit" && e.skill === "lightning")
    .map((e) => e.id);
  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, 6);
});
test("ice double ring can freeze ordinary enemies but never a boss", () => {
  const w = isolated();
  w.skills.ice = 4;
  const e = enemy(w, "minion", 2.8, 0),
    b = enemy(w, "boss", 2.8, 1);
  e.hp = 1000;
  b.state = "seek";
  step(w, 0.45);
  assert.ok(e.freezeUntil > w.time);
  assert.equal(b.freezeUntil, 0);
  assert.ok(b.slow <= 0.25);
  step(w, 0.15);
  assert.equal(w.rings.length, 2);
});
test("shield halves front direct hits but allows rear and periodic damage", () => {
  const w = isolated();
  const e = enemy(w, "shield", 0, 0);
  e.hp = 1000;
  e.facing = 0;
  w.hit(e, 20, "blade", false, { x: 2, y: 0 });
  assert.equal(e.hp, 990);
  w.hit(e, 20, "blade", false, { x: -2, y: 0 });
  assert.equal(e.hp, 970);
  w.hit(e, 20, "fire", false, { x: 2, y: 0 }, false);
  assert.equal(e.hp, 950);
});
test("boar telegraph locks direction; only one charge may be scheduled", () => {
  const w = isolated();
  const a = enemy(w, "boar", 4, 0),
    b = enemy(w, "boar", 4, 2);
  w.time = 10;
  for (const e of [a, b]) {
    e.visibleSince = 8;
    e.attack = 0;
  }
  stepEnemies(w, 1 / 60);
  assert.equal(w.hazards.filter((h) => h.kind === "line").length, 1);
  const locked = a.lockedAngle;
  w.player.y = 4;
  for (let i = 0; i < 40; i++) {
    w.time += 1 / 60;
    stepEnemies(w, 1 / 60);
  }
  assert.equal(a.lockedAngle, locked);
  assert.equal(a.state, "windup");
});
test("freeze cancels a pending attack, requiring a new full telegraph", () => {
  const w = isolated();
  const e = enemy(w, "boar", 4, 0);
  w.time = 10;
  e.visibleSince = 8;
  e.attack = 0;
  stepEnemies(w, 1 / 60);
  assert.equal(w.hazards.length, 1);
  w.slow(e, true);
  assert.equal(w.hazards.length, 0);
  assert.equal(e.state, "recover");
  assert.ok(e.freezeUntil > w.time);
});
test("telegraphed mage hazard can be dodged and is cancelled on caster death", () => {
  const w = isolated();
  const e = enemy(w, "mage", 6, 0);
  w.time = 10;
  e.visibleSince = 8;
  e.attack = 0;
  stepEnemies(w, 1 / 60);
  assert.equal(w.hazards.length, 1);
  w.player = { x: 0, y: 4 };
  w.time += 0.56;
  stepHazards(w);
  assert.equal(w.hp, 100);
  w.hazards[0].until = w.time + 2;
  w.hit(e, 1000, "fire");
  stepHazards(w);
  assert.equal(w.hazards.length, 0);
});
test("bloater death is delayed and pool uses normal invulnerability", () => {
  const w = isolated();
  const e = enemy(w, "bloater", 0, 0);
  w.hit(e, 1000, "fire");
  assert.equal(w.hazards.length, 1);
  w.time = 0.9;
  stepHazards(w);
  assert.equal(w.hp, 100);
  w.time = 1.01;
  stepHazards(w);
  assert.equal(w.hp, 90);
  stepHazards(w);
  assert.equal(w.hp, 90);
});
test("spawn cap includes summons; summoned units do not grant experience", () => {
  const w = isolated();
  for (let i = 0; i < 105; i++) w.addEnemy("minion", 10, 10, true);
  assert.equal(w.enemies.length, 100);
  w.hit(w.enemies[0], 1000, "fire");
  assert.equal(w.gems.length, 0);
  assert.equal(w.xp, 0);
});
test("boss arrival clears elites and pending hazards; boss death wins", () => {
  const w = isolated();
  enemy(w, "executioner", 10, 0);
  enemy(w, "mage", 6, 0);
  w.time = 480;
  w.step(1 / 60);
  assert.ok(
    !w.enemies.some((e) => e.kind === "executioner" || e.kind === "mage"),
  );
  const boss = w.enemies.find((e) => e.kind === "boss");
  assert.ok(boss);
  assert.equal(boss.state, "arriving");
  w.hit(boss, 1000000, "fire");
  assert.ok(boss.hp > 0);
  boss.state = "seek";
  w.hit(boss, 1000000, "fire");
  assert.equal(w.state, "won");
  assert.equal(w.hazards.length, 0);
});
test("potions restore once; passive speed and cooldown do not change invulnerability", () => {
  const w = isolated();
  w.hp = 92;
  w.potions.push({ id: 999, x: 0, y: 0 });
  w.step(1 / 60);
  assert.equal(w.hp, 100);
  assert.equal(w.potions.length, 0);
  w.passives.boots = 2;
  assert.ok(Math.abs(w.speed - 4.956) < 1e-6);
  w.passives.hourglass = 2;
  w.hurt(8, "test");
  assert.equal(w.invulnerable, 0.7);
});
test("all skill evolution identities have a legal choice and bounded entities", () => {
  for (const skill of WEAPONS) {
    const w = isolated();
    w.skills[skill] = 10;
    if(SYNTHESIS_RECIPES[skill]) {w.skills[SYNTHESIS_RECIPES[skill]]=10;w.step(1/60);assert.equal(w.evolutions[skill],EVOLUTIONS[skill][0].id);}
    else {offer(w, skill);assert.ok(w.evolve(EVOLUTIONS[skill][0].id));}
    for (let i = 0; i < 20; i++) {
      const e = enemy(w, "minion", 4 + Math.cos(i), Math.sin(i));
      e.hp = e.maxHp = 10000;
    }
    step(w, 15);
    assert.ok(w.shots.length < 80);
    assert.ok(w.rings.length < 5);
    assert.ok(
      w.shots.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    );
  }
});

test("return blade respects per-blade per-leg hit deduplication", () => {
  const w = isolated();
  w.skills.blade = 4;
  w.evolutions.blade = "return";
  const e = enemy(w, "minion", 2.8, 0);
  e.hp = e.maxHp = 10000;
  w.time = 0.31;
  w.orbitAngle = 0;
  w.stepWeapons(0.001);
  const hp = e.hp;
  assert.ok(hp < 10000);
  for (let i = 0; i < 10; i++) w.stepWeapons(0.001);
  assert.equal(e.hp, hp);
});
test("offscreen special enemies cannot start attacks", () => {
  const w = isolated();
  const e = enemy(w, "mage", 0, 6);
  w.camera = { x: 15, y: 0 };
  w.time = 10;
  e.attack = 0;
  e.visibleSince = 8;
  stepEnemies(w, 1 / 60);
  assert.equal(w.hazards.length, 0);
  assert.equal(e.visibleSince, -1);
});
test("death pool can use the second danger slot without exceeding it", () => {
  const w = isolated();
  const mage = enemy(w, "mage", 6, 0);
  w.time = 10;
  mage.attack = 0;
  mage.visibleSince = 8;
  stepEnemies(w, 1 / 60);
  assert.equal(w.hazards.length, 1);
  w.hit(enemy(w, "bloater", 2, 2), 1000, "fire");
  assert.equal(w.hazards.length, 2);
  w.hit(enemy(w, "bloater", 2, 3), 1000, "fire");
  assert.equal(w.hazards.length, 2);
});
