import { furnaceRest } from "./FurnaceEncounters";
import type { SurvivalWorld } from './SurvivalWorld';
import { Enemy, Hazard, distance } from './SurvivalTypes';
import { crownEscape } from './CrownSystem';
import { encounterBeat, encounterTime } from './EncounterPacing';
import { isElite } from './SurvivalConfig';

/** Armour is a temporary attack-state property, never an immunity to a weapon. */
export function lateStageDamage(w: SurvivalWorld, e: Enemy, direct: boolean) {
  return w.stageId === 6 && e.kind === 'boss' && e.state === 'windup'
    && e.bossAction !== 'transition' && direct ? .8 : 1;
}
export function lateCast(w: SurvivalWorld, source = 0, index = 0) {
  if (w.stageId < 6 || w.hazards.length >= 2) return false;
  const furnace = w.stageId === 6;
  const boss = w.enemies.find(e => e.id === source);
  const angle = Math.atan2(w.player.y - (boss?.y || 0), w.player.x - (boss?.x || 0));
  // Positions lock on cast. A strip is finite and leaves room to go around its ends.
  const strip = furnace && index % 2 === 0;
  const ring = !furnace && index % 2 === 0;
  const delay = source ? 1.4 : 1.8;
  const h: Hazard = {
    id: w.id(), source, kind: strip ? 'flameLine' : furnace ? 'flame' : ring ? 'bellRing' : 'bellPulse',
    x: strip ? w.player.x - Math.cos(angle) * 4 : w.player.x,
    y: strip ? w.player.y - Math.sin(angle) * 4 : w.player.y,
    angle, radius: strip ? 8 : furnace ? 2.2 : ring ? 4.2 : 2,
    width: strip ? .75 : ring ? 2.2 : 0,
    created: w.time, due: w.time + delay, until: w.time + delay + (furnace && !strip ? 2.2 : .3),
    damage: source ? 18 : 10, fixedDamage: true,
    damageLabel: furnace ? strip ? '熔流切线' : '锻击余火' : ring ? '裂隙外环' : '永夜内爆',
    fired: false, next: w.time + delay,
  };
  if (!crownEscape(w, [h])) return false;
  w.hazards.push(h);
  return true;
}
export class LateStageDirector {
  private cursor = 0;
  private readonly times = [60, 78, 132, 150, 205, 218];
  step(w: SurvivalWorld) {
    if (w.stageId !== 6 && w.stageId !== 7) return;
    if (encounterTime(w.time) >= 230 || encounterBeat(w.time).rest || (w.stageId===6 && furnaceRest(w.time)) || w.enemies.some(e=>e.hp>0 && isElite(e.kind))) {
      w.hazards = w.hazards.filter(h=>h.source!==0);
    }
    while (this.cursor < this.times.length && w.time >= this.times[this.cursor]*2) {
      const index = this.cursor++;
      if (w.time - this.times[index]*2 > .5 || encounterTime(w.time) >= 230 || encounterBeat(w.time).rest || (w.stageId===6 && furnaceRest(w.time))
        || w.time < w.reinforcementRestUntil || w.hazards.length
        || w.enemies.some(e=>e.hp>0 && (isElite(e.kind)||e.kind==='boss'))) continue;
      lateCast(w, 0, w.stageId===6 && index>=2 ? index+w.furnaceRoute : index);
    }
  }
}
export function stepLateBoss(w: SurvivalWorld, e: Enemy, dt: number) {
  const phase = e.hp <= e.maxHp * .5 ? 2 : 1;
  if (phase > e.bossPhase) {
    e.bossPhase = phase; e.state = 'windup'; e.bossAction = 'transition'; e.timer = 1.5;
    e.pattern = 0; e.combo = 0; w.hazards = [];
    w.effects.push({type:'bossPhase',x:e.x,y:e.y,value:phase}); return;
  }
  if (e.state === 'windup') {
    e.timer -= dt;
    if (e.timer > 0) return;
    // The second attack gets a full new warning and a newly locked position.
    if (w.stageId === 7 && phase === 2 && e.combo === 0 && e.bossAction !== 'transition') {
      e.combo = 1;
      if (lateCast(w,e.id,e.pattern)) {
        e.pattern++; e.timer = 1.7; return;
      }
    }
    e.state = 'recover'; e.timer = w.stageId === 6 ? (phase === 2 ? 2.8 : 3.4) : (phase === 2 ? 2.6 : 3);
    return;
  }
  if (e.state === 'recover') {
    e.timer -= dt;
    if (e.timer <= 0) {e.state='seek';e.attack=.8;}
    return;
  }
  const d = distance(e,w.player), angle = Math.atan2(w.player.y-e.y,w.player.x-e.x);
  e.facing = angle; e.attack -= dt;
  if (d > .75) {
    const speed = (w.stageId === 7 ? 1.9 : 1.7) * (e.slowUntil>w.time?1-e.slow:1);
    e.x += Math.cos(angle)*speed*dt; e.y += Math.sin(angle)*speed*dt;
  }
  if (d < 1) w.hurt(18,'boss',false);
  if (e.attack > 0 || e.visibleSince < 0 || w.time-e.visibleSince < .8 || !w.visible(e,.3)) return;
  if (!lateCast(w,e.id,e.pattern)) {e.attack=.35;return;}
  e.bossAction = w.stageId === 6 ? 'altar' : e.pattern%2===0 ? 'bellRing' : 'bellPulse';
  e.pattern++; e.combo=0; e.state='windup'; e.timer=w.stageId===6 && e.pattern%2===0 ? 3.6 : 1.7;
}
