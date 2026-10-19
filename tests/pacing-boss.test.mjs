import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { stepEnemies, stepHazards } from "../temp/tests/battle/EnemySystem.mjs";
import { bossExposed } from "../temp/tests/battle/BossSystem.mjs";
import { encounterBeat, encounterRealTime } from "../temp/tests/battle/EncounterPacing.mjs";
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
test('mid-run collection breaks are shorter and harvest beats keep spawning packs',()=>{
 assert.equal(encounterBeat(encounterRealTime(170)).rest,true);
 assert.equal(encounterBeat(encounterRealTime(174)).rest,false);
 assert.equal(encounterBeat(encounterRealTime(338)).rest,true);
 assert.equal(encounterBeat(encounterRealTime(342)).rest,false);
 assert.equal(encounterBeat(encounterRealTime(462)).rest,false);
 assert.equal(encounterBeat(encounterRealTime(470)).rest,true);
 // Stage one delegates to the siege director, which always mixes a shield/bow pack.
 for(const time of [240,260]){
  const w=new SurvivalWorld(19,'ranger',1);w.time=time;w.director.elites=[true,true];
  w.director.step(w,1/60);
  assert.ok(w.enemies.length>0,`time ${time}`);
  assert.ok(w.enemies.every(e=>e.state==='arriving'||e.state==='seek'));
 }
});
