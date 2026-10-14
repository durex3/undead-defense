import { enemyAttackRate, enemyDamage, enemyRecoveryRate } from "./SurvivalConfig";
import type { SurvivalWorld } from "./SurvivalWorld";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import { ENEMIES, isElite } from "./SurvivalConfig";
import { hordePressure } from "./HordePressure";
import { crownEscape } from "./CrownSystem";
import { arsenalBlocked, arsenalHeading, resolveArsenal } from "./ArsenalMap";

export function arsenalRest(t: number) {
  return (
    (t >= 164 && t < 172) ||
    (t >= 250 && t < 260) ||
    (t >= 330 && t < 340) ||
    (t >= 468 && t < 480)
  );
}
export function arsenalHint(t: number) {
  return arsenalRest(t)
    ? "军械库暂歇 · 拾取经验与补给"
    : t < 60
      ? "骨卫前排 · 绕侧或贯穿清路"
      : t < 120
        ? "旗手加速附近骨兵 · 绕侧拆掉支援"
        : t < 150
          ? "弩手锁线 · 看准方向后横移"
          : t < 480
            ? "兵器架不挡弩箭 · 清路后切入后排"
            : "军械统领 · 躲扫击与锁线，恢复时反击";
}
export function arsenalAura(w: SurvivalWorld, e: Enemy) {
  if (!["minion", "boneguard"].includes(e.kind)) return 1;
  return w.enemies.some(
    (o) =>
      o.hp > 0 &&
      (o.kind === "warflag" ||
        (o.kind === "standardbearer" && o.state === "windup")) &&
      o.freezeUntil <= w.time &&
      (o.expires === undefined || o.expires > w.time) &&
      distance(e, o) <= 4,
  )
    ? 1.15
    : 1;
}
export class ArsenalDirector {
  private group = 0;
  private special = 60;
  step(
    w: SurvivalWorld,
    dt: number,
    position: (angle: number, r?: number) => Point,
  ) {
    if (arsenalRest(w.time) || w.time < w.reinforcementRestUntil) return;
    const elite = w.enemies.some((e) => e.hp > 0 && isElite(e.kind));
    const reduced =
      (w.time >= 120 && w.time < 150) ||
      (w.time >= 172 && w.time < 210) ||
      (w.time >= 340 && w.time < 380);
    this.group -= dt;
    if (this.group <= 0) {
      const pressure = hordePressure(w),
        count =
          w.time < 0.1
            ? 6
            : Math.min(
                22,
                5 +
                  Math.floor(w.time / 55) +
                  (elite || reduced ? 0 : pressure.extra),
              );
      const angle = w.random() * Math.PI * 2;
      const flag = w.enemies.find(
        (e) => e.hp > 0 && e.kind === "standardbearer",
      );
      for (let i = 0; i < count; i++) {
        const guard =
          w.time >= 30 &&
          w.time < 460 &&
          !elite &&
          i < 4 &&
          w.enemies.filter((e) => e.hp > 0 && e.kind === "boneguard").length <
            16;
        const p = position(
          angle + (i >= count / 2 ? Math.PI * 0.85 : 0) + i * 0.12,
        );
        if (arsenalBlocked(p, 0.4) || distance(p, w.player) < 3) continue;
        const e = w.addEnemy(guard ? "boneguard" : "minion", p.x, p.y);
        if (!e) break;
        e.state = "arriving";
        e.timer = 1;
        if (guard && flag) {
          e.arsenalTarget = {
            x: (flag.x + w.player.x) / 2,
            y: (flag.y + w.player.y) / 2,
          };
          resolveArsenal(e.arsenalTarget, 0.4);
          e.arsenalUntil = w.time + 3;
        }
      }
      this.group =
        Math.max(0.9, 2.7 - w.time / 250) /
        (elite || reduced ? 0.6 : pressure.rate);
    }
    if (w.time < this.special || w.time >= 420 || elite) return;
    this.special = w.time + 14;
    if (
      (w.time >= 150 && w.time < 210) ||
      (w.time >= 250 && w.time < 260) ||
      (w.time >= 300 && w.time < 380)
    )
      return;
    const kind =
      w.time < 120
        ? "standardbearer"
        : w.time < 150
          ? "crossbowman"
          : w.time < 250
            ? "standardbearer"
            : w.time < 300
              ? "crossbowman"
              : Math.floor(w.time / 14) % 2
                ? "standardbearer"
                : "crossbowman";
    const cap = w.time < 150 ? 1 : 2;
    if (w.enemies.filter((e) => e.hp > 0 && e.kind === kind).length >= cap)
      return;
    const threat = w.enemies.reduce(
      (n, e) => n + (e.hp > 0 ? ENEMIES[e.kind].threat : 0),
      0,
    );
    if (threat + 2 > 6) return;
    // Sample inside the viewport: no back-row attacker may begin off screen.
    const start = w.random() * Math.PI * 2;
    for (let i = 0; i < 32; i++) {
      const a = start + (i * Math.PI) / 16,
        r = Math.min(
          9,
          (w.viewport.x - 1) / Math.max(0.01, Math.abs(Math.cos(a))),
          (w.viewport.y - 1) / Math.max(0.01, Math.abs(Math.sin(a))),
        );
      const p = {
        x: w.camera.x + Math.cos(a) * r,
        y: w.camera.y + Math.sin(a) * r,
      };
      if (
        Math.abs(p.x) > 22 ||
        Math.abs(p.y) > 26 ||
        distance(p, w.player) < 6 ||
        !w.visible(p, 0.6) ||
        arsenalBlocked(p, 0.4)
      )
        continue;
      const e = w.addEnemy(kind, p.x, p.y);
      if (e) {
        e.state = "arriving";
        e.timer = 1;
      }
      break;
    }
  }
}

