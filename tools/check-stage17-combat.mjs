import fs from 'node:fs';
import {withVerificationLock} from './verification-lock.mjs';
import{SurvivalWorld}from'../temp/tests/battle/SurvivalWorld.mjs';
await withVerificationLock(async()=>{
 const rows=[];
 for(const life of [1,2])for(const scene of ['center','east','north','corner','circle','weave','zigzag'])for(const dt of [1/30,.2]){
  const w=new SurvivalWorld(31,'ranger',17);w.time=400;w.state='battle';w.hp=w.maxHp=1e8;w.player={x:scene==='east'||scene==='corner'?20:0,y:scene==='north'||scene==='corner'?24:0};w.viewport={x:7.5*844/390,y:7.5};w.director.step=()=>{};w.armory.step=()=>{};
  const e=w.addEnemy('boss',Math.max(-21.3,w.player.x-4.8),w.player.y);w.stageStrategy.map.resolve(e,.7);e.state='seek';e.attack=0;if(life===2){e.trace.life=2;e.bossPhase=2;e.hp=e.maxHp=e.trace.total*.65;}
  let waypoint=0;const corners=[{x:-3,y:-2},{x:1,y:-2},{x:1,y:2},{x:-3,y:2}];let maxSlots=0,walls=0,furthest=0,old={x:e.x,y:e.y};
  for(let t=0;t<120;t+=dt){if(scene==='circle'||scene==='weave'||scene==='zigzag'){if(scene==='zigzag'&&Math.hypot(w.player.x-corners[waypoint].x,w.player.y-corners[waypoint].y)<.15)waypoint=(waypoint+1)%4;const target=scene==='zigzag'?corners[waypoint]:scene==='circle'?{x:Math.cos(t*.5)*3,y:Math.sin(t*.5)*3}:{x:Math.sin(t*.5)*4,y:Math.sin(t*.27)*2};const d=Math.hypot(target.x-w.player.x,target.y-w.player.y);w.move={x:d?(target.x-w.player.x)/d*Math.min(1,d/dt/w.speed):0,y:d?(target.y-w.player.y)/d*Math.min(1,d/dt/w.speed):0};}w.camera={x:Math.max(-512/48,Math.min(512/48,w.player.x)),y:Math.max(-1124/48,Math.min(1124/48,w.player.y))};w.step(dt);maxSlots=Math.max(maxSlots,w.hazards.filter(h=>h.until>w.time).length);if(w.stageStrategy.map.blocked(e,.699))walls++;furthest=Math.max(furthest,Math.hypot(e.x-old.x,e.y-old.y));old={x:e.x,y:e.y};w.drain();}
  rows.push({life,scene,dt,damage:1e8-w.hp,patterns:{...w.trace.stats.patterns},maxSlots,wallViolations:walls,maxBodyStep:furthest,state:e.state,rejected:w.trace.stats.rejected,genuineHistory:w.trace.history.samples.length,genuineCasts:w.trace.stats.genuineCasts,historyCasts:w.trace.stats.historyCasts});
 }
 fs.mkdirSync('artifacts/stage17-implementation',{recursive:true});fs.writeFileSync('artifacts/stage17-implementation/combat.json',JSON.stringify({scope:'Single real boss/no weapons or director,120 seconds, stationary and moving,30/5fps; not a victory or win-rate test',rows},null,2)+'\n');
 const issues=rows.filter(r=>(r.life===2&&r.scene==='zigzag'&&r.genuineCasts===0)||r.maxSlots>2||r.wallViolations||r.maxBodyStep>5.2*r.dt+1e-5||(['center','east','north','corner'].includes(r.scene)&&r.damage===0));console.log(JSON.stringify({cases:rows.length,issues},null,2));if(issues.length)throw Error('Stage17 combat diagnostic failed');
});
