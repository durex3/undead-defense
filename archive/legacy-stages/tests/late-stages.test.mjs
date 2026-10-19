import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {lateCast,LateStageDirector,lateStageDamage} from '../temp/tests/battle/LateStageSystem.mjs';
import {stepBoss,bossExposed} from '../temp/tests/battle/BossSystem.mjs';
import {stepHazards} from '../temp/tests/battle/EnemySystem.mjs';
import {ProgressStore,PROGRESS_KEY} from '../temp/tests/platform/ProgressStore.mjs';
import {battleReport} from '../temp/tests/battle/BattleReport.mjs';
import {battleHud} from '../temp/tests/presentation/BattleHud.mjs';
function boss(stage){const w=new SurvivalWorld(1,'ranger',stage);w.time=10;w.player={x:3,y:0};const e=w.addEnemy('boss',0,0);e.state='seek';e.visibleSince=0;e.attack=0;return {w,e};}
test('furnace strip locks position, has full warning and exact lateral escape',()=>{
 const w=new SurvivalWorld(1,'ranger',6);assert.ok(lateCast(w));const h=w.hazards[0];
 assert.equal(h.due,1.8);w.time=1.79;stepHazards(w);assert.equal(w.hp,100);
 w.player.y=1;w.time=1.8;stepHazards(w);assert.equal(w.hp,100);assert.equal(h.y,0);
 w.hazards=[];w.player={x:0,y:0};assert.ok(lateCast(w));w.time+=1.8;stepHazards(w);assert.equal(w.hp,90);assert.equal(w.lastDamageSource,'熔流切线');
});
test('rift inner circle is safe during ring but not pulse; hazards cancel with source',()=>{
 const {w,e}=boss(7);assert.ok(lateCast(w,e.id,0));let h=w.hazards[0];w.time=h.due;stepHazards(w);assert.equal(w.hp,100);
 w.hazards=[];assert.ok(lateCast(w,e.id,1));h=w.hazards[0];w.time=h.due;stepHazards(w);assert.equal(w.hp,82);assert.equal(w.lastDamageSource,'永夜内爆');
 w.hazards=[];lateCast(w,e.id,0);e.hp=0;stepHazards(w);assert.equal(w.hazards.length,0);
});
test('environment skips elite/rest windows, never catches up missed events and pause freezes time',()=>{
 for(const stage of [6,7]){
  const w=new SurvivalWorld(1,'ranger',stage),d=new LateStageDirector();w.time=120;d.step(w);assert.equal(w.hazards.length,1);
  w.pause('qa',true);w.step(2);assert.equal(w.time,120);w.pause('qa',false);
  w.time=170;d.step(w);assert.equal(w.hazards.length,0);
  w.time=264;w.addEnemy('executioner');d.step(w);assert.equal(w.hazards.length,0);
  w.enemies=[];w.time=300;d.step(w);assert.equal(w.hazards.length,1);
  w.time=460;d.step(w);assert.equal(w.hazards.length,0);
  w.time=480;w.director.step(w,0);assert.equal(w.enemies.filter(e=>e.kind==='boss').length,1);
 }
});
test('furnace temporary armour distinguishes direct and persistent damage without immunity',()=>{
 const {w,e}=boss(6);stepBoss(w,e,0);assert.equal(e.state,'windup');assert.equal(lateStageDamage(w,e,true),.8);assert.equal(lateStageDamage(w,e,false),1);
 const hp=e.hp;w.hit(e,10,'qa',false,w.player,true);assert.equal(hp-e.hp,8);
 w.hit(e,10,'qa',false,w.player,false);assert.equal(hp-e.hp,18);
 w.time=12;stepHazards(w);stepBoss(w,e,2);assert.equal(e.state,'recover');assert.ok(bossExposed(w,e));assert.equal(lateStageDamage(w,e,true),1);
});
test('rift phase clears old attacks and each follow-up warns before recovery',()=>{
 const {w,e}=boss(7);lateCast(w,e.id);e.hp=e.maxHp*.49;stepBoss(w,e,0);assert.equal(e.bossPhase,2);assert.equal(w.hazards.length,0);
 stepBoss(w,e,1.5);e.state='seek';e.attack=0;stepBoss(w,e,0);const first=w.hazards[0];
 w.player.y=3;w.time+=1.71;stepHazards(w);stepBoss(w,e,1.71);const second=w.hazards[0];
 assert.notEqual(second.id,first.id);assert.equal(second.y,3);assert.ok(second.due-w.time>=1.39);assert.equal(e.combo,1);
 w.time+=1.71;stepHazards(w);stepBoss(w,e,1.71);assert.equal(e.state,'recover');assert.ok(bossExposed(w,e));
});
