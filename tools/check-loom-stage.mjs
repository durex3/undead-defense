import fs from 'node:fs';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ENEMIES,isElite,ALL_WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
import {loomState} from '../temp/tests/battle/LoomGeometry.mjs';
const rows=[];
for(const mode of ['stationary','moving']){
 const w=new SurvivalWorld(41,'ranger',11);for(const s of ALL_WEAPONS)w.skills[s]=0;w.level=64;
 let maxSlots=0,maxThreat=0,maxEntities=0;const seen=new Set(),phases=new Set(),elites=[];let old=0;
 for(let i=0;i<660*20;i++){
  w.invulnerable=100;w.state='battle';w.hp=w.maxHp=10000;
  if(mode==='moving'){const a=w.time*.12;w.setMove(Math.cos(a),Math.sin(a));}else w.setMove(0,0);
  w.camera={x:Math.max(-10.6,Math.min(10.6,w.player.x)),y:Math.max(-1124/48,Math.min(1124/48,w.player.y))};
  // Clear only elites after an explicit 30-second observation window, allowing all four arrivals.
  for(const e of w.enemies)if(e.hp>0&&e.kind!=='boss'&&w.time-e.born>(isElite(e.kind)?30:e.kind==='ragbound'?4.5:18))w.hit(e,1e9,'blade');
  w.step(.05);w.drain();
  const actors=w.enemies.filter(e=>e.hp>0),live=w.hazards.filter(h=>h.until>w.time&&!h.loom?.cancelled);
  maxSlots=Math.max(maxSlots,live.length);maxEntities=Math.max(maxEntities,actors.length);maxThreat=Math.max(maxThreat,actors.reduce((n,e)=>n+ENEMIES[e.kind].threat,0));
  for(const e of actors){seen.add(e.kind);if(isElite(e.kind)&&!elites.some(v=>v.id===e.id))elites.push({id:e.id,kind:e.kind,time:+e.born.toFixed(2),hp:e.maxHp});}
  const boss=actors.find(e=>e.kind==='boss');
  if(boss){const elapsed=w.time-boss.born;boss.hp=boss.maxHp*(elapsed<80?1:elapsed<160?.65:.3);phases.add(boss.bossPhase);}
  if(maxSlots>2||maxThreat>6||maxEntities>100)throw Error('Loom global budget exceeded');
 }
 if(phases.size!==3||elites.length!==4||!Object.values(w.loom.stats.patterns).every(n=>n>0))throw Error(`Incomplete Loom scheduler coverage: ${mode}`);
 rows.push({mode,maxSlots,maxThreat,maxEntities,seen:Array.from(seen),phases:Array.from(phases),elites,stats:w.loom.stats,bossState:w.enemies.find(e=>e.kind==='boss')?.state});
}
fs.mkdirSync('artifacts/loom-stage',{recursive:true});fs.writeFileSync('artifacts/loom-stage/director.json',JSON.stringify({scope:'Invulnerable 660s structural scheduler diagnostic. Script clears fodder after 4.5s, specials after 18s, elites after 30s, and sets Boss phase health thresholds; no claim of normal survival or legitimate wins.',rows},null,2)+'\n');console.log(JSON.stringify(rows,null,2));
