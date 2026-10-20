/** Scripted equipment / huge HP for encounter capacity only; not random growth or human difficulty. */
import fs from 'node:fs';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ALL_WEAPONS,isElite} from '../temp/tests/battle/SurvivalConfig.mjs';
const builds={blade:['hunt','return'],fire:['heavy','embers'],lightning:['relay','echo'],holy:['execution','brand']};
const samples=[];
for(let stage=1;stage<=8;stage++)for(const seed of [19,73]){
 const w=new SurvivalWorld(seed,'ranger',stage);w.hp=w.maxHp=1e9;w.level=64;
 for(const s of ALL_WEAPONS){w.skills[s]=builds[s]?1:0;w.mods[s]=[];}
 for(const p of ['power','hourglass','area'])w.passives[p]=4;w.passives.amount=2;
 const seen=new Map();let actors=0,hazards=0;
 for(let i=0;i<400*30&&w.time<362&&w.state!=='won'&&w.state!=='lost';i++){
  if(w.state==='tactical')w.chooseTacticalBlessing(w.tacticalChoices[0].id);
  const level=w.time<90?1:w.time<180?4:w.time<270?6:8;
  for(const s of Object.keys(builds)){w.skills[s]=level;w.mods[s]=level<4?[]:level<8?[builds[s][0]]:builds[s];}
  const elite=w.enemies.find(e=>e.hp>0&&isElite(e.kind));
  const target=elite??w.gems[0]??{x:Math.cos(w.time*.04)*5,y:Math.sin(w.time*.04)*5};
  const a=w.stageStrategy.map.heading({...w.player},target);w.setMove(Math.cos(a),Math.sin(a));
  w.camera={x:Math.max(-10.6,Math.min(10.6,w.player.x)),y:Math.max(-19.5,Math.min(19.5,w.player.y))};
  w.step(1/30);w.drain();
  for(const e of w.enemies)if(isElite(e.kind)&&!seen.has(e.id))seen.set(e.id,{kind:e.kind,at:+w.time.toFixed(2),health:e.maxHp});
  actors=Math.max(actors,w.enemies.length);hazards=Math.max(hazards,w.hazards.filter(h=>h.until>w.time).length);
 }
 samples.push({stage,seed,time:+w.time.toFixed(1),elites:[...seen.values()],eliteKills:w.eliteKills,actors,hazards,bossPresent:w.enemies.some(e=>e.kind==='boss'),damageTaken:1e9-w.hp});
 if(actors>100||hazards>2)throw Error('capacity violation');
}
const report={scope:'16 huge-HP scripted four-weapon level 1/4/6/8 encounter diagnostics; not normal account progression or human win rate. Captures actual kills and delays, without deleting living enemies.',samples};
fs.mkdirSync('artifacts/elite-rounds',{recursive:true});fs.writeFileSync('artifacts/elite-rounds/simulation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(samples.map(s=>({stage:s.stage,seed:s.seed,rounds:s.elites.length,kills:s.eliteKills,boss:s.bossPresent})),null,2));
