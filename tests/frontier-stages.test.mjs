import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {FRONTIER_MAPS,frontierMap} from '../temp/tests/battle/FrontierMaps.mjs';
import {FRONTIER_ROLES,FrontierDirector,castFrontier,stepFrontierEnemy,stepFrontierBoss,frontierRest} from '../temp/tests/battle/FrontierSystem.mjs';
import {frontierContains} from '../temp/tests/battle/FrontierGeometry.mjs';
import {stepEnemies,stepHazards} from '../temp/tests/battle/EnemySystem.mjs';
import {stepGarden} from '../temp/tests/battle/GardenMap.mjs';
import {crownAreaHit} from '../temp/tests/battle/CrownSystem.mjs';
import {STAGES,STAGE_GUIDES} from '../temp/tests/battle/StageRules.mjs';
import {STAGE_IDS} from '../temp/tests/battle/ProgressionConfig.mjs';
import {ProgressStore} from '../temp/tests/platform/ProgressStore.mjs';
const stages=[11,12,13];
function world(stage){const w=new SurvivalWorld(19,'ranger',stage);w.time=10;w.setMove(1,0);w.director.elites=[true,true];return w;}
function enemy(w,kind='boss'){const e=w.addEnemy(kind,-4,0);e.state='seek';e.visibleSince=0;e.attack=0;return e;}

