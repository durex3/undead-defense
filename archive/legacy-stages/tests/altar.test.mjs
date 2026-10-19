import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {AltarSystem,altarFlame,altarLance,ALTAR_ZONES,ALTAR_RADIUS} from '../temp/tests/battle/AltarSystem.mjs';
import {stepHazards} from '../temp/tests/battle/EnemySystem.mjs';
import {stepBoss} from '../temp/tests/battle/BossSystem.mjs';
import {ProgressStore,PROGRESS_KEY} from '../temp/tests/platform/ProgressStore.mjs';
import {STAGES} from '../temp/tests/battle/StageRules.mjs';
test('difficulty climbs across stages without increasing reward',()=>{
 for(const key of ['health','elite','bossHealth','damage'])assert.ok(STAGES[1][key]<STAGES[2][key] && STAGES[2][key]<STAGES[3][key]);
 assert.equal(STAGES[2].xp,STAGES[3].xp);
});
test('altar has a safe center, full warning, periodic fixed damage and shared hazard budget',()=>{
 assert.ok(ALTAR_ZONES.every(p=>Math.hypot(p.x,p.y)>ALTAR_RADIUS+1));
 const w=new SurvivalWorld(1,'ranger',3);w.player={...ALTAR_ZONES[0]};
 assert.equal(altarFlame(w,0),true);assert.equal(altarFlame(w,1),false);
 w.time=1.49;stepHazards(w);assert.equal(w.hp,100);
 w.time=1.5;stepHazards(w);assert.equal(w.hp,90);
 w.invulnerable=0;w.time=2.4;stepHazards(w);assert.equal(w.hp,90);
 w.time=2.5;stepHazards(w);assert.equal(w.hp,80);
 w.time=5.5;stepHazards(w);assert.equal(w.hazards.length,0);
 altarFlame(w,0);w.hazards.push({...w.hazards[0],id:999,kind:'circle'});assert.equal(altarFlame(w,2),false);
});
test('map fire respects elite/rest windows, pausing and boss arrival cleanup',()=>{
 const w=new SurvivalWorld(1,'ranger',3),a=new AltarSystem();w.time=118;a.step(w);assert.equal(w.hazards.length,0);
 w.time=120;a.step(w);assert.equal(w.hazards.length,1);w.pause('test',true);w.step(10);assert.equal(w.time,120);w.pause('test',false);
 w.hazards=[];w.time=170;a.step(w);assert.equal(w.hazards.length,0);
 w.time=180;const e=w.addEnemy('executioner');a.step(w);assert.equal(w.hazards.length,0);e.hp=0;
 w.time=240;a.step(w);assert.equal(w.hazards.length,1);
 w.time=480;w.director.step(w,0);assert.equal(w.hazards.length,0);
});
test('lance locks aim, has exact rectangle hit region and cancels on caster death',()=>{
 const w=new SurvivalWorld(1,'ranger',3),e=w.addEnemy('boss',0,0);e.state='seek';w.player={x:5,y:0};altarLance(w,e);
 const h=w.hazards[0];w.player.y=2;w.time=1.2;stepHazards(w);assert.equal(w.hp,100);assert.equal(h.angle,0);
 w.hazards=[];w.player={x:5,y:0};altarLance(w,e);w.time+=1.2;stepHazards(w);assert.ok(w.hp<100);
 w.hazards=[];altarLance(w,e);e.hp=0;stepHazards(w);assert.equal(w.hazards.length,0);
});
test('altar boss phase transition clears fire and each second lance has its own warning',()=>{
 const w=new SurvivalWorld(1,'ranger',3),e=w.addEnemy('boss',0,0);e.state='seek';e.visibleSince=0;w.time=10;w.player={x:4,y:0};
 altarFlame(w,0);e.hp=e.maxHp*.49;stepBoss(w,e,0);assert.equal(e.bossPhase,2);assert.equal(e.timer,1.5);assert.equal(w.hazards.length,0);
 e.state='seek';e.attack=0;e.pattern=0;stepBoss(w,e,0);assert.equal(e.bossAction,'lance');assert.equal(e.timer,1.5);
 w.player.y=3;w.time+=1.2;stepBoss(w,e,1.2);assert.equal(e.combo,0);
 w.time+=.31;stepHazards(w);stepBoss(w,e,.31);assert.equal(e.combo,1);assert.equal(e.timer,1.5);assert.equal(w.hazards.length,1);
 assert.notEqual(w.hazards[0].angle,0);assert.equal(w.hazards[0].due,w.time+1.2);
});
