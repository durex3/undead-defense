import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, isElite, type Kind, type Skill } from "./SurvivalConfig";
import {
  distance,
  type Enemy,
  type Hazard,
  type Point,
  segmentDistance,
} from "./SurvivalTypes";
import { TwingateEncounter } from "./TwingateEncounter";
import { TwingateDirector } from "./TwingateDirector";
import { twingateMap } from "./TwingateMap";
import { advanceTactically } from "./TacticalMovement";
import {
  gateBody,
  gateHeads,
  gateThreat,
  gateImpact,
  gateCut,
  gateMove,
  gateEscape,
  gateConflict,
  type GateMove,
  type GatePart,
} from "./TwingateGeometry";
import type { GateRole } from "./TwingateChallenge";
export const GATE_KINDS: readonly Kind[] = [
  "gategrub",
  "shorthorn",
  "bowwatch",
  "splitblade",
  "huntermarshal",
  "gateballista",
];
export const gateEnemy = (k: Kind) => GATE_KINDS.includes(k);
export interface GateState {
  role: GateRole;
  action: "A" | "B";
  vulnerable: boolean;
  item?: Hazard;
  retireUntil?: number;
  waitUntil?: number;
  retry?: number;
  goal?: Point;
  goalUntil?: number;
  retreatUntil?: number;
}
interface Group {
  id: number;
  action: "A" | "B";
  boss: boolean;
  items: Hazard[];
  interrupted: boolean;
  proved: Set<number>;
}
export class TwingateSystem {
  readonly forms = 2;
  readonly encounter: TwingateEncounter;
  readonly schedule: TwingateDirector;
  readonly groups = new Map<number, Group>();
  readonly stats = {
    pairs: 0,
    solo: { hunter: { A: 0, B: 0 }, warden: { A: 0, B: 0 } },
    patterns: { A: 0, B: 0 },
    eliteCasts: { huntermarshal: 0, gateballista: 0 },
    rejected: 0,
    cancelled: 0,
    retired: 0,
  };
  private soloStarted = false;
  private leader = 0;
  private nextAction: "A" | "B" = "A";
  constructor(private w: SurvivalWorld) {
    // Creator emits field initializers before TypeScript parameter properties.
    this.encounter = new TwingateEncounter(w);
    this.schedule = new TwingateDirector(w, this);
  }
  initialize(e: Enemy) {
    this.encounter.initialize(e);
  }
  keep(_e: Enemy) {
    return false;
  }
  tick() {
    if (
      this.w.active &&
      this.encounter.solo &&
      !this.soloStarted &&
      this.w.time >= this.encounter.soloAt
    ) {
      this.soloStarted = true;
      for (const e of this.encounter.alive) {
        const s = this.state(e);
        s.item = undefined;
        s.vulnerable = false;
        e.state = "seek";
        e.immovable = false;
        e.attack = 0;
        e.bossPhase = 2;
      }
    }
  }
  progress(_e: Enemy) {
    return (
      this.encounter.summary() ?? { form: 0, livesRemaining: 0, remaining: 1 }
    );
  }
  supplies(e: Enemy) {
    this.encounter.supplies(e);
  }
  summary() {
    return this.encounter.summary();
  }
  state(e: Enemy): GateState {
    return (
      e.twin ??
      (e.twin = {
        role: ["shorthorn", "splitblade", "huntermarshal"].includes(e.kind)
          ? "hunter"
          : "warden",
        action: "A",
        vulnerable: false,
      })
    );
  }
  get slots() {
    return this.w.hazards.filter(
      (h) => h.until > this.w.time && !h.twin?.cancelled,
    ).length;
  }
  get canReinforce() {
    return (
      this.encounter.alive.length > 0 &&
      (!this.encounter.solo || this.w.time >= this.encounter.soloAt) &&
      !this.encounter.alive.some((e) => e.state === "recover")
    );
  }
  director(dt: number) {
    this.schedule.step(dt);
  }
  spawnBosses() {
    const w = this.w;
    if (
      this.encounter.members.length ||
      w.enemies.filter((e) => e.hp > 0).length > 98
    )
      return;
    const candidates: Point[] = [];
    for (const r of [3.4, 4.4, 5.6, 6.4])
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12,
          p = {
            x: w.player.x + Math.cos(a) * r,
            y: w.player.y + Math.sin(a) * r,
          };
        if (
          Math.abs(p.x) <= 21.3 &&
          Math.abs(p.y) <= 25.3 &&
          !twingateMap.blocked(p, 0.7) &&
          w.visible(p, 1)
        )
          candidates.push(p);
      }
    for (const h of candidates)
      for (const r of candidates) {
        if (distance(h, r) < 3.2 || distance(h, w.player) > 4.5) continue;
        // Leave room for the tall bow frame above its physical foot point.
        if (
          h.y + 2.4 > w.camera.y + w.viewport.y - 2.6 ||
          r.y + 3.3 > w.camera.y + w.viewport.y - 2.6
        ) continue;
        const d = distance(h, w.player),
          landing = {
            x: h.x + ((w.player.x - h.x) / d) * 5.6,
            y: h.y + ((w.player.y - h.y) / d) * 5.6,
          };
        if (segmentDistance(r, h, landing) < 1.4) continue;
        const a = w.addEnemy("boss", h.x, h.y),
          b = w.addEnemy("boss", r.x, r.y);
        if (!a || !b) throw Error("Atomic twin capacity invariant");
        for (const e of [a, b]) {
          e.state = "arriving";
          e.timer = 2;
        }
        return [a, b];
      }
  }
  retireSpecials() {
    for (const e of this.w.enemies)
      if (
        e.hp > 0 &&
        gateEnemy(e.kind) &&
        e.kind !== "gategrub" &&
        !isElite(e.kind)
      ) {
        const s = this.state(e);
        if (!s.retireUntil) {
          if (s.item) gateCut(s.item, this.w.time, false);
          s.retireUntil = Math.max(this.w.time, s.item?.until ?? 0) + 0.6;
          e.immovable = true;
          this.stats.retired++;
        }
        if (this.w.time >= s.retireUntil) e.hp = 0;
      }
  }
  part(e: Enemy, kind: GateMove, solo = false): GatePart {
    const w = this.w,
      boss = e.kind === "boss",
      large = boss || isElite(e.kind),
      role = this.state(e).role;
    let length =
      kind === "sweep"
        ? boss
          ? solo && role === "warden"
            ? 3.4
            : 3.5
          : large
            ? 3.2
            : 2.6
        : kind === "charge"
          ? boss
            ? role === "warden"
              ? 3.8
              : 5.6
            : large
              ? 5
              : 4.4
          : boss
            ? solo
              ? 6.6
              : 7
            : 6.4;
    const speed =
      kind === "charge"
        ? boss
          ? role === "warden"
            ? 4.6
            : solo
              ? 5
              : 4.8
          : large
            ? 4.4
            : 4
        : boss
          ? solo && kind !== "split"
            ? 5.2
            : 5
          : 4.6;
    // R2 remains the original seven-unit bow shot in the warden's solo form.
    if (boss && kind === "split") length = 7;
    const radius =
      kind === "sweep"
        ? length
        : kind === "charge"
          ? boss
            ? role === "warden"
              ? 0.55
              : 0.6
            : large
              ? 0.5
              : 0.42
          : boss
            ? 0.32
            : 0.28;
    const angle = Math.atan2(w.player.y - e.y, w.player.x - e.x),
      due = w.time + (large ? 2.4 : 2.2),
      f: GatePart = {
        x: e.x,
        y: e.y,
        kind,
        angle,
        length,
        speed,
        radius,
        half: ((e.kind === "splitblade" ? 65 : 70) * Math.PI) / 180,
        locked: w.time,
        due,
        end: due + (kind === "sweep" ? 0.2 : length / speed),
        to: {
          x: e.x + Math.cos(angle) * length,
          y: e.y + Math.sin(angle) * length,
        },
        damage: !large
          ? 22
          : kind === "sweep"
            ? boss
              ? 28
              : 26
            : kind === "charge"
              ? 26
              : 24,
        threatens: false,
        hit: false,
      };
    f.threatens = gateThreat(f, w.player);
    return f;
  }
  plan(
    e: Enemy,
    action: "A" | "B",
    solo = e.kind === "boss" && this.encounter.solo,
    override?: GateMove,
  ): Hazard {
    const s = this.state(e),
      boss = e.kind === "boss";
    let kind: GateMove =
      override ??
      (s.role === "hunter"
        ? action === "A"
          ? "charge"
          : "sweep"
        : solo && action === "B"
          ? "charge"
          : action === "B" || solo
            ? "split"
            : "bolt");
    if (e.kind === "splitblade") kind = "sweep";
    if (e.kind === "shorthorn") kind = "charge";
    if (e.kind === "bowwatch") kind = "bolt";
    const f = this.part(e, kind, solo),
      follow: GateMove | undefined = solo
        ? s.role === "hunter" || action === "B"
          ? "bolt"
          : "sweep"
        : undefined;
    return {
      id: this.w.id(),
      source: e.id,
      kind: "circle",
      x: e.x,
      y: e.y,
      angle: f.angle,
      radius: 0,
      width: 0,
      created: this.w.time,
      due: f.due,
      until: f.end + (follow ? 2.4 + 1.4 : 0),
      damage: f.damage,
      fixedDamage: true,
      damageLabel: "双阙猎庭",
      fired: false,
      next: 0,
      twin: {
        parts: [f],
        role: s.role,
        boss,
        solo,
        action,
        last: this.w.time,
        player: { ...this.w.player },
        follow,
      },
    };
  }
  legal(h: Hazard, extra: Hazard[] = []) {
    const w = this.w,
      visible = (p: Point, r: number) =>
        Math.abs(p.x - w.camera.x) + r < w.viewport.x - 0.4 &&
        p.y - w.camera.y + r < w.viewport.y - 2.6 &&
        p.y - w.camera.y - r > -w.viewport.y + 2.7;
    for (const f of h.twin!.parts) {
      if (f.cancelled) continue;
      if (f.kind === "charge") {
        if (
          [f, f.to].some(
            (p) =>
              Math.abs(p.x) > 21.3 ||
              Math.abs(p.y) > 25.3 ||
              !visible(p, f.radius),
          ) ||
          twingateMap.segment(f, f.to, 0.7)
        )
          return false;
      } else if (f.kind === "sweep") {
        if (
          !visible(f, 0.3) ||
          Array.from(
            { length: 33 },
            (_, i) => f.angle - f.half + (i * f.half) / 16,
          ).some(
            (a) =>
              !visible(
                {
                  x: f.x + Math.cos(a) * f.length,
                  y: f.y + Math.sin(a) * f.length,
                },
                0.3,
              ),
          )
        )
          return false;
      } else if (
        !visible(f, f.radius) ||
        gateHeads(f, f.end).some((p) => !visible(p, f.radius))
      )
        return false;
    }
    if (
      w.enemies.some(
        (o) =>
          o.hp > 0 &&
          o.id !== h.source &&
          (o.kind === "boss" || isElite(o.kind)) &&
          gateConflict(
            h,
            o,
            extra.find((x) => x.source === o.id) ||
              w.hazards.find(
                (x) => x.source === o.id && x.twin && x.until > w.time,
              ),
            w.time,
          ),
      )
    )
      return false;
    return true;
  }
  private publish(e: Enemy, h: Hazard) {
    const s = this.state(e);
    s.item = h;
    s.action = h.twin!.action;
    s.vulnerable = false;
    s.waitUntil = undefined;
    e.state = "windup";
    e.immovable = true;
    e.facing = h.twin!.parts[0]?.angle ?? e.facing;
    if (e.kind !== "boss")
      this.stats.eliteCasts[e.kind as "huntermarshal" | "gateballista"] !==
        undefined &&
        this.stats.eliteCasts[e.kind as "huntermarshal" | "gateballista"]++;
    this.w.hazards.push(h);
  }
  begin(e: Enemy, action: "A" | "B" = this.state(e).action) {
    if (this.slots >= 2) return false;
    const h = this.plan(e, action);
    const emptySoloSweep =
      h.twin!.solo && h.twin!.follow === "sweep" &&
      !h.twin!.parts.some((f) => f.threatens) &&
      !gateThreat(this.part(e, "sweep", true), this.w.player);
    if (emptySoloSweep || !this.legal(h) || !gateEscape(this.w, [h])) {
      this.stats.rejected++;
      e.attack = 0.4;
      return false;
    }
    this.publish(e, h);
    if (e.kind === "boss" && h.twin!.solo)
      this.stats.solo[h.twin!.role][action]++;
    return true;
  }
  pair(hunter: Enemy, warden: Enemy, action: "A" | "B" = this.nextAction) {
    if (this.slots) return false;
    const first = action === "A" ? hunter : warden,
      second = action === "A" ? warden : hunter,
      a = this.plan(first, action, false),
      b = this.plan(second, action, false);
    b.twin!.parts.forEach((f) => {
      f.locked += 0.9;
      f.due += 0.9;
      f.end += 0.9;
    });
    a.until = b.until = Math.max(a.until, b.twin!.parts[0].end);
    if (
      !this.legal(a, [a, b]) ||
      !this.legal(b, [a, b]) ||
      !gateEscape(this.w, [a, b])
    )
      return false;
    const id = this.w.id();
    a.twin!.pair = b.twin!.pair = id;
    b.twin!.parts = [];
    b.twin!.pendingAt = this.w.time + 0.9;
    b.until = a.until;
    this.groups.set(id, {
      id,
      action,
      boss: first.kind === "boss",
      items: [a, b],
      interrupted: false,
      proved: new Set(),
    });
    this.publish(first, a);
    this.publish(second, b);
    this.leader = first.id;
    this.nextAction = action === "A" ? "B" : "A";
    this.stats.pairs++;
    if (first.kind === "boss") this.stats.patterns[action]++;
    return true;
  }
  private lock(e: Enemy, h: Hazard, kind?: GateMove) {
    const b = h.twin!,
      g = b.pair && this.groups.get(b.pair);
    b.pendingAt = undefined;
    if (g && g.interrupted) {
      gateCut(h, this.w.time, false);
      return;
    }
    const f = kind
        ? this.part(e, kind, b.solo)
        : this.plan(e, b.action, false).twin!.parts[0],
      proposal = {
        ...h,
        until: f.end,
        twin: {
          ...b,
          parts: [...b.parts, f],
          follow: undefined,
          pendingAt: undefined,
        },
      };
    b.follow = undefined;
    if (
      this.legal(proposal, g ? g.items.filter((x) => x.id !== h.id) : []) &&
      gateEscape(this.w, [proposal])
    ) {
      b.parts.push(f);
      h.until = f.end;
    } else {
      b.interrupted = true;
      if (g) g.interrupted = true;
      this.stats.cancelled++;
      h.until = Math.max(
        this.w.time,
        ...b.parts
          .filter((f) => !f.cancelled)
          .map((f) => Math.min(f.end, f.cutAt ?? Infinity)),
      );
      if (!b.parts.length) b.cancelled = true;
    }
  }
  private interrupt(h: Hazard, t: number, stopBody = true) {
    gateCut(h, t, stopBody);
    const id = h.twin!.pair;
    if (id) {
      const g = this.groups.get(id);
      if (g) g.interrupted = true;
    }
  }
  private sync(h: Hazard) {
    const e = this.w.enemies.find((e) => e.id === h.source);
    if (!e || e.hp <= 0 || e.freezeUntil > this.w.time || e.state !== "windup")
      return;
    const p = gateBody(h, this.w.time);
    e.x = p.x;
    e.y = p.y;
    const f = h.twin!.parts.find(
      (f) =>
        f.kind === "charge" &&
        !f.cancelled &&
        this.w.time >= f.due &&
        this.w.time < Math.min(f.end, f.cutAt ?? Infinity),
    );
    if (f) e.facing = f.angle;
  }
  clean() {
    const w = this.w;
    if (!w.active) return;
    for (const h of w.hazards) {
      const b = h.twin;
      if (!b) continue;
      const e = w.enemies.find((e) => e.id === h.source);
      if (!e || e.hp <= 0 || e.freezeUntil > w.time) {
        this.interrupt(h, w.time);
        continue;
      }
      this.sync(h);
      if (b.pendingAt !== undefined && w.time + 1e-9 >= b.pendingAt)
        this.lock(e, h);
      if (b.follow && b.parts.every((f) => f.end <= w.time))
        this.lock(e, h, b.follow);
    }
    for (const [id, g] of this.groups) {
      if (!g.items.some((h) => h.twin!.pendingAt !== undefined)) {
        const end = Math.max(
            ...g.items.flatMap((h) =>
              h
                .twin!.parts.filter((f) => !f.cancelled)
                .map((f) => Math.min(f.end, f.cutAt ?? Infinity)),
            ),
          ),
          safeEnd = Number.isFinite(end) ? end : w.time;
        g.items.forEach((h) => (h.until = safeEnd));
        if (w.time > safeEnd + 3) this.groups.delete(id);
      }
    }
  }
  private sample(h: Hazard, p: Point, t: number, from: number, old: Point) {
    const b = h.twin!;
    for (const f of b.parts)
      if (!f.hit && gateImpact(f, p, t, from, old)) {
        f.hit = true;
        b.collided = true;
        this.w.hurt(f.damage, b.boss ? "boss" : "猎庭攻势", false, h.source);
      }
    b.last = t;
    b.player = { ...p };
  }
  movePlayer(dt: number) {
    const w = this.w,
      from = w.time - dt;
    for (const h of w.hazards)
      if (h.twin) {
        const e = w.enemies.find((e) => e.id === h.source);
        if (!e || e.hp <= 0 || e.freezeUntil > from) this.interrupt(h, from);
      }
    gateMove(
      w.player,
      { x: w.move.x * w.speed, y: w.move.y * w.speed },
      dt,
      0.3,
      w.time,
      (old, p, a, z) => {
        for (const h of w.hazards) if (h.twin) this.sample(h, p, z, a, old);
      },
    );
  }
  stepHazard(h: Hazard) {
    this.sample(h, this.w.player, this.w.time, h.twin!.last, h.twin!.player);
  }
  private recover(e: Enemy) {
    const s = this.state(e);
    e.state = "recover";
    e.immovable = false;
    s.vulnerable = true;
    e.timer =
      e.kind === "boss"
        ? s.item?.twin?.solo
          ? (s.action === "A" ? 5.8 : 6) * 0.35
          : (s.role === "hunter" ? 5.4 : 5.8) * 0.35
        : isElite(e.kind)
          ? (s.role === "hunter" ? 5.4 : 5.8) * 0.35
          : e.kind === "shorthorn"
            ? 1.2
            : e.kind === "bowwatch"
              ? 1.4
              : 1.3;
    e.pattern++;
  }
  onHit(e: Enemy, source: string, dealt: number) {
    const s = this.state(e),
      b = s.item?.twin,
      skill = (source === "needleEcho" ? "needle" : source) as Skill;
    if (
      e.kind !== "boss" ||
      !b ||
      dealt <= 0 ||
      !this.w.skills[skill] ||
      e.state !== "recover" ||
      !s.vulnerable ||
      distance(e, this.w.player) > 2.8 ||
      b.interrupted ||
      b.collided
    )
      return;
    if (b.pair) {
      const g = this.groups.get(b.pair);
      if (
        !g ||
        !g.boss ||
        g.interrupted ||
        !g.items.every(
          (h) =>
            !h.twin!.interrupted &&
            !h.twin!.collided &&
            h.twin!.pendingAt === undefined &&
            h.twin!.parts.length &&
            h.twin!.parts.every((f) => !f.cancelled && this.w.time >= f.end),
        ) ||
        !g.items.some((h) => h.twin!.parts.some((f) => f.threatens))
      )
        return;
      g.proved.add(e.id);
      this.w.challenge.gateGroups.add(g.action);
      this.w.challenge.gateBodies.add(s.role);
    } else if (
      b.solo &&
      !b.proved &&
      b.follow === undefined &&
      b.parts.length === 2 &&
      b.parts.every((f) => !f.cancelled && this.w.time >= f.end) &&
      b.parts.some((f) => f.threatens)
    ) {
      b.proved = true;
      this.w.challenge.gateSolo.add(b.action);
    }
  }
  onDeath(e: Enemy) {
    const s = this.state(e);
    if (e.kind === "boss") {
      for (const h of this.w.hazards)
        if (h.twin && (h.source === e.id || (h.twin.boss && h.twin.pair)))
          this.interrupt(h, this.w.time, h.source === e.id);
      const consumed = this.encounter.death(e);
      if (consumed)
        for (const o of this.encounter.alive) {
          this.state(o).vulnerable = false;
          o.state = "windup";
          o.immovable = true;
        }
      return consumed;
    }
    if (s.item) this.interrupt(s.item, this.w.time);
    this.schedule.onDeath(e);
    return false;
  }
  private move(e: Enemy, dt: number) {
    const w = this.w,
      s = this.state(e),
      d = distance(e, w.player),
      boss = e.kind === "boss",
      large = boss || isElite(e.kind),
      r = large ? 0.7 : 0.35,
      solo = boss && this.encounter.solo,
      preferred = s.role === "warden" ? (solo ? 3.5 : 4.8) : 2.8;
    let speed = boss
      ? d > 6
        ? solo || s.role === "hunter"
          ? 5
          : 4.6
        : solo
          ? 2.6
          : s.role === "hunter"
            ? 2.4
            : 1.8
      : ENEMIES[e.kind].speed;
    if (
      !s.goal ||
      w.time >= (s.goalUntil ?? 0) ||
      distance(s.goal, w.player) > preferred + 2
    ) {
      s.goalUntil = w.time + 1;
      const a = Math.atan2(e.y - w.player.y, e.x - w.player.x),
        goals = Array.from({ length: 16 }, (_, i) => ({
          x: w.player.x + Math.cos(a + (i * Math.PI) / 8) * preferred,
          y: w.player.y + Math.sin(a + (i * Math.PI) / 8) * preferred,
        })).filter(
          (p) =>
            Math.abs(p.x) <= 22 - r &&
            Math.abs(p.y) <= 26 - r &&
            !twingateMap.blocked(p, r),
        );
      s.goal = goals.sort((a, b) => distance(e, a) - distance(e, b))[0] ?? {
        ...w.player,
      };
      e.navWaypoint = undefined;
    }
    const before = { x: e.x, y: e.y };
    advanceTactically(
      twingateMap,
      e,
      large ? s.goal : w.player,
      speed * (e.slowUntil > w.time ? 1 - e.slow : 1),
      dt,
      r,
    );
    const partners = w.enemies.filter(
      (o) =>
        o.id !== e.id && o.hp > 0 && (o.kind === "boss" || isElite(o.kind)),
    );
    if (
      large &&
      partners.some((o) => {
        const h = w.hazards.find(
          (h) => h.source === o.id && h.twin && h.until > w.time,
        );
        return h
          ? h.twin!.parts.some(
              (f) =>
                f.kind === "charge" &&
                !f.cancelled &&
                f.end > w.time &&
                segmentDistance(e, f, f.to) < 1.4,
            )
          : distance(e, o) < 1.4 && distance(e, o) < distance(before, o);
      })
    ) {
      e.x = before.x;
      e.y = before.y;
      s.goalUntil = 0;
    }
  }
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w,
      s = this.state(e);
    if (s.retireUntil) return;
    if (
      e.kind === "boss" &&
      (this.encounter.members.length !== 2 ||
        (this.encounter.solo && w.time < this.encounter.soloAt))
    ) {
      e.immovable = true;
      return;
    }
    if (e.freezeUntil > w.time) {
      if (s.item && !s.item.twin!.interrupted) this.interrupt(s.item, w.time);
      if (!s.item || w.time >= s.item.until) {
        if (e.state !== "recover") this.recover(e);
      }
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "seek";
        s.item = undefined;
        s.vulnerable = false;
        e.attack = e.kind === "boss" || isElite(e.kind) ? 0 : 2;
      }
      return;
    }
    if (s.item && e.state === "windup") {
      this.sync(s.item);
      if (
        w.time >= s.item.until &&
        s.item.twin!.pendingAt === undefined &&
        !s.item.twin!.follow
      )
        this.recover(e);
      return;
    }
    e.immovable = false;
    const d = distance(e, w.player);
    if (e.kind === "gategrub") {
      this.move(e, dt);
      if (distance(e, w.player) < 0.65) w.hurt(12, e.kind);
      return;
    }
    if (
      e.kind !== "boss" &&
      !isElite(e.kind) &&
      w.enemies.some((o) => o.hp > 0 && isElite(o.kind))
    )
      return;
    if (d < (e.kind === "boss" ? 1 : 0.65))
      w.hurt(
        e.kind === "boss" ? 22 : ENEMIES[e.kind].contact,
        e.kind === "boss" ? "boss" : e.kind,
        false,
        e.id,
      );
    e.attack -= dt;
    if (
      d >
        (s.role === "hunter"
          ? 3.5
          : this.encounter.solo && e.kind === "boss"
            ? 4.2
            : 5.8) ||
      !w.visible(e, 1) ||
      e.visibleSince < 0 ||
      w.time - e.visibleSince < 0.8
    ) {
      this.move(e, dt);
      return;
    }
    if (e.attack > 0) {
      if (d > 3.2) this.move(e, dt);
      return;
    }
    const partners = w.enemies.filter(
      (o) =>
        o.hp > 0 &&
        o.id !== e.id &&
        (e.kind === "boss" ? o.kind === "boss" : isElite(o.kind)),
    );
    if (partners.length && (!this.encounter.solo || e.kind !== "boss")) {
      const ready = [e, ...partners]
        .filter(
          (o) => o.state === "seek" && o.attack <= 0 && o.freezeUntil <= w.time,
        )
        .sort(
          (a, b) =>
            Number(a.id === this.leader) - Number(b.id === this.leader) ||
            a.id - b.id,
        );
      if (ready[0] !== e) return;
      const other = ready.find(
        (o) =>
          o.id !== e.id &&
          w.visible(o, 1) &&
          w.time - o.visibleSince >= 0.8 &&
          distance(o, w.player) <= 6,
      );
      if (other) {
        const h = s.role === "hunter" ? e : other,
          r = s.role === "warden" ? e : other;
        if (this.pair(h, r, this.nextAction)) return;
      }
      if (w.time >= (s.retry ?? 0)) {
        s.waitUntil ??= w.time + 1.5;
        if (w.time < s.waitUntil) {
          this.move(e, dt);
          return;
        }
        s.retry = w.time + 3;
        s.waitUntil = undefined;
      }
    }
    s.action = e.pattern % 2 ? "B" : "A";
    if (!this.begin(e, s.action)) {
      s.action = s.action === "A" ? "B" : "A";
      if (!this.begin(e, s.action)) this.move(e, dt);
    }
  }
}
