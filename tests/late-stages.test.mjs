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
test('sixth and seventh unlock sequentially and survive save round trip',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 const p=new ProgressStore(storage);assert.equal(p.unlockedStage(6),false);
 const w=new SurvivalWorld(1,'ranger',5);w.state='won';p.observe(w);assert.equal(p.unlockedStage(6),true);assert.equal(p.unlockedStage(7),false);
 w.stageId=6;p.observe(w);assert.equal(p.unlockedStage(7),true);w.stageId=7;p.observe(w);
 const q=new ProgressStore(storage);assert.deepEqual(q.data,p.data);assert.ok(q.data.stageBest[7].won);assert.ok(data.get(PROGRESS_KEY));
});
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
  const w=new SurvivalWorld(1,'ranger',stage),d=new LateStageDirector();w.time=60;d.step(w);assert.equal(w.hazards.length,1);
  w.pause('qa',true);w.step(2);assert.equal(w.time,60);w.pause('qa',false);
  w.time=85;d.step(w);assert.equal(w.hazards.length,0);
  w.time=132;w.addEnemy('executioner');d.step(w);assert.equal(w.hazards.length,0);
  w.enemies=[];w.time=150;d.step(w);assert.equal(w.hazards.length,1);
  w.time=230;d.step(w);assert.equal(w.hazards.length,0);
  w.time=240;w.director.step(w,0);assert.equal(w.enemies.filter(e=>e.kind==='boss').length,1);
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
test('new stages share hazard cap and offer stage-specific HUD and retry guidance',()=>{
 for(const stage of [6,7]){const w=new SurvivalWorld(1,'ranger',stage);lateCast(w);lateCast(w,0,1);assert.equal(lateCast(w),false);assert.ok(w.hazards.length<=2);
 assert.match(battleHud(w,false,[]).hint,stage===6?/熔流/:/裂隙/);assert.match(battleReport(w).retryTip,stage===6?/圣水|骨矛/:/雷电|镰刀/);}
});
