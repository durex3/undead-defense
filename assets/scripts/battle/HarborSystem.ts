import { enemyAttackRate, enemyDamage, enemyRecoveryRate } from "./SurvivalConfig";
import type { SurvivalWorld } from "./SurvivalWorld";
import {
  Enemy,
  Hazard,
  Point,
  distance,
  segmentDistance,
} from "./SurvivalTypes";
import { ENEMIES, Kind, isElite } from "./SurvivalConfig";
import { hordePressure, bossCrowdRules } from "./HordePressure";
import { crownEscape } from "./CrownSystem";
import {
  harborBlocked,
  harborHeading,
  harborSegment,
  resolveHarbor,
} from "./HarborMap";
export function harborRest(t: number) {
  return (
    (t >= 164 && t < 172) ||
    (t >= 250 && t < 260) ||
    (t >= 330 && t < 340) ||
    (t >= 468 && t < 480)
  );
}
export function harborHint(t: number) {
  return harborRest(t)
    ? "港湾暂歇 · 收集经验与补给"
    : t < 60
      ? "水手成排推进 · 绕侧或贯穿清路"
      : t < 120
        ? "溺亡者侧切 · 提前转向摆脱包抄"
        : t < 150
          ? "投锚落点已锁定 · 离开圆圈即可"
          : t < 480
            ? "货堆可挡冲锋，不挡落锚 · 留出侧向通路"
            : "沉港船长 · 横向躲锚，撞堆后反击";
}
export class HarborDirector {
  private group = 0;
  private special = 60;
  step(
    w: SurvivalWorld,
    dt: number,
    position: (a: number, r?: number) => Point,
  ) {
    if (harborRest(w.time) || w.time < w.reinforcementRestUntil) return;
    const elite = w.enemies.some((e) => e.hp > 0 && isElite(e.kind));
    this.group -= dt;
    if (this.group <= 0) {
      const pressure = hordePressure(w),
        reduced =
          (w.time >= 120 && w.time < 150) ||
          (w.time >= 172 && w.time < 210) ||
          (w.time >= 340 && w.time < 380);
      const count =
        w.time < 0.1
          ? 6
          : Math.min(
              22,
              5 +
                Math.floor(w.time / 55) +
                (elite || reduced ? 0 : pressure.extra),
            );
      const angle = w.random() * Math.PI * 2,
        center = position(angle);
      for (let i = 0; i < count; i++) {
        const use =
          w.time >= 30 &&
          w.time < 460 &&
          !elite &&
          i < 6 &&
          w.enemies.filter((e) => e.kind === "sailor" && e.hp > 0).length < 24;
        const p = use
          ? {
              x: center.x - Math.sin(angle) * (i - 2.5) * 0.85,
              y: center.y + Math.cos(angle) * (i - 2.5) * 0.85,
            }
          : position(angle + (i >= count / 2 ? Math.PI * 0.85 : 0) + i * 0.12);
        if (
          Math.abs(p.x) > 22.7 ||
          Math.abs(p.y) > 26.7 ||
          harborBlocked(p, 0.4) ||
          distance(p, w.player) < 3
        )
          continue;
        const e = w.addEnemy(use ? "sailor" : "minion", p.x, p.y);
        if (!e) break;
        if (use) {
          e.harborTarget = {
            x: w.player.x - Math.sin(angle) * (i - 2.5) * 0.85,
            y: w.player.y + Math.cos(angle) * (i - 2.5) * 0.85,
          };
          resolveHarbor(e.harborTarget, 0.4);
          e.harborUntil = w.time + 3.5;
        }
        e.state = "arriving";
        e.timer = 1;
      }
      this.group =
        Math.max(0.9, 2.7 - w.time / 250) /
        (elite || reduced ? 0.6 : pressure.rate);
    }
    if (w.time < this.special || w.time >= 460 || elite) return;
    this.special = w.time + 14;
    if (
      (w.time >= 150 && w.time < 210) ||
      (w.time >= 250 && w.time < 260) ||
      (w.time >= 300 && w.time < 380)
    )
      return;
    const roles: Kind[] =
      w.time < 120
        ? ["drowned"]
        : w.time < 150
          ? ["anchorhand"]
          : w.time < 250
            ? ["drowned", "drowned"]
            : w.time < 300
              ? ["anchorhand", "anchorhand"]
              : w.time < 420
                ? Math.floor(w.time / 14) % 2
                  ? ["drowned"]
                  : ["anchorhand"]
                : ["drowned"];
    let used = w.enemies.reduce(
      (n, e) => n + (e.hp > 0 ? ENEMIES[e.kind].threat : 0),
      0,
    );
    for (let i = 0; i < roles.length; i++) {
      const kind = roles[i];
      if (
        w.enemies.filter((e) => e.kind === kind && e.hp > 0).length >=
          ENEMIES[kind].cap ||
        used + ENEMIES[kind].threat > 6
      )
        continue;
      const p = position(w.random() * Math.PI * 2 + i * Math.PI);
      const e = w.addEnemy(kind, p.x, p.y);
      if (!e) break;
      used += ENEMIES[kind].threat;
      e.state = "arriving";
      e.timer = 1;
      if (kind === "drowned") {
        const a =
          Math.atan2(w.lastMove.y, w.lastMove.x) +
          ((e.id % 2 ? 1 : -1) * Math.PI) / 2;
        e.harborTarget = {
          x: Math.max(-22, Math.min(22, w.player.x + Math.cos(a) * 2.5)),
          y: Math.max(-26, Math.min(26, w.player.y + Math.sin(a) * 2.5)),
        };
        resolveHarbor(e.harborTarget, 0.4);
        e.harborUntil = w.time + 2.8;
      }
    }
  }
}
function anchor(w: SurvivalWorld, e: Enemy, radius: number, damage: number) {
  if (w.hazards.length >= 2) return false;
  const h: Hazard = {
    id: w.id(),
    source: e.id,
    kind: "circle",
    ...w.player,
    radius,
    width: 0,
    angle: 0,
    created: w.time,
    due: w.time + 1.4 / enemyAttackRate(e.kind),
    until: w.time + 1.65 / enemyAttackRate(e.kind),
    damage: enemyDamage(e.kind,damage),
    fixedDamage: true,
    damageLabel: e.kind === "boss" ? "船长抛锚" : "投锚落击",
    fired: false,
    next: 0,
  };
  if (!crownEscape(w, [h])) return false;
  w.hazards.push(h);
  e.state = "windup";
  e.timer = 1.65 / enemyAttackRate(e.kind);
  e.bossAction = "anchor";
  return true;
}
export function stepHarborEnemy(w: SurvivalWorld, e: Enemy, dt: number) {
  if (e.state === "windup" || e.state === "recover") {
    if (e.state === "windup" && distance(e, w.player) < 1.5) {
      w.hazards = w.hazards.filter((h) => h.source !== e.id);
      e.state = "recover";
      e.timer = 1.2;
    } else {
      e.timer -= dt * enemyRecoveryRate(e.kind,e.state);
      if (e.timer <= 0) {
        if (e.state === "windup") {
          e.state = "recover";
          e.timer = 1.2;
        } else {
          e.state = "seek";
          e.attack = 5;
        }
      }
    }
    return;
  }
  const d = distance(e, w.player);
  e.attack -= dt * enemyAttackRate(e.kind);
  const target =
    e.harborTarget && (e.harborUntil || 0) > w.time ? e.harborTarget : w.player;
  const a = harborHeading(e, target),
    slow = e.slowUntil > w.time ? 1 - e.slow : 1;
  e.facing = Math.atan2(w.player.y - e.y, w.player.x - e.x);
  if (d > (e.kind === "anchorhand" ? 6 : 0.6) && distance(e, target) > 0.15) {
    e.x += Math.cos(a) * ENEMIES[e.kind].speed * slow * dt;
    e.y += Math.sin(a) * ENEMIES[e.kind].speed * slow * dt;
  }
  if (d < 0.7) w.hurt(enemyDamage(e.kind,8), e.kind);
  if (
    e.kind === "anchorhand" &&
    d > 1.5 &&
    d < 10 &&
    e.attack <= 0 &&
    e.visibleSince >= 0 &&
    w.time - e.visibleSince >= 0.8 &&
    w.visible(e, 0.3)
  )
    if (!anchor(w, e, 1.1, 10)) e.attack = 0.35;
}
export function stepHarborBoss(w: SurvivalWorld, e: Enemy, dt: number) {
  if (e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
    e.bossPhase = 2;
    e.state = "windup";
    e.bossAction = "transition";
    e.timer = 1.5;
    e.pattern = 0;
    e.combo = 0;
    w.hazards = [];
    w.effects.push({ type: "bossPhase", ...e, value: 2 });
    return;
  }
  if (e.state === "windup") {
    e.timer -= dt;
    if (e.timer > 0) return;
    if (e.bossAction === "harborCharge") {
      e.state = "charge";
      e.timer = 1;
      e.combo = 0;
      return;
    }
    if (e.bossAction === "anchor" && e.bossPhase === 2 && e.combo === 0) {
      e.combo = 1;
      if (anchor(w, e, 1.5, 18)) return;
    }
    if (e.bossAction === "harborSummon") {
      const rules = bossCrowdRules(8, e.bossPhase),
        alive = w.enemies.filter((o) => o.hp > 0 && o.kind !== "boss").length;
      const gap =
        distance(w.player, { x: 0, y: 0 }) > 3
          ? Math.atan2(-w.player.y, -w.player.x)
          : Math.atan2(w.lastMove.y, w.lastMove.x);
      const count = Math.min(12, rules.target - alive);
      for (let i = 0; i < count; i++) {
        const a = gap + 0.7 + ((Math.PI * 2 - 1.4) * (i + 0.5)) / count,
          p = {
            x: w.player.x + Math.cos(a) * 7,
            y: w.player.y + Math.sin(a) * 7,
          };
        if (
          Math.abs(p.x) > 22.7 ||
          Math.abs(p.y) > 26.7 ||
          harborBlocked(p, 0.4)
        )
          continue;
        const child = w.addEnemy("minion", p.x, p.y, true);
        if (child) {
          child.state = "arriving";
          child.timer = 1;
        }
      }
    }
    e.state = "recover";
    e.timer = e.bossAction === "anchor" ? 2.4 : 2.6;
    return;
  }
  if (e.state === "charge") {
    const old = { x: e.x, y: e.y },
      next = {
        x: e.x + Math.cos(e.lockedAngle) * 6 * dt,
        y: e.y + Math.sin(e.lockedAngle) * 6 * dt,
      };
    const cargo = harborSegment(old, next, 0.65),
      edge = Math.abs(next.x) > 22 || Math.abs(next.y) > 26;
    if (!cargo && !edge) {
      e.x = next.x;
      e.y = next.y;
      if (!e.combo && segmentDistance(w.player, old, e) < 0.95) {
        w.hurt(18, "船长拖锚冲锋", false);
        e.combo = 1;
      }
    }
    e.timer -= dt;
    if (cargo || edge || e.timer <= 0) {
      w.hazards = w.hazards.filter((h) => h.source !== e.id);
      e.state = "recover";
      e.timer = cargo ? 2.8 : 2.2;
    }
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
  const d = distance(e, w.player),
    angle = Math.atan2(w.player.y - e.y, w.player.x - e.x);
  e.facing = angle;
  e.attack -= dt;
  if (d > 0.75) {
    const a = harborHeading(e, w.player),
      speed =
        (e.bossPhase === 2 ? 1.9 : 1.7) *
        (e.slowUntil > w.time ? 1 - e.slow : 1);
    e.x += Math.cos(a) * speed * dt;
    e.y += Math.sin(a) * speed * dt;
  }
  if (d < 1) w.hurt(18, "boss", false);
  if (
    e.attack > 0 ||
    e.visibleSince < 0 ||
    w.time - e.visibleSince < 0.8 ||
    !w.visible(e, 0.3) ||
    w.hazards.length >= 2
  )
    return;
  const action = e.pattern % 3;
  e.combo = 0;
  if (action === 2) {
    e.bossAction = "harborSummon";
    e.state = "windup";
    e.timer = 1.2;
    e.pattern++;
    return;
  }
  if (action === 1 && d >= 2.5 && d <= 8) {
    const h: Hazard = {
      id: w.id(),
      source: e.id,
      kind: "line",
      x: e.x,
      y: e.y,
      angle,
      radius: 6,
      width: 0.65,
      created: w.time,
      due: w.time + 1.3,
      until: w.time + 2.3,
      damage: 18,
      fixedDamage: true,
      damageLabel: "拖锚冲锋",
      fired: false,
      next: 0,
    };
    if (crownEscape(w, [h])) {
      w.hazards.push(h);
      e.lockedAngle = angle;
      e.state = "windup";
      e.timer = 1.3;
      e.bossAction = "harborCharge";
      e.pattern++;
      return;
    }
  }
  if (anchor(w, e, 1.5, 18)) e.pattern++;
  else e.attack = 0.35;
}
