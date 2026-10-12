import { crownEscape } from "./CrownSystem";
import type { SurvivalWorld } from './SurvivalWorld';
import type { Enemy } from './SurvivalTypes';
import { isElite } from './SurvivalConfig';
import { encounterBeat } from './EncounterPacing';
export const ALTAR_ZONES = [{x:-7,y:-7},{x:7,y:-7},{x:7,y:7},{x:-7,y:7}];
export const ALTAR_RADIUS = 4;
export function altarFlame(w: SurvivalWorld, index: number, source = 0) {
  if (w.hazards.length >= 2 || w.hazards.some(h=>h.kind==='flame')) return false;
  const p = source ? { ...w.player } : ALTAR_ZONES[index % 4];
  w.hazards.push({id:w.id(),source,kind:'flame',...p,angle:0,radius:source?2.6:ALTAR_RADIUS,width:0,
    created:w.time,due:w.time+1.5,until:w.time+(source?4:5.5),damage:10,fired:false,next:w.time+1.5});
  const candidate=w.hazards.pop()!;
  if(!crownEscape(w,[candidate]))return false;
  w.hazards.push(candidate);
  return true;
}
export class AltarSystem {
  private next = 60;
  private zone = 0;
  step(w: SurvivalWorld) {
    if(w.stageId!==3 || w.time>=230 || w.time<this.next) return;
    if(encounterBeat(w.time).rest || w.enemies.some(e=>e.hp>0 && (isElite(e.kind)||e.kind==='boss'))) return;
    if(altarFlame(w,this.zone)) {this.zone=(this.zone+1)%4;this.next=w.time+20;}
  }
}
export function altarLance(w: SurvivalWorld, e: Enemy) {
  if(w.hazards.length>=2)return false;
  const previousAngle=e.lockedAngle;
  e.lockedAngle=Math.atan2(w.player.y-e.y,w.player.x-e.x);
  w.hazards.push({id:w.id(),source:e.id,kind:'flameLine',x:e.x,y:e.y,angle:e.lockedAngle,
    radius:12,width:.65,created:w.time,due:w.time+1.2,until:w.time+1.5,damage:20,fired:false,next:0});
  const candidate=w.hazards.pop()!;
  if(!crownEscape(w,[candidate])){e.lockedAngle=previousAngle;return false;}
  w.hazards.push(candidate);
  e.bossAction='lance'; e.state='windup'; e.timer=1.5;
  return true;
}
