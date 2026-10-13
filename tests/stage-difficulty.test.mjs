import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {stepBoss} from '../temp/tests/battle/BossSystem.mjs';
test('stage two scales threats while stage one retains its baseline',()=>{
 const a=new SurvivalWorld(1,'ranger',1),b=new SurvivalWorld(1,'ranger',2);
 for(const [kind,ratio] of [['minion',1.2],['executioner',1.25],['boss',1.534]]) {
  const x=a.addEnemy(kind),y=b.addEnemy(kind);
  assert.ok(Math.abs(y.maxHp/x.maxHp-ratio)<1e-10);
 }
 a.hurt(10,'minion');b.hurt(10,'minion');assert.equal(a.hp,90);assert.equal(b.hp,89);
 const x=a.enemies.find(e=>e.kind==='boss'),y=b.enemies.find(e=>e.kind==='boss');
 x.state=y.state='windup';x.timer=y.timer=1;stepBoss(a,x,.1);stepBoss(b,y,.1);assert.equal(x.timer,y.timer);
 x.state=y.state='recover';x.timer=y.timer=1;stepBoss(a,x,.9);stepBoss(b,y,.9);assert.equal(x.state,'recover');assert.equal(y.state,'seek');
});
test('stage two drops less experience and less frequent medicine',()=>{
 for(const stage of [1,2]){
  const w=new SurvivalWorld(2,'ranger',stage);w.kills=24;
  const e=w.addEnemy('minion',0,0);w.hit(e,10000,'blade');
  assert.equal(w.potions.length,stage===1?1:0);
  const expected=stage===1?1:.85;
  const baseline=new SurvivalWorld(2,'ranger',1);const other=baseline.addEnemy('minion',0,0);baseline.hit(other,10000,'blade');
  assert.ok(Math.abs(w.gems[0].value/baseline.gems[0].value-expected)<1e-10);
 }
});
test('garden medicine expires, is capped, and counts only effective healing',()=>{
 const w=new SurvivalWorld(1,'ranger',2);
 for(let i=0;i<5;i++)w.dropPotion(0,0);
 assert.equal(w.potions.length,3);
 w.hp=95;w.collect(0);assert.equal(w.hp,100);assert.equal(w.healing.potion,5);assert.equal(w.potions.length,2);
 w.time=25;w.collect(0);assert.equal(w.potions.length,0);
 const a=new SurvivalWorld(1,'ranger',1);a.dropPotion(0,0);a.time=100;a.collect(0);assert.equal(a.potions.length,0);
});
test('garden boss staggered route cut locks both positions and keeps threat cap',()=>{
 const w=new SurvivalWorld(1,'ranger',2);w.time=10;w.player={x:5,y:0};w.setMove(1,0);
 const e=w.addEnemy('boss',0,0);e.state='seek';e.visibleSince=0;e.attack=0;e.pattern=1;
 stepBoss(w,e,0);assert.equal(w.hazards.length,2);
 const [a,b]=w.hazards;assert.equal(a.x,5);assert.equal(b.x,7.8);assert.ok(b.due>a.due);
 w.player.y=5;assert.equal(a.y,0);assert.equal(b.y,0);
 e.state='seek';e.attack=0;stepBoss(w,e,0);assert.equal(w.hazards.length,2);
});
test('later elite has greater pressure than first elite on challenge maps',()=>{
 for(const stage of [2,3]){
 const w=new SurvivalWorld(1,'ranger',stage);w.time=180;w.director.step(w,0);const first=w.enemies.find(e=>e.kind==='executioner');
 const base=new SurvivalWorld(1,'ranger',stage);base.time=180;const f=base.addEnemy('executioner');assert.ok(Math.abs(first.maxHp/f.maxHp-.9)<1e-9);
 w.enemies=[];w.time=350;w.director.step(w,0);const second=w.enemies.find(e=>e.kind==='charger');base.time=350;const s=base.addEnemy('charger');assert.ok(Math.abs(second.maxHp/s.maxHp-1.1)<1e-9);
 }
});
