import {isFrontier,frontierMap} from "./FrontierMaps";
import {frontierEnemy,stepFrontierEnemy} from "./FrontierSystem";
import {frontierContains} from "./FrontierGeometry";
import {stepArsenalEnemy, arsenalAura} from "./ArsenalSystem";
import {stepObservatoryEnemy,isStarEnemy} from "./ObservatorySystem";
import {observatoryHeading} from "./ObservatoryMap";
import {starContains} from "./ObservatoryPath";
import {arsenalHeading} from "./ArsenalMap";
import {stepHarborEnemy} from "./HarborSystem";
import {harborHeading} from "./HarborMap";
import { crownEscape } from "./CrownSystem";
import { bellContains } from "./ChurchSystem";
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
    width:
      kind === "sector"
        ? (Math.PI *
            (e.kind === "boss" ? 140 : e.kind === "banshee" ? 70 : 120)) /
          180
        : 1,
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
    if(e.kind==="warflag"){stepArsenalEnemy(w,e,dt);continue;}
    if (e.freezeUntil > w.time) {
      if(e.frontierUntil!==undefined)e.frontierUntil+=dt;
      if(e.starUntil!==undefined)e.starUntil+=dt;
      if(e.arsenalUntil!==undefined)e.arsenalUntil+=dt;
      for (const h of w.hazards) if (h.source === e.id && !h.fired) {
        h.created += dt; h.due += dt; h.until += dt;
      }
      continue;
    }
    if(isFrontier(w.stageId)&&frontierEnemy(e.kind)){stepFrontierEnemy(w,e,dt);continue;}
    if(isStarEnemy(e)){stepObservatoryEnemy(w,e,dt);continue;}
    if(["boneguard","standardbearer","crossbowman"].includes(e.kind)){stepArsenalEnemy(w,e,dt);continue;}
    if(["sailor","drowned","anchorhand"].includes(e.kind)){stepHarborEnemy(w,e,dt);continue;}
    const moveAngle=isFrontier(w.stageId)?frontierMap(w.stageId).heading(e,w.player):w.stageId===10?observatoryHeading(e,w.player):w.stageId===9?arsenalHeading(e,w.player):w.stageId===8?harborHeading(e,w.player):Math.atan2(w.player.y-e.y,w.player.x-e.x);
    const d = distance(e, w.player),
      angle = Math.atan2(w.player.y - e.y, w.player.x - e.x),
      slow = e.slowUntil > w.time ? 1 - e.slow : 1;
    if (e.kind === "shield")
      e.facing += Math.max(
        (-Math.PI / 2) * dt,
        Math.min((Math.PI / 2) * dt, angleDelta(angle, e.facing)),
      );
    else if (e.state === "seek") e.facing = angle;
    if (e.state === "windup") {
      e.timer -= dt;
      if (e.kind === "mage" && d < 1.3) {
        w.hazards = w.hazards.filter((h) => h.source !== e.id);
        e.state = "recover";
        e.timer = 1;
        continue;
      }
      if (e.timer <= 0) {
        if (e.kind === "boar" || e.kind === "charger" || e.kind === "wisp") {
          e.state = "charge";
          e.timer = e.kind === "wisp" ? 0.8 : 5 / 6;
        } else {
          e.state = "recover";
          e.timer = 1.2;
        }
      }
    } else if (e.state === "charge") {
      const old = { x: e.x, y: e.y };
      e.x = Math.max(
        -22.7,
        Math.min(
          22.7,
          e.x + Math.cos(e.lockedAngle) * (e.kind === "wisp" ? 3.75 : 6) * dt,
        ),
      );
      e.y = Math.max(
        -26.7,
        Math.min(
          26.7,
          e.y + Math.sin(e.lockedAngle) * (e.kind === "wisp" ? 3.75 : 6) * dt,
        ),
      );
      if (segmentDistance(w.player, old, e) < 0.7)
        w.hurt(
          enemyDamage(e.kind,e.kind === "charger" ? 16 : e.kind === "wisp" ? 8 : 14),
          e.kind + "冲锋",
        );
      e.timer -= dt;
      if (e.timer <= 0) {
        w.hazards = w.hazards.filter((h) => h.source !== e.id);
        e.state = "recover";
        e.timer = e.kind === "charger" && e.combo === 0 ? 0.6 : 1.8;
        e.combo++;
      }
    } else if (e.state === "recover") {
      e.timer -= dt * enemyAttackRate(e.kind);
      if (e.timer <= 0) {
        e.state = "seek";
        e.attack =
          e.kind === "charger" && e.combo === 1
            ? 0
            : e.kind === "archer"
              ? 2.35
              : e.kind === "banshee"
                ? 2.8
                : e.kind === "mage"
                  ? 2.6
                  : 2.2;
      }
    } else {
      e.attack -= dt * enemyAttackRate(e.kind);
      let speed = ENEMIES[e.kind].speed * (w.stageId===9?arsenalAura(w,e):1);
      if (e.kind === "rogue") {
        const phase = (w.time - e.born) % 2;
        speed = phase < 1.2 ? 3.6 : 1;
      }
      if (
        !isLarge(e.kind) &&
        !["drummer", "mage", "archer", "summoner", "banshee", "wisp"].includes(
          e.kind,
        ) &&
        w.enemies.some(
          (o) =>
            o.hp > 0 &&
            o.kind === "drummer" &&
            o.state !== "arriving" &&
            o.freezeUntil <= w.time &&
            distance(e, o) <= 3,
        )
      )
        speed *= 1.2;
      const stop =
        e.kind === "mage" || e.kind === "archer" || e.kind === "summoner"
          ? 6
          : e.kind === "banshee"
            ? 3.5
            : e.kind === "wisp"
              ? 3
              : 0.6;
      if (d > stop) {
        e.x += Math.cos(moveAngle) * speed * slow * dt;
        e.y += Math.sin(moveAngle) * speed * slow * dt;
      }
      if (e.kind === "wisp" && d <= 3.5 && e.attack > 0) {
        e.x += Math.cos(angle + Math.PI / 2) * speed * slow * dt;
        e.y += Math.sin(angle + Math.PI / 2) * speed * slow * dt;
      }
      const can =
        w.visible(e, 0.3) &&
        e.visibleSince >= 0 &&
        w.time - e.visibleSince >= 0.8 &&
        e.attack <= 0 &&
        w.hazards.length < 2;
      if (can) {
        e.lockedAngle = angle;
        if ((e.kind === "boar" || e.kind === "charger") && d > 2 && d < 7) {
          const delay = e.kind === "charger" && e.combo === 1 ? 0.7 : 0.85;
          if (
            hazard(
              w,
              e,
              "line",
              delay,
              5,
              e.kind === "charger" ? 16 : 14,
              5 / 6,
            )
          ) {
            if (e.combo >= 2) e.combo = 0;
            e.attack = 4;
          }
        } else if (e.kind === "archer" && d < 8) {
          if (hazard(w, e, "arrow", 0.65, 10, 10, 10 / 4.5)) e.attack = 3;
        } else if (e.kind === "banshee" && d < 5) {
          if (hazard(w, e, "sector", 1, 4, 12)) e.attack = 5;
        } else if (e.kind === "wisp" && d < 5 && d > 1) {
          if (hazard(w, e, "line", 0.8, 3, 8, 0.8)) e.attack = 3;
        } else if (e.kind === "summoner" && d < 9) {
          let owned = w.enemies.filter(
            (o) => o.hp > 0 && o.owner === e.id,
          ).length;
          for (let i = 0; i < 2 && owned < 4; i++) {
            const a = angle + (i ? 0.8 : -0.8);
            const x = Math.max(-22, Math.min(22, e.x + Math.cos(a) * 1.3));
            const y = Math.max(-26, Math.min(26, e.y + Math.sin(a) * 1.3));
            if (Math.hypot(x - w.player.x, y - w.player.y) < 3) continue;
            const child = w.addEnemy("minion", x, y, true);
            if (child) {
              child.owner = e.id;
              child.state = "arriving";
              child.timer = 1;
              owned++;
            }
          }
          e.attack = 7;
          w.effects.push({ type: "summon", x: e.x, y: e.y });
        } else if (e.kind === "mage" && d < 8) {
          if (hazard(w, e, "circle", 1.1, 1.1, 12)) e.attack = 3.8;
        } else if (e.kind === "executioner" && d < 3.7) {
          if (hazard(w, e, "sector", 0.9, 2.6, 18)) e.attack = 3.2;
        }
      }
    }
    if (
      e.state !== "charge" &&
      distance(e, w.player) < (isLarge(e.kind) ? 1.0 : 0.65)
    )
      w.hurt(ENEMIES[e.kind].contact, e.kind);
  }
  const grid = new Map<string, Enemy[]>();
  for (const e of w.enemies) {
    if (e.hp <= 0) continue;
    const key = Math.floor(e.x) + "," + Math.floor(e.y);
    const list = grid.get(key) || [];
    list.push(e);
    grid.set(key, list);
  }
  for (const e of w.enemies) {
    if (e.hp <= 0 || e.kind === "warflag" || e.state !== "seek") continue;
    const x = Math.floor(e.x),
      y = Math.floor(e.y);
    for (let a = x - 1; a <= x + 1; a++)
      for (let b = y - 1; b <= y + 1; b++)
        for (const o of grid.get(a + "," + b) || []) {
          if (o.id <= e.id || o.kind === "warflag" || o.state !== "seek") continue;
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
}
export function stepHazards(w: SurvivalWorld) {
  w.hazards = w.hazards.filter(
    (h) =>
      h.until > w.time &&
      (h.source === 0 || (h.kind === "arrow" && h.fixedDamage && h.fired) || w.enemies.some((e) => e.id === h.source && e.hp > 0)),
  );
  for (const h of w.hazards) {
    if (h.due > w.time) continue;
    const d = distance(h, w.player);
    if(h.kind==="frontierLane"||h.kind==="frontierImpact"){
      if(!h.fired){h.fired=true;if(!h.groupHit&&frontierContains(h,w.player)){w.hurt(h.damage,h.damageLabel||"铸潮攻击",false);for(const other of w.hazards)if(other.id===h.id||(h.group!==undefined&&other.group===h.group))other.groupHit=true;}}
      continue;
    }
    if(h.kind==='starTrace'){
      h.fired=true;
      if(!h.groupHit&&starContains(h,w.player)){
        w.hurt(h.damage,h.damageLabel||'旧路星痕',false);
        for(const o of w.hazards)if(o.id===h.id||(h.group!==undefined&&o.group===h.group))o.groupHit=true;
      }
      continue;
    }
    if(h.kind==='starLeap'){
      if(!h.fired){h.fired=true;if(starContains(h,w.player))w.hurt(h.damage,h.damageLabel||'坠星踏击',false);w.effects.push({type:'hazard',x:h.x,y:h.y,radius:h.radius});}
      continue;
    }
    if (h.kind === "bellRing" || h.kind === "bellPulse") {
      if (!h.fired) {
        h.fired=true;
        if(bellContains(h,w.player)) w.hurt(h.damage,h.damageLabel || (h.source ? (h.kind === "bellRing" ? "主教钟震" : "近身震击") : "幽钟共振"),!h.fixedDamage && h.source !== 0);
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
