import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ChurchSystem,bellHazard,bellContains,CHURCH_BELLS} from '../temp/tests/battle/ChurchSystem.mjs';
import {stepHazards} from '../temp/tests/battle/EnemySystem.mjs';
import {stepBoss} from '../temp/tests/battle/BossSystem.mjs';
import {ProgressStore} from '../temp/tests/platform/ProgressStore.mjs';
test('ring boundaries, warning, inner safety and one-shot fixed environmental damage',()=>{
 const w=new SurvivalWorld(1,'ranger',4);bellHazard(w,{x:0,y:0});const h=w.hazards[0];
 assert.equal(bellContains(h,{x:2.19,y:0}),false);assert.equal(bellContains(h,{x:2.2,y:0}),true);assert.equal(bellContains(h,{x:4.2,y:0}),false);
 w.player={x:3,y:0};w.time=1.39;stepHazards(w);assert.equal(w.hp,100);
 w.time=1.4;stepHazards(w);assert.equal(w.hp,88);w.invulnerable=0;stepHazards(w);assert.equal(w.hp,88);
 assert.equal(w.losses['幽钟共振'],12);
});
test('church environment respects budget, pause, elite and pre-boss quiet window',()=>{
 const w=new SurvivalWorld(1,'ranger',4),c=new ChurchSystem();w.time=120;c.step(w);assert.equal(w.hazards.length,1);
 w.pause('qa',true);w.step(10);assert.equal(w.time,120);w.pause('qa',false);
 w.time=200;w.hazards=[];w.addEnemy('executioner');c.step(w);assert.equal(w.hazards.length,0);
 w.enemies=[];w.time=240;c.step(w);assert.equal(w.hazards.length,1);
 bellHazard(w,CHURCH_BELLS[1]);assert.equal(bellHazard(w,CHURCH_BELLS[2]),false);
 w.time=460;c.step(w);assert.equal(w.hazards.length,0);
});
test('bishop locks distant ring and phase-two pulse gets a new full warning',()=>{
 const w=new SurvivalWorld(1,'ranger',4);w.time=10;w.player={x:6,y:0};const e=w.addEnemy('boss',0,0);e.state='seek';e.visibleSince=0;e.attack=0;
 stepBoss(w,e,0);assert.equal(e.bossAction,'bellRing');assert.equal(w.hazards[0].x,6);w.player.x=7;assert.equal(w.hazards[0].x,6);
 e.hp=e.maxHp*.49;stepBoss(w,e,0);assert.equal(e.timer,1.5);assert.equal(w.hazards.length,0);
 e.state='seek';e.attack=0;e.pattern=0;stepBoss(w,e,0);w.time+=1.4;stepBoss(w,e,1.4);
 assert.equal(e.bossAction,'bellRing');
 w.time+=.26;stepHazards(w);stepBoss(w,e,.26);
 assert.equal(e.bossAction,'bellPulse');assert.equal(e.timer,1.35);assert.equal(w.hazards.length,1);assert.equal(w.hazards[0].due,w.time+1.1);
 e.hp=0;stepHazards(w);assert.equal(w.hazards.length,0);
});
