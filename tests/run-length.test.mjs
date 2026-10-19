import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {BOSS_TIME,MAX_PLAYER_LEVEL,encounterBeat,bossTimeForStage} from '../temp/tests/battle/EncounterPacing.mjs';
import {MAX_ENEMIES,WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
test('all four stages summon at their boss time; stages 1 and 2 keep a pre-boss respite',()=>{
 assert.equal(BOSS_TIME,480);assert.equal(MAX_PLAYER_LEVEL,64);
 for(let stage=1;stage<=4;stage++){
  const w=new SurvivalWorld(19,'ranger',stage);w.time=240;w.director.step(w,0);assert(!w.enemies.some(e=>e.kind==='boss'));
  const bossTime=bossTimeForStage(stage);
  // The authored respite ends just before the boss hand-off on every stage.
  // Thunder and Moon directors spawn continuously, so only Siege and Sand author a quiet window.
  if (stage <= 2) {
    const pre = bossTime-6;
    w.enemies=[];w.time=pre;assert(encounterBeat(w.time).rest);w.director.step(w,0);assert.equal(w.enemies.length,0);
  }
  w.time=bossTime;w.director.step(w,0);assert.equal(w.enemies.filter(e=>e.kind==='boss').length,1);
 }
});
test('level sixty-four is attainable and excess XP cannot open a sixty-fifth upgrade',()=>{
 const w=new SurvivalWorld();w.level=63;w.xp=w.xpNeed;w.checkUpgrade();assert.equal(w.level,64);assert.equal(w.state,'upgrade');
 w.choose(w.cards[0]);w.xp=10000;w.checkUpgrade();assert.equal(w.level,64);assert.equal(w.state,'battle');
});
test('the enemy pool stays bounded under a late multi-direction wave',()=>{
 const w=new SurvivalWorld(19);w.time=300;w.director.elites=[true,true];
 for(let i=0;i<MAX_ENEMIES+20;i++)w.addEnemy('minion',10,10);
 assert.equal(w.enemies.length,MAX_ENEMIES);assert.equal(MAX_ENEMIES,100);
 const before=w.enemies.length;w.director.step(w,1);
 assert.ok(w.enemies.length<=MAX_ENEMIES,`${before} -> ${w.enemies.length}`);
});
