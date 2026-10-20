import { stageRecoveryFactor } from "./StagePressure";
import {ELITE_TIMES,eliteQuiet,RETURN_ELITE_HEALTH} from "./EncounterPacing";
import type { SurvivalWorld } from "./SurvivalWorld";
import { Kind, ENEMIES, isElite } from "./SurvivalConfig";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import { bellMap } from "./BellMap";
import { bellEscape, bellHit } from "./BellGeometry";
export const BELL_KINDS: readonly Kind[] = [
  "waxbearer",
  "bellacolyte",
  "waxscribe",
  "waxcrawler",
  "twinbell",
  "waxporter",
];
export const bellEnemy = (k: Kind) => BELL_KINDS.includes(k);
export interface BellState {
  action: "A" | "B" | "C" | "single" | "charge" | "transition";
  step: number;
  next: number;
  recover: number;
  reserved: number;
  vulnerable: boolean;
}
export class BellSystem {
  private wave = 0;
  private special = 0;
  private spawned = [false, false, false];
  private boss = false;
  private rest = 0;
  private horde = 0;
  private reservations = new Map<number, number>();
  readonly stats = { waves: 0, wax: 0, charges: 0, rejected: 0, boss: 0 };
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
      if (distance(p, w.player) > 4 && !bellMap.blocked(p, 0.7)) return p;
    }
    return undefined;
  }
  private spawn(kind: Kind, angle: number, reinforcement = false) {
    const w = this.w,
      c = ENEMIES[kind];
    if (
      w.enemies.filter((e) => e.hp > 0 && e.kind === kind).length >= c.cap ||
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
    e.timer = 1;
    e.bossReinforcement = reinforcement;
    if (kind === "boss") e.timer = 2;
    return e;
  }
  director(dt: number) {
    const w = this.w,
      t = w.time;
    this.wave -= dt;
    this.special -= dt;
    const elite = w.enemies.some((e) => e.hp > 0 && isElite(e.kind));
    if (t >= 360 && !this.boss) {
      this.boss = true;
      this.spawn("boss", Math.atan2(-w.player.y, -w.player.x));
      w.effects.push({ type: "boss", ...w.player });
      this.horde = t + 3;
    }
    if (this.boss) {
      const b = w.enemies.find((e) => e.hp > 0 && e.kind === "boss");
      if (
        b &&
        t >= this.horde &&
        !elite &&
        t >= this.rest &&
        b.state !== "recover" &&
        b.bell?.action !== "transition" &&
        (t - 360) % 14 < 9
      ) {
        const n = w.enemies.filter(
          (e) => e.hp > 0 && e.kind === "waxbearer",
        ).length;
        for (let i = 0; i < Math.min(8, 32 - n); i++)
          this.spawn("waxbearer", (i * Math.PI) / 4 + w.random() * 0.3, true);
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
        const e=this.spawn(i === 1 ? "waxporter" : "twinbell",w.random()*Math.PI*2);
        if(e){if(i===2)e.hp=e.maxHp=e.hp*RETURN_ELITE_HEALTH;this.spawned[i]=true;this.special=6;}
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
          "waxbearer",
          (i >= n / 2 ? Math.PI : 0) + i * 0.15 + w.random() * 0.3,
        );
      this.wave = quiet ? 4 : 2.8;
    }
    if (quiet || elite || t < this.rest || this.special > 0 || t < 30) return;
    const kinds: Kind[] =
      t < 60
        ? ["bellacolyte"]
        : t < 90
          ? ["waxscribe"]
          : t < 120
            ? ["waxcrawler"]
            : t < 175
              ? ["bellacolyte", "waxscribe"]
              : t < 230
                ? ["waxscribe", "waxcrawler"]
                : t < 305
                  ? ["bellacolyte", "waxcrawler"]
                  : ["bellacolyte", "waxscribe"];
    this.spawn(
      kinds[Math.floor(t / 5) % kinds.length],
      w.random() * Math.PI * 2,
    );
    this.special = t < 120 ? 6 : 5;
  }
  clean() {
    const w = this.w;
    for (const h of w.hazards)
      if (h.bell) {
        const e = w.enemies.find((e) => e.id === h.source && e.hp > 0);
        if (!h.fired && !e) h.until = w.time;
      }
    this.reservations.forEach((_, id) => {
      if (!w.enemies.some((e) => e.id === id && e.hp > 0))
        this.reservations.delete(id);
    });
  }
  onDeath(e: Enemy) {
    this.reservations.delete(e.id);
    for (const h of this.w.hazards)
      if (h.source === e.id && h.bell && (!h.fired || h.bell.shape === "dash"))
        h.until = this.w.time;
    if (isElite(e.kind)) this.rest = this.w.time + 6;
  }
  private move(e: Enemy, dt: number, speed = ENEMIES[e.kind].speed) {
    const w = this.w,
      a = bellMap.heading(e, w.player),
      rate = e.slowUntil > w.time ? 1 - e.slow : 1;
    e.facing = a;
    e.x += Math.cos(a) * speed * rate * dt;
    e.y += Math.sin(a) * speed * rate * dt;
    bellMap.resolve(e, e.kind === "boss" ? 0.65 : 0.35);
  }
  private recover(e: Enemy, duration: number) {
    e.state = "recover";
    e.timer = duration * stageRecoveryFactor(this.w.stageId);
    e.bell!.vulnerable = true;
    e.bell!.reserved = 0;
    e.bell!.step = 0;
    this.reservations.delete(e.id);
  }
  private reserve(e: Enemy, count: number) {
    if (this.slots + count > 2) return false;
    this.reservations.set(e.id, count);
    return true;
  }
  private publish(e: Enemy, shape: "wave" | "wax" | "dash", order: number) {
    const w = this.w,
      b = e.bell!,
      boss = e.kind === "boss",
      elite = isElite(e.kind),
      big = boss || elite;
    const delay =
      shape === "wax"
        ? boss
          ? 1.3
          : 1.25
        : shape === "dash"
          ? 1.35
          : boss
            ? 1.4
            : elite
              ? 1.3
              : 1.2;
    const radius =
      shape === "wax"
        ? boss
          ? 1.6
          : elite
            ? 1.5
            : 1.25
        : shape === "dash"
          ? e.kind === "waxcrawler"
            ? 3
            : 5
          : boss
            ? 8
            : elite
              ? 7
              : 6;
    let p = shape === "wax" ? { ...w.player } : { x: e.x, y: e.y };
    if (shape === "wax" && b.action === "C") {
      const side = order === 1 ? -1 : 1;
      p = {
        x:
          e.x +
          Math.cos(e.facing + Math.PI / 2) * 3 * side +
          Math.cos(e.facing) * 3,
        y:
          e.y +
          Math.sin(e.facing + Math.PI / 2) * 3 * side +
          Math.sin(e.facing) * 3,
      };
    }
    if (
      Math.abs(p.x) > 21 ||
      Math.abs(p.y) > 25 ||
      bellMap.blocked(p, shape === "wax" ? 0.2 : 0.1)
    )
      return false;
    const angle = Math.atan2(w.player.y - e.y, w.player.x - e.x),
      end = {
        x: e.x + Math.cos(angle) * radius,
        y: e.y + Math.sin(angle) * radius,
      };
    if (shape === "dash") {
      for (let d = 0; d <= radius; d += 0.1) {
        const q = {
          x: e.x + Math.cos(angle) * d,
          y: e.y + Math.sin(angle) * d,
        };
        if (
          bellMap.blocked(q, 0.65) ||
          Math.abs(q.x) > 21 ||
          Math.abs(q.y) > 25
        ) {
          end.x = e.x + Math.cos(angle) * Math.max(0, d - 0.1);
          end.y = e.y + Math.sin(angle) * Math.max(0, d - 0.1);
          break;
        }
      }
    }
    const speed = shape === "dash" ? (e.kind === "waxcrawler" ? 5.5 : 3) : 6,
      duration =
        shape === "wax"
          ? 0.18
          : shape === "dash"
            ? Math.max(0.05, distance(e, end) / speed)
            : radius / speed + 0.08;
    const h: Hazard = {
      id: w.id(),
      source: e.id,
      kind: shape === "wax" ? "circle" : shape === "wave" ? "bellRing" : "line",
      ...p,
      created: w.time,
      due: w.time + delay,
      until: w.time + delay + duration,
      radius,
      width:
        shape === "wave"
          ? 0.25
          : shape === "dash"
            ? e.kind === "waxcrawler"
              ? 0.325
              : 0.65
            : 0,
      widthAngle:
        ((boss ? (b.action === "B" ? 100 : 120) : elite ? 120 : 90) * Math.PI) /
        180,
      angle,
      damage: boss
        ? shape === "wax"
          ? 24
          : 26
        : elite
          ? 24
          : shape === "wave"
            ? 20
            : 18,
      fixedDamage: true,
      damageLabel:
        shape === "wave"
          ? "钟庭声浪"
          : shape === "wax"
            ? "钟庭蜡印"
            : "拖钟扑击",
      fired: false,
      next: 0,
      bell: {
        shape,
        order,
        hit: false,
        last: w.time + delay,
        from: { x: e.x, y: e.y },
        to: end,
        speed,
      },
    };
    if (!w.visible(p, -0.1) || !bellEscape(w, [h])) {
      this.stats.rejected++;
      return false;
    }
    w.hazards.push(h);
    e.state = "windup";
    e.timer = delay;
    e.lockedAngle = angle;
    b.next =
      h.until +
      (shape === "wave"
        ? b.action === "B"
          ? 0.6
          : 0.4
        : shape === "dash"
          ? 0.5
          : 0.45);
    b.step = order;
    if (shape === "wave") this.stats.waves++;
    else if (shape === "wax") this.stats.wax++;
    else this.stats.charges++;
    return true;
  }
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w;
    if (!e.bell)
      e.bell = {
        action: "single",
        step: 0,
        next: 0,
        recover: 2,
        reserved: 0,
        vulnerable: false,
      };
    const b = e.bell;
    if (e.freezeUntil > w.time) {
      b.next += dt;
      for (const h of w.hazards)
        if (
          h.bell &&
          h.source === e.id &&
          (!h.fired || h.bell.shape === "dash")
        ) {
          h.created += dt;
          h.due += dt;
          h.until += dt;
          h.bell.last += dt;
        }
      return;
    }
    if (e.kind === "boss" && e.hp / e.maxHp <= 0.5 && e.bossPhase === 1) {
      e.bossPhase = 2;
      b.action = "transition";
      b.next = w.time + 1.5;
      e.state = "windup";
      this.reservations.delete(e.id);
      for (const h of w.hazards)
        if (h.source === e.id && !h.fired) h.until = w.time;
      w.effects.push({ type: "bossPhase", ...e });
      return;
    }
    if (b.action === "transition") {
      if (w.time >= b.next) {
        b.action = "single";
        this.recover(e, 1);
      }
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "seek";
        b.vulnerable = false;
        e.attack = 2.5;
      }
      return;
    }
    if (b.step > 0) {
      const live = w.hazards.some((h) => h.source === e.id && h.until > w.time);
      if (w.time < b.next || live) return;
      const two = e.kind === "boss" || isElite(e.kind);
      if (two && b.step === 1) {
        const shape =
          b.action === "B" ? "wave" : e.kind === "waxporter" ? "wave" : "wax";
        if (!this.publish(e, shape, 2)) this.recover(e, b.recover);
      } else this.recover(e, b.recover);
      return;
    }
    if (e.kind === "waxbearer") {
      if (distance(e, w.player) > 0.6) this.move(e, dt);
      if (distance(e, w.player) < 0.65) w.hurt(12, "waxbearer", false);
      return;
    }
    if (
      e.kind === "boss" &&
      w.enemies.some((o) => o.hp > 0 && isElite(o.kind))
    ) {
      this.rest = w.time + 3;
      return;
    }
    if (e.kind === "boss" && w.time < this.rest) return;
    const d = distance(e, w.player);
    if (d > (e.kind === "waxcrawler" ? 4 : 6) || !w.visible(e, 1)) {
      this.move(e, dt, e.kind === "boss" ? 1.45 : ENEMIES[e.kind].speed);
      return;
    }
    e.attack -= dt;
    if (e.attack > 0) {
      if (d > 2.5) this.move(e, dt);
      if (d < 0.65)
        w.hurt(e.kind === "boss" ? 22 : ENEMIES[e.kind].contact, e.kind, false);
      return;
    }
    const big = e.kind === "boss" || isElite(e.kind),
      slots = big ? 2 : 1;
    if (!this.reserve(e, slots)) {
      e.attack = 0.25;
      return;
    }
    b.step = 0;
    b.vulnerable = false;
    b.reserved = slots;
    b.recover = big
      ? b.action === "C"
        ? 3.4
        : 3.2
      : e.kind === "waxcrawler"
        ? 2
        : 1.8;
    if (e.kind === "boss") {
      const order = e.bossPhase === 1 ? ["A", "C", "B"] : ["B", "A", "C"];
      b.action = order[e.pattern++ % 3] as "A" | "B" | "C";
      this.stats.boss++;
    } else b.action = e.kind === "waxporter" ? "charge" : "single";
    if (e.kind === "boss" && b.action === "C") b.recover = 3.4;
    const shape =
      b.action === "C" || e.kind === "waxscribe"
        ? "wax"
        : e.kind === "waxcrawler" || e.kind === "waxporter"
          ? "dash"
          : "wave";
    if (!this.publish(e, shape, 1)) this.recover(e, b.recover);
  }
  stepHazard(h: Hazard) {
    const w = this.w,
      b = h.bell!;
    if (w.time < h.due) return;
    const owner = w.enemies.find((e) => e.id === h.source && e.hp > 0);
    if (!h.fired && (!owner || owner.freezeUntil > w.time)) return;
    h.fired = true;
    if (b.shape === "dash" && owner) {
      const q = Math.min(
        distance(b.from, b.to),
        Math.max(0, w.time - h.due) * b.speed,
      );
      owner.x = b.from.x + Math.cos(h.angle) * q;
      owner.y = b.from.y + Math.sin(h.angle) * q;
      bellMap.resolve(owner, 0.65);
      owner.state = "charge";
    }
    if (!b.hit && bellHit(h, w.player, Math.min(w.time, h.until), b.last)) {
      b.hit = true;
      w.hurt(h.damage, h.damageLabel!, false);
    }
    b.last = w.time;
  }
}
