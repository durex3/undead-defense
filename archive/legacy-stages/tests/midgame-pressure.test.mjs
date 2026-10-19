import test from "node:test";
import assert from "node:assert/strict";
import {SurvivalWorld} from "../temp/tests/battle/SurvivalWorld.mjs";
import {stepEnemies, stepHazards} from "../temp/tests/battle/EnemySystem.mjs";

test("early-stage ranged pressure doubles ranged health and preserves fodder, and stops growing", () => {
  const hp = (time, kind, stage=2) => {
    const w=new SurvivalWorld(19,"ranger",stage);w.time=time;
    return w.addEnemy(kind,6,0).hp;
  };
  assert.equal(hp(0,"mage"),30*1.8*1.2);
  assert.equal(hp(90,"mage"),30*1.3*1.8*1.2);
  assert.equal(hp(90,"minion"),hp(450,"minion"));
  assert.equal(hp(270,"mage"),hp(450,"mage"));
  assert.equal(hp(450,"mage",3),30*1.8*1.8*1.32);
  assert.equal(hp(450,"executioner"),30*1.8*20*1.25);
});

function directorWorld(time) {
  const w=new SurvivalWorld(19,"ranger",2);w.time=time;
  w.director.elites=[true,true];w.director.nextGroup=Infinity;
  w.director.nextSpecial=0;w.director.specialWave=1;
  return w;
}
test("ranged pair arrives with a grace period under the existing threat budget", () => {
  const w=directorWorld(150);w.director.step(w,0);
  assert.deepEqual(w.enemies.map(e=>e.kind),["archer","mage"]);
  assert.ok(w.enemies.every(e=>e.state==="arriving" && e.timer===1.2));
  assert.equal(w.hazards.length,0);
  w.director.nextSpecial=0;w.director.specialWave=1;w.director.step(w,0);
  assert.equal(w.enemies.length,2);
});
test("pressure respects pause, authored rests and the pre-boss quiet window", () => {
  for(const time of [168,470]) {
    const w=directorWorld(time);w.director.step(w,0);
    assert.equal(w.enemies.length,0);
  }
  const w=directorWorld(150);w.pause("test",true);w.director.step(w,0);
  assert.equal(w.enemies.length,0);
});

test("mage warning locks its target, permits escape and can be cancelled by killing its source", () => {
  for(const response of ["stand","move","kill"]) {
    const w=new SurvivalWorld(19,"ranger",2);w.time=270;
    const e=w.addEnemy("mage",6,0);e.attack=0;e.visibleSince=268;
    stepEnemies(w,0);assert.equal(w.hazards.length,1);
    const h=w.hazards[0];assert.ok(Math.abs(h.due-w.time-.55)<1e-9);
    if(response==="move") w.player.y=2;
    if(response==="kill") w.hit(e,10000,"lightning");
    w.time=h.due+.01;stepHazards(w);
    assert.equal(w.hp,response==="stand"?73.6:100);
    assert.equal(h.x,0);assert.equal(h.y,0);
  }
});
