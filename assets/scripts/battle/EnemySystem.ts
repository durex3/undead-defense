import { thunderDevice } from "./ThunderSystem";
import { crownEscape } from "./Escape";
import { hazardLaneContains } from "./HazardLane";
import { stepBoss } from "./BossSystem";
import type { SurvivalWorld } from "./SurvivalWorld";
import {
  Enemy,
  Hazard,
  distance,
  angleDelta,
  segmentDistance,
} from "./SurvivalTypes";
import { ENEMIES, isLarge, enemyAttackRate, enemyDamage } from "./SurvivalConfig";
function hazard(
  w: SurvivalWorld,
  e: Enemy,
  kind: Hazard["kind"],
  delay: number,
  radius: number,
  damage: number,
  duration = 0.12,
) {
  if (
    w.hazards.length >= 2 ||
    (kind === "line" && w.hazards.some((h) => h.kind === "line"))
  )
    return false;
  const rate = enemyAttackRate(e.kind);
  delay /= rate;
  if(kind === "arrow") duration /= rate;
  const id = w.id();
  w.hazards.push({
    id,
    source: e.id,
    kind,
    x: kind === "circle" ? w.player.x : e.x,
    y: kind === "circle" ? w.player.y : e.y,
    angle: e.lockedAngle,
    radius,
    width: kind === "sector" ? (Math.PI * (e.kind === "boss" ? 140 : 120)) / 180 : 1,
    created: w.time,
    due: w.time + delay,
    until: w.time + delay + duration,
    damage: enemyDamage(e.kind,damage),
    projectileSpeed: kind === "arrow" ? 4.5 * rate : undefined,
    fired: false,
    next: 0,
  });
  const candidate = w.hazards.pop()!;
  if (!crownEscape(w, [candidate])) { e.attack = .35; return false; }
  w.hazards.push(candidate);
  e.hazardId = id;
  e.state = "windup";
  e.timer = delay;
  return true;
}
export function stepEnemies(w: SurvivalWorld, dt: number) {
  for (const e of w.enemies) {
    if (e.hp <= 0) continue;
    if (w.visible(e, 0.3)) {
      if (e.visibleSince < 0) e.visibleSince = w.time;
    } else e.visibleSince = -1;
    if (e.state === "arriving") {
      e.timer -= dt;
      if (e.timer <= 0) e.state = "seek";
      continue;
    }
    if (e.kind === "boss") {
      stepBoss(w, e, dt);
      continue;
    }
    if(w.stageId!==1&&w.stageStrategy.stepEnemy(e,dt))continue;
    if (e.freezeUntil > w.time) {
      if(e.siegeNext!==undefined)e.siegeNext+=dt;
      for (const h of w.hazards) if (h.source === e.id && !h.fired && !h.siegeLaunched) {
        h.created += dt; h.due += dt; h.until += dt;
      }
      continue;
    }
    if(w.stageId===1&&w.stageStrategy.stepEnemy(e,dt))continue;
    const moveAngle=w.stageStrategy.map.heading(e,w.player);
    const d = distance(e, w.player),
      angle = Math.atan2(w.player.y - e.y, w.player.x - e.x),
      slow = e.slowUntil > w.time ? 1 - e.slow : 1;
    if (e.state === "seek") e.facing = angle;
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "seek";
        e.attack = 2.2;
      }
      continue;
    }
    if (e.state === "windup") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "recover";
        e.timer = 1.2;
      }
      continue;
    }
    e.attack -= dt;
    const speed = ENEMIES[e.kind].speed;
    if (d > 0.6) {
      e.x += Math.cos(moveAngle) * speed * slow * dt;
      e.y += Math.sin(moveAngle) * speed * slow * dt;
    }
    if (
      e.state !== "charge" &&
      distance(e, w.player) < (isLarge(e.kind) ? 1.0 : 0.65)
    )
      w.hurt(ENEMIES[e.kind].contact, e.kind);
  }
  const grid = new Map<string, Enemy[]>();
  for (const e of w.enemies) {
    if (e.hp <= 0 || e.immovable || thunderDevice(e.kind)) continue;
    const key = Math.floor(e.x) + "," + Math.floor(e.y);
    const list = grid.get(key) || [];
    list.push(e);
    grid.set(key, list);
  }
  for (const e of w.enemies) {
    if (e.hp <= 0 || e.immovable || thunderDevice(e.kind) || e.state !== "seek") continue;
    const x = Math.floor(e.x),
      y = Math.floor(e.y);
    for (let a = x - 1; a <= x + 1; a++)
      for (let b = y - 1; b <= y + 1; b++)
        for (const o of grid.get(a + "," + b) || []) {
          if (o.id <= e.id || o.immovable || thunderDevice(o.kind) || o.state !== "seek") continue;
          const dx = e.x - o.x,
            dy = e.y - o.y,
            d = Math.hypot(dx, dy);
          if (d < 0.65 && d > 0.001) {
            const p = (0.65 - d) * 0.5;
            e.x += (dx / d) * p;
            e.y += (dy / d) * p;
            o.x -= (dx / d) * p;
            o.y -= (dy / d) * p;
          }
        }
  }
  if(w.stageStrategy.resolveCrowd)for(const e of w.enemies)if(e.hp>0&&!e.immovable&&e.state==="seek")w.stageStrategy.map.resolve(e,e.kind==="boss"?.65:.35);
}
export function stepHazards(w: SurvivalWorld) {
  w.stageStrategy.clean();
  for(const h of w.hazards)if(h.siegeBallistic&&!h.siegeLaunched&&w.time>=h.created+(h.sandLaunchDelay??.2)&&w.enemies.some(e=>e.id===h.source&&e.hp>0&&e.freezeUntil<=w.time))h.siegeLaunched=true;
  w.hazards = w.hazards.filter(
    (h) =>
      (h.until > w.time || (!!h.lead && !h.lead.cancelled && h.lead.last < h.until && h.lead.legs.some(f=>!f.cancelled&&f.launch<=w.time)) || (!!h.eclipse && !h.eclipse.cancelled && h.eclipse.last < h.until && h.due <= w.time) || (!!h.edge && !h.edge.cancelled && h.edge.last < h.until && h.due <= w.time) || (!!h.kiln && !h.kiln.cancelled && h.kiln.last < h.until && h.due <= w.time) || (!!h.loom && !h.loom.cancelled && h.loom.last < h.until && h.due <= w.time) || (!!h.library && !h.library.cancelled && h.library.last < h.until && h.due <= w.time) || (!!h.root && !h.root.cancelled && h.root.last < h.until && h.due <= w.time) || (!!h.wind && !h.wind.cancelled && h.wind.last < h.until && h.due <= w.time)) &&
      (!!h.lead || !!h.eclipse || !!h.edge || !!h.kiln || !!h.loom || !!h.library || !!h.wind || !!h.root || !!h.prism || !!h.tide || !!h.bell || !!h.moon || !!h.thunder || h.source === 0 || h.siegeLaunched || ((h.kind === "arrow" || h.siegeGround) && h.fixedDamage && h.fired) || w.enemies.some((e) => e.id === h.source && e.hp > 0)),
  );
  for (const h of w.hazards) {
    if(w.stageStrategy.stepHazard(h))continue;
    if (h.due > w.time) continue;
    const d = distance(h, w.player);
    if(h.siegeGround){
      if(!h.fired){h.fired=true;h.next=w.time+.7;if(d<h.radius)w.hurt(h.damage,h.damageLabel||'钉地',false);}
      else if(h.siegeTick&&w.time>=h.next){h.next=w.time+.7;if(d<h.radius)w.hurt(h.siegeTick,h.damageLabel||'钉地',false);}
      continue;
    }
    if(h.sandRift&&h.fired&&w.time>=h.next){h.next=w.time+.6;if(hazardLaneContains(h,w.player))w.hurt(6,h.damageLabel||"沙裂",false);}
    if(h.kind==="frontierLane"||h.kind==="frontierImpact"){
      if(!h.fired){h.fired=true;if(!h.groupHit&&hazardLaneContains(h,w.player)){w.hurt(h.damage,h.damageLabel||"铸潮攻击",false);for(const other of w.hazards)if(other.id===h.id||(h.group!==undefined&&other.group===h.group))other.groupHit=true;}}
      continue;
    }
    if(h.kind==='starTrace'){
      h.fired=true;
      if(!h.groupHit&&d<h.radius){
        w.hurt(h.damage,h.damageLabel||'旧路星痕',false);
        for(const o of w.hazards)if(o.id===h.id||(h.group!==undefined&&o.group===h.group))o.groupHit=true;
      }
      continue;
    }
    if(h.kind==='starLeap'){
      if(!h.fired){h.fired=true;if(d<h.radius)w.hurt(h.damage,h.damageLabel||'坠星踏击',false);w.effects.push({type:'hazard',x:h.x,y:h.y,radius:h.radius});}
      continue;
    }
    if (h.kind === "bellRing" || h.kind === "bellPulse") {
      if (!h.fired) {
        h.fired=true;
        // A ring is hollow: the inner disc stays safe and only the band hurts.
        const hit = h.kind === "bellRing" ? d >= h.width && d < h.radius : d < h.radius;
        if(hit) w.hurt(h.damage,h.damageLabel || (h.kind === "bellRing" ? "主教钟震" : "近身震击"),!h.fixedDamage);
      }
      continue;
    }
    if (h.kind === "flame") {
      h.fired = true;
      if (h.next <= w.time) { h.next = w.time + 1; if (d < h.radius) w.hurt(h.damage,h.damageLabel || "祭坛熔火",false); }
      continue;
    }
    if (h.kind === "flameLine") {
      if (!h.fired) {
        h.fired = true;
        const dx=w.player.x-h.x, dy=w.player.y-h.y;
        const along=dx*Math.cos(h.angle)+dy*Math.sin(h.angle);
        const across=Math.abs(-dx*Math.sin(h.angle)+dy*Math.cos(h.angle));
        if(along>=0 && along<=h.radius && across<h.width) w.hurt(h.damage,h.damageLabel || "裂地焰",!h.fixedDamage);
      }
      continue;
    }
    if (h.kind === "line") continue;
    if (h.kind === "arrow") {
      const speed = h.projectileSpeed ?? 4.5;
      const previous = Math.max(0, h.next - h.due) * speed;
      const current = Math.min(h.radius, (w.time - h.due) * speed);
      const a = {
        x: h.x + Math.cos(h.angle) * previous,
        y: h.y + Math.sin(h.angle) * previous,
      };
      const b = {
        x: h.x + Math.cos(h.angle) * current,
        y: h.y + Math.sin(h.angle) * current,
      };
      if (segmentDistance(w.player, a, b) < (h.fixedDamage ? h.width : 0.38)) {
        w.hurt(h.damage, h.damageLabel || "骨箭", !h.fixedDamage);
        h.until = w.time;
      }
      h.next = w.time;
      h.fired = true;
      continue;
    }
    if (h.kind === "burst") {
      const radius = (w.time - h.due) * 3;
      for (let i = 0; i < 8; i++) {
        const a = h.angle + (i * Math.PI) / 4;
        if (
          Math.hypot(
            w.player.x - h.x - Math.cos(a) * radius,
            w.player.y - h.y - Math.sin(a) * radius,
          ) < 0.38
        )
          w.hurt(h.damage, "碎骨震波");
      }
      continue;
    }
    if (!h.fired) {
      h.fired = true;
      const facing = Math.atan2(w.player.y - h.y, w.player.x - h.x);
      if (
        d < h.radius &&
        (h.kind !== "sector" ||
          Math.abs(angleDelta(facing, h.angle)) < h.width / 2)
      )
        w.hurt(
          h.damage,
          h.damageLabel || (h.kind === "pool"
            ? "尸爆"
            : h.kind === "sector"
              ? "横扫"
              : w.stageId === 2 &&
                  w.enemies.some((e) => e.id === h.source && e.kind === "boss")
                ? "墓碑落击"
                : "咒印"),
          !h.fixedDamage,
        );
      w.effects.push({
        type: h.kind === "pool" ? "poison" : "hazard",
        x: h.x,
        y: h.y,
        radius: h.radius,
        angle: h.angle,
      });
    }
    if (h.kind === "pool" && h.next <= w.time) {
      h.next = w.time + 1;
      if (d < h.radius) w.hurt(5, "毒池");
    }
  }
}
