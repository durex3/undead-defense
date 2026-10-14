import {isFrontier} from "./FrontierMaps";
import {stepFrontierBoss} from "./FrontierSystem";
import {stepObservatoryBoss} from "./ObservatorySystem";
import {stepArsenalBoss} from "./ArsenalSystem";
import {stepHarborBoss} from "./HarborSystem";
import { stepLateBoss } from "./LateStageSystem";
import { crownEscape } from "./CrownSystem";
import { stepKing } from "./KingBossSystem";
import { churchCast } from "./ChurchSystem";
import { altarFlame, altarLance, ALTAR_ZONES } from "./AltarSystem";
import type { SurvivalWorld } from "./SurvivalWorld";
import { Enemy, Hazard, distance } from "./SurvivalTypes";
export function bossExposed(w: SurvivalWorld, e: Enemy) {
  return (
    e.kind === "boss" &&
    e.state === "recover" &&
    !w.hazards.some((h) => h.source === e.id && h.until > w.time)
  );
}
export function stepBoss(w: SurvivalWorld, e: Enemy, dt: number) {
  if(w.stageId===15){w.sand.stepEnemy(e,dt);return;}
  if(w.stageId===14){w.siege.stepBoss(e,dt);return;}
  if(isFrontier(w.stageId)){stepFrontierBoss(w,e,dt);return;}
  if(w.stageId===10){stepObservatoryBoss(w,e,dt);return;}
  if(w.stageId===9){stepArsenalBoss(w,e,dt);return;}
  if(w.stageId===8){stepHarborBoss(w,e,dt);return;}
  if(w.stageId>=6){stepLateBoss(w,e,dt);return;}
  if(w.stageId===5){stepKing(w,e,dt);return;}
  if (e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
    e.bossPhase = 2;
    e.bossAction = "transition";
    e.state = "windup";
    e.timer = w.stageId >= 3 ? 1.5 : 1.2;
    w.hazards = w.hazards.filter((h) => h.source !== e.id && !(w.stageId === 3 && h.kind === "flame") && !(w.stageId === 4 && h.kind === "bellRing"));
    w.effects.push({ type: "bossPhase", x: e.x, y: e.y });
  }
  if (e.state === "windup") {
    e.timer -= dt;
    if (e.timer <= 0) {
      if (w.stageId === 3 && e.bossAction === "lance" && e.bossPhase === 2 && e.combo === 0 && w.hazards.length < 2) {
        e.combo = 1; if(altarLance(w,e)) return;
      }
      if (w.stageId === 4 && e.bossAction === "bellRing" && e.bossPhase === 2 && e.combo === 0) {
        e.combo=1;
        if(churchCast(w,e,true)) return;
      }
      e.state = "recover";
      e.timer =
        e.bossAction === "burst"
          ? (e.bossPhase === 2 ? 3.6 : 4.2)
          : e.bossAction === "transition"
            ? 1.5
            : 2.5;
    }
    return;
  }
  if (e.state === "recover") {
    e.timer -= dt * (w.stageId >= 2 ? 1 / 0.9 : 1);
    if (e.timer <= 0) {
      e.state = "seek";
      e.attack = e.bossPhase === 2 ? 0.65 : 1;
    }
    return;
  }
  const d = distance(e, w.player),
    angle = Math.atan2(w.player.y - e.y, w.player.x - e.x);
  e.facing = angle;
  e.attack -= dt;
  if (d > .75) {
    const speed =
      (e.bossPhase === 2 ? 2.1 : 1.7) *
      (e.slowUntil > w.time ? 1 - e.slow : 1);
    e.x += Math.cos(angle) * speed * dt;
    e.y += Math.sin(angle) * speed * dt;
  }
  if (d < 1) w.hurt(18, "boss");
  if (
    e.attack > 0 ||
    e.visibleSince < 0 ||
    w.time - e.visibleSince < 0.8 ||
    !w.visible(e, 0.3) ||
    w.hazards.length >= 2
  )
    return;
  const action = e.pattern % 3;
  // At long range the sweep becomes a warned burst, so kiting cannot stall the entire cycle.
  if (action === 2) {
    let owned = w.enemies.filter((o) => o.hp > 0 && o.owner === e.id).length;
    const count = e.bossPhase === 2 ? 6 : 4;
    for (let i = 0; i < count && owned < 8; i++) {
      const a = angle + (i * Math.PI * 2) / count;
      const x = Math.max(-22, Math.min(22, w.player.x + Math.cos(a) * 5));
      const y = Math.max(-26, Math.min(26, w.player.y + Math.sin(a) * 5));
      if (Math.hypot(x - w.player.x, y - w.player.y) < 4) continue;
      const child = w.addEnemy("minion", x, y, true);
      if (child) {
        child.owner = e.id;
        child.state = "arriving";
        child.timer = 1.2;
        owned++;
      }
    }
    e.bossAction = "summon";
    e.state = "recover";
    e.timer = 2.5;
    e.pattern++;
    return;
  }
  if (w.stageId === 4) {
    e.combo=0;
    if(churchCast(w,e,action===1)) e.pattern++;
    return;
  }
  if (w.stageId === 3) {
    if (action === 0) {e.combo = 0; if(!altarLance(w,e)) {e.attack=.35;return;}}
    else {
      let nearest = 0;
      ALTAR_ZONES.forEach((p,i) => {if (Math.hypot(p.x-w.player.x,p.y-w.player.y) < Math.hypot(ALTAR_ZONES[nearest].x-w.player.x,ALTAR_ZONES[nearest].y-w.player.y)) nearest=i;});
      if (!altarFlame(w,nearest,e.id)) return;
      e.bossAction = "altar"; e.state = "windup"; e.timer = 1.5;
    }
    e.pattern++; return;
  }
  const existingCount=w.hazards.length;
  const sweep = action === 0 && d < 4.5;
  const kind: Hazard["kind"] = sweep
    ? "sector"
    : w.stageId === 2
      ? "circle"
      : "burst";
  const delay = sweep ? (e.bossPhase === 2 ? 0.9 : 1.1) : 1.1;
  e.lockedAngle = angle;
  e.bossAction = sweep ? "sweep" : w.stageId === 2 ? "tombstone" : "burst";
  e.state = "windup";
  e.timer = delay;
  e.pattern++;
  w.hazards.push({
    id: w.id(),
    source: e.id,
    kind,
    x: kind === "circle" ? w.player.x : e.x,
    y: kind === "circle" ? w.player.y : e.y,
    angle,
    radius: sweep ? 3.4 : kind === "circle" ? 1.35 : 9,
    width: (Math.PI * (e.bossPhase === 2 ? 160 : 130)) / 180,
    created: w.time,
    due: w.time + delay,
    until: w.time + delay + (kind === "burst" ? 3 : 0.15),
    damage: sweep ? 20 : kind === "circle" ? 14 : 12,
    fired: false,
    next: 0,
  });
  // Alternate a single impact with a staggered route cut. Both positions lock now.
  if (w.stageId === 2 && kind === "circle" && e.pattern % 2 === 0 && w.hazards.length < 2) {
    const moving = Math.hypot(w.move.x,w.move.y) > .1;
    const direction = moving ? Math.atan2(w.move.y,w.move.x) : angle + Math.PI / 2;
    w.hazards.push({
      id:w.id(),source:e.id,kind:"circle",
      x:Math.max(-21,Math.min(21,w.player.x+Math.cos(direction)*2.8)),
      y:Math.max(-25,Math.min(25,w.player.y+Math.sin(direction)*2.8)),
      angle:0,radius:1.35,width:0,created:w.time,due:w.time+1.65,
      until:w.time+1.8,damage:14,fired:false,next:0,
    });
  }
  const proposed=w.hazards.splice(existingCount);
  if(crownEscape(w,proposed))w.hazards.push(...proposed);
  else {e.state='seek';e.attack=.35;e.pattern--;}
}