test('stages 11–13 unlock sequentially and preserve old and new saves and bests',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 let p=new ProgressStore(storage);assert.equal(STAGE_IDS.length,13);
 for(const stage of stages){assert(!p.unlockedStage(stage));const w=world(stage-1);w.state='won';p.observe(w);assert(p.unlockedStage(stage));assert(!p.data.stages.includes(stage));}
 const w=world(13);w.state='won';p.observe(w);p=new ProgressStore(storage);
 for(const stage of [10,11,12,13])assert(p.data.stageBest[stage].won&&p.data.stages.includes(stage));
 assert.equal(p.data.revision,4);assert.equal(Object.keys(STAGES).length,13);
 for(const stage of stages)assert(STAGE_GUIDES[stage].threat.length&&STAGE_GUIDES[stage].builds.length);
});
for(const stage of stages){
 test(`stage ${stage}: map corridors are connected and navigation clears obstacles`,()=>{
  const m=frontierMap(stage),visited=new Set(['0,0']),queue=[[0,0]];
  for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=nx+','+ny;if(Math.abs(nx)>21||Math.abs(ny)>25||visited.has(k)||m.blocked({x:nx,y:ny},.65))continue;visited.add(k);queue.push([nx,ny]);}}
  for(const p of [[-21,-25],[21,-25],[-21,25],[21,25],[-18,0],[18,0],[0,-20],[0,20]])assert(visited.has(p.join(',')));
  const b=FRONTIER_MAPS[stage].boxes[0],w=world(stage),e=enemy(w),target={x:b.x+FRONTIER_MAPS[stage].width+2,y:b.y};
  e.x=b.x-FRONTIER_MAPS[stage].width-2;e.y=b.y;
  assert(m.segment(e,target));
  for(let i=0;i<1800&&Math.hypot(e.x-target.x,e.y-target.y)>.2;i++){const a=m.heading(e,target);e.x+=Math.cos(a)*1.7/60;e.y+=Math.sin(a)*1.7/60;m.resolve(e,.65);assert(!m.blocked(e,.64));}
  assert(Math.hypot(e.x-target.x,e.y-target.y)<.3);
  w.player={...b};stepGarden(w,0);assert(!m.blocked(w.player,.29));
 });
 test(`stage ${stage}: all boss attacks snapshot visible geometry, reserve slots and finish with a real recovery`,()=>{
  for(const phase of [1,2])for(const action of [0,1,2]){
   const w=world(stage),e=enemy(w);e.bossPhase=phase;
   assert(castFrontier(w,e,action),`${stage}/${phase}/${action}`);assert(w.hazards.length<=2);
   if(w.hazards.length===2){const [a,b]=w.hazards;if(a.due===b.due)assert(w.hazards.every(h=>h.sequence===undefined));else assert.deepEqual(w.hazards.map(h=>h.sequence),[1,2]);}
   const snapshot=JSON.stringify(w.hazards);w.player.x=8;w.setMove(0,1);
   assert.equal(JSON.stringify(w.hazards),snapshot);
   assert(w.hazards.every(h=>h.due-h.created>=1.5&&h.fixedDamage&&h.damage===18));
   for(const h of w.hazards){assert.equal(crownAreaHit(h,{x:h.x,y:h.y}),frontierContains(h,h));}
   const duration=e.timer;stepFrontierBoss(w,e,duration);assert.equal(e.state,'recover');assert(e.timer>=2.8);
   const x=e.x,y=e.y,hp=w.hp;stepFrontierBoss(w,e,1);assert.equal(e.x,x);assert.equal(e.y,y);assert.equal(w.hp,hp);
  }
 });
 test(`stage ${stage}: two-slot casts are atomic and unsafe edge attacks are skipped`,()=>{
  const w=world(stage),e=enemy(w);e.bossPhase=2;
  w.hazards=[{id:99,until:20}];const before=JSON.stringify(w.hazards);
  assert(!castFrontier(w,e,stage===11?1:0));assert.equal(JSON.stringify(w.hazards),before);assert.equal(e.state,'seek');
  w.hazards=[];w.player={x:21.9,y:25.9};assert(!castFrontier(w,e,0));assert.equal(w.hazards.length,0);
 });
 test(`stage ${stage}: both specialist enemies cast, freeze, cancel near player and release hazards on death`,()=>{
  for(const kind of FRONTIER_ROLES[stage].slice(1)){
   const w=world(stage),e=enemy(w,kind);assert(castFrontier(w,e));
   const due=w.hazards[0].due,timer=e.timer;w.slow(e,true);assert.equal(e.state,"windup");assert.equal(w.hazards[0].due,due);stepEnemies(w,.25);
   assert.equal(e.timer,timer);assert.equal(w.hazards[0].due,due+.25);
   e.freezeUntil=0;w.player={x:e.x,y:e.y};stepFrontierEnemy(w,e,.1);assert.equal(e.state,'recover');assert.equal(w.hazards.length,0);
   w.player={x:0,y:0};assert(castFrontier(w,e));e.hp=0;stepHazards(w);assert.equal(w.hazards.length,0);
  }
 });
 test(`stage ${stage}: staggered and intersecting shapes hit only once per group`,()=>{
  const w=world(stage),e=enemy(w);e.bossPhase=2;const action=stage===11?1:0;assert(castFrontier(w,e,action));assert.equal(w.hazards.length,2);
  const [a,b]=w.hazards;w.time=a.due;w.player={x:a.x,y:a.y};stepHazards(w);assert.equal(w.hp,82);
  w.invulnerable=0;w.time=b.due;w.player={x:b.x,y:b.y};stepHazards(w);assert.equal(w.hp,82);
 });
 test(`stage ${stage}: transition clears pending second hit and prevents contact damage`,()=>{
  const w=world(stage),e=enemy(w);assert(castFrontier(w,e,0));e.hp=e.maxHp*.49;
  stepFrontierBoss(w,e,.1);assert.equal(w.hazards.length,0);assert.equal(e.bossPhase,2);assert.equal(e.bossAction,'transition');assert.equal(e.timer,1.5);
  w.player={x:e.x,y:e.y};stepFrontierBoss(w,e,1);assert.equal(w.hp,100);
 });
 test(`stage ${stage}: opening, separate teaching, elite/rest windows and caps remain bounded`,()=>{
  for(const [time,allowed] of [[1,[]],[40,[0]],[80,[0,1]],[130,[0,2]],[215,[0,1]],[275,[0,2]],[390,[0,1,2]]]){
   const w=world(stage),d=new FrontierDirector();w.time=time;d.step(w,.1,(a,r=8)=>({x:Math.cos(a)*r,y:Math.sin(a)*r}));
   const roles=FRONTIER_ROLES[stage];assert(w.enemies.every(e=>e.kind==='minion'||allowed.some(i=>roles[i]===e.kind)));
   assert(w.enemies.every(e=>e.state==='arriving'&&e.timer>=1));
  }
  for(const t of [165,255,335,470]){assert(frontierRest(t));const w=world(stage),d=new FrontierDirector();w.time=t;d.step(w,1,()=>({x:8,y:0}));assert.equal(w.enemies.length,0);}
  const w=world(stage),d=new FrontierDirector();w.time=390;for(let i=0;i<100;i++)w.addEnemy('minion',8,0);d.step(w,20,()=>({x:8,y:0}));assert.equal(w.enemies.length,100);
 });
 test(`stage ${stage}: pause freezes world timers and boss spawn removes old specialists`,()=>{
  const w=world(stage),e=enemy(w,FRONTIER_ROLES[stage][1]);assert(castFrontier(w,e));w.pause('menu',true);
  const snapshot=JSON.stringify({time:w.time,enemy:e,hazards:w.hazards});w.step(2);assert.equal(JSON.stringify({time:w.time,enemy:e,hazards:w.hazards}),snapshot);
  w.pause('menu',false);w.time=480;w.director.step(w,1/60);assert(w.enemies.some(e=>e.kind==='boss'));assert(!w.enemies.some(e=>e.kind===FRONTIER_ROLES[stage][1]));assert.equal(w.hazards.length,0);
 });
}
