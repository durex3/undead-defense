import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {WEAPONS,EVOLUTIONS,SYNTHESIS_RECIPES} from '../temp/tests/battle/SurvivalConfig.mjs';
import {weaponStatus,upgradeSynergy,combatWeaponEntries,combinationRecipes} from '../temp/tests/battle/WeaponStatus.mjs';
const pair=skill=>SYNTHESIS_RECIPES[skill]?skill:WEAPONS.find(s=>SYNTHESIS_RECIPES[s]===skill);
function prepare(skill,partner){const w=new SurvivalWorld(19,'ranger',1,6);Object.defineProperty(w,"tagBonus",{get:()=>({})});for(const s of WEAPONS)w.skills[s]=0;w.skills[skill]=10;w.evolutions[skill]=EVOLUTIONS[skill][1].id;const main=pair(skill),other=main===skill?SYNTHESIS_RECIPES[main]:main;if(partner){w.skills[other]=10;w.evolutions[other]=EVOLUTIONS[other][0].id;w.cooldowns[other]=999;}for(let i=0;i<8;i++){const e=w.addEnemy('minion',Math.cos(i*Math.PI/4)*3,Math.sin(i*Math.PI/4)*3);e.state='seek';e.hp=e.maxHp=1e7;}return w;}
test('all eighteen independent branches keep their own damage and never gain recipe effects from a maxed partner',()=>{
 for(const skill of WEAPONS){
  const solo=prepare(skill,false),withPartner=prepare(skill,true),main=pair(skill);
  for(const w of [solo,withPartner])for(let i=0;i<600;i++){w.time=i/60;w.stepWeapons(1/60);w.drain();}
  assert((solo.damage[skill]||0)>0,`${skill} must attack alone`);
  // Blade can attack passively despite its disabled cooldown; it cannot add synergy to the tested skill.
  assert.equal(withPartner.damage[skill],solo.damage[skill],`${skill} must not depend on its recipe partner`);
  assert.equal(withPartner.combinations.ready(main),false,skill);
  assert.equal(Object.keys(withPartner.combinations.stats).length,0,skill);
  assert(!withPartner.synthesisOptions().includes(main));
  assert.equal(weaponStatus(withPartner,skill).icons,'◆');
  assert(upgradeSynergy(withPartner,skill).text.includes('不再触发'));
  assert(!combatWeaponEntries(withPartner).some(s=>s.endsWith(' ∞')));
  assert(combinationRecipes(withPartner).find(r=>r.main===main).blocked);
 }
});
test('first branches still combine, while either second branch blocks all nine recipes',()=>{
 for(const [main,partner] of Object.entries(SYNTHESIS_RECIPES))for(const second of [null,main,partner]){
  const w=new SurvivalWorld();w.skills[main]=w.skills[partner]=10;w.evolutions[main]=EVOLUTIONS[main][0].id;w.evolutions[partner]=EVOLUTIONS[partner][0].id;
  if(second)w.evolutions[second]=EVOLUTIONS[second][1].id;
  assert.equal(w.combinations.ready(main),second===null,`${main}/${second}`);
  if(second){assert.equal(w.setBuildTarget(main),false);assert(w.targetReason(main).includes('独立'));}
 }
});
test('second-branch descriptions explain their own attacks without any retained cooperation promises',()=>{
 for(const skill of WEAPONS)assert(!/联动|组合后|保留.*标记|搭配/.test(EVOLUTIONS[skill][1].description),skill);
});
test('automatic branch choice never announces a superweapon before a player can choose independence',()=>{
 for(const independent of [true,false]){
  const w=new SurvivalWorld();w.skills.fire=w.skills.blade=10;w.step(0);
  assert.equal(w.pendingEvolution,'fire');assert(!w.drain().some(e=>e.type==='comboReady'));
  w.evolve(EVOLUTIONS.fire[independent?1:0].id);
  assert.equal(w.pendingEvolution,'blade');assert(!w.drain().some(e=>e.type==='comboReady'));
  w.back();w.step(0);
  assert.equal(w.drain().filter(e=>e.type==='comboReady').length,independent?0:1);
 }
});
