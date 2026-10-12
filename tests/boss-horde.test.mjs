import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {bossCrowdRules} from '../temp/tests/battle/HordePressure.mjs';
import {MAX_ENEMIES} from '../temp/tests/battle/SurvivalConfig.mjs';
function battle(stage=5){const w=new SurvivalWorld(1,'ranger',stage);w.time=240;w.director.step(w,0);const b=w.enemies.find(e=>e.kind==='boss');b.state='seek';return {w,b};}
test('boss pressure scales across five stages and phases without exceeding global capacity',()=>{
 let last=0;for(let stage=1;stage<=5;stage++){
  const rules=bossCrowdRules(stage);assert.ok(rules.target>last);last=rules.target;
  const {w,b}=battle(stage);b.bossPhase=stage===5?3:2;
  for(let i=0;i<60;i++){w.time+=1;w.director.step(w,1);}
  assert.ok(w.enemies.length>20);assert.ok(w.enemies.length<=bossCrowdRules(stage,b.bossPhase).target+1);assert.ok(w.enemies.length<=MAX_ENEMIES);
  assert.ok(w.enemies.every(e=>['boss','minion'].includes(e.kind)));
 }
});
test('reinforcements arrive away from player, leave a new-wave gap and grant no farming resources',()=>{
 const {w}=battle();w.time=243;w.director.step(w,3);const adds=w.enemies.filter(e=>e.kind==='minion');assert.ok(adds.length>=10);
 for(const e of adds){assert.ok(Math.hypot(e.x-w.player.x,e.y-w.player.y)>=4);assert.equal(e.state,'arriving');assert.equal(e.timer,1);assert.equal(e.summoned,true);assert.equal(e.owner,0);e.state='seek';w.hit(e,1e6,'blade');}
 assert.equal(w.gems.length,0);assert.equal(w.potions.length,0);
});
test('boss transition and pause defer waves; kills are replenished; victory stops spawns',()=>{
 const {w,b}=battle();b.bossAction='transition';b.state='windup';w.time=250;w.director.step(w,10);assert.equal(w.enemies.length,1);
 b.state='seek';w.pause('test',true);w.time=255;w.director.step(w,5);assert.equal(w.enemies.length,1);w.pause('test',false);
 w.director.step(w,0);assert.ok(w.enemies.length>1);w.enemies=w.enemies.filter(e=>e===b);w.time+=3;w.director.step(w,3);assert.ok(w.enemies.length>1);
 w.hit(b,1e6,'blade');assert.equal(w.state,'won');const count=w.enemies.length;w.time+=10;w.director.step(w,10);assert.equal(w.enemies.length,count);assert.ok(w.enemies.every(e=>e.hp<=0));
});
test('own boss summons count toward wave target and edges never spawn on player',()=>{
 const {w,b}=battle();w.player={x:22,y:26};w.camera={x:10,y:20};
 for(let i=0;i<8;i++){const e=w.addEnemy('minion',0,0,true);e.owner=b.id;}
 for(let i=0;i<20;i++){w.time+=3;w.director.step(w,3);}
 assert.ok(w.enemies.length<=bossCrowdRules(5).target+1);
 assert.ok(w.enemies.filter(e=>e.owner===0&&e.kind==='minion').every(e=>Math.hypot(e.x-22,e.y-26)>=4));
});
