import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ProgressStore,PROGRESS_KEY} from '../temp/tests/platform/ProgressStore.mjs';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};
test('all five stages expire full-health potions at 25 seconds and cap the oldest drops',()=>{
 for(let stage=1;stage<=5;stage++){
  const w=new SurvivalWorld(1,'ranger',stage);w.time=10;
  w.dropPotion(0,0);const old=w.potions[0].id;
  w.time=20;for(let i=0;i<3;i++)w.dropPotion(0,0);
  assert.equal(w.potions.length,3);assert.ok(w.potions.every(p=>p.id!==old));
  w.time=44.99;w.collect(0);assert.equal(w.potions.length,3);assert.equal(w.hp,100);
  w.time=45;w.hp=80;w.collect(0);assert.equal(w.potions.length,0);assert.equal(w.hp,80);assert.equal(w.healing.potion,0);
 }
});
test('valid potion heals once and pause does not consume its battle-time lifetime',()=>{
 const w=new SurvivalWorld();w.dropPotion(0,0);w.pause('test',true);w.step(30);
 assert.equal(w.time,0);assert.equal(w.potions.length,1);w.pause('test',false);
 w.hp=85;w.collect(0);w.collect(0);assert.equal(w.hp,100);assert.equal(w.healing.potion,15);assert.equal(w.potions.length,0);
});
test('third altar boundary remains movable at the right edge',()=>{
 const w=new SurvivalWorld(1,'ranger',3);w.player={x:22,y:0};w.setMove(1,0);for(let i=0;i<60;i++)w.step(1/60);assert.ok(w.player.x<=22);assert.ok(w.player.x>=21);w.setMove(-1,0);for(let i=0;i<120;i++)w.step(1/60);assert.ok(w.player.x<21);
});
test('elite boss-like kills drop a visible high-value experience gem',()=>{
 const w=new SurvivalWorld(1,'ranger',1);w.time=175;const e=w.addEnemy('siegerider',0,0);e.hp=1;w.hit(e,1000,'blade');
 assert.equal(w.gems.length,1);assert.equal(w.gems[0].value,8*.85);assert.equal(w.xp,0);
});
