import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {BOSS_TIME,MAX_PLAYER_LEVEL,encounterBeat} from '../temp/tests/battle/EncounterPacing.mjs';
import {MAX_ENEMIES,WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
test('all ten stages summon at eight minutes, not four, and keep the pre-boss respite',()=>{
 assert.equal(BOSS_TIME,480);assert.equal(MAX_PLAYER_LEVEL,64);
 for(let stage=1;stage<=10;stage++){
  const w=new SurvivalWorld(19,'ranger',stage);w.time=240;w.director.step(w,0);assert(!w.enemies.some(e=>e.kind==='boss'));
  w.enemies=[];w.time=470;assert(encounterBeat(w.time).rest);w.director.step(w,0);assert.equal(w.enemies.length,0);
  w.time=480;w.director.step(w,0);assert.equal(w.enemies.filter(e=>e.kind==='boss').length,1);
 }
});
test('level sixty-four is attainable and excess XP cannot open a sixty-fifth upgrade',()=>{
 const w=new SurvivalWorld();w.level=63;w.xp=w.xpNeed;w.checkUpgrade();assert.equal(w.level,64);assert.equal(w.state,'upgrade');
 w.choose(w.cards[0]);w.xp=10000;w.checkUpgrade();assert.equal(w.level,64);assert.equal(w.state,'battle');
});
test('the larger enemy budget remains strict under a late multi-direction wave',()=>{
 const w=new SurvivalWorld(19);w.time=400;w.director.elites=[true,true];
 for(let i=0;i<MAX_ENEMIES+20;i++)w.addEnemy('minion',10,10);
 w.director.step(w,1);assert.equal(w.enemies.length,MAX_ENEMIES);assert.equal(MAX_ENEMIES,100);
});
