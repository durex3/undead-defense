import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ALL_WEAPONS,ENEMIES} from '../temp/tests/battle/SurvivalConfig.mjs';
import {STAGES} from '../temp/tests/battle/StageRules.mjs';
import {stageReference,stageGrowth} from '../temp/tests/battle/StageGrowth.mjs';
import {stageRecoveryFactor} from '../temp/tests/battle/StagePressure.mjs';
test('all registered weapon strategies are executable and isolated from unlearned weapons',()=>{
 const w=new SurvivalWorld(19,'ranger',1);assert.deepEqual(Object.keys(w.armory.strategies).sort(),[...ALL_WEAPONS].sort());
 for(const skill of ALL_WEAPONS){const q=new SurvivalWorld(19,'ranger',1);q.player={x:0,y:0};for(const s of ALL_WEAPONS)q.skills[s]=0;q.skills[skill]=1;const e=q.addEnemy('minion',1.5,0);e.state='seek';e.hp=e.maxHp=1e8;q.armory.step(0);assert.equal(q.castCounts[skill],1,skill);assert(Object.entries(q.castCounts).every(([s,c])=>s===skill||!c));}
});
test('fixed reference-output × target-time budgets grow without an unbounded equipment multiplier',()=>{
 let previous=null;
 for(let stage=1;stage<=10;stage++){
  const w=new SurvivalWorld(19,'ranger',stage);w.time=240;
  const n=w.addEnemy('minion'),e=w.addEnemy('siegeflag'),b=w.addEnemy('boss'),r=stageReference(stage);
  assert(Math.abs(b.maxHp-r.bossDps*r.bossSeconds)<1e-7);
  assert(Math.abs(e.maxHp-30*1.8*ENEMIES.siegeflag.health*STAGES[stage].elite)<1e-7);
  if(previous){assert(n.maxHp>previous.n);assert(e.maxHp>previous.e);assert(b.maxHp>previous.b);}
  previous={n:n.maxHp,e:e.maxHp,b:b.maxHp};
  // The same stage has the same HP even when the player has a different build.
  const q=new SurvivalWorld(91,'ranger',stage);q.time=240;q.skills.hammer=8;q.passives.power=4;
  assert.equal(q.addEnemy('boss').maxHp,b.maxHp);
 }
 assert.equal(stageGrowth(1).health,1.65);assert.equal(stageGrowth(1).elite,1.85);
 assert.equal(stageReference(1).bossSeconds,60);
 const late=stageReference(10000),growth=stageGrowth(10000);
 assert.equal(late.bossDps,560);assert.equal(late.bossSeconds,120);
 assert.equal(growth.bossHealth*8400,67200);
 assert(Math.abs(growth.health-3.234)<1e-9);assert(Math.abs(growth.elite-3.885)<1e-9);
 assert.throws(()=>stageGrowth(0));assert.throws(()=>stageGrowth(NaN));assert.throws(()=>stageGrowth(1.5));
});
test('Boss fracture has diminishing team armor advantage and preserves exposure windows; elites retain fracture strength',()=>{
 for(const stage of [5,6,7,8,9,10]){
  const w=new SurvivalWorld(19,'ranger',stage),e=w.addEnemy('boss');e.state='seek';e.hp=e.maxHp=1e6;
  const hit=()=>{const hp=e.hp;w.hit(e,100,'bone');return hp-e.hp;};
  assert.equal(hit(),45);w.fracture(e);assert.equal(hit(),60);w.fracture(e);assert.equal(hit(),75);
  w.time=3.01;assert.equal(hit(),45);
 }
 assert.equal(stageRecoveryFactor(4),1);assert(Math.abs(stageRecoveryFactor(10)-.531441)<1e-9);assert.equal(stageRecoveryFactor(100),.35);
});
