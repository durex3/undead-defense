import test from "node:test";
import assert from "node:assert/strict";
import {SurvivalWorld} from "../temp/tests/battle/SurvivalWorld.mjs";
import {ENEMIES} from "../temp/tests/battle/SurvivalConfig.mjs";
import {MIDGAME_WINDOWS,midgameEncounter,midgameRest,midgameForecast} from "../temp/tests/battle/MidgameEncounters.mjs";
import {battleHud} from "../temp/tests/presentation/BattleHud.mjs";
import {AltarSystem} from "../temp/tests/battle/AltarSystem.mjs";
import {ChurchSystem} from "../temp/tests/battle/ChurchSystem.mjs";
import {CrownDirector} from "../temp/tests/battle/CrownSystem.mjs";
import {LateStageDirector} from "../temp/tests/battle/LateStageSystem.mjs";

function wave(stage,time) {
 const w=new SurvivalWorld(19,"ranger",stage);w.time=time;
 w.director.elites=[true,true];w.director.nextGroup=Infinity;w.director.nextSpecial=0;
 return w;
}
test("authored packs cover stage-specific roles and leave opening, furnace and new stages intact",()=>{
 for(const stage of [3,4,5,7]) {
  assert.equal(midgameEncounter(stage,60),null);
  assert.equal(midgameEncounter(stage,470),null);
  const packs=MIDGAME_WINDOWS.map(x=>midgameEncounter(stage,x.start));
  assert.equal(new Set(packs.map(p=>p.name)).size,3);
  for(const pack of packs)assert.equal(pack.enemies.length,2);
 }
 for(const stage of [1,2,6,8,9,10])assert.equal(midgameEncounter(stage,220),null);
 assert.notDeepEqual(midgameEncounter(3,280).enemies,midgameEncounter(7,280).enemies);
});
test("all authored waves spawn their roles with arrival grace and stay within threat and type caps",()=>{
 for(const stage of [3,4,5,7])for(const window of MIDGAME_WINDOWS) {
  const w=wave(stage,window.start+.1),pack=midgameEncounter(stage,w.time);
  w.director.step(w,0);
  assert(pack.enemies.every(kind=>w.enemies.some(e=>e.kind===kind)),`${stage}/${w.time}`);
  assert(w.enemies.every(e=>e.state==="arriving"&&e.timer===1.2));
  assert(w.enemies.every(e=>Math.hypot(e.x-w.player.x,e.y-w.player.y)>3));
  for(const kind of pack.enemies)assert(w.enemies.filter(e=>e.kind===kind).length<=ENEMIES[kind].cap);
  const t=w.time/2,budget=(t<55?2:t<110?4:t<175?6:8)+(t>=110?Math.floor((stage-1)/2):0);
  assert(w.enemies.reduce((n,e)=>n+ENEMIES[e.kind].threat,0)<=budget);
  w.director.nextSpecial=0;w.director.step(w,0);
  assert(w.enemies.reduce((n,e)=>n+ENEMIES[e.kind].threat,0)<=budget);
 }
});
test("guard formations place their rear role behind the shield and flanks approach from distinct directions",()=>{
 for(const stage of [3,5]){
  const w=wave(stage,150);w.director.step(w,0);
  const shield=w.enemies.find(e=>e.kind==="shield"),rear=w.enemies.find(e=>e.kind==="summoner"||e.kind==="archer");
  assert(Math.hypot(rear.x,rear.y)>Math.hypot(shield.x,shield.y));
 }
 const w=wave(7,280);w.director.step(w,0);
 const [a,b]=w.enemies;
 const angle=Math.abs(Math.atan2(Math.sin(Math.atan2(a.y,a.x)-Math.atan2(b.y,b.x)),Math.cos(Math.atan2(a.y,a.x)-Math.atan2(b.y,b.x))));
 assert(angle>1);
});
test("collection windows halt new spawns, clear only environmental hazards and do not replay missed stage events",()=>{
 for(const [stage,System] of [[3,AltarSystem],[4,ChurchSystem],[5,CrownDirector],[7,LateStageDirector]]){
  const w=wave(stage,250),system=new System();assert(midgameRest(stage,w.time));
  const hazard={id:1,source:0,kind:"circle",x:0,y:0,angle:0,radius:1,width:0,created:249,due:251,until:252,damage:10,fired:false,next:0};
  w.hazards=[hazard,{...hazard,id:2,source:99},{...hazard,id:3,kind:"pool"}];
  w.director.step(w,1);system.step(w);
  assert.equal(w.enemies.length,0);assert.deepEqual(w.hazards.map(h=>h.id),[2,3]);
  w.hazards=[];w.time=260;system.step(w);
  if(stage===5||stage===7)assert.equal(w.hazards.length,0);
 }
});
test("elite encounters, pause and pre-boss quiet override pressure",()=>{
 for(const stage of [3,4,5,6,7]){
  const w=wave(stage,220);w.addEnemy("executioner",8,0);w.director.step(w,0);assert.equal(w.enemies.length,1);
  w.enemies=[];w.pause("test",true);w.director.step(w,1);assert.equal(w.enemies.length,0);
  w.pause("test",false);w.time=470;w.director.step(w,1);assert.equal(w.enemies.length,0);
 }
});
test("HUD exposes encounter decisions and respite without consuming randomness",()=>{
 const w=wave(3,220),seed=w.seed;
 assert.match(battleHud(w,true,[]).hint,/烈阵追击/);
 w.time=250;assert.match(battleHud(w,true,[]).hint,/暂歇/);
 assert.equal(w.seed,seed);
 assert.equal(midgameForecast(8,250),null);
});
