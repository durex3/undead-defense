import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, Kind, isElite } from "./SurvivalConfig";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import {
  MoonMotion,
  moonEnd,
  moonEscape,
  moonFootprint,
  moonPose,
  moonSwept,
} from "./MoonGeometry";
import { moonMap } from "./MoonMap";
import { MoonDirector } from "./MoonDirector";
import { encounterScoreTime } from "./EncounterPacing";
export const moonEnemy = (k: Kind) =>
  [
    "thornrunner",
    "crescentmantis",
    "vaultlynx",
    "antlerprowler",
    "moonreaver",
    "hornwarden",
  ].includes(k);
export function moonHint(w: SurvivalWorld) {
  const b = w.enemies.find((e) => e.kind === "boss" && e.hp > 0);
  if (b?.state === "recover") return "猎王收招 · 切入反击";
  if (b?.moon?.action === "leaps") return "离开落点 · 落地后还有扫角";
  if (b?.moon?.action === "sweeps") return "绕过角刃 · 留意反向回扫";
  return "去程之后还有回程 · 看箭头换向";
}
const mid = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
export class MoonSystem {
  private reservations = new Map<number, number>();
  private encounter: MoonDirector;
  private lastStart = -Infinity;
  private reposition = new Map<number, Point>();
  rest = 0;
  completed = 0;
  reinforce = 0;
  constructor(private w: SurvivalWorld) {
    this.encounter = new MoonDirector(w, this);
  }
  director(dt: number) {
    this.encounter.director(dt);
  }
  slots() {
    const costs = new Map(this.reservations);
    for (const h of this.w.hazards)
      if (h.moon && h.until > this.w.time)
        costs.set(
          h.source,
          Math.max(
            costs.get(h.source) || 0,
            this.w.hazards.filter(
              (o) => o.moon && o.source === h.source && o.until > this.w.time,
            ).length,
          ),
        );
    return Array.from(costs.values()).reduce((a, b) => a + b, 0);
  }
  private owner(h: Hazard) {
    return this.w.enemies.find((e) => e.id === h.source && e.hp > 0);
  }
  clean() {
    const w = this.w;
    w.hazards = w.hazards.filter(
      (h) =>
        !h.moon ||
        (h.until > w.time &&
          ((h.moon.motion.shape === "blade" && h.moon.launched) ||
            !!this.owner(h))),
    );
    for (const [id] of this.reservations) {
      const e = w.enemies.find((e) => e.id === id && e.hp > 0);
      if (!e || e.state === "recover" || e.state === "seek")
        this.reservations.delete(id);
    }
  }
  onDeath(e: Enemy) {
    this.reservations.delete(e.id);
    if (isElite(e.kind)) this.rest = Math.max(this.rest, this.w.time + 6);
    else if (
      ENEMIES[e.kind].threat &&
      !this.w.enemies.some(
        (o) => o.id !== e.id && o.hp > 0 && ENEMIES[o.kind].threat,
      )
    )
      this.rest = Math.max(this.rest, this.w.time + 3);
    this.clean();
  }
  private legal(p: Point, r = 0.65) {
    return (
      Math.abs(p.x) < 22 - r && Math.abs(p.y) < 26 - r && !moonMap.blocked(p, r)
    );
  }
  private motion(
    shape: MoonMotion["shape"],
    start: Point,
    end: Point,
    delay: number,
    out: number,
    radius: number,
    width = 0,
  ): MoonMotion {
    return {
      shape,
      start: { ...start },
      end: { ...end },
      control: mid(start, end),
      home: { ...start },
      returnControl: mid(start, end),
      due: this.w.time + delay,
      out,
      hover: 0,
      back: 0,
      radius,
      width,
      angle: 0,
      turn: 0,
    };
  }
  private hazard(e: Enemy, m: MoonMotion, damage: number, order = 1): Hazard {
    return {
      id: this.w.id(),
      source: e.id,
      kind: "circle",
      ...m.start,
      angle: m.angle,
      radius: m.radius,
      width: m.width,
      due: m.due,
      created: this.w.time,
      until: moonEnd(m),
      damage,
      fired: false,
      next: 0,
      fixedDamage: true,
      damageLabel:
        m.shape === "blade"
          ? "月刃折返"
          : m.shape === "landing"
            ? "月兽跃扑"
            : "旋转角刃",
      moon: {
        motion: m,
        launched: false,
        hits: 0,
        last: this.w.time,
        player: { ...this.w.player },
        order,
      },
    };
  }
  private safe(hs: Hazard[]) {
    // Bounds use the complete path, not only the endpoint. HUD/touch safety margins stay visible.
    if (
      !hs.every((h) =>
        moonFootprint(h.moon!.motion).every(
          (p) =>
            Math.abs(p.x) < 21.5 &&
            Math.abs(p.y) < 25.5 &&
            this.w.visible(p, 0.9),
        ),
      )
    )
      return false;
    return moonEscape(this.w, [
      ...this.w.hazards
        .filter((h) => h.moon && h.until > this.w.time)
        .map((h) => h.moon!.motion),
      ...hs.map((h) => h.moon!.motion),
    ]);
  }
  private publish(hs: Hazard[]) {
    if (!this.safe(hs)) return false;
    this.w.hazards.push(...hs);
    return true;
  }
  private recover(e: Enemy) {
    const s = e.moon;
    if (!s) return;
    e.state = "recover";
    e.timer = s.recovery;
    s.vulnerable = true;
    e.attack = s.cooldown;
    this.reservations.delete(e.id);
    if (e.kind === "boss") {
      this.completed++;
      if (this.completed % 2 === 0) this.reinforce = 1;
      this.rest = Math.max(this.rest, this.w.time + 3);
    }
  }
  private move(e: Enemy, p: Point, dt: number, speed = ENEMIES[e.kind].speed) {
    speed *= e.slowUntil > this.w.time ? 1 - e.slow : 1;
    e.facing = moonMap.heading(e, p);
    e.x += Math.cos(e.facing) * speed * dt;
    e.y += Math.sin(e.facing) * speed * dt;
    moonMap.resolve(e, e.kind === "boss" ? 0.65 : 0.35);
  }
  private blades(e: Enemy): Hazard[] {
    const boss = e.kind === "boss",
      elite = e.kind === "moonreaver",
      count = boss || elite ? 2 : 1;
    const a = Math.atan2(this.w.player.y - e.y, this.w.player.x - e.x),
      side = (e.pattern % 2 ? 1 : -1) * (boss && e.bossPhase === 2 ? -1 : 1);
    return Array.from({ length: count }, (_, i) => {
      const sign = count === 1 ? side : i ? -side : side,
        offset = count === 1 ? 0 : 0.5 * sign;
      const from = {
        x: e.x - Math.sin(a) * offset,
        y: e.y + Math.cos(a) * offset,
      };
      const d = Math.min(
        boss ? 4.8 : elite ? 5.5 : 5,
        Math.max(2, distance(from, this.w.player) + 0.4),
      );
      const aim=Math.atan2(this.w.player.y-from.y,this.w.player.x-from.x);
      const end = {
        x: Math.max(-21.45, Math.min(21.45, from.x + Math.cos(aim) * d)),
        y: Math.max(-25.45, Math.min(25.45, from.y + Math.sin(aim) * d)),
      };
      const m = this.motion(
        "blade",
        from,
        end,
        (boss ? 1.3 : elite ? 1.25 : 1.15) + i * (boss ? 1.9 : 1.75),
        boss ? 1.3 : distance(from, end) / (elite ? 4.2 : 4),
        boss ? 0.32 : elite ? 0.3 : 0.28,
      );
      m.home = {
        x: from.x - Math.sin(a) * 1.8 * sign,
        y: from.y + Math.cos(a) * 1.8 * sign,
      };
      m.returnControl = mid(end, m.home);
      m.hover = boss || elite ? 1.05 : 0.95;
      m.back = boss ? 1.3 : distance(end, m.home) / (elite ? 4.2 : 4);
      if (boss) {
        m.control.x -= Math.sin(a) * 1.3 * sign;
        m.control.y += Math.cos(a) * 1.3 * sign;
        m.returnControl.x += Math.sin(a) * 1.3 * sign;
        m.returnControl.y -= Math.cos(a) * 1.3 * sign;
      }
      return this.hazard(e, m, boss ? 26 : elite ? 22 : 20, i + 1);
    });
  }
  private sweep(e: Enemy, follow = false): Hazard {
    const boss = e.kind === "boss",
      elite = e.kind === "hornwarden",
      leap = e.moon?.action === "leaps",
      angle = Math.atan2(this.w.player.y - e.y, this.w.player.x - e.x);
    const moving = !follow && !leap && (boss || elite),
      r = boss ? (leap ? 4.2 : 4.5) : elite ? 3.8 : follow ? 2.3 : 3.4;
    const end = moving
      ? {
          x: e.x + Math.cos(angle) * (boss ? 2.8 : 2.4),
          y: e.y + Math.sin(angle) * (boss ? 2.8 : 2.4),
        }
      : { x: e.x, y: e.y };
    const delay = boss
      ? follow
        ? leap
          ? 1.2
          : 1.25
        : 1.5
      : elite
        ? follow
          ? 1.2
          : 1.4
        : follow
          ? 1.1
          : 1.25;
    const duration = moving
      ? 2
      : boss
        ? leap
          ? 1
          : 0.9
        : elite
          ? 1
          : follow
            ? 0.15
            : 0.9;
    const m = this.motion(
      e.kind === "vaultlynx" && follow ? "claw" : "sweep",
      e,
      end,
      delay,
      duration,
      r,
      boss ? 0.28 : elite ? 0.25 : 0.22,
    );
    const degrees = boss ? (leap ? 120 : follow ? 80 : 120) : 100;
    const sign =
      (e.moon?.direction ?? (e.pattern % 2 ? 1 : -1)) *
      (e.bossPhase === 2 ? -1 : 1) *
      (follow ? -1 : 1);
    m.turn = ((degrees * Math.PI) / 180) * sign;
    m.angle = angle - m.turn / 2;
    return this.hazard(
      e,
      m,
      boss ? (leap || follow ? 26 : 28) : elite ? 24 : follow ? 20 : 18,
    );
  }
  private leap(e: Enemy): Hazard | undefined {
    const end = {
      x: Math.max(-21.3, Math.min(21.3, this.w.player.x)),
      y: Math.max(-25.3, Math.min(25.3, this.w.player.y)),
    };
    if (!this.legal(end) || moonMap.segment(e, end, 0.65)) return;
    const boss = e.kind === "boss",
      m = this.motion(
        "landing",
        e,
        end,
        (boss ? 1.3 : 1.25) + 0.45,
        0.08,
        boss ? 1.1 : 0.9,
      );
    const h = this.hazard(e, m, boss ? 28 : 20);
    if (!this.publish([h])) return;
    e.moon!.jumpStart = { x: e.x, y: e.y };
    e.moon!.jumpEnd = end;
    e.moon!.jumpAt = m.due - 0.45;
    e.moon!.jumpDue = m.due;
    e.moon!.next = h.due;
    e.state = "windup";
    return h;
  }
  start(e: Enemy, action: "blades" | "leaps" | "sweeps") {
    this.clean();
    const slots =
      action === "blades"
        ? e.kind === "boss" || e.kind === "moonreaver"
          ? 2
          : 1
        : e.kind === "boss" || e.kind === "hornwarden"
          ? 2
          : 1;
    if (this.slots() + slots > 2) return false;
    const boss = e.kind === "boss";
    e.moon = {
      action,
      direction: e.pattern % 2 ? 1 : -1,
      step: 0,
      next: this.w.time,
      recovery: boss
        ? action === "blades"
          ? 3
          : 3.2
        : e.kind === "moonreaver"
          ? 2.8
          : e.kind === "hornwarden"
            ? 3
            : action === "leaps"
              ? 2
              : 1.8,
      cooldown: boss
        ? 0.6
        : e.kind === "moonreaver"
          ? 3
          : e.kind === "hornwarden"
            ? 3.2
            : action === "leaps"
              ? 2.8
              : action === "blades"
                ? 3
                : 3.2,
    };
    const fail = () => {
      e.moon = undefined;
      e.state = "seek";
      e.attack = 0.6;
      const target = { x: this.w.camera.x, y: this.w.camera.y };
      if (["vaultlynx", "crescentmantis", "moonreaver"].includes(e.kind)) {
        const a = Math.atan2(e.y - this.w.player.y, e.x - this.w.player.x);
        target.x = this.w.player.x + Math.cos(a) * 3.8;
        target.y = this.w.player.y + Math.sin(a) * 3.8;
      }
      moonMap.resolve(target, 0.7);
      this.reposition.set(e.id, target);
      return false;
    };
    e.state = "windup";
    if (action === "blades") {
      let hs = this.blades(e);
      if (!this.safe(hs) && hs.length === 2) hs = hs.slice(0, 1);
      if (!this.publish(hs)) return fail();
      e.moon.next = Math.max(...hs.map((h) => h.until));
    } else if (action === "leaps") {
      if (!this.leap(e)) return fail();
    } else {
      const h = this.sweep(e);
      if (
        !this.legal(h.moon!.motion.end) ||
        moonMap.segment(e, h.moon!.motion.end, 0.65) ||
        !this.publish([h])
      )
        return fail();
      e.moon.next = h.until;
    }
    this.reservations.set(e.id, slots);
    this.reposition.delete(e.id);
    this.lastStart = this.w.time;
    return true;
  }
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w;
    if (e.kind === "boss" && e.bossPhase === 1 && e.hp <= e.maxHp * 0.55) {
      e.bossPhase = 2;
      w.hazards = w.hazards.filter(
        (h) =>
          h.source !== e.id ||
          (h.moon?.motion.shape === "blade" && h.moon.launched),
      );
      this.reservations.delete(e.id);
      e.moon = {
        action: "transition",
        step: 0,
        next: w.time + 1.5,
        recovery: 0,
        cooldown: 0,
      };
      e.state = "windup";
      e.pattern = 0;
      w.effects.push({ type: "bossPhase", ...e, value: 2 });
    }
    const s = e.moon;
    if (e.kind !== "boss" && e.freezeUntil > w.time && e.state !== "charge") {
      if (s) {
        s.next += dt;
        if (s.flankUntil !== undefined) s.flankUntil += dt;
        if (s.jumpAt !== undefined) s.jumpAt += dt;
        if (s.jumpDue !== undefined) s.jumpDue += dt;
      }
      for (const h of w.hazards)
        if (h.source === e.id && h.moon && !h.moon.launched) {
          h.due += dt;
          h.until += dt;
          h.created += dt;
          h.moon.motion.due += dt;
          h.moon.last = w.time;
          h.moon.player = { ...w.player };
        }
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "seek";
        e.moon = undefined;
      }
      return;
    }
    if (s && (e.state === "windup" || e.state === "charge")) {
      if (s.action === "transition") {
        if (
          w.time >= s.next &&
          !w.hazards.some((h) => h.source === e.id && h.until > w.time)
        ) {
          e.state = "seek";
          e.moon = undefined;
          e.attack = 0.5;
        }
        return;
      }
      if (
        s.jumpAt !== undefined &&
        w.time >= s.jumpAt &&
        s.jumpDue !== undefined
      ) {
        e.state = "charge";
        const u = Math.min(1, (w.time - s.jumpAt) / 0.45);
        e.x = s.jumpStart!.x + (s.jumpEnd!.x - s.jumpStart!.x) * u;
        e.y = s.jumpStart!.y + (s.jumpEnd!.y - s.jumpStart!.y) * u;
      }
      const h = w.hazards.find(
        (h) =>
          h.source === e.id &&
          h.moon?.motion.shape === "sweep" &&
          w.time >= h.due &&
          w.time < h.until,
      );
      if (h) {
        e.state = "charge";
        const p = moonPose(h.moon!.motion, w.time).point;
        if (moonMap.segment(e, p, 0.65) || !this.legal(p)) {
          w.hazards = w.hazards.filter((o) => o.source !== e.id);
          this.recover(e);
          return;
        }
        e.x = p.x;
        e.y = p.y;
      }
      if (w.time < s.next) return;
      if (s.action === "blades") {
        this.recover(e);
        return;
      }
      if (s.action === "leaps") {
        // Each follow-up locks only after its independent waiting period.
        if (s.step === 0) {
          s.step = 1;
          s.next = w.time + (e.kind === "boss" ? 0.5 : 0.4);
          s.jumpAt = undefined;
          e.state = "windup";
          return;
        }
        if (s.step === 1 && e.kind === "boss") {
          s.step = 2;
          if (!this.leap(e)) this.recover(e);
          return;
        }
        if (s.step === 2) {
          s.step = 3;
          s.next = w.time + 0.45;
          s.jumpAt = undefined;
          e.state = "windup";
          return;
        }
        if (s.step === 1 || s.step === 3) {
          const follow = this.sweep(e, true);
          s.step = 4;
          if (!this.publish([follow])) {
            this.recover(e);
            return;
          }
          s.next = follow.until;
          e.state = "windup";
          return;
        }
        this.recover(e);
        return;
      }
      if (s.step === 0 && (e.kind === "boss" || e.kind === "hornwarden")) {
        s.step = 1;
        s.next = w.time + 0.4;
        e.state = "windup";
        return;
      }
      if (s.step === 1) {
        const follow = this.sweep(e, true);
        s.step = 2;
        if (!this.publish([follow])) {
          this.recover(e);
          return;
        }
        s.next = follow.until;
        e.state = "windup";
        return;
      }
      this.recover(e);
      return;
    }
    e.attack -= dt;
    const staging = this.reposition.get(e.id);
    if (staging && distance(e, staging) > 0.25) {
      this.move(
        e,
        staging,
        dt,
        e.kind === "boss" ? 1.7 : ENEMIES[e.kind].speed,
      );
    } else if (staging) this.reposition.delete(e.id);
    if (e.kind === "thornrunner") {
      this.move(e, s?.flank && s.flankUntil! > w.time ? s.flank : w.player, dt);
      if (distance(e, w.player) < 0.65) w.hurt(8, ENEMIES[e.kind].name);
      return;
    }
    const d = distance(e, w.player),
      ranged = e.kind === "crescentmantis" || e.kind === "moonreaver";
    if (!staging && d > (ranged ? 4 : e.kind === "vaultlynx" ? 3.7 : 2.8))
      this.move(
        e,
        w.player,
        dt,
        e.kind === "boss" ? 1.7 : ENEMIES[e.kind].speed,
      );
    if (!staging && (ranged || e.kind === "vaultlynx") && d < 3) {
      const a = Math.atan2(e.y - w.player.y, e.x - w.player.x);
      const p = { x: e.x + Math.cos(a) * 2, y: e.y + Math.sin(a) * 2 };
      if (this.legal(p, 0.35)) this.move(e, p, dt);
    }
    // Seeking only: all announced and committed actions and recovery have no body damage.
    if (distance(e, w.player) < (e.kind === "boss" ? 1 : 0.65))
      w.hurt(
        e.kind === "boss" ? 24 : ENEMIES[e.kind].contact,
        e.kind === "boss" ? "蚀月角王" : ENEMIES[e.kind].name,
        e.kind !== "boss" && !isElite(e.kind),
      );
    if (
      e.attack > 0 ||
      e.visibleSince < 0 ||
      w.time - e.visibleSince < 1 ||
      !w.visible(e, 0.6)
    )
      return;
    if (e.kind === "boss") {
      if (
        d > 4.5 ||
        this.slots() > 0 ||
        w.time < Math.max(this.rest, w.reinforcementRestUntil) ||
        w.enemies.some((o) => o.hp > 0 && isElite(o.kind))
      )
        return;
      const actions =
        e.bossPhase === 1
          ? (["blades", "leaps", "sweeps"] as const)
          : (["sweeps", "blades", "leaps"] as const);
      if (this.start(e, actions[e.pattern % 3])) e.pattern++;
      else {
        e.attack = 0.6;
      }
      return;
    }
    if (!isElite(e.kind)) {
      if (this.encounter.suppressSpecial() || w.time - this.lastStart < 3)
        return;
      if (
        encounterScoreTime(w.time) < 150 &&
        e.kind !==
          (encounterScoreTime(w.time) < 75
            ? "crescentmantis"
            : encounterScoreTime(w.time) < 115
              ? "vaultlynx"
              : "antlerprowler")
      )
        return;
      if (
        (ranged && (d < 3 || d > 8)) ||
        (e.kind === "vaultlynx" && (d < 3 || d > 7)) ||
        (e.kind === "antlerprowler" && (d < 2 || d > 5))
      )
        return;
    }
    const a =
      e.kind === "crescentmantis" || e.kind === "moonreaver"
        ? "blades"
        : e.kind === "vaultlynx"
          ? "leaps"
          : "sweeps";
    if (!this.start(e, a)) {
      e.attack = 0.6;
    }
  }
  stepHazard(h: Hazard) {
    const w = this.w,
      t = h.moon!,
      m = t.motion;
    if (w.time >= m.due && !t.launched) {
      t.launched = true;
      if (m.shape === "landing")
        w.effects.push({ type: "hazard", ...m.end, radius: m.radius });
    }
    for (const leg of [1, 2] as const) {
      const mask = 1 << leg;
      if (
        !(t.hits & mask) &&
        moonSwept(m, t.player, w.player, t.last, w.time, 0.3, leg)
      ) {
        t.hits |= mask;
        w.hurt(h.damage, h.damageLabel!, false);
      }
    }
    h.fired = t.launched;
    t.last = w.time;
    t.player = { ...w.player };
  }
}
