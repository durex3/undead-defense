import { stageRecoveryFactor } from "./StagePressure";
import {ELITE_TIMES,eliteQuiet,RETURN_ELITE_HEALTH} from "./EncounterPacing";
import type { SurvivalWorld } from "./SurvivalWorld";
import { Kind, ENEMIES, isElite } from "./SurvivalConfig";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import { tideMap, tideStop } from "./TideMap";
import { tideStrips, tideEscape, tideHit } from "./TideGeometry";
export const TIDE_KINDS: readonly Kind[] = [
  "brineporter",
  "sluiceray",
  "sailharpooner",
  "winchbeast",
  "twinlockwarden",
  "severedcrane",
];
export const tideEnemy = (kind: Kind) => TIDE_KINDS.includes(kind);
export interface TideState {
  action:
    | "wave"
    | "fork"
    | "hook"
    | "twin"
    | "crane"
    | "A"
    | "B"
    | "C"
    | "transition";
  step: number;
  next: number;
  recover: number;
  vulnerable: boolean;
  points: Point[];
  angle: number;
  blocked: boolean;
  preview?: Hazard;
  berth?: Point;
  moveAt?: number;
  moveUntil?: number;
  cancelSecond?: boolean;
}
export class TideSystem {
  private wave = 0;
  private special = 0;
  private spawned = [false, false, false];
  private boss = false;
  private horde = 0;
  private rest = 0;
  private lastStart = -Infinity;
  private reservations = new Map<number, number>();
  readonly stats = {
    waves: 0,
    forks: 0,
    hooks: 0,
    boss: 0,
    rejected: 0,
    berths: 0,
    cancelledBerths: 0,
  };
  constructor(private w: SurvivalWorld) {}
  get slots() {
    const w = this.w;
    let n = w.hazards.filter((h) => h.until > w.time).length;
    this.reservations.forEach((r, id) => {
      n += Math.max(
        0,
        r - w.hazards.filter((h) => h.source === id && h.until > w.time).length,
      );
    });
    return n;
  }
  position(angle: number, r = 9): Point | undefined {
    const w = this.w;
    for (let i = 0; i < 24; i++) {
      const a = angle + (i * Math.PI) / 12,
        p = {
          x: Math.max(-21, Math.min(21, w.player.x + Math.cos(a) * r)),
          y: Math.max(-25, Math.min(25, w.player.y + Math.sin(a) * r)),
        };
      if (distance(p, w.player) > 4 && !tideMap.blocked(p, 0.8)) return p;
    }
  }
  private spawn(kind: Kind, angle: number, reinforcement = false) {
    const w = this.w,
      c = ENEMIES[kind];
    if (
      w.enemies.filter((e) => e.hp > 0 && e.kind === kind).length >=
        Math.min(c.cap, w.time < 120 && kind !== "brineporter" ? 1 : c.cap) ||
      w.enemies.reduce(
        (n, e) => n + (e.hp > 0 ? ENEMIES[e.kind].threat : 0),
        0,
      ) +
        c.threat >
        6
    )
      return;
    const p = this.position(angle);
    if (!p) return;
    const e = w.addEnemy(kind, p.x, p.y, reinforcement);
    if (!e) return;
    e.state = "arriving";
    e.timer = kind === "boss" ? 2 : 1;
    e.bossReinforcement = reinforcement;
    return e;
  }
  director(dt: number) {
    const w = this.w,
      t = w.time;
    this.wave -= dt;
    this.special -= dt;
    const elite = w.enemies.some((e) => e.hp > 0 && isElite(e.kind));
    if (t >= 360 && !this.boss) {
      const e = this.spawn("boss", Math.atan2(-w.player.y, -w.player.x));
      if (e) {
        this.boss = true;
        this.horde = t + 3;
        w.effects.push({ type: "boss", ...e });
      }
    }
    if (this.boss) {
      const e = w.enemies.find((e) => e.hp > 0 && e.kind === "boss");
      if (
        e &&
        t >= this.horde &&
        !elite &&
        t >= this.rest &&
        e.state !== "recover" &&
        e.tide?.action !== "transition" &&
        (t - 360) % 14 < 9
      ) {
        const n = w.enemies.filter(
          (e) => e.hp > 0 && e.kind === "brineporter",
        ).length;
        for (let i = 0; i < Math.min(8, 32 - n); i++)
          this.spawn("brineporter", (i * Math.PI) / 4 + w.random() * 0.3, true);
        this.horde = t + 2.5;
      }
      return;
    }
    for (let i = 0; i < 3; i++)
      if (
        !this.spawned[i] &&
        t >= ELITE_TIMES[i] &&
        t < 340 &&
        !elite &&
        t >= this.rest
      ) {
        const e = this.spawn(
          i === 1 ? "severedcrane" : "twinlockwarden",
          w.random() * Math.PI * 2,
        );
        if (e) {
          if(i===2)e.hp=e.maxHp=e.hp*RETURN_ELITE_HEALTH;
          this.spawned[i] = true;
          this.special = 6;
          w.effects.push({ type: "elite", ...e });
        }
        break;
      }
    const quiet =
      eliteQuiet(t) || t >= 350 ||
      (t >= 130 && t < 135) ||
      (t >= 220 && t < 230) ||
      (t >= 255 && t < 265);
    if (this.wave <= 0) {
      const n = quiet ? 3 : Math.min(16, 6 + Math.floor(t / 40));
      for (let i = 0; i < n; i++)
        this.spawn(
          "brineporter",
          (i >= n / 2 ? Math.PI : 0) + i * 0.15 + w.random() * 0.3,
        );
      this.wave = quiet ? 4 : 2.8;
    }
    if (quiet || elite || t < this.rest || this.special > 0 || t < 30) return;
    const kinds: Kind[] =
      t < 65
        ? ["sluiceray"]
        : t < 95
          ? ["sailharpooner"]
          : t < 120
            ? ["winchbeast"]
            : t < 175
              ? ["sluiceray", "sailharpooner"]
              : t < 220
                ? Math.floor(t / 15) % 2
                  ? ["sluiceray", "sailharpooner"]
                  : ["sailharpooner", "winchbeast"]
                : t < 305
                  ? ["sluiceray", "sailharpooner"]
                  : Math.floor(t / 15) % 2
                    ? ["sluiceray", "sailharpooner"]
                    : ["sluiceray", "winchbeast"];
    // A surviving previous teaching type cannot introduce a simultaneous new lesson.
    if (
      t < 120 &&
      w.enemies.some(
        (e) =>
          e.hp > 0 &&
          TIDE_KINDS.includes(e.kind) &&
          e.kind !== "brineporter" &&
          !kinds.includes(e.kind),
      )
    )
      return;
    this.spawn(
      kinds[Math.floor(t / 5) % kinds.length],
      w.random() * Math.PI * 2,
    );
    this.special = t < 120 ? 6 : 5;
  }
  clean() {
    const w = this.w;
    for (const h of w.hazards)
      if (h.tide) {
        const owner = w.enemies.find((e) => e.hp > 0 && e.id === h.source);
        if (!owner && (!h.fired || h.tide.shape === "hook")) h.until = w.time;
      }
    this.reservations.forEach((_, id) => {
      if (!w.enemies.some((e) => e.id === id && e.hp > 0))
        this.reservations.delete(id);
    });
  }
  onDeath(e: Enemy) {
    this.reservations.delete(e.id);
    if (e.tide) e.tide.preview = undefined;
    for (const h of this.w.hazards)
      if (h.source === e.id && h.tide && (!h.fired || h.tide.shape === "hook"))
        h.until = this.w.time;
    if (isElite(e.kind)) this.rest = this.w.time + (this.w.time >= 360 ? 3 : 6);
  }
  private reserve(e: Enemy, n: number) {
    if (this.slots + n > 2) return false;
    this.reservations.set(e.id, n);
    return true;
  }
  private recover(e: Enemy, seconds = e.tide!.recover) {
    const s = e.tide!;
    e.state = "recover";
    e.timer = seconds * stageRecoveryFactor(this.w.stageId);
    s.step = 0;
    s.vulnerable = true;
    s.preview = undefined;
    s.berth = undefined;
    s.moveAt = undefined;
    this.reservations.delete(e.id);
  }
  private move(e: Enemy, target: Point, dt: number, speed: number) {
    const d = distance(e, target);
    if (d < 0.05) return;
    const angle = tideMap.heading(e, target),
      delta = Math.min(
        d,
        speed * dt * (e.slowUntil > this.w.time ? 1 - e.slow : 1),
      );
    e.facing = angle;
    e.x += Math.cos(angle) * delta;
    e.y += Math.sin(angle) * delta;
    tideMap.resolve(e, e.kind === "boss" ? 0.7 : 0.35);
  }
  private state(e: Enemy): TideState {
    return (
      e.tide ??
      (e.tide = {
        action: "wave",
        step: 0,
        next: 0,
        recover: 2,
        vulnerable: false,
        points: [],
        angle: 0,
        blocked: false,
      })
    );
  }
  private visible(h: Hazard) {
    const w = this.w,
      b = h.tide!;
    if (b.shape === "tide") {
      const nx = -Math.sin(h.angle),
        ny = Math.cos(h.angle),
        dx = Math.cos(h.angle),
        dy = Math.sin(h.angle);
      const step = (b.halfSpan * 2) / b.stops.length;
      for (let i = 0; i < b.stops.length; i++) {
        if (b.stops[i] <= 0) continue;
        for (const side of [
          -b.halfSpan + i * step,
          -b.halfSpan + (i + 1) * step,
        ])
          for (const d of [0, b.stops[i]])
            if (
              !w.visible(
                { x: h.x + nx * side + dx * d, y: h.y + ny * side + dy * d },
                0.3,
              )
            )
              return false;
      }
    } else if (
      !w.visible(b.from, Math.max(0.6, h.width + 0.1)) ||
      !w.visible(b.to, Math.max(0.6, h.width + 0.1))
    )
      return false;
    return true;
  }
  private waveHazard(
    e: Enemy,
    angle: number,
    order: number,
    at = this.w.time,
  ): Hazard {
    const w = this.w,
      boss = e.kind === "boss",
      elite = isElite(e.kind),
      s = this.state(e),
      width = boss ? (s.action === "C" ? 8 : 7) : elite ? 6.4 : 5.6,
      speed = boss ? (s.action === "C" ? 2.3 : 2.4) : 2.2,
      travel = (elite && !boss) || s.action === "C" ? 7 : 8,
      delay = boss ? (s.action === "C" ? 1.5 : 1.4) : elite ? 1.4 : 1.35;
    const from = {
      x: w.player.x - Math.cos(angle) * 3,
      y: w.player.y - Math.sin(angle) * 3,
    };
    const stops = tideStrips(from, angle, width / 2, travel);
    return {
      id: w.id(),
      source: e.id,
      kind: "bellRing",
      ...from,
      created: at,
      due: at + delay,
      until: at + delay + travel / speed,
      angle,
      radius: travel,
      width: boss || elite ? 0.6 : 0.55,
      damage: boss ? (s.action === "C" ? 28 : 26) : elite ? 24 : 20,
      damageLabel: "船坞潮墙",
      fixedDamage: true,
      fired: false,
      next: 0,
      tide: {
        shape: "tide",
        order,
        speed,
        halfSpan: width / 2,
        stops,
        hit: false,
        last: at + delay,
        from,
        to: {
          x: from.x + Math.cos(angle) * travel,
          y: from.y + Math.sin(angle) * travel,
        },
        chainFrom: { x: e.x, y: e.y },
        stopped: false,
        player: { ...w.player },
      },
    };
  }
  private forkHazard(e: Enemy, order: number): Hazard {
    const w = this.w,
      boss = e.kind === "boss",
      elite = isElite(e.kind),
      angle = Math.atan2(w.player.y - e.y, w.player.x - e.x),
      speed = boss ? 6.5 : 6,
      range = boss ? 8 : 7,
      delay = boss || elite ? 1.25 : 1.2,
      from = { x: e.x, y: e.y };
    return {
      id: w.id(),
      source: e.id,
      kind: "arrow",
      ...from,
      created: w.time,
      due: w.time + delay,
      until: w.time + delay + range / speed,
      angle,
      radius: range,
      width: boss ? 0.3 : 0.22,
      damage: boss ? 24 : elite ? 22 : 20,
      damageLabel: "船坞飞叉",
      fixedDamage: true,
      fired: false,
      next: 0,
      tide: {
        shape: "fork",
        order,
        speed,
        halfSpan: 0,
        stops: [],
        hit: false,
        last: w.time + delay,
        from,
        to: {
          x: e.x + Math.cos(angle) * range,
          y: e.y + Math.sin(angle) * range,
        },
        chainFrom: { ...from },
        stopped: false,
        player: { ...w.player },
      },
    };
  }
  private hookPlan(e: Enemy) {
    const w = this.w,
      s = this.state(e),
      d = e.kind === "boss" ? 4 : isElite(e.kind) ? 3.5 : 3,
      angle = Math.atan2(w.player.y - e.y, w.player.x - e.x),
      side = e.pattern % 2 ? 1 : -1,
      dx = Math.cos(angle),
      dy = Math.sin(angle),
      nx = -dy * side,
      ny = dx * side;
    s.points = [
      { x: w.player.x - dx * 2 + nx * 2.8, y: w.player.y - dy * 2 + ny * 2.8 },
    ];
    s.points.push({ x: s.points[0].x + dx * d, y: s.points[0].y + dy * d });
    s.points.push({ x: s.points[1].x - nx * d, y: s.points[1].y - ny * d });
    return (
      distance(s.points[0], w.player) >= 2.5 &&
      !tideMap.blocked(s.points[0], 0.75) &&
      s.points.every((p) => Math.abs(p.x) <= 21 && Math.abs(p.y) <= 25)
    );
  }
  private hookHazard(e: Enemy, order: number): Hazard {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss",
      elite = isElite(e.kind),
      from = { ...s.points[order - 1] },
      desired = s.points[order],
      angle = Math.atan2(desired.y - from.y, desired.x - from.x),
      radius = boss ? 0.7 : elite ? 0.65 : 0.5,
      speed = boss || elite ? 2.8 : 2.6,
      delay =
        order === 1
          ? boss
            ? 1.35
            : elite
              ? 1.3
              : 1.25
          : boss || elite
            ? 1.2
            : 1.1,
      full = distance(from, desired),
      length = tideStop(from, angle, full, radius);
    s.blocked = length < full - 0.01;
    return {
      id: w.id(),
      source: e.id,
      kind: "line",
      ...from,
      created: w.time,
      due: w.time + delay,
      until: w.time + delay + Math.max(0.05, length / speed),
      angle,
      radius: length,
      width: radius,
      damage: boss ? 26 : elite ? 24 : 20,
      damageLabel: "船坞拖锚",
      fixedDamage: true,
      fired: false,
      next: 0,
      tide: {
        shape: "hook",
        order,
        speed,
        halfSpan: 0,
        stops: [],
        hit: false,
        last: w.time + delay,
        from,
        to: {
          x: from.x + Math.cos(angle) * length,
          y: from.y + Math.sin(angle) * length,
        },
        chainFrom: { x: e.x, y: e.y },
        stopped: s.blocked,
        player: { ...w.player },
      },
    };
  }
  private publish(e: Enemy, h: Hazard, extra: Hazard[] = []) {
    const w = this.w,
      s = this.state(e);
    if (
      !this.visible(h) ||
      extra.some((x) => !this.visible(x)) ||
      (h.tide!.shape === "tide" && h.tide!.stops.every((x) => x <= 0)) ||
      !tideEscape(w, [h, ...extra])
    ) {
      this.stats.rejected++;
      return false;
    }
    w.hazards.push(h);
    e.state = "windup";
    e.timer = h.due - w.time;
    e.lockedAngle = h.angle;
    s.step = h.tide!.order;
    s.next =
      h.until +
      (h.tide!.shape === "hook"
        ? e.kind === "winchbeast"
          ? 0.35
          : 0.4
        : s.action === "C"
          ? 0.6
          : s.action === "twin"
            ? 0.5
            : s.action === "fork"
              ? 0.35
              : 0.45);
    this.stats[
      h.tide!.shape === "tide"
        ? "waves"
        : h.tide!.shape === "fork"
          ? "forks"
          : "hooks"
    ]++;
    return true;
  }
  private begin(e: Enemy) {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss",
      elite = isElite(e.kind);
    const n = boss
      ? s.action === "B"
        ? 1
        : 2
      : e.kind === "twinlockwarden" || e.kind === "severedcrane"
        ? 2
        : 1;
    if (!this.reserve(e, n)) {
      e.attack = 0.3;
      return;
    }
    s.vulnerable = false;
    s.blocked = false;
    s.preview = undefined;
    s.cancelSecond = false;
    s.berth = undefined;
    s.moveAt = undefined;
    s.angle = Math.atan2(w.player.y - e.y, w.player.x - e.x);
    s.recover = boss
      ? s.action === "C"
        ? 3.6
        : s.action === "B"
          ? 3.2
          : 3
      : elite
        ? e.kind === "severedcrane"
          ? 3.2
          : 3
        : e.kind === "winchbeast"
          ? 2
          : 1.8;
    const hooks =
      s.action === "hook" || s.action === "crane" || s.action === "B";
    if (hooks && !this.hookPlan(e)) {
      this.stats.rejected++;
      this.recover(e);
      return;
    }
    let h: Hazard;
    if (hooks) h = this.hookHazard(e, 1);
    else if (s.action === "fork") h = this.forkHazard(e, 1);
    else h = this.waveHazard(e, s.angle, 1);
    if (boss && s.action === "C") {
      const next = this.waveHazard(e, s.angle + Math.PI / 2, 2, h.until + 0.6);
      next.tide!.preview = true;
      s.preview = next;
      if (e.bossPhase === 2) {
        const berth = {
          x: e.x - Math.sin(s.angle) * 4,
          y: e.y + Math.cos(s.angle) * 4,
        };
        if (
          !w.visible(berth, 1.1) ||
          Math.abs(berth.x) > 21 ||
          Math.abs(berth.y) > 25 ||
          tideMap.blocked(berth, 0.7) ||
          tideMap.segment(e, berth, 0.7)
        ) {
          s.cancelSecond = true;
          s.preview = undefined;
          this.stats.cancelledBerths++;
        } else {
          s.berth = berth;
          s.moveAt = h.due;
          s.moveUntil = h.until + 0.6;
        }
      }
    }
    if (!this.publish(e, h, s.preview ? [s.preview] : [])) {
      // A rejected ultimate never silently discards its announced second wave.
      this.recover(e);
    }
  }
  private advance(e: Enemy) {
    const w = this.w,
      s = this.state(e);
    let next: Hazard | undefined;
    if (s.action === "fork" && s.step === 1) next = this.forkHazard(e, 2);
    else if (
      (s.action === "hook" || s.action === "B" || s.action === "crane") &&
      s.step === 1 &&
      !s.blocked
    )
      next = this.hookHazard(e, 2);
    else if (s.action === "crane" && s.step < 3) next = this.forkHazard(e, 3);
    else if (s.action === "twin" && s.step === 1)
      next = this.waveHazard(e, s.angle + Math.PI / 2, 2);
    else if (s.action === "A" && s.step === 1) next = this.forkHazard(e, 2);
    else if (s.action === "C" && s.step === 1 && s.preview && !s.cancelSecond) {
      if (s.berth && distance(e, s.berth) > 0.12) {
        this.stats.cancelledBerths++;
        this.recover(e);
        return;
      }
      next = s.preview;
      next.tide!.preview = false;
      const delay = 1.5;
      next.created = w.time;
      next.due = w.time + delay;
      next.until = next.due + next.radius / next.tide!.speed;
      next.tide!.last = next.due;
      next.tide!.player = { ...w.player };
      s.preview = undefined;
    }
    if (next) {
      if (!this.publish(e, next)) this.recover(e);
    } else this.recover(e);
  }
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss";
    if (e.freezeUntil > w.time) {
      s.next += dt;
      if (s.moveAt !== undefined) s.moveAt += dt;
      if (s.moveUntil !== undefined) s.moveUntil += dt;
      for (const h of w.hazards)
        if (
          h.tide &&
          h.source === e.id &&
          (!h.fired || h.tide.shape === "hook")
        ) {
          h.created += dt;
          h.due += dt;
          h.until += dt;
          h.tide.last += dt;
        }
      if (s.preview) {
        s.preview.created += dt;
        s.preview.due += dt;
        s.preview.until += dt;
        s.preview.tide!.last += dt;
      }
      return;
    }
    if (boss && e.hp / e.maxHp <= 0.55 && e.bossPhase === 1) {
      e.bossPhase = 2;
      s.action = "transition";
      s.next = w.time + 1.5;
      s.step = 0;
      s.preview = undefined;
      s.berth = undefined;
      s.moveAt = undefined;
      this.reservations.delete(e.id);
      for (const h of w.hazards)
        if (h.source === e.id && (!h.fired || h.tide?.shape === "hook"))
          h.until = w.time;
      e.state = "windup";
      e.timer = 1.5;
      w.effects.push({ type: "bossPhase", ...e });
      return;
    }
    if (s.action === "transition") {
      e.timer = Math.max(0, s.next - w.time);
      if (w.time >= s.next) {
        s.action = "wave";
        e.pattern = 0;
        this.recover(e, 1);
      }
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        s.vulnerable = false;
        e.state = "seek";
        e.attack = e.kind === "sailharpooner" ? 2.5 : 3;
      }
      return;
    }
    if (s.step > 0) {
      if (s.berth && s.moveAt !== undefined && w.time >= s.moveAt) {
        this.move(e, s.berth, dt, 2);
        if (distance(e, s.berth) < 0.12 && !s.cancelSecond) {
          s.moveAt = undefined;
          this.stats.berths++;
        }
      }
      const live = w.hazards.find((h) => h.source === e.id && h.until > w.time);
      if (live) e.timer = Math.max(0, live.due - w.time);
      if (w.time >= s.next && !live) this.advance(e);
      return;
    }
    if (e.kind === "brineporter") {
      if (distance(e, w.player) > 0.6) this.move(e, w.player, dt, 1.7);
      if (distance(e, w.player) < 0.65) w.hurt(12, "brineporter", false);
      return;
    }
    if (boss && w.enemies.some((o) => o.hp > 0 && isElite(o.kind))) {
      this.rest = w.time + 3;
      return;
    }
    if (boss && w.time < this.rest) return;
    // Recovery is a real counterattack window, including for special enemies already on screen.
    if (
      !boss &&
      w.enemies.some(
        (o) => o.hp > 0 && o.kind === "boss" && o.state === "recover",
      )
    )
      return;
    if (
      !boss &&
      !isElite(e.kind) &&
      w.enemies.some((o) => o.hp > 0 && isElite(o.kind))
    )
      return;
    const d = distance(e, w.player);
    if (d > 6 || !w.visible(e, 1)) {
      this.move(e, w.player, dt, boss ? 1.4 : ENEMIES[e.kind].speed);
      return;
    }
    e.attack -= dt;
    if (e.attack > 0) {
      if (d > 3.5)
        this.move(e, w.player, dt, boss ? 1.4 : ENEMIES[e.kind].speed);
      if (d < 0.65) w.hurt(boss ? 22 : ENEMIES[e.kind].contact, e.kind, false);
      return;
    }
    if (boss) {
      s.action = (e.bossPhase === 1 ? ["A", "B", "C"] : ["C", "A", "B"])[
        e.pattern % 3
      ] as "A" | "B" | "C";
    } else
      s.action =
        e.kind === "sailharpooner"
          ? "fork"
          : e.kind === "winchbeast"
            ? "hook"
            : e.kind === "twinlockwarden"
              ? "twin"
              : e.kind === "severedcrane"
                ? "crane"
                : "wave";
    if (!boss && !isElite(e.kind) && w.time - this.lastStart < 3) {
      e.attack = 0.3;
      return;
    }
    const before = this.stats.waves + this.stats.hooks + this.stats.forks;
    this.begin(e);
    if (this.stats.waves + this.stats.hooks + this.stats.forks > before) {
      e.pattern++;
      this.lastStart = w.time;
      if (boss) this.stats.boss++;
    } else if (s.vulnerable) {
      // An illegal layout cancels this beat, never traps the pattern forever.
      e.pattern++;
    }
  }
  stepHazard(h: Hazard) {
    const w = this.w,
      b = h.tide!;
    if (w.time < h.due) {
      b.last = w.time;
      b.player = { ...w.player };
      return;
    }
    const owner = w.enemies.find((e) => e.hp > 0 && e.id === h.source);
    if (!h.fired && (!owner || owner.freezeUntil > w.time)) return;
    h.fired = true;
    if (
      !b.hit &&
      tideHit(h, w.player, Math.min(w.time, h.until), b.last, 0.3, b.player)
    ) {
      b.hit = true;
      w.hurt(h.damage, h.damageLabel!, false);
    }
    b.last = w.time;
    b.player = { ...w.player };
  }
}
