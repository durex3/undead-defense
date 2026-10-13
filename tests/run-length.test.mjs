import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {BOSS_TIME,MAX_PLAYER_LEVEL,encounterBeat} from '../temp/tests/battle/EncounterPacing.mjs';
import {MAX_ENEMIES,WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
test('opening offers three distinct roles, freezes the world, chooses exactly one without XP cost',()=>{
 const seen=new Set();
 for(let seed=1;seed<=40;seed++){
  const w=new SurvivalWorld(seed,'necromancer');assert(w.offerStartingWeapons());const cards=[...w.startingWeapons];
  assert.equal(cards.length,3);assert.equal(new Set(cards).size,3);assert.equal(w.weaponCount,0);
  w.step(10);assert.equal(w.time,0);assert.equal(w.enemies.length,0);assert.equal(w.active,false);
  assert.equal(w.chooseStartingWeapon('mine'),false);assert(w.chooseStartingWeapon(cards[1]));
  assert.equal(w.chooseStartingWeapon(cards[0]),false);assert.equal(w.weaponCount,1);assert.equal(w.skills[cards[1]],1);assert.equal(w.level,1);assert.equal(w.xp,0);assert.equal(w.active,true);
  seen.add(cards[1]);
 }
 assert(seen.size>=3);
});
test('all ten stages summon at eight minutes, not four, and keep the pre-boss respite',()=>{
 assert.equal(BOSS_TIME,480);assert.equal(MAX_PLAYER_LEVEL,60);
 for(let stage=1;stage<=10;stage++){
  const w=new SurvivalWorld(19,'ranger',stage);w.time=240;w.director.step(w,0);assert(!w.enemies.some(e=>e.kind==='boss'));
  w.enemies=[];w.time=470;assert(encounterBeat(w.time).rest);w.director.step(w,0);assert.equal(w.enemies.length,0);
  w.time=480;w.director.step(w,0);assert.equal(w.enemies.filter(e=>e.kind==='boss').length,1);
 }
});
test('level sixty is attainable and excess XP cannot open a sixty-first upgrade',()=>{
 const w=new SurvivalWorld();w.level=59;w.xp=w.xpNeed;w.checkUpgrade();assert.equal(w.level,60);assert.equal(w.state,'upgrade');
 w.choose(w.cards[0]);w.xp=10000;w.checkUpgrade();assert.equal(w.level,60);assert.equal(w.state,'battle');
});
test('full six-weapon combinations cannot safely stand still against later bosses',()=>{
 for(const stage of [5,6,7,8,9,10]){
  const w=new SurvivalWorld(19,'necromancer',stage,6);for(const s of WEAPONS)w.skills[s]=0;
  Object.assign(w.skills,{ghost:10,bat:10,water:10,poison:10,lightning:10,ice:10});
  Object.assign(w.evolutions,{ghost:'hunters',water:'tide',lightning:'thunder'});w.level=60;w.time=480;w.director.step(w,0);
  for(let i=0;i<7200 && w.state!=='won' && w.state!=='lost';i++){if(w.state==='evolution')w.back();w.step(1/60);w.drain();}
  assert.equal(w.state,'lost',`stage ${stage}`);assert(w.enemies.some(e=>e.kind==='boss'&&e.hp>0));
 }
});
test('the larger enemy budget remains strict under a late multi-direction wave',()=>{
 const w=new SurvivalWorld(19);w.time=400;w.director.elites=[true,true];
 for(let i=0;i<MAX_ENEMIES+20;i++)w.addEnemy('minion',10,10);
 w.director.step(w,1);assert.equal(w.enemies.length,MAX_ENEMIES);assert.equal(MAX_ENEMIES,100);
});
