// Paired, reproducible full-build boss tests. No save state or hidden difficulty changes.
import fs from 'node:fs';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {EVOLUTIONS,WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
import {sandMap} from '../temp/tests/battle/SandMap.mjs';
import {siegeMap} from '../temp/tests/battle/SiegeMap.mjs';
const builds=[
 ['blade','lightning','fire','ghost','ice','scythe'],
 ['water','poison','bone','mine','meteor','soul'],
 ['chain','pillar','totem','soul','void','bat'],
];
const rows=[];
const stage=Number(process.argv[4]||14),map=stage===15?sandMap:siegeMap;
const scenario=process.argv[3]||'boss';
const selected=process.argv[2]===undefined?null:Number(process.argv[2]);
for(let bi=0;bi<6;bi++){
 if(selected!==null&&selected!==bi)continue;
 for(const start of [{x:0,y:0},{x:0,y:8},{x:18,y:0}])for(const seed of [1,19,72])for(const mode of ['stationary','moving']){
  const w=new SurvivalWorld(seed,'ranger',stage,6);w.time=scenario==='midgame'?240:480;w.level=64;w.state='battle';w.player={...start};w.camera={...start};
  for(const k of WEAPONS)w.skills[k]=0;
  for(const k of builds[bi%3]){w.skills[k]=10;w.evolutions[k]=EVOLUTIONS[k][bi>=3?EVOLUTIONS[k].length-1:0].id;}
  let boss;
  if(scenario==='boss'){
   w.director.boss=true;w.director.elites=[true,true];
   const origin={x:start.x+(start.x>10?-6:6),y:start.y};map.resolve(origin,.7);boss=w.addEnemy('boss',origin.x,origin.y);
  }
  let maxHazards=0,maxEnemies=0;const milestones=[];let next=w.time+10;
  for(let i=0;i<60*240&&!['lost','won'].includes(w.state);i++){
   if(w.state==='upgrade')w.choose(w.cards.includes('repair')?'repair':w.cards[0]);
   if(w.state==='evolution')w.evolve(EVOLUTIONS[w.pendingEvolution][bi>=3?1:0].id);
   if(mode==='moving'){
    const b=w.enemies.find(e=>e.kind==='boss'&&e.hp>0)||w.player;
    const age=w.time-480,a=age*.48,target={x:Math.max(-20,Math.min(20,b.x+Math.cos(a)*4.1)),y:Math.max(-24,Math.min(24,b.y+Math.sin(a)*4.1))};
    let angle=map.heading({...w.player},target),dx=Math.cos(angle),dy=Math.sin(angle);
    for(const h of w.hazards){
     const d=Math.hypot(w.player.x-h.x,w.player.y-h.y);
     if(['circle','frontierImpact'].includes(h.kind)&&d<h.radius+.8){const u=Math.atan2(w.player.y-h.y,w.player.x-h.x);dx+=Math.cos(u)*3;dy+=Math.sin(u)*3;}
     if(h.kind==='bellRing'&&d>h.width-.5&&d<h.radius+.5){dx+=(h.x-w.player.x)/Math.max(.1,d)*3;dy+=(h.y-w.player.y)/Math.max(.1,d)*3;}
     if(h.kind==='sector'&&d<h.radius+.7){const a=Math.atan2(w.player.y-h.y,w.player.x-h.x),delta=Math.atan2(Math.sin(a-h.angle),Math.cos(a-h.angle));if(Math.abs(delta)<h.width/2+.2){dx+=-Math.sin(h.angle)*(delta>=0?1:-1)*3;dy+=Math.cos(h.angle)*(delta>=0?1:-1)*3;}}
     if(h.kind==='line'||h.kind==='arrow'||h.kind==='frontierLane'){
      const ux=Math.cos(h.angle),uy=Math.sin(h.angle),px=w.player.x-h.x,py=w.player.y-h.y,along=px*ux+py*uy,side=px*(-uy)+py*ux;
      if(along>-.5&&along<h.radius+.5&&Math.abs(side)<h.width+.8){const sign=side>=0?1:-1;dx+=-uy*sign*3;dy+=ux*sign*3;}
     }
    }
    w.setMove(dx,dy);
   }
   w.camera={x:Math.max(-512/48,Math.min(512/48,w.player.x)),y:Math.max(-984/48,Math.min(984/48,w.player.y))};
   w.useUltimate();w.step(1/60);w.drain();maxHazards=Math.max(maxHazards,w.hazards.length);maxEnemies=Math.max(maxEnemies,w.enemies.length);
   if(w.time>=next){milestones.push({time:Math.round(w.time),hp:w.hp,boss:boss?Math.ceil(boss.hp/boss.maxHp*100):null});next+=10;}
  }
  rows.push({stage,scenario,build:bi,start,seed,mode,state:w.state,time:Math.round(w.time),hp:w.hp,skills:w.skills,forms:w.evolutions,bossRemaining:boss?Math.max(0,Math.ceil(boss.hp/boss.maxHp*100)):null,losses:w.losses,stats:stage===15?w.sand.stats:w.siege.stats,maxHazards,maxEnemies,milestones});
 }
}
const path=`artifacts/${stage===15?"sand":"legion"}-${scenario}-${selected??'all'}.json`;fs.writeFileSync(path,JSON.stringify(rows,null,2));
console.log(JSON.stringify({path,runs:rows.length,won:rows.filter(r=>r.state==='won').length,lost:rows.filter(r=>r.state==='lost').length,timeout:rows.filter(r=>!['won','lost'].includes(r.state)).length}));
