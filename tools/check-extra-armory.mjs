import fs from 'node:fs';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {WEAPONS,NAMES,PASSIVES,PASSIVE_MAX} from '../temp/tests/battle/SurvivalConfig.mjs';
import {MODS,weaponStats} from '../temp/tests/battle/ArmoryConfig.mjs';
const report={generated:new Date().toISOString(),scope:'Desktop Node armory simulation only; static immortal enemies, no enemy AI, renderer, human win rate or phone thermals.',weapons:[],pressure:[]};
for(const skill of WEAPONS){const w=new SurvivalWorld(23,'ranger',14);w.character=null;w.skills[skill]=8;report.weapons.push({skill,name:NAMES[skill],levels:Array.from({length:8},(_,i)=>weaponStats(w,skill,i+1)),mods:MODS[skill]});}
for(const skills of [['blade','fire','water','frost','lightning','ghost'],['bone','mine','void','holy','frost','ghost']]){
 const w=new SurvivalWorld(23,'ranger',14);for(const s of WEAPONS)w.skills[s]=0;for(const s of skills){w.skills[s]=8;w.mods[s]=[MODS[s][1].id,MODS[s][2].id];}for(const p of PASSIVES)w.passives[p]=PASSIVE_MAX[p];
 for(let i=0;i<100;i++){const a=i*.618,e=w.addEnemy('siegebone',Math.cos(a)*(2+i%7),Math.sin(a)*(2+i%7));e.hp=e.maxHp=1e9;e.state='seek';}
 const times=[];let peak=0;for(let i=0;i<3600;i++){w.time+=1/60;const before=performance.now();w.armory.step(1/60);times.push(performance.now()-before);peak=Math.max(peak,w.armory.extra.attacks.filter(a=>a.active).length);}
 times.sort((a,b)=>a-b);report.pressure.push({skills,frames:3600,simulationSeconds:60,medianMs:times[1800],p95Ms:times[3420],peakExtraActive:peak,extraAllocated:w.armory.extra.attacks.length,shotsAllocated:w.armory.shots.length,fieldsAllocated:w.armory.fields.length,damage:w.damage});
}
fs.mkdirSync('artifacts/armory',{recursive:true});fs.writeFileSync('artifacts/armory/all-weapons-0.23.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.pressure,null,2));
