import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {FURNACE_STONES,FURNACE_WINDOWS,furnaceRoute,furnaceEncounter,furnaceRest,furnaceForecast} from '../temp/tests/battle/FurnaceEncounters.mjs';
import {resolveGarden,stepGarden} from '../temp/tests/battle/GardenMap.mjs';
import {crownEscape} from '../temp/tests/battle/CrownSystem.mjs';
import {LateStageDirector,lateCast} from '../temp/tests/battle/LateStageSystem.mjs';
function wave(seed=1,index=0){
 const w=new SurvivalWorld(seed,'ranger',6);w.time=FURNACE_WINDOWS[index].start;w.director.elites=[true,true];w.director.nextGroup=1e9;w.director.nextSpecial=0;w.camera={x:0,y:0};return w;
}
test('three repeatable encounter orders each cover all roles and do not consume card RNG',()=>{
 const routes=new Set();
 for(let seed=1;seed<=40;seed++){
  const w=new SurvivalWorld(seed,'ranger',6),other=new SurvivalWorld(seed,'ranger',7);
  assert.equal(w.seed,other.seed);assert.equal(w.random(),other.random());assert.equal(w.furnaceRoute,furnaceRoute(seed));
  routes.add(w.furnaceRoute);assert.equal(new Set(FURNACE_WINDOWS.map(x=>furnaceEncounter(x.start,w.furnaceRoute).id)).size,3);
  assert.equal(furnaceEncounter(120,w.furnaceRoute),null);assert.equal(furnaceEncounter(480,w.furnaceRoute),null);
 }
 assert.equal(routes.size,3);
});
test('each authored encounter actually spawns its roles, warned, within the existing threat budget',()=>{
 for(let seed=1;seed<=12;seed++)for(let index=0;index<3;index++){
  const w=wave(seed,index),act=furnaceEncounter(w.time,w.furnaceRoute);w.director.step(w,0);
  assert(act.enemies.every(kind=>w.enemies.some(e=>e.kind===kind)),act.id);
  assert(w.enemies.every(e=>e.state==='arriving'&&e.timer===1.2));
  assert(w.enemies.every(e=>Math.hypot(e.x-w.player.x,e.y-w.player.y)>3));
  assert(w.enemies.every(e=>FURNACE_STONES.every(s=>Math.hypot(s.x-e.x,s.y-e.y)>=1.5)));
  if(act.id==='formation'||act.id==='summoning'){
   const shield=w.enemies.find(e=>e.kind==='shield'),rear=w.enemies.find(e=>e.kind==='archer'||e.kind==='summoner');
   assert(Math.hypot(rear.x,rear.y)>Math.hypot(shield.x,shield.y));
  }
 }
});
test('encounters preserve elite, pause, pre-boss quiet and population limits',()=>{
 const w=wave();const elite=w.addEnemy('executioner',0,10);w.director.step(w,0);assert.equal(w.enemies.length,1);
 elite.hp=0;w.enemies=[];w.pause('qa',true);w.director.step(w,0);assert.equal(w.enemies.length,0);w.pause('qa',false);
 w.time=470;w.director.step(w,0);assert.equal(w.enemies.length,0);
 w.time=480;w.director.step(w,0);assert.equal(w.enemies.filter(e=>e.kind==='boss').length,1);
});
test('mini-rests halt fresh waves and remove environment hazards without replaying skipped events',()=>{
 const w=wave(),director=new LateStageDirector();w.time=250;assert(furnaceRest(w.time));
 lateCast(w);director.step(w);assert.equal(w.hazards.length,0);w.director.nextGroup=0;w.director.step(w,1);assert.equal(w.enemies.length,0);
 assert.match(furnaceForecast(250,w.furnaceRoute),/商店/);assert.match(furnaceForecast(210,w.furnaceRoute),/下一段/);
 w.time=410;director.step(w);assert.equal(w.hazards.length,0);w.time=412;director.step(w);assert.equal(w.hazards.length,0);
});
test('workshop pillars collide, leave a connected center and exits, and match hazard escape checks',()=>{
 const w=wave();assert.equal(FURNACE_STONES.length,12);
 for(const x of [-8,0,8]){
  for(let y=-20;y<=20;y+=.25){const p={x,y};resolveGarden(p,.3,FURNACE_STONES);assert.deepEqual(p,{x,y});}
  w.player={x,y:0};assert(lateCast(w,0,1));assert(crownEscape(w,[]));w.hazards=[];
 }
 const charger=w.addEnemy('boar',6,3);charger.state='charge';stepGarden(w,0);assert.equal(charger.state,'recover');assert.equal(charger.timer,1);
 w.player={x:6,y:3};stepGarden(w,0);assert(Math.hypot(w.player.x-6,w.player.y-3)>=1.35-1e-9);
 const blocked={id:99,source:0,kind:'circle',x:6,y:3,radius:2,width:0,angle:0,created:w.time,due:w.time+1.8,until:w.time+2.1,damage:10,fired:false,next:0};
 w.player={x:6,y:3};assert.equal(crownEscape(w,[blocked]),false);
});
