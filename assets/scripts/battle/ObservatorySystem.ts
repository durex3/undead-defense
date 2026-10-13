import type { SurvivalWorld } from "./SurvivalWorld";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import { ENEMIES, isElite } from "./SurvivalConfig";
import { hordePressure } from "./HordePressure";
import { crownEscape } from "./CrownSystem";
import {
  observatoryBlocked,
  observatoryHeading,
  resolveObservatory,
} from "./ObservatoryMap";

export const isStarEnemy = (e: Enemy) =>
  ["starpatrol", "starweaver", "starpuppet"].includes(e.kind);
export const starAirborne = (e: Enemy) =>
  e.state === "charge" &&
  !!e.leapEnd &&
  (isStarEnemy(e) || e.bossAction === "starLeap");
export function starHeight(e: Enemy) {
  return starAirborne(e)
    ? Math.sin(
        Math.PI * Math.max(0, Math.min(1, 1 - e.timer / (e.leapDuration || 1))),
      ) * (e.kind === "boss" ? 90 : 60)
    : 0;
}
export function observatoryRest(t: number) {
  return (
    (t >= 164 && t < 172) ||
    (t >= 250 && t < 260) ||
    (t >= 330 && t < 340) ||
    (t >= 468 && t < 480)
  );
}
export function observatoryHint(t: number) {
  return observatoryRest(t)
    ? "观测台暂歇 · 拾取经验与补给"
    : t < 75
      ? "巡星侧向切入 · 看清方向后换线"
      : t < 125
        ? "星痕记录旧路线 · 避免立刻原路折返"
        : t < 150
          ? "坠星落点已锁定 · 横移后贴近反击"
          : t < 480
            ? "基座不挡星痕 · 中央与两侧均可换线"
            : "葬星占卜者 · 避旧痕、躲落点，恢复时反击";
}
export class ObservatoryDirector {
  private group = 0;
  private special = 75;
  private wave = 0;
  step(
    w: SurvivalWorld,
    dt: number,
    position: (a: number, r?: number) => Point,
  ) {
    if (observatoryRest(w.time) || w.time < w.reinforcementRestUntil) return;
    const elite = w.enemies.some((e) => e.hp > 0 && isElite(e.kind)),
      reduced =
        (w.time >= 75 && w.time < 150) ||
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
      const a = w.random() * Math.PI * 2;
      this.wave++;
      for (let i = 0; i < count; i++) {
        const patrol =
          w.time >= 30 &&
          w.time < 460 &&
          !elite &&
          this.wave % 2 === 0 &&
          i < 2 &&
          w.enemies.filter((e) => e.hp > 0 && e.kind === "starpatrol").length <
            12;
        const p = position(
          a + (i >= count / 2 ? Math.PI * 0.85 : 0) + i * 0.12,
        );
        if (observatoryBlocked(p, 0.4) || distance(p, w.player) < 3) continue;
        const e = w.addEnemy(patrol ? "starpatrol" : "minion", p.x, p.y);
        if (!e) break;
        e.state = "arriving";
        e.timer = 1;
        if (patrol) {
          const side = a + ((e.id % 2 ? 1 : -1) * Math.PI) / 2;
          e.starTarget = {
            x: Math.max(-22, Math.min(22, w.player.x + Math.cos(side) * 2)),
            y: Math.max(-26, Math.min(26, w.player.y + Math.sin(side) * 2)),
          };
          resolveObservatory(e.starTarget, 0.4);
          e.starUntil = w.time + 3;
        }
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
    const kind =
      w.time < 125
        ? "starweaver"
        : w.time < 150
          ? "starpuppet"
          : w.time < 250
            ? "starweaver"
            : w.time < 300
              ? "starpuppet"
              : w.time < 420
                ? Math.floor(w.time / 14) % 2
                  ? "starweaver"
                  : "starpuppet"
                : "starpuppet";
    const cap = w.time < 150 || w.time >= 420 ? 1 : 2;
    if (
      w.enemies.filter((e) => e.hp > 0 && e.kind === kind).length >= cap ||
      w.enemies.reduce(
        (n, e) => n + (e.hp > 0 ? ENEMIES[e.kind].threat : 0),
        0,
      ) +
        2 >
        6
    )
      return;
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
        observatoryBlocked(p, 0.4)
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
function baseHazard(
  w: SurvivalWorld,
  e: Enemy,
  kind: Hazard["kind"],
  delay: number,
  duration: number,
): Hazard {
  const boss = e.kind === "boss";
  return {
    id: w.id(),
    source: e.id,
    kind,
    x: e.x,
    y: e.y,
    angle: 0,
    radius: 0,
    width: 0,
    created: w.time,
    due: w.time + delay,
    until: w.time + delay + duration,
    damage: boss ? 18 : 10,
    fixedDamage: true,
    fired: false,
    next: 0,
  };
}
export function castStarTrace(w: SurvivalWorld, e: Enemy, count = 1) {
  const segments = w.starPath.segments(count, (p) => w.visible(p, 0.3));
  if (!segments.length) return "empty";
  if (w.hazards.length + segments.length > 2) return "blocked";
  const boss = e.kind === "boss",
    group = w.id(),
    delay = boss ? 1.6 : 1.5;
  const hazards = segments.map((s) => ({
    ...baseHazard(w, e, "starTrace", delay, 0.6),
    ...s.a,
    endX: s.b.x,
    endY: s.b.y,
    width: boss ? 0.65 : 0.45,
    group,
    damageLabel: boss ? "命轨刻印" : "旧路星痕",
  }));
  if (!crownEscape(w, hazards)) return "blocked";
  w.hazards.push(...hazards);
  e.state = "windup";
  e.timer = delay + 0.6;
  if (boss) e.bossAction = "starTrace";
  return "cast";
}
export function castStarBlade(w: SurvivalWorld, e: Enemy) {
  if (w.hazards.length >= 2) return false;
  const moving = Math.hypot(w.lastMove.x, w.lastMove.y) > 0.01,
    a =
      (moving
        ? Math.atan2(w.lastMove.y, w.lastMove.x)
        : Math.atan2(w.player.y - e.y, w.player.x - e.x)) +
      Math.PI / 2;
  const h = {
    ...baseHazard(w, e, "starTrace", 1.5, 0.25),
    x: w.player.x - Math.cos(a) * 3,
    y: w.player.y - Math.sin(a) * 3,
    endX: w.player.x + Math.cos(a) * 3,
    endY: w.player.y + Math.sin(a) * 3,
    width: 0.55,
    damageLabel: "断路星刃",
  };
  h.group = h.id;
  if (!crownEscape(w, [h])) return false;
  w.hazards.push(h);
  e.state = "windup";
  e.timer = 1.75;
  e.bossAction = "starBlade";
  return true;
}
export function castStarLeap(w: SurvivalWorld, e: Enemy) {
  const boss = e.kind === "boss",
    body = boss ? 0.65 : 0.35,
    delay = boss ? 1.5 : 1.3,
    flight = boss ? 0.45 : 0.35;
  if (
    w.hazards.length >= 2 ||
    distance(e, w.player) > 7 ||
    (!boss && distance(e, w.player) < 3) ||
    observatoryBlocked(w.player, body)
  )
    return false;
  const h = {
    ...baseHazard(w, e, "starLeap", delay + flight, 0.12),
    ...w.player,
    radius: boss ? 1.5 : 0.9,
    damageLabel: boss ? "坠星踏击" : "傀儡坠星",
  };
  if (!crownEscape(w, [h])) return false;
  w.hazards.push(h);
  e.hazardId = h.id;
  e.state = "windup";
  e.timer = delay;
  e.leapStart = { x: e.x, y: e.y };
  e.leapEnd = { x: h.x, y: h.y };
  e.leapDuration = flight;
  if (boss) e.bossAction = "starLeap";
  return true;
}
function recover(e: Enemy, time: number) {
  e.state = "recover";
  e.timer = time;
  e.leapStart = undefined;
  e.leapEnd = undefined;
  e.leapDuration = undefined;
}
function flight(w: SurvivalWorld, e: Enemy) {
  const h = w.hazards.find((h) => h.id === e.hazardId);
  if (!h || !e.leapStart || !e.leapEnd) {
    recover(e, e.kind === "boss" ? 3 : 1.8);
    return;
  }
  e.timer = Math.max(0, h.due - w.time);
  const t = Math.max(0, Math.min(1, 1 - e.timer / (e.leapDuration || 1)));
  e.x = e.leapStart.x + (e.leapEnd.x - e.leapStart.x) * t;
  e.y = e.leapStart.y + (e.leapEnd.y - e.leapStart.y) * t;
  if (e.timer <= 1e-6) {
    e.x = e.leapEnd.x;
    e.y = e.leapEnd.y;
    recover(e, e.kind === "boss" ? 3 : 1.8);
  }
}
export function stepObservatoryEnemy(w: SurvivalWorld, e: Enemy, dt: number) {
  const d = distance(e, w.player);
  if (e.state === "charge") {
    flight(w, e);
    return;
  }
  if (e.state === "windup") {
    if (e.kind === "starweaver" && (d < 1.5 || !w.visible(e, 0.3))) {
      w.hazards = w.hazards.filter((h) => h.source !== e.id || h.fired);
      recover(e, 1.5);
      return;
    }
    e.timer -= dt;
    if (e.timer <= 1e-6) {
      if (e.kind === "starpuppet") {
        e.state = "charge";
        e.timer = e.leapDuration || 0.35;
        flight(w, e);
      } else recover(e, 1.5);
    }
    return;
  }
  if (e.state === "recover") {
    e.timer -= dt;
    if (e.timer <= 0) {
      e.state = "seek";
      e.attack = e.kind === "starweaver" ? 6 : 3;
    }
    return;
  }
  const target =
    e.starTarget && (e.starUntil || 0) > w.time ? e.starTarget : w.player;
  e.facing = Math.atan2(w.player.y - e.y, w.player.x - e.x);
  e.attack -= dt;
  if (d > (e.kind === "starweaver" ? 6 : 0.6) && distance(e, target) > 0.15) {
    const a = observatoryHeading(e, target),
      s = ENEMIES[e.kind].speed * (e.slowUntil > w.time ? 1 - e.slow : 1);
    e.x += Math.cos(a) * s * dt;
    e.y += Math.sin(a) * s * dt;
  }
  if (d < 0.65) w.hurt(8, e.kind);
  if (
    e.kind === "starpatrol" ||
    e.attack > 0 ||
    e.visibleSince < 0 ||
    w.time - e.visibleSince < 1 ||
    !w.visible(e, 0.3)
  )
    return;
  if (e.kind === "starweaver") {
    const status = castStarTrace(w, e);
    if (status !== "cast") e.attack = status === "empty" ? 1 : 0.35;
  } else if (!castStarLeap(w, e)) e.attack = 0.35;
}
export function stepObservatoryBoss(w: SurvivalWorld, e: Enemy, dt: number) {
  if (e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
    e.bossPhase = 2;
    e.state = "windup";
    e.bossAction = "transition";
    e.timer = 1.5;
    e.pattern = 0;
    e.starRetry = 0;
    e.leapEnd = undefined;
    e.leapStart = undefined;
    w.hazards = [];
    w.starPath.clear();
    w.effects.push({ type: "bossPhase", ...e, value: 2 });
    resolveObservatory(e, 0.65);
    return;
  }
  if (e.state === "charge") {
    flight(w, e);
    return;
  }
  if (e.state === "windup") {
    e.timer -= dt;
    if (e.timer <= 1e-6) {
      if (e.bossAction === "starLeap") {
        e.state = "charge";
        e.timer = e.leapDuration || 0.45;
        flight(w, e);
      } else recover(e, e.bossAction === "transition" ? 1.5 : 2.6);
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
  const d = distance(e, w.player);
  e.attack -= dt;
  e.facing = Math.atan2(w.player.y - e.y, w.player.x - e.x);
  if (d > 0.85) {
    const a = observatoryHeading(e, w.player),
      s =
        (e.bossPhase === 2 ? 1.85 : 1.7) *
        (e.slowUntil > w.time ? 1 - e.slow : 1);
    e.x += Math.cos(a) * s * dt;
    e.y += Math.sin(a) * s * dt;
  }
  if (d < 1) w.hurt(18, "boss", false);
  if (e.visibleSince < 0 || w.time - e.visibleSince < 1 || !w.visible(e, 0.3))
    return;
  if (e.attack > 0) {
    if ((e.starRetry || 0) > 0) e.starRetry! += dt;
    return;
  }
  const action = e.pattern % 3;
  const status =
    action === 0
      ? castStarTrace(w, e, e.bossPhase === 2 ? 2 : 1)
      : action === 1
        ? castStarBlade(w, e)
          ? "cast"
          : "blocked"
        : castStarLeap(w, e)
          ? "cast"
          : "blocked";
  if (status === "cast") {
    e.pattern++;
    e.starRetry = 0;
    return;
  }
  e.starRetry = (e.starRetry || 0) + dt;
  if (status === "empty" || e.starRetry >= 2) {
    e.pattern++;
    e.starRetry = 0;
    recover(e, 1.5);
  } else e.attack = 0.35;
}
