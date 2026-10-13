import test from 'node:test';
import assert from 'node:assert/strict';
import { SurvivalWorld } from '../temp/tests/battle/SurvivalWorld.mjs';
import { WEAPONS, EVOLUTIONS, SYNTHESIS_RECIPES } from '../temp/tests/battle/SurvivalConfig.mjs';
import { rankDamage } from '../temp/tests/battle/BuildProgression.mjs';
function choose(w,s){w.state='upgrade';w.cards=[s];assert.equal(w.choose(s),true);}
test('weapons grow continuously past four; seven awakens without spending another choice',()=>{
 for(const s of WEAPONS){
  const w=new SurvivalWorld(8);w.skills[s]=4;
  for(let rank=5;rank<=10;rank++){
   choose(w,s);assert.equal(w.skills[s],rank,s);
   if(rank===10 && !SYNTHESIS_RECIPES[s]){assert.equal(w.state,'evolution');w.back();}
   assert.equal(w.state,'battle',s);
   assert.equal(w.weaponEvolution(s),rank>=7?EVOLUTIONS[s][0].id:undefined,s);
  }
  if(SYNTHESIS_RECIPES[s]){w.skills[SYNTHESIS_RECIPES[s]]=10;w.step(1/60);assert.equal(w.evolutions[s],EVOLUTIONS[s][0].id);assert.equal(w.skills[SYNTHESIS_RECIPES[s]],10);continue;}
  if(!SYNTHESIS_RECIPES[s]){assert.equal(w.legal().includes(s),false);continue;}

 }
});
test('old early evolutions and shop synthesis can still be upgraded through rank ten',()=>{
 const w=new SurvivalWorld(2);w.skills.fire=4;w.evolutions.fire='meteor';
 assert(w.legal().includes('fire'));choose(w,'fire');assert.equal(w.skills.fire,5);
});
test('established builds still receive other choices across repeated upgrades',()=>{
 const w=new SurvivalWorld(19);w.skills.blade=6;w.skills.fire=3;let alternatives=0;
 for(let i=0;i<100;i++){w.roll();assert.equal(new Set(w.cards).size,3);if(!w.cards.includes('blade'))alternatives++;}
 assert(alternatives>0);
});
test('each late rank improves damage and enemies do not gain health from weapon ranks',()=>{
 const w=new SurvivalWorld(1);const a=w.addEnemy('minion',4,0).maxHp;
 w.skills.blade=10;const b=w.addEnemy('minion',4,0).maxHp;assert.equal(a,b);
 for(let r=5;r<=10;r++)assert(rankDamage(r)>rankDamage(r-1));
});
test('midgame fodder health stops inflating while special enemies retain progression',()=>{
 const w=new SurvivalWorld(1);w.time=90;const a=w.addEnemy('minion',5,0).maxHp;
 const special=w.addEnemy('mage',5,0).maxHp;w.time=220;
 assert.equal(w.addEnemy('minion',5,0).maxHp,a);
 assert(w.addEnemy('mage',5,0).maxHp>special);
});
test('a completed main/support build clears the identical fifty-enemy wave substantially faster',()=>{
 function clearTime(blade,fire){
  const w=new SurvivalWorld(22);w.time=120;w.level=64;w.invulnerable=999;w.skills.blade=blade;w.skills.fire=fire;
  w.director.nextGroup=1e9;w.director.nextSpecial=1e9;w.director.elites=[true,true];
  for(let i=0;i<50;i++){const a=i*Math.PI*2/50;w.addEnemy('minion',Math.cos(a)*3.5,Math.sin(a)*3.5);}
  for(let i=0;i<300;i++){if(w.state==='evolution')w.back();w.step(1/60);w.drain();if(w.kills===50)return (i+1)/60;}
  return Infinity;
 }
 const basic=clearTime(4,3),complete=clearTime(10,7);
 assert(Number.isFinite(basic));assert(complete<basic*.6,`${complete} vs ${basic}`);
});
