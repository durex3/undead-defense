// Fixed-target diagnostic, not a player win-rate or a replacement for moving playtests.
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {EVOLUTIONS,WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
const skills=process.argv[2]?.split(',') || ['blade','fire','scythe','axe','ice','lightning','chain','pillar'];
for(const skill of skills)for(const scene of ['front','rear','crowd','boss']) {
 const variants=[{rank:9,form:null},...EVOLUTIONS[skill].map(e=>({rank:10,form:e.id}))];
 for(const {rank,form} of variants){
  const w=new SurvivalWorld(19,'ranger',1,6);
  for(const s of WEAPONS)w.skills[s]=0;
  w.skills[skill]=rank;if(form)w.evolutions[skill]=form;
  w.lastMove={x:1,y:0};
  const points=scene==='crowd'?Array.from({length:12},(_,i)=>({x:Math.cos(i*Math.PI/6)*2.5,y:Math.sin(i*Math.PI/6)*2.5})): [{x:scene==='rear'?-5:scene==='boss'?5:5,y:0}];
  for(const p of points){const e=w.addEnemy(scene==='boss'?'boss':'minion',p.x,p.y);e.state='seek';e.hp=e.maxHp=1e8;}
  for(let i=0;i<60*30;i++){w.time+=1/60;w.stepWeapons(1/60);w.drain();}
  console.log(JSON.stringify({skill,scene,rank,form,damage:Math.round(w.damage[skill]||0),targetsHit:w.enemies.filter(e=>e.hp<e.maxHp).length,casts:w.castCounts[skill]||0}));
 }
}
