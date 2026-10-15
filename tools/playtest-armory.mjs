import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
import {modReason} from '../temp/tests/battle/ArmoryConfig.mjs';
const builds={precision:{blade:['hunt','return'],fire:['heavy','embers'],water:['wave','pulse']},coverage:{blade:['orbit','shards'],fire:['salvo','flame'],water:['spring','pulse']},mobility:{blade:['return','shards'],fire:['salvo','embers'],water:['wave','recall']}};
const result=[],start=performance.now();
for(const stage of [14,15])for(const [name,mods] of Object.entries(builds))for(const moving of [false,true])for(const seed of [19,73,217]){
 const w=new SurvivalWorld(seed,'ranger',stage);w.level=64;w.time=480;for(const s of WEAPONS){w.skills[s]=8;w.mods[s]=[...mods[s]];}for(const p of ['power','hourglass','area','boots'])w.passives[p]=4;
 w.director.step(w,0);let frames=0;const samples=[];
 for(;frames<60*180&&w.state==='battle';frames++){
  if(moving){const b=w.enemies.find(e=>e.kind==='boss');const a=w.time*.8;const t=b?{x:b.x+Math.cos(a)*4,y:b.y+Math.sin(a)*4}:{x:Math.cos(a)*5,y:Math.sin(a)*5};let dx=t.x-w.player.x,dy=t.y-w.player.y;
   for(const h of w.hazards){if(h.due-w.time<.6&&h.until>w.time){const d=Math.hypot(w.player.x-h.x,w.player.y-h.y);if(d<h.radius+1){dx+=(w.player.x-h.x)/(d||1)*8;dy+=(w.player.y-h.y)/(d||1)*8;}}}w.setMove(dx,dy);
  }w.step(1/60);w.drain();if(frames%60===0)samples.push(w.enemies.length);
 }
 const boss=w.enemies.find(e=>e.kind==='boss');result.push({stage,name,moving,seed,state:w.state,seconds:Math.round(w.time-480),hp:Math.round(w.hp),bossRemaining:boss?Math.round(boss.hp/boss.maxHp*100):0,kills:w.kills,peakEnemies:Math.max(...samples,0),shots:w.armory.shots.length,fields:w.armory.fields.length});
}
const output={scope:'满级三武器、四被动；原始Boss血量、原始敌人行为；移动机器人仅作回归观测，不代表真人胜率',elapsedMs:Math.round(performance.now()-start),result};
fs.mkdirSync('artifacts/armory',{recursive:true});fs.writeFileSync('artifacts/armory/boss-simulation.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({runs:result.length,stationaryWins:result.filter(r=>!r.moving&&r.state==='won').length,movingWins:result.filter(r=>r.moving&&r.state==='won').length,timeouts:result.filter(r=>r.state==='battle').length,elapsedMs:output.elapsedMs}));
