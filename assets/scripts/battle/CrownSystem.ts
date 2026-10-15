import { thunderMap } from "./ThunderMap";
import { sandMap } from "./SandMap";
import { siegeMap } from "./SiegeMap";
import {isFrontier,frontierMap} from "./FrontierMaps";
import {frontierContains} from "./FrontierGeometry";
import { midgameRest } from "./MidgameEncounters";
import {arsenalBlocked} from "./ArsenalMap";
import {observatoryBlocked} from "./ObservatoryMap";
import {starContains} from "./ObservatoryPath";
import {harborBlocked} from "./HarborMap";
import { FURNACE_STONES } from "./FurnaceEncounters";
import { GARDEN_STONES, ALTAR_STONES, CHURCH_STONES } from "./GardenMap";
import { segmentDistance } from "./SurvivalTypes";
import type { SurvivalWorld } from './SurvivalWorld';
import { Hazard, Point, angleDelta } from './SurvivalTypes';
import { isElite } from './SurvivalConfig';
import { encounterBeat, encounterTime } from './EncounterPacing';
import { ALTAR_ZONES, altarFlame } from './AltarSystem';
import { CHURCH_BELLS, bellHazard } from './ChurchSystem';
export const CROWN_STONES=[{x:-12,y:-12},{x:12,y:-12},{x:12,y:12},{x:-12,y:12}];
export function crownAreaHit(h: Hazard,p: Point) {
 if(h.kind==='frontierLane'||h.kind==='frontierImpact')return frontierContains(h,p);
 if(h.kind==='starTrace'||h.kind==='starLeap')return starContains(h,p);
 const dx=p.x-h.x,dy=p.y-h.y,d=Math.hypot(dx,dy);
 if(h.kind==='flameLine') return dx*Math.cos(h.angle)+dy*Math.sin(h.angle)>=0 && dx*Math.cos(h.angle)+dy*Math.sin(h.angle)<=h.radius && Math.abs(-dx*Math.sin(h.angle)+dy*Math.cos(h.angle))<h.width;
 if(h.kind==='bellRing')return d>=h.width && d<h.radius;
 if(h.kind==='sector')return d<h.radius && Math.abs(angleDelta(Math.atan2(dy,dx),h.angle))<h.width/2;
 return ['circle','flame','bellPulse','pool'].includes(h.kind) && d<h.radius;
}
function timedHit(h: Hazard,p: Point,time:number) {
 const age=Math.max(0,time-h.due), dx=Math.cos(h.angle),dy=Math.sin(h.angle);
 if(h.kind==='arrow'||h.kind==='line'){
  const speed=h.kind==='arrow'?(h.projectileSpeed??4.5):h.radius/(h.until-h.due);
  const a=Math.max(0,age-.05)*speed,b=Math.min(h.radius,age*speed);
  return segmentDistance(p,{x:h.x+dx*a,y:h.y+dy*a},{x:h.x+dx*b,y:h.y+dy*b})<(h.kind==='arrow'?(h.fixedDamage?h.width:.4):h.siegeCharge?h.width:h.damageLabel==='拖锚冲锋'?.95:.75);
 }
 if(h.kind==='burst')return Array.from({length:8},(_,i)=>h.angle+i*Math.PI/4).some(a=>Math.hypot(p.x-h.x-Math.cos(a)*age*3,p.y-h.y-Math.sin(a)*age*3)<.45);
 return crownAreaHit(h,p);
}
/** Conservative straight-path sampling at base speed; no prediction of moving enemies. */
export function crownEscape(w: SurvivalWorld, candidates: Hazard[], avoidCrowd = false) {
 const blockers=avoidCrowd?w.enemies.filter(e=>e.hp>0&&e.kind!=="boss"&&e.state!=="arriving"&&Math.hypot(e.x-w.player.x,e.y-w.player.y)<8):[];
 const hazards=[...w.hazards,...candidates];
 const horizon=Math.max(.1, ...candidates.map(h=>h.until-w.time));
 const stones=w.stageId===1||w.stageId===8||w.stageId===9||w.stageId>=10?[]:w.stageId===2?GARDEN_STONES:w.stageId===3?ALTAR_STONES:w.stageId===4?CHURCH_STONES:w.stageId===6?FURNACE_STONES:CROWN_STONES;
 const speed=Math.min(4.2,w.speed);
 for(let direction=-1;direction<32;direction++){
  const angle=direction*Math.PI/16;
  let safe=true;
  for(let t=0;t<=horizon;t+=.05){
   const p={x:w.player.x+(direction<0?0:Math.cos(angle)*speed*t),y:w.player.y+(direction<0?0:Math.sin(angle)*speed*t)};
   if(Math.abs(p.x)>22 || Math.abs(p.y)>26 || stones.some(s=>Math.hypot(s.x-p.x,s.y-p.y)<1.4) || (w.stageId===8&&harborBlocked(p,.3)) || (w.stageId===9&&arsenalBlocked(p,.3)) || (w.stageId===10&&observatoryBlocked(p,.3)) || (w.stageId===14&&siegeMap.blocked(p,.3)) || (w.stageId===15&&sandMap.blocked(p,.3)) || (w.stageId===16&&thunderMap.blocked(p,.3)) || (isFrontier(w.stageId)&&frontierMap(w.stageId).blocked(p,.3))){safe=false;break;}
   if(t>.2&&t<1.5&&Math.round(t/.05)%4===0&&blockers.some(e=>Math.hypot(e.x-p.x,e.y-p.y)<(w.stageId>=14?1:.6))){safe=false;break;}
   if(hazards.some(h=>w.time+t>=h.due && w.time+t<h.until && timedHit(h,p,w.time+t))){safe=false;break;}
  }
  if(safe)return true;
 }
 return false;
}
const EVENTS=[{t:60,kind:'fire',index:0},{t:80,kind:'fire',index:1},{t:132,kind:'bell',index:0},{t:205,kind:'fire',index:2},{t:217,kind:'bell',index:2}];
export class CrownDirector {
 private cursor=0;
 step(w: SurvivalWorld){
  if(w.stageId!==5)return;
    if(midgameRest(w.stageId,w.time)){w.hazards=w.hazards.filter(h=>h.source!==0 || h.kind==="pool");return;}
  if((encounterTime(w.time)>=82&&encounterTime(w.time)<90)||(encounterTime(w.time)>=165&&encounterTime(w.time)<175))w.hazards=w.hazards.filter(h=>h.source!==0);
  if(encounterTime(w.time)>=230){w.hazards=w.hazards.filter(h=>h.source!==0);return;}
  while(this.cursor<EVENTS.length && w.time>=EVENTS[this.cursor].t*2){
   const event=EVENTS[this.cursor++];
   // Never replay an event missed during a quiet period or an elite encounter.
   if(w.time-event.t*2>.5 || encounterBeat(w.time).rest || w.time<w.reinforcementRestUntil || w.enemies.some(e=>e.hp>0 && (isElite(e.kind)||e.kind==='boss')) || w.hazards.length)continue;
   if(event.kind==='fire')altarFlame(w,event.index);else bellHazard(w,CHURCH_BELLS[event.index]);
  }
 }
}
