import test from 'node:test';
import assert from 'node:assert/strict';
import {experienceRequired} from '../temp/tests/battle/ExperienceCurve.mjs';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {MAX_PLAYER_LEVEL,BOSS_TIME} from '../temp/tests/battle/EncounterPacing.mjs';
const old=[6,8,10,10,12,12,14,14,16,16,18,18,20,20,22,22,24,24,26,26,28,28,30,30];
test('XP costs rise at every level from the opening and keep the same boss time and cap',()=>{
 assert.deepEqual([1,2,3,4,5].map(experienceRequired),[6,8,10,11,12]);
 for(let level=2;level<MAX_PLAYER_LEVEL;level++)assert(experienceRequired(level)>experienceRequired(level-1));
 assert.equal(BOSS_TIME,480);assert.equal(MAX_PLAYER_LEVEL,64);
});
test('late harvest levels have increasing costs and cannot buy a full build on the old flat budget',()=>{
 let total=0;
 for(let level=1;level<MAX_PLAYER_LEVEL;level++){
  const required=experienceRequired(level);assert(Number.isInteger(required)&&required>0);
  if(level>=2){assert(required>experienceRequired(level-1));assert(required<=experienceRequired(level-1)*1.34);}
  const w=new SurvivalWorld();w.level=level;assert.equal(w.xpNeed,required);total+=required;
 }
 const oldTotal=old.reduce((a,b)=>a+b,0)+(63-old.length)*36;
 assert(total>oldTotal*2&&total<oldTotal*3);
 assert(experienceRequired(50)>experienceRequired(25)*2);
 let budget=oldTotal,level=1;while(budget>=experienceRequired(level)){budget-=experienceRequired(level);level++;}
 assert(level<50,`old full-build budget now reaches ${level}`);
});
test('late bulk pickup pays each new level cost without losing leftover XP or exceeding the level cap',()=>{
 const w=new SurvivalWorld();w.level=40;for(const c of Object.keys(w.skills))w.skills[c]=0;
 const amount=experienceRequired(40)+experienceRequired(41)+7;w.gems=[{id:w.id(),x:5,y:5,value:amount}];
 assert(w.useUltimate());assert.equal(w.level,41);
 while(w.state==='upgrade'||w.state==='evolution'){
  if(w.state==='evolution')w.back();else w.choose(w.cards[0]);
 }
 assert.equal(w.level,42);assert.equal(w.xp,7);assert.equal(w.gems.length,0);
 w.level=63;w.xp=experienceRequired(63)+11;w.checkUpgrade();assert.equal(w.level,64);
 while(w.state==='upgrade'||w.state==='evolution'){if(w.state==='evolution')w.back();else w.choose(w.cards[0]);}
 assert.equal(w.xp,11);w.checkUpgrade();assert.equal(w.level,64);assert.equal(w.state,'battle');
});
