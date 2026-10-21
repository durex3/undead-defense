import fs from 'node:fs';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ALL_WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
const rows=[];
for(const grade of [1,4])for(const partner of [null,'orbit','hunt','return'])for(const shards of [false,true])for(const scene of ['single','moving','cluster','spread']){
 const w=new SurvivalWorld(31,'ranger',1);w.player={x:0,y:0};w.enemies=[];for(const k of ALL_WEAPONS)w.skills[k]=0;w.skills.blade=8;w.weaponGrades.blade=grade;w.mods.blade=[...(partner?[partner]:[]),...(shards?['shards']:[])];
 const count=scene==='cluster'?8:scene==='spread'?8:1;const targets=[];
 for(let i=0;i<count;i++){const a=i*Math.PI*2/count;const p=scene==='cluster'?{x:2.4+Math.cos(a)*.35,y:Math.sin(a)*.35}:scene==='spread'?{x:Math.cos(a)*3.5,y:Math.sin(a)*3.5}:{x:2.4,y:0};const e=w.addEnemy('minion',p.x,p.y);e.state='seek';e.hp=e.maxHp=1e8;targets.push(e);}
 let children=0,childDamage=0,mainDamage=0;const hit=w.armory.hit.bind(w.armory);w.armory.hit=(e,amount,p,skill,...args)=>{const before=e.hp;hit(e,amount,p,skill,...args);const dealt=before-e.hp;if(p.child)childDamage+=dealt;else mainDamage+=dealt;};
 const launch=w.armory.launch.bind(w.armory);w.armory.launch=(cast,child=false)=>{if(child&&cast.skill==='blade')children++;return launch(cast,child);};
 for(let i=0;i<1800;i++){w.time+=1/60;if(scene==='moving'){targets[0].x=2.4+Math.sin(w.time*1.2)*1.4;targets[0].y=Math.cos(w.time*1.2)*1.4;}w.armory.step(1/60);w.drain();}
 rows.push({grade,partner,shards,scene,dps:(w.damage.blade||0)/30,children,childDamage,mainDamage});
}
for(const row of rows)if(row.shards){const base=rows.find(r=>r.grade===row.grade&&r.partner===row.partner&&!r.shards&&r.scene===row.scene);row.gain=base.dps?row.dps/base.dps-1:null;}
fs.writeFileSync(process.argv[2]||'artifacts/blade-shards-0.38.3/after.json',JSON.stringify({scope:'30s fixed high-HP targets, no enemy AI/contact, native/epic blade8, with/without each legal partner; output diagnostic, not human win rate.',rows},null,2));console.log(JSON.stringify(rows.filter(r=>r.shards&&r.grade===1),null,2));
