import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {WEAPONS,SYNTHESIS_RECIPES,EVOLUTIONS} from '../temp/tests/battle/SurvivalConfig.mjs';
const enemy=(w,x,y=0,kind='minion')=>{const e=w.addEnemy(kind,x,y);e.state='seek';e.hp=e.maxHp=100000;return e;};
const mines=(w,count=1)=>{w.expansion.mines=Array.from({length:count},(_,i)=>({id:w.id(),x:3+i*.1,y:0,armed:0,until:8,queued:false}));};
const stopAuto=w=>{for(const s of WEAPONS)w.cooldowns[s]=99;};

test('nine disjoint recipes cover all eighteen weapons and each final combination fires once without consumption',()=>{
 const members=Object.entries(SYNTHESIS_RECIPES).flat();assert.equal(members.length,18);assert.equal(new Set(members).size,18);
 assert.deepEqual([...members].sort(),[...WEAPONS].sort());
 for(const main of ['bone','chain','totem']){
  const w=new SurvivalWorld();const partner=SYNTHESIS_RECIPES[main];w.skills[main]=10;w.skills[partner]=9;
  assert.equal(w.synthesize(main),false);w.skills[partner]=10;w.step(1/60);
  assert.equal(w.evolutions[main],EVOLUTIONS[main][0].id);assert.equal(w.skills[main],10);assert.equal(w.skills[partner],10);
  if(w.state==='evolution')w.back();
  assert.equal(w.drain().filter(e=>e.final&&e.skill===main).length,1);w.step(1/60);
  assert.equal(w.drain().filter(e=>e.final&&e.skill===main).length,0);
 }
});

test('bone remotely queues only armed mines after fusion and adds outer bone shards within the four-mine budget',()=>{
 const w=new SurvivalWorld();w.skills.bone=w.skills.mine=10;w.evolutions.bone='ram';mines(w,6);
 w.expansion.mines[5].armed=1;const outer=enemy(w,5.8);
 w.expansion.queueMinesOnSegment({x:0,y:0},{x:4,y:0});assert(w.expansion.mines.slice(0,5).every(m=>m.queued));assert(!w.expansion.mines[5].queued);
 w.expansion.stepMines();assert.equal(w.expansion.mines.length,2);assert(outer.hp<100000);
 assert.equal(w.drain().filter(e=>e.type==='comboBone').length,4);assert(w.damage.bone>0);
 const unready=new SurvivalWorld();unready.skills.bone=10;unready.skills.mine=9;unready.evolutions.bone='ram';mines(unready);
 unready.expansion.queueMinesOnSegment({x:0,y:0},{x:4,y:0});assert(!unready.expansion.mines[0].queued);
});

test('a real bone projectile queues a mine along its continuous movement segment',()=>{
 const w=new SurvivalWorld();w.skills.bone=w.skills.mine=10;w.evolutions.bone='ram';enemy(w,7);mines(w);
 w.expansion.cast('bone');w.stepShot(w.shots[0],.3);assert(w.expansion.mines[0].queued);
});

test('pillar triggers chain detonation once per enemy across a three-pulse strike and stops after partner removal',()=>{
 const w=new SurvivalWorld();w.skills.chain=w.skills.pillar=10;w.evolutions.chain='hellchain';w.evolutions.pillar='judgmentsky';
 enemy(w,3);enemy(w,3.5);stopAuto(w);w.arsenal.cast('chain');w.arsenal.cast('pillar');
 w.arsenal.step(0);w.drain();w.time=.8;w.arsenal.step(0);
 const first=w.drain().filter(e=>e.type==='comboJudgment');assert.equal(first.length,2);
 w.time=1.1;w.arsenal.step(0);assert.equal(w.drain().filter(e=>e.type==='comboJudgment').length,0);
 w.time=1.4;w.arsenal.step(0);assert.equal(w.drain().filter(e=>e.type==='comboJudgment').length,0);
 w.skills.pillar=0;w.time=2;w.arsenal.cast('pillar');w.time=3;w.arsenal.step(0);
 assert.equal(w.drain().filter(e=>e.type==='comboJudgment').length,0);
});

test('pillar requires a live chain mark and complete recipe rather than merely its early signature',()=>{
 for(const completed of [false,true]){
  const w=new SurvivalWorld();w.skills.chain=10;w.skills.pillar=completed?10:9;w.evolutions.chain='hellchain';const e=enemy(w,3);
  stopAuto(w);w.arsenal.cast('chain');w.arsenal.cast('pillar');w.arsenal.step(0);w.drain();w.time=.8;w.arsenal.step(0);
  assert.equal(w.drain().some(e=>e.type==='comboJudgment'),completed);
  for(const p of w.arsenal.links)p.active=false;w.time=3;w.arsenal.cast('pillar');w.time=4;w.arsenal.step(0);
  assert(!w.drain().some(e=>e.type==='comboJudgment'));assert(e.hp>0);
 }
});

test('soul-marked targets get gated extra totem hits; a lone boss can receive a soul tether after fusion',()=>{
 const w=new SurvivalWorld();w.skills.totem=w.skills.soul=10;w.evolutions.totem='gravegrid';const boss=enemy(w,4,0,'boss');
 stopAuto(w);assert(w.arsenal.cast('soul'));w.arsenal.cast('totem');w.arsenal.step(0);
 assert.equal(w.drain().filter(e=>e.type==='comboSoul').length,1);
 // Force all three rays to be due again; the shared enemy gate blocks duplicate bonuses.
 for(const p of w.arsenal.totems)p.next=0;w.arsenal.step(0);assert(!w.drain().some(e=>e.type==='comboSoul'));
 w.time=.75;w.arsenal.step(0);assert.equal(w.drain().filter(e=>e.type==='comboSoul').length,1);
 w.arsenal.remove('soul');for(const p of w.arsenal.totems)p.next=0;w.time=1.5;w.arsenal.step(0);
 assert(!w.drain().some(e=>e.type==='comboSoul'));assert(boss.hp>0);
});

test('completed chain recipe accelerates pillar impact and records the combo before a low-health target dies',()=>{
 const w=new SurvivalWorld();w.skills.chain=w.skills.pillar=10;w.evolutions.chain='hellchain';
 const e=enemy(w,3);e.hp=e.maxHp=40;stopAuto(w);w.arsenal.cast('chain');w.arsenal.cast('pillar');
 assert(w.arsenal.markers.some(p=>p.active&&p.due===.35));w.arsenal.step(0);assert(e.hp>0);w.drain();
 w.time=.34;w.arsenal.step(0);assert(!w.drain().some(e=>e.type==='comboJudgment'));
 w.time=.36;w.arsenal.step(0);assert.equal(w.drain().filter(e=>e.type==='comboJudgment').length,1);
 assert.equal(w.kills,1);assert.equal(w.damage.chain,40);
});

test('soul strike resolves once before the ordinary ray can kill its marked target',()=>{
 const w=new SurvivalWorld();w.skills.totem=w.skills.soul=10;w.evolutions.totem='gravegrid';
 const e=enemy(w,4);e.hp=e.maxHp=40;stopAuto(w);w.arsenal.cast('soul');w.arsenal.cast('totem');w.arsenal.step(0);
 assert.equal(w.drain().filter(e=>e.type==='comboSoul').length,1);assert.equal(w.kills,1);
 assert.equal(w.weaponKills.totem,1);
});