function attack(w: SurvivalWorld, e: Enemy, sweep = false) {
  if (w.hazards.length >= 2) return false;
  const boss = e.kind === "boss",
    delay = (sweep ? 1.3 : boss ? 1.4 : 1.35) / enemyAttackRate(e.kind);
  const h: Hazard = {
    id: w.id(),
    source: e.id,
    kind: sweep ? "sector" : "arrow",
    x: e.x,
    y: e.y,
    angle: Math.atan2(w.player.y - e.y, w.player.x - e.x),
    radius: sweep ? 3.6 : 9,
    width: sweep ? (Math.PI * 100) / 180 : boss ? 0.55 : 0.4,
    created: w.time,
    due: w.time + delay,
    until: w.time + delay + (sweep ? 0.2 : 2) / enemyAttackRate(e.kind),
    damage: enemyDamage(e.kind,boss ? 18 : 10),
    projectileSpeed: sweep ? undefined : 4.5 * enemyAttackRate(e.kind),
    fixedDamage: true,
    damageLabel: sweep ? "统领破阵横扫" : boss ? "统领贯阵弩击" : "裂甲弩矢",
    fired: false,
    next: 0,
  };
  if (!crownEscape(w, [h])) return false;
  w.hazards.push(h);
  e.lockedAngle = h.angle;
  e.state = "windup";
  e.timer = h.until - w.time;
  if (boss) e.bossAction = sweep ? "arsenalSweep" : "arsenalBolt";
  return true;
}
export function stepArsenalEnemy(w: SurvivalWorld, e: Enemy, dt: number) {
  if (e.kind === "warflag") {
    if ((e.expires || 0) <= w.time) e.hp = 0;
    return;
  }
  const d = distance(e, w.player);
  if (e.state === "windup" || e.state === "recover") {
    const close =
      e.state === "windup" &&
      (d < 1.5 || (e.kind === "crossbowman" && !w.visible(e, 0.3)));
    if (close) {
      w.hazards = w.hazards.filter((h) => h.source !== e.id || h.fired);
      e.state = "recover";
      e.timer = 1.2;
    } else {
      e.timer -= dt * enemyRecoveryRate(e.kind,e.state);
      if (e.timer <= 0) {
        if (e.state === "windup") {
          e.state = "recover";
          e.timer = e.kind === "standardbearer" ? 2 : 1.6;
        } else {
          e.state = "seek";
          e.attack = e.kind === "standardbearer" ? 0 : 5;
        }
      }
    }
    // A lowered flag moves normally during its two-second regroup.
    if (e.kind === "standardbearer" && e.state === "recover" && d > 1.5)
      move(w, e, w.player, dt, 1);
    return;
  }
  e.attack -= dt * enemyAttackRate(e.kind);
  e.facing = Math.atan2(w.player.y - e.y, w.player.x - e.x);
  const target =
    e.arsenalTarget && (e.arsenalUntil || 0) > w.time
      ? e.arsenalTarget
      : w.player;
  const stop =
    e.kind === "crossbowman" ? 7 : e.kind === "standardbearer" ? 5 : 0.6;
  if (d > stop && distance(e, target) > 0.15)
    move(w, e, target, dt, arsenalAura(w, e));
  if (d < 0.65) w.hurt(ENEMIES[e.kind].contact, e.kind);
  if (
    e.visibleSince < 0 ||
    w.time - e.visibleSince < 1 ||
    !w.visible(e, 0.3) ||
    d < 1.5 ||
    e.attack > 0
  )
    return;
  if (e.kind === "standardbearer") {
    e.state = "windup";
    e.timer = 4;
  }
  if (e.kind === "crossbowman" && d < 9 && !attack(w, e)) e.attack = 0.35;
}
function move(
  w: SurvivalWorld,
  e: Enemy,
  target: Point,
  dt: number,
  multiplier: number,
) {
  const a = arsenalHeading(e, target),
    speed =
      ENEMIES[e.kind].speed *
      multiplier *
      (e.slowUntil > w.time ? 1 - e.slow : 1);
  e.x += Math.cos(a) * speed * dt;
  e.y += Math.sin(a) * speed * dt;
}
function clearFlags(w: SurvivalWorld) {
  for (const o of w.enemies) if (o.kind === "warflag") o.hp = 0;
}
export function stepArsenalBoss(w: SurvivalWorld, e: Enemy, dt: number) {
  if (e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
    e.bossPhase = 2;
    e.state = "windup";
    e.bossAction = "transition";
    e.timer = 1.5;
    e.pattern = 0;
    e.combo = 0;
    w.hazards = [];
    clearFlags(w);
    w.effects.push({ type: "bossPhase", ...e, value: 2 });
    return;
  }
  if (e.state === "windup") {
    e.timer -= dt;
    if (e.timer > 0) return;
    if (e.bossAction === "arsenalBolt" && e.bossPhase === 2 && e.combo === 0) {
      // A failed second-shot escape check must retry with a fresh full warning.
      if (attack(w, e)) {
        e.combo = 1;
        return;
      }
      e.timer = 0.35;
      return;
    }
    if (e.bossAction === "arsenalFlag") {
      clearFlags(w);
      if (!arsenalBlocked(e, 0.45)) {
        const flag = w.addEnemy("warflag", e.x, e.y, true);
        if (flag) {
          flag.expires = w.time + 6;
          flag.owner = e.id;
        }
      }
    }
    e.state = "recover";
    e.timer =
      e.bossAction === "arsenalSweep"
        ? 2.6
        : e.bossAction === "arsenalBolt"
          ? e.bossPhase === 2
            ? 2.8
            : 2.4
          : 3;
    return;
  }
  if (e.state === "recover") {
    e.timer -= dt;
    if (e.timer <= 0) {
      e.state = "seek";
      e.attack = 0.65;
    }
    return;
  }
  const d = distance(e, w.player);
  e.attack -= dt;
  e.facing = Math.atan2(w.player.y - e.y, w.player.x - e.x);
  if (d > 0.85) {
    const a = arsenalHeading(e, w.player),
      speed =
        (e.bossPhase === 2 ? 1.9 : 1.75) *
        (e.slowUntil > w.time ? 1 - e.slow : 1);
    e.x += Math.cos(a) * speed * dt;
    e.y += Math.sin(a) * speed * dt;
  }
  if (d < 1) w.hurt(18, "boss", false);
  if (
    e.attack > 0 ||
    e.visibleSince < 0 ||
    w.time - e.visibleSince < 1 ||
    !w.visible(e, 0.3) ||
    w.hazards.length >= 2
  )
    return;
  const action = e.pattern % 3;
  if (action === 2) {
    e.state = "windup";
    e.bossAction = "arsenalFlag";
    e.timer = 1.2;
    e.pattern++;
    return;
  }
  if (action === 0 && d > 4.5) {
    e.combo += dt;
    if (e.combo < 2) return;
  }
  if (attack(w, e, action === 0 && d <= 4.5)) {
    e.combo = 0;
    e.pattern++;
  } else e.attack = 0.35;
}
