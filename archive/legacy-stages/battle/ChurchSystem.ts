import { midgameRest } from "./MidgameEncounters";
import { crownEscape } from "./CrownSystem";
import type { SurvivalWorld } from './SurvivalWorld';
import type { Enemy, Hazard, Point } from './SurvivalTypes';
import { isElite } from './SurvivalConfig';
import { encounterBeat, encounterTime } from './EncounterPacing';
export const CHURCH_BELLS = [{x:-8,y:6},{x:8,y:6},{x:0,y:-8}];
export function bellContains(h: Hazard, p: Point) {
  const d=Math.hypot(p.x-h.x,p.y-h.y);
  return d>=h.width && d<h.radius;
}
export function bellHazard(w: SurvivalWorld,p: Point,source=0,pulse=false) {
  if(w.hazards.length>=2) return false;
  const delay=pulse?1.1:1.4;
  w.hazards.push({id:w.id(),source,kind:pulse?'bellPulse':'bellRing',x:p.x,y:p.y,
    angle:0,radius:pulse?2:4.2,width:pulse?0:2.2,created:w.time,due:w.time+delay,
    until:w.time+delay+.25,damage:source?(pulse?18:16):12,fired:false,next:0});
  const candidate=w.hazards.pop()!;
  if(!crownEscape(w,[candidate]))return false;
  w.hazards.push(candidate);
  return true;
}
export function churchCast(w: SurvivalWorld,e: Enemy,pulse=false) {
  const far=Math.hypot(w.player.x-e.x,w.player.y-e.y)>5;
  const p=far?w.player:e;
  if(!bellHazard(w,p,e.id,pulse)) return false;
  e.bossAction=pulse?'bellPulse':'bellRing';e.state='windup';e.timer=(pulse?1.1:1.4)+.25;
  const candidate=w.hazards.pop()!;
  if(!crownEscape(w,[candidate]))return false;
  w.hazards.push(candidate);
  return true;
}
export class ChurchSystem {
  private next=120;
  private bell=0;
  step(w: SurvivalWorld) {
    if(w.stageId!==4)return;
    if(midgameRest(w.stageId,w.time)){w.hazards=w.hazards.filter(h=>h.source!==0 || h.kind==="pool");return;}
    if(encounterTime(w.time)>=230){w.hazards=w.hazards.filter(h=>!(h.source===0 && h.kind==='bellRing'));return;}
    if(w.time<this.next||encounterBeat(w.time).rest||w.time<w.reinforcementRestUntil||w.enemies.some(e=>e.hp>0&&(isElite(e.kind)||e.kind==='boss')))return;
    // Start environment attacks only when no enemy warning is already active.
    if(w.hazards.length || !bellHazard(w,CHURCH_BELLS[this.bell]))return;
    this.bell=(this.bell+1)%3;this.next=w.time+36;
  }
}
