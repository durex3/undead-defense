import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, isElite, type Kind, type Skill } from "./SurvivalConfig";
import { distance, type Enemy, type Hazard, type Point } from "./SurvivalTypes";
import { traceMap } from "./TraceCourtMap";
import { TraceHistory, type TraceDirection } from "./TraceHistory";
import {
  traceLegs,
  traceImpacts,
  traceBodySync,
  traceCut,
  traceMove,
  traceEscape,
} from "./TraceCourtGeometry";
import { graveDistance } from "./EchoGraveGeometry";
import { stageRecoveryFactor } from "./StagePressure";
import { advanceTactically } from "./TacticalMovement";
import { BossPlanChoice, type BossAction } from "./BossPlanChoice";
export const TRACE_KINDS: readonly Kind[] = [
  "shackleshard",
  "fettersprinter",
  "trailhound",
  "turnwarden",
  "trailmarshal",
  "reversejailer",
];
export const traceEnemy = (k: Kind) => TRACE_KINDS.includes(k);
export interface TraceState {
  action: BossAction;
  life: 1 | 2;
  total?: number;
  deadUntil?: number;
  milestones?: number;
  item?: Hazard;
  vulnerable: boolean;
  qualified?: boolean;
  approach?: Point;
  approachUntil?: number;
  historyRetry?: number;
}
export class TraceCourtSystem {
  readonly forms = 2;
  readonly history = new TraceHistory();
  readonly choices = new BossPlanChoice();
  private reinforceEpoch = 360;
  private wave = 0;
  private special = 0;
  private rounds = [false, false, false, false];
  private firstReturn = 0;
  private boss = false;
  private horde = 0;
  private rest = 0;
  private lastElite = 0;
  readonly stats = {
    patterns: { A: 0, B: 0, C: 0 },
    phases: [0, 0],
    eliteCasts: { trailmarshal: 0, reversejailer: 0 },
    revivals: 0,
    rejected: 0,
    cancelled: 0,
    genuineCasts: 0,
    historyCasts: 0,
  };
  constructor(private w: SurvivalWorld) {}
  state(e: Enemy): TraceState {
    return e.trace ?? (e.trace = { action: "A", life: 1, vulnerable: false });
  }
  get slots() {
    return this.w.hazards.filter(
      (h) => h.until > this.w.time && !h.trace?.cancelled,
    ).length;
  }
  position(angle: number, r = 9): Point | undefined {
    for (let i = 0; i < 24; i++) {
      const a = angle + (i * Math.PI) / 12,
        p = {
          x: Math.max(-21, Math.min(21, this.w.player.x + Math.cos(a) * r)),
          y: Math.max(-25, Math.min(25, this.w.player.y + Math.sin(a) * r)),
        };
      if (distance(p, this.w.player) > 3 && !traceMap.blocked(p, 0.8)) return p;
    }
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
    if (e) {
      e.state = "arriving";
      e.timer = kind === "boss" ? 2 : 1;
      e.bossReinforcement = reinforcement;
    }
    return e;
  }
  director(dt: number) {
    const w = this.w,
      t = w.time;
    this.wave -= dt;
    this.special -= dt;
    const elites = w.enemies.filter((e) => e.hp > 0 && isElite(e.kind));
    if (
      t >= 360 &&
      !this.boss &&
      !elites.length &&
      t >= this.rest &&
      !w.hazards.some((h) => h.until > t)
    ) {
      const e = this.spawn("boss", Math.atan2(-w.player.y, -w.player.x));
      if (e) {
        this.boss = true;
        this.initialize(e);
        this.horde = t + 3;
        w.effects.push({ type: "boss", ...e });
      }
    }
    if (this.boss) {
      const boss = w.enemies.find((e) => e.hp > 0 && e.kind === "boss");
      if (
        boss &&
        !elites.length &&
        t >= this.rest &&
        t >= this.horde &&
        boss.state !== "recover" &&
        !boss.trace?.deadUntil &&
        (t - this.reinforceEpoch) % 14 < 9
      ) {
        const n = w.enemies.filter(
          (e) => e.hp > 0 && e.kind === "shackleshard",
        ).length;
        for (let i = 0; i < Math.min(6, 28 - n); i++)
          this.spawn(
            "shackleshard",
            (i * Math.PI) / 4 + w.random() * 0.3,
            true,
          );
        this.horde = t + 3;
      }
      return;
    }
    for (let i = 0; i < 4; i++) {
      const at = [135, 225, 305, 311][i],
        deadline = i === 2 ? 328 : i === 3 ? 334 : 340;
      if (this.rounds[i] || t < at) continue;
      if (t > deadline) {
        this.rounds[i] = true;
        continue;
      }
      if (i < 3 && (elites.length || t < this.rest)) continue;
      if (i === 3 && (!this.firstReturn || t < this.firstReturn + 6)) continue;
      const e = this.spawn(
        i === 0 || i === 2 ? "trailmarshal" : "reversejailer",
        w.random() * Math.PI * 2,
      );
      if (e) {
        this.rounds[i] = true;
        if (i === 2) this.firstReturn = t;
        this.special = 6;
        w.effects.push({ type: "elite", ...e });
      }
      break;
    }
    const quiet =
      t >= 350 ||
      (t >= 125 && t < 135) ||
      (t >= 215 && t < 225) ||
      (t >= 295 && t < 305);
    if (this.wave <= 0) {
      const n = quiet
        ? 3
        : Math.floor(
            Math.min(16, 6 + Math.floor(t / 40)) *
              (elites.length >= 2 ? 0.7 : 1),
          );
      for (let i = 0; i < n; i++)
        this.spawn(
          "shackleshard",
          (i >= n / 2 ? Math.PI : 0) + i * 0.15 + w.random() * 0.3,
        );
      this.wave = quiet ? 4 : 2.7;
    }
    if (
      quiet ||
      elites.length ||
      t < this.rest ||
      this.special > 0 ||
      t < 30 ||
      (t >= 295 && t < 340)
    )
      return;
    const kinds: Kind[] =
      t < 65
        ? ["fettersprinter"]
        : t < 95
          ? ["trailhound"]
          : t < 125
            ? ["turnwarden"]
            : t >= 265 && t < 295
              ? ["fettersprinter", "trailhound"]
              : Math.floor(t / 20) % 2
                ? ["fettersprinter", "trailhound"]
                : ["trailhound", "turnwarden"];
    if (
      w.enemies.some(
        (e) =>
          e.hp > 0 &&
          traceEnemy(e.kind) &&
          e.kind !== "shackleshard" &&
          !isElite(e.kind) &&
          !kinds.includes(e.kind),
      )
    )
      return;
    this.spawn(
      kinds[Math.floor(t / 5) % kinds.length],
      w.random() * Math.PI * 2,
    );
    this.special = 9;
  }

