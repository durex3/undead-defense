import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { stepEnemies, stepHazards } from "../temp/tests/battle/EnemySystem.mjs";
import { bossExposed } from "../temp/tests/battle/BossSystem.mjs";
import { encounterBeat } from "../temp/tests/battle/EncounterPacing.mjs";
function setup(x = 3) {
  const w = new SurvivalWorld();
  w.time = 250;
  const e = w.addEnemy("boss", x, 0);
  e.state = "seek";
  e.attack = 0;
  e.visibleSince = 248;
  return { w, e };
}
function tick(w, n) {
  for (let i = 0; i < n; i++) {
    w.time += 1 / 60;
    w.invulnerable = Math.max(0, w.invulnerable - 1 / 60);
    stepEnemies(w, 1 / 60);
    stepHazards(w);
  }
}
test("pacing has finite harvest/rest beats and no fresh spawns during pre-boss rest", () => {
  assert.equal(encounterBeat(80).harvest, true);
  assert.equal(encounterBeat(168).rest, true);
  assert.equal(encounterBeat(190).rest, false);
  assert.equal(encounterBeat(470).rest, true);
  const w = new SurvivalWorld();
  w.time = 470;
  w.director.elites = [true, true];
  w.director.step(w, 1 / 60);
  assert.equal(w.enemies.length, 0);
  w.time = 480;
  w.director.step(w, 1 / 60);
  assert.equal(w.enemies.filter((e) => e.kind === "boss").length, 1);
});
test("boss sweep locks direction, then offers stationary damage bonus after danger expires", () => {
  const { w, e } = setup();
  stepEnemies(w, 1 / 60);
  assert.equal(w.hazards[0].kind, "sector");
  const angle = w.hazards[0].angle;
  w.player.y = 4;
  tick(w, 80);
  assert.equal(w.hp, 100);
  assert.equal(e.state, "recover");
  assert.ok(bossExposed(w, e));
  assert.equal(e.lockedAngle, angle);
  const x = e.x,
    hp = e.hp;
  w.hit(e, 20, "blade");
  assert.equal(hp - e.hp, 28.75);
  tick(w, 20);
  assert.equal(e.x, x);
});
test("boss phase changes once with full warning, does not erase health or become invulnerable", () => {
  const { w, e } = setup();
  e.hp = e.maxHp * 0.5;
  stepEnemies(w, 1 / 60);
  assert.equal(e.bossPhase, 2);
  assert.equal(e.bossAction, "transition");
  assert.ok(e.timer > 1);
  const hp = e.hp;
  w.hit(e, 20, "blade");
  assert.equal(hp - e.hp, 23);
  tick(w, 85);
  assert.equal(w.effects.filter((e) => e.type === "bossPhase").length, 1);
  assert.ok(bossExposed(w, e));
});
test("distant player cannot stall boss cycle and flying burst does not count as safe opening", () => {
  const { w, e } = setup(6);
  stepEnemies(w, 1 / 60);
  assert.equal(w.hazards[0].kind, "burst");
  w.player.y = 5;
  tick(w, 80);
  assert.equal(e.state, "recover");
  assert.equal(bossExposed(w, e), false);
  tick(w, 180);
  assert.ok(bossExposed(w, e));
});
test("boss summons have a warning, no XP and owner cap; offscreen boss cannot initiate attacks", () => {
  const { w, e } = setup();
  e.pattern = 2;
  stepEnemies(w, 1 / 60);
  assert.equal(w.enemies.filter((o) => o.owner === e.id).length, 4);
  for (let i = 0; i < 4; i++) {
    e.state = "seek";
    e.pattern = 2;
    e.attack = 0;
    stepEnemies(w, 1 / 60);
  }
  assert.equal(w.enemies.filter((o) => o.owner === e.id).length, 8);
  assert.ok(
    w.enemies
      .filter((o) => o.owner === e.id)
      .every((o) => o.summoned && o.state === "arriving"),
  );
  w.camera.x = 40;
  e.state = "seek";
  e.pattern = 1;
  e.attack = 0;
  stepEnemies(w, 1 / 60);
  assert.equal(w.hazards.length, 0);
});
test('mid-run collection breaks are shorter and late harvest alternates pure fodder with special roles',()=>{
 assert.equal(encounterBeat(170).rest,true);
 assert.equal(encounterBeat(174).rest,false);
 assert.equal(encounterBeat(338).rest,true);
 assert.equal(encounterBeat(342).rest,false);
 assert.equal(encounterBeat(462).rest,false);
 assert.equal(encounterBeat(470).rest,true);
 for(const [time,hasSpecial] of [[240,false],[260,true]]){
  const w=new SurvivalWorld(19,'ranger',1);w.time=time;w.director.elites=[true,true];
  w.director.step(w,1/60);
  assert.equal(w.enemies.some(e=>e.kind!=='minion'),hasSpecial);
 }
});
