import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ProgressStore,PROGRESS_KEY} from '../temp/tests/platform/ProgressStore.mjs';
import {battleReport} from '../temp/tests/battle/BattleReport.mjs';
import {crownEscape} from '../temp/tests/battle/CrownSystem.mjs';
import {stepEnemies,stepHazards} from '../temp/tests/battle/EnemySystem.mjs';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};
test('per-stage best survives reload, ignores longer weaker boss attempts and repeated observation',()=>{
 const s=storage(),p=new ProgressStore(s),w=new SurvivalWorld(1,'ranger',5);
 w.time=300;const b=w.addEnemy('boss',4,0);b.bossPhase=3;b.hp=b.maxHp*.12;w.state='lost';p.observe(w);
 const revision=p.data.revision;p.observe(w);assert.equal(p.data.revision,revision);
 w.time=400;b.hp=b.maxHp*.2;p.observe(w);assert.equal(p.data.stageBest[5].bossRemaining,12);
 w.stageId=4;b.bossPhase=2;p.observe(w);assert.equal(p.data.stageBest[4].phase,2);
 const q=new ProgressStore(s);assert.deepEqual(q.data,p.data);assert.match(q.bestLine(5),/12%/);
 w.stageId=5;w.state='won';b.hp=0;q.observe(w);assert.match(q.bestLine(5),/已通关/);
});
test('fatal report identifies the killing blow rather than largest cumulative damage',()=>{
 const w=new SurvivalWorld();w.hurt(80,'boss');w.invulnerable=0;w.hurt(30,'骨箭');
 const r=battleReport(w);assert.equal(r.deathSource,'骨箭');assert.equal(r.losses[0].name,'骸骨领主');
});
test('evolved ghost splash hits neighbors but never adds a second hit to the direct target',()=>{
 const w=new SurvivalWorld();w.skills.ghost=4;w.evolutions.ghost='legion';
 const e=w.addEnemy('minion',1,0),near=w.addEnemy('minion',1,.7);e.hp=near.hp=100;
 w.stepShot({x:0,y:0,vx:10,vy:0,ttl:1,age:0,skill:'ghost',damage:10,width:.01,left:1,hit:[],target:e.id},.1);
 assert.equal(e.hp,90);assert.equal(near.hp,100-w.attack*.3);
});
test('escape checks reject covering hazards and allow a warned lateral dodge in all five maps',()=>{
 for(let stage=1;stage<=5;stage++){
  const w=new SurvivalWorld(1,'ranger',stage);
  const h={id:1,source:0,kind:'circle',x:0,y:0,angle:0,width:0,radius:100,created:0,due:1,until:1.25,damage:1,fired:false,next:0};
  assert.equal(crownEscape(w,[h]),false);assert.equal(crownEscape(w,[{...h,radius:1}]),true);
 }
});
test('already launched arrows continue during caster freeze and do not gain extra lifetime',()=>{
 const w=new SurvivalWorld();const e=w.addEnemy('archer',4,0);e.freezeUntil=10;
 const h={id:1,source:e.id,kind:'arrow',x:4,y:0,angle:Math.PI,width:0,radius:10,created:0,due:0,until:2,damage:10,fired:true,next:0};w.hazards=[h];
 stepEnemies(w,.1);assert.equal(h.until,2);w.time=1;stepHazards(w);assert.ok(w.hp<100);
});
test('altar boss flame locks player position with a full warning while environment stays fixed',async()=>{
 const {altarFlame,ALTAR_ZONES}=await import('../temp/tests/battle/AltarSystem.mjs');
 const w=new SurvivalWorld(1,'ranger',3),e=w.addEnemy('boss',5,0);w.player={x:0,y:0};
 assert.equal(altarFlame(w,0,e.id),true);const h=w.hazards[0];assert.equal(h.x,0);assert.equal(h.radius,2.6);assert.equal(h.due,1.5);
 w.player.x=5;assert.equal(h.x,0);w.time=1.5;stepHazards(w);assert.equal(w.hp,100);
 w.hazards=[];assert.equal(altarFlame(w,0),true);assert.equal(w.hazards[0].x,ALTAR_ZONES[0].x);
});