  initialize(e: Enemy) {
    if (e.kind !== "boss") return;
    const s = this.state(e);
    if (s.total) return;
    s.total = e.maxHp;
    e.hp = e.maxHp = s.total * 0.35;
  }
  keep(e: Enemy) {
    return e.kind === "boss" && e.trace?.life === 1 && !!e.trace.deadUntil;
  }
  totalRemaining(e: Enemy) {
    const s = this.state(e);
    return Math.max(0, e.hp) + (s.life === 1 && s.total ? s.total * 0.65 : 0);
  }
  progress(e: Enemy) {
    const s = this.state(e);
    return {
      form: s.life,
      livesRemaining: e.hp <= 0 && !s.deadUntil ? 0 : s.life === 1 ? 2 : 1,
      remaining: this.totalRemaining(e) / (s.total || e.maxHp),
    };
  }
  tick() {
    const w = this.w;
    if (!w.active) return;
    for (const e of w.enemies) {
      const s = e.trace;
      if (s?.deadUntil && s.life === 1 && w.time + 1e-9 >= s.deadUntil) {
        s.life = 2;
        s.deadUntil = undefined;
        s.item = undefined;
        s.qualified = false;
        s.vulnerable = false;
        e.hp = e.maxHp = s.total! * 0.65;
        e.state = "seek";
        e.immovable = false;
        e.bossPhase = 2;
        e.pattern = 0;
        e.attack = 0;
        this.clearTarget(e);
        this.history.clear();
        this.stats.revivals++;
        this.reinforceEpoch = w.time;
        this.horde = w.time + 3;
        w.effects.push({ type: "bossPhase", ...e, value: 2 });
        w.touch();
      }
    }
  }
  private clearTarget(e: Enemy) {
    e.burn =
      e.burnUntil =
      e.burnNext =
      e.slow =
      e.slowUntil =
      e.freezeUntil =
      e.freezeReady =
      e.fracture =
      e.fractureUntil =
        0;
    this.w.armory.support.clearTarget(e.id);
  }
  supplies(e: Enemy) {
    const s = this.state(e);
    if (!s.total) return;
    let n = s.milestones ?? 0;
    while (
      n < 3 &&
      this.totalRemaining(e) <= s.total * (0.75 - n * 0.25) + 1e-8
    ) {
      this.w.dropBossPotion(e);
      n++;
    }
    s.milestones = n;
  }
  onDeath(e: Enemy) {
    const s = this.state(e);
    if (s.item) traceCut(s.item, this.w.time);
    if (e.kind === "boss" && s.life === 1 && s.total) {
      e.hp = 0;
      s.deadUntil = Math.max(this.w.time, s.item?.until ?? 0) + 2.4;
      s.vulnerable = false;
      e.immovable = true;
      this.clearTarget(e);
      this.history.clear();
      return true;
    }
    if (
      isElite(e.kind) &&
      !this.w.enemies.some((o) => o.hp > 0 && o.id !== e.id && isElite(o.kind))
    )
      this.rest = this.w.time + (this.w.time >= 360 ? 3 : 6);
    return false;
  }
  onHit(e: Enemy, source: string, dealt: number) {
    const s = this.state(e),
      skill = source === "needleEcho" ? "needle" : (source as Skill);
    if (
      e.kind !== "boss" ||
      !s.qualified ||
      !s.vulnerable ||
      e.state !== "recover" ||
      dealt <= 0 ||
      !(this.w.skills[skill] > 0) ||
      distance(e, this.w.player) > 2.8
    )
      return;
    this.w.challenge.traceGroups.add(`${s.life}${s.action}`);
    const dir = s.item?.trace?.direction;
    if (
      s.life === 2 &&
      s.action === "A" &&
      !this.w.challenge.traceDirection &&
      dir
    )
      this.w.challenge.traceDirection = dir;
  }
  private move(e: Enemy, dt: number, target = this.w.player) {
    const s = this.state(e),
      d = distance(e, target),
      speed =
        e.kind === "boss"
          ? d > 5.2
            ? 5
            : s.life === 2
              ? 2.4
              : 1.6
          : ENEMIES[e.kind].speed;
    advanceTactically(
      traceMap,
      e,
      target,
      speed * (e.slowUntil > this.w.time ? 1 - e.slow : 1),
      dt,
      e.kind === "boss" || isElite(e.kind) ? 0.7 : 0.35,
    );
  }
  movePlayer(dt: number) {
    this.clean();
    traceMove(
      this.w.player,
      { x: this.w.move.x * this.w.speed, y: this.w.move.y * this.w.speed },
      dt,
      0.3,
      this.w.time,
      (a, z, from, to) => {
        this.history.record(a, from);
        this.history.record(z, to);
        this.sample(a, z, from, to);
      },
    );
  }
  sample(a: Point, z: Point, from: number, to: number) {
    for (const h of this.w.hazards)
      if (h.trace) {
        const b = h.trace;
        for (const pass of traceImpacts(h, z, to, from, a))
          if (!b.hitPasses.includes(pass)) {
            b.hitPasses.push(pass);
            const hp = this.w.hp;
            this.w.hurt(
              pass === 3 && b.life === 2 ? 28 : h.damage,
              h.damageLabel!,
              false,
              h.source,
            );
            b.damaged = true;
          }
        b.last = to;
        b.player = { ...z };
      }
  }
  stepHazard(h: Hazard) {
    if (h.trace && h.trace.last < this.w.time)
      this.sample(h.trace.player, this.w.player, h.trace.last, this.w.time);
  }
  clean() {
    for (const h of this.w.hazards)
      if (h.trace) {
        const e = this.w.enemies.find((e) => e.id === h.source);
        if (!e || e.hp <= 0 || e.freezeUntil > this.w.time) {
          if (!h.trace.interrupted) {
            traceCut(
              h,
              e?.freezeUntil! > this.w.time ? h.trace.last : this.w.time,
            );
            this.stats.cancelled++;
          }
        } else if (e.state === "windup" || e.state === "charge")
          traceBodySync(e, h, this.w.time);
      }
  }
  plan(e: Enemy, turn = 0): Hazard[] {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss",
      large = boss || isElite(e.kind),
      late = boss && s.life === 2,
      warning = large ? 2.4 : 2.2,
      speed = large
        ? late
          ? 5.2
          : 4.6
        : e.kind === "fettersprinter"
          ? 3.8
          : 4.4;
    const aim = Math.atan2(w.player.y - e.y, w.player.x - e.x) + turn,
      point = (p: Point, r: number, a: number) => ({
        x: p.x + Math.cos(a) * r,
        y: p.y + Math.sin(a) * r,
      });
    const a = s.action;
    let points: Point[] = [
        { x: e.x, y: e.y },
        point(e, boss ? 5.2 : e.kind === "turnwarden" ? 3.6 : 4.8, aim),
      ],
      genuine = false,
      historical = false,
      direction: TraceDirection | undefined;
    const needsHistory = late || e.kind === "trailhound" || isElite(e.kind);
    if (needsHistory) {
      const route = this.history.route(e, w.time, late && a === "C");
      if (route) {
        points = route.points;
        historical = true;
        genuine = route.genuine;
        direction = route.direction;
      } else if (late && a === "B") return [];
    }
    if (boss && s.life === 1 && a === "B") {
      const mid = point(e, 3, aim);
      points = [
        { x: e.x, y: e.y },
        mid,
        point(mid, 3, aim + ((e.pattern % 2 ? 1 : -1) * Math.PI) / 3),
      ];
    }
    if (e.kind === "trailhound") {
      let len = points
        .slice(1)
        .reduce((n, p, i) => n + distance(p, points[i]), 0);
      if (points.length > 3 || len > 4.8) {
        points = [{ x: e.x, y: e.y }, point(e, 4.8, aim)];
        historical = false;
        genuine = false;
      }
    }
    const sweepOnly = boss && s.life === 1 && a === "C";
    const legs = sweepOnly
      ? []
      : traceLegs(
          points,
          w.time + warning,
          speed,
          1,
          boss && s.life === 1 && a === "B" ? 0.6 : 0,
        );
    const pending =
      (late && a === "B") ||
      e.kind === "turnwarden" ||
      e.kind === "reversejailer"
        ? "return"
        : (late && a === "C") || e.kind === "trailmarshal"
          ? "sweep"
          : undefined;
    const sweep = sweepOnly
      ? {
          x: e.x,
          y: e.y,
          angle: aim,
          radius: 3.2,
          half: (70 * Math.PI) / 180,
          due: w.time + warning,
          end: w.time + warning + 0.2,
          hit: false,
          old: false,
        }
      : undefined;
    const end = legs.length ? legs[legs.length - 1].end : sweep!.end;
    return [
      {
        id: w.id(),
        source: e.id,
        kind: "circle",
        x: e.x,
        y: e.y,
        angle: aim,
        radius: 0,
        width: 0,
        created: w.time,
        due: w.time + warning,
        until: pending ? end + warning + 0.2 : end,
        damage: late && a === "B" ? 28 : large ? 26 : 22,
        fixedDamage: true,
        damageLabel: "刑官实体冲锋",
        fired: false,
        next: 0,
        trace: {
          legs,
          radius: boss ? (late ? 0.55 : 0.65) : 0.42,
          last: w.time,
          player: { ...w.player },
          action: a,
          life: s.life,
          genuine,
          historical,
          direction,
          hitPasses: [],
          sweep,
          pending,
          route: points.map((p) => ({ ...p })),
        },
      },
    ];
  }
  legal(h: Hazard) {
    const b = h.trace!,
      visible = (p: Point, r: number) =>
        Math.abs(p.x - this.w.camera.x) + r < this.w.viewport.x - 0.4 &&
        p.y - this.w.camera.y + r < this.w.viewport.y - 2.6 &&
        p.y - this.w.camera.y - r > -this.w.viewport.y + 2.7;
    if (
      b.legs.some(
        (f) =>
          [f.from, f.to].some(
            (p) =>
              Math.abs(p.x) > 21.3 ||
              Math.abs(p.y) > 25.3 ||
              !visible(p, b.radius),
          ) || traceMap.segment(f.from, f.to, 0.7),
      )
    )
      return false;
    if (b.sweep) {
      const f = b.sweep;
      for (let i = 0; i <= 32; i++) {
        const a = f.angle - f.half + (2 * f.half * i) / 32;
        if (
          !visible(
            {
              x: f.x + Math.cos(a) * f.radius,
              y: f.y + Math.sin(a) * f.radius,
            },
            0.3,
          )
        )
          return false;
      }
    }
    return true;
  }
  begin(e: Enemy, items?: Hazard[]) {
    const s = this.state(e),
      w = this.w;
    if (this.slots >= 2) {
      e.attack = 0.2;
      return false;
    }
    let chosen = items;
    for (const turn of [
      0,
      Math.PI / 6,
      -Math.PI / 6,
      Math.PI / 3,
      -Math.PI / 3,
      Math.PI / 2,
      -Math.PI / 2,
      Math.PI,
    ]) {
      if (chosen) break;
      const hs = this.plan(e, turn);
      if (hs.length && hs.every((h) => this.legal(h)) && traceEscape(w, hs))
        chosen = hs;
    }
    if (
      !chosen?.length ||
      chosen.some((h) => !this.legal(h)) ||
      !traceEscape(w, chosen)
    ) {
      this.stats.rejected++;
      this.recover(e);
      e.pattern++;
      return false;
    }
    s.item = chosen[0];
    if (chosen[0].trace!.genuine) this.stats.genuineCasts++;
    if (chosen[0].trace!.historical) this.stats.historyCasts++;
    s.vulnerable = false;
    s.qualified = false;
    e.state = "windup";
    e.immovable = true;
    w.hazards.push(...chosen);
    if (e.kind === "boss") {
      this.choices.commit(e, s.action);
      this.stats.patterns[s.action]++;
      this.stats.phases[s.life - 1]++;
    } else if (isElite(e.kind)) {
      this.stats.eliteCasts[e.kind as "trailmarshal" | "reversejailer"]++;
      this.lastElite = e.id;
    }
    return true;
  }
  private recover(e: Enemy) {
    const s = this.state(e),
      b = s.item?.trace;
    s.qualified =
      !!b &&
      !b.interrupted &&
      !b.damaged &&
      !b.pending &&
      !b.cancelled &&
      (s.life === 1 ? s.action === "B" : b.genuine);
    s.vulnerable = true;
    e.immovable = false;
    e.state = "recover";
    e.timer =
      (e.kind === "boss"
        ? (s.life === 1 ? [4.6, 5, 5.2] : [5, 5.4, 5.6])[
            "ABC".indexOf(s.action)
          ]
        : isElite(e.kind)
          ? 4.6
          : 3) * stageRecoveryFactor(this.w.stageId);
  }
  private finishPart(e: Enemy, h: Hazard) {
    const w = this.w,
      b = h.trace!,
      end = Math.max(h.due, ...b.legs.map((f) => f.end));
    if (!b.pending || w.time < end) return;
    const next = b.pending;
    b.pending = undefined;
    if (next === "return") {
      const points = b.route
        .slice()
        .reverse()
        .map((p) => ({ ...p }));
      const original = b.legs.slice();
      b.legs.push(
        ...traceLegs(
          points,
          w.time + (isElite(e.kind) || e.kind === "boss" ? 2.4 : 2.2),
          e.kind === "boss" ? 5.2 : 4.4,
          2,
        ),
      );
      h.until = b.legs[b.legs.length - 1].end;
      if (!this.legal(h) || !traceEscape(w, [])) {
        b.legs = original;
        b.interrupted = true;
        h.until = w.time;
      }
      return;
    }
    const f = {
      x: e.x,
      y: e.y,
      angle: Math.atan2(w.player.y - e.y, w.player.x - e.x),
      radius: 3.4,
      half: (75 * Math.PI) / 180,
      due: w.time + 2.4,
      end: w.time + 2.6,
      hit: false,
      old: false,
    };
    const proposal: Hazard = {
      ...h,
      until: f.end,
      trace: { ...b, legs: [], sweep: f },
    };
    if (this.legal(proposal) && traceEscape(w, [proposal])) {
      b.sweep = f;
      h.until = f.end;
    } else {
      b.interrupted = true;
      h.until = w.time;
    }
  }
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w,
      s = this.state(e);
    if (e.freezeUntil > w.time) {
      if (s.item && !s.item.trace!.interrupted) traceCut(s.item, w.time);
      if (s.item?.until! > w.time) return;
      if (e.state !== "recover") this.recover(e);
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "seek";
        s.item = undefined;
        s.vulnerable = false;
        s.qualified = false;
        e.attack = e.kind === "boss" || isElite(e.kind) ? 0 : 3;
      }
      return;
    }
    if (s.item && (e.state === "windup" || e.state === "charge")) {
      const h = s.item;
      traceBodySync(e, h, w.time);
      this.finishPart(e, h);
      const f = h.trace!.legs.find((f) => w.time >= f.due && w.time < f.end);
      e.state = f ? "charge" : "windup";
      if (w.time >= h.until) this.recover(e);
      return;
    }
    if (e.kind === "shackleshard") {
      this.move(e, dt);
      if (distance(e, w.player) < 0.65) w.hurt(12, e.kind, false);
      return;
    }
    if (
      e.kind !== "boss" &&
      !isElite(e.kind) &&
      w.enemies.some((o) => o.hp > 0 && isElite(o.kind))
    )
      return;
    const d = distance(e, w.player);
    if (d > (e.kind === "boss" ? 5.2 : 5) || !w.visible(e, 1)) {
      this.move(e, dt);
      return;
    }
    if (d < (e.kind === "boss" ? 1 : 0.65))
      w.hurt(e.kind === "boss" ? 22 : ENEMIES[e.kind].contact, e.kind, false);
    e.attack -= dt;
    if (e.attack > 0) {
      if (d > 3.2) this.move(e, dt);
      return;
    }
    if (isElite(e.kind)) {
      const ready = w.enemies
        .filter(
          (o) =>
            o.hp > 0 && isElite(o.kind) && o.state === "seek" && o.attack <= 0,
        )
        .sort(
          (a, b) =>
            Number(a.id === this.lastElite) - Number(b.id === this.lastElite) ||
            a.id - b.id,
        );
      if (ready.length && ready[0] !== e) return;
    }
    s.action =
      e.kind === "boss"
        ? ("ABC"[e.pattern % 3] as BossAction)
        : e.kind === "turnwarden" || e.kind === "reversejailer"
          ? "B"
          : e.kind === "trailmarshal"
            ? "C"
            : "A";

    if (
      ((s.life === 2 && e.kind === "boss") ||
        e.kind === "trailhound" ||
        isElite(e.kind)) &&
      !this.history.route(e, w.time) &&
      !this.history.route(e, w.time, true)
    ) {
      if (
        s.approach &&
        w.time < (s.approachUntil ?? 0) &&
        distance(e, s.approach) > 1.05
      ) {
        this.move(e, dt, s.approach);
        return;
      }
      if (s.approach) {
        s.approach = undefined;
        s.historyRetry = w.time + 3;
      }
      if (w.time >= (s.historyRetry ?? 0)) {
        const candidate = this.history.samples
          .filter((p) => !traceMap.blocked(p, 0.7))
          .sort((a, b) => distance(a, e) - distance(b, e))[0];
        if (candidate && distance(candidate, e) > 1.05) {
          s.approach = { x: candidate.x, y: candidate.y };
          s.approachUntil = w.time + 1.5;
          s.historyRetry = w.time + 4.5;
          this.move(e, dt, s.approach);
          return;
        }
      }
    } else s.approach = undefined;
    let proposal;
    if (e.kind === "boss" && this.slots === 0) {
      proposal = this.choices.choose(
        e,
        s.action,
        (action, turn) => this.plan({ ...e, trace: { ...s, action } }, turn),
        (items) => items.every((h) => this.legal(h)) && traceEscape(w, items),
        (items) =>
          items.some(
            (h) => traceImpacts(h, w.player, h.until, w.time).length > 0,
          ),
      );
      if (proposal) s.action = proposal.action;
    }
    if (this.begin(e, proposal?.items)) e.pattern++;
  }
}
