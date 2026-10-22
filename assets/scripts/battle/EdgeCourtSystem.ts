import { stageRecoveryFactor } from "./StagePressure";
import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, ALL_WEAPONS, Kind, Skill, isElite } from "./SurvivalConfig";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import { edgeMap } from "./EdgeCourtMap";
import {
  edgeEnvelope,
  edgeSolid,
  edgeMove,
  edgeImpacts,
  edgeCut,
  edgeEscape,
  edgePosition,
} from "./EdgeCourtGeometry";
import type { EdgeFlight } from "./EdgeCourtGeometry";
export const EDGE_KINDS: readonly Kind[] = [
  "scrapbound",
  "edgecaster",
  "stepcutter",
  "reelstalker",
  "twinclamp",
  "edgepuppeteer",
];
export const edgeEnemy = (kind: Kind) => EDGE_KINDS.includes(kind);
export interface EdgeState {
  action:
    | "blade"
    | "step"
    | "reel"
    | "pair"
    | "mixed"
    | "A"
    | "B"
    | "C"
    | "transition";
  step: number;
  next: number;
  recover: number;
  vulnerable: boolean;
  items?: Hazard[];
  origin?: Point;
  relocate?: Point;
  relocateUntil?: number;
  waiting?: number;
  qualify?: { group: number; phase: number; until: number };
}
export class EdgeCourtSystem {
  private wave = 0;
  private special = 0;
  private rounds = [false, false, false, false];
  private firstReturn = 0;
  private boss = false;
  private horde = 0;
  private rest = 0;
  private lastStart = -Infinity;
  private lastElite = 0;
  readonly stats = {
    blade: 0,
    body: 0,
    rejected: 0,
    cancelled: 0,
    qualified: 0,
    eliteCasts: { twinclamp: 0, edgepuppeteer: 0 },
    patterns: { A: 0, B: 0, C: 0 },
    phases: [0, 0, 0],
    phasePatterns: [
      { A: 0, B: 0, C: 0 },
      { A: 0, B: 0, C: 0 },
      { A: 0, B: 0, C: 0 },
    ],
  };
  constructor(private w: SurvivalWorld) {}
  state(e: Enemy): EdgeState {
    return (
      e.edge ??
      (e.edge = {
        action: "blade",
        step: 0,
        next: 0,
        recover: 3,
        vulnerable: false,
      })
    );
  }
  get slots() {
    return this.w.hazards.filter(
      (h) => h.until > this.w.time && !h.edge?.cancelled,
    ).length;
  }
  position(angle: number, r = 9): Point | undefined {
    for (let i = 0; i < 24; i++) {
      const a = angle + (i * Math.PI) / 12,
        p = {
          x: Math.max(-21, Math.min(21, this.w.player.x + Math.cos(a) * r)),
          y: Math.max(-25, Math.min(25, this.w.player.y + Math.sin(a) * r)),
        };
      if (distance(p, this.w.player) > 3 && !edgeMap.blocked(p, 0.8)) return p;
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
    if (t >= 360 && !this.boss) {
      const e = this.spawn("boss", Math.atan2(-w.player.y, -w.player.x));
      if (e) {
        this.boss = true;
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
        boss.edge?.action !== "transition" &&
        (t - 360) % 14 < 9
      ) {
        const n = w.enemies.filter(
          (e) => e.hp > 0 && e.kind === "scrapbound",
        ).length;
        for (let i = 0; i < Math.min(6, 28 - n); i++)
          this.spawn("scrapbound", (i * Math.PI) / 4 + w.random() * 0.3, true);
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
        i === 0 || i === 2 ? "twinclamp" : "edgepuppeteer",
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
          "scrapbound",
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
        ? ["edgecaster"]
        : t < 95
          ? ["stepcutter"]
          : t < 125
            ? ["reelstalker"]
            : t >= 265 && t < 295
              ? ["edgecaster", "stepcutter"]
              : Math.floor(t / 20) % 2
                ? ["edgecaster", "stepcutter"]
                : ["stepcutter", "reelstalker"];
    if (
      w.enemies.some(
        (e) =>
          e.hp > 0 &&
          edgeEnemy(e.kind) &&
          e.kind !== "scrapbound" &&
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
  private recover(e: Enemy, seconds = this.state(e).recover) {
    const s = this.state(e),
      items = s.items ?? [];
    e.state = "recover";
    e.timer = seconds * stageRecoveryFactor(this.w.stageId);
    e.immovable = false;
    s.step = 0;
    s.vulnerable = true;
    s.waiting = undefined;
    const complete =
      items.length &&
      items.every(
        (h) =>
          !h.edge!.interrupted &&
          !h.edge!.damaged &&
          h.edge!.flights.every(
            (f) => !f.cancelled && f.end <= this.w.time + 1e-8,
          ),
      );
    s.qualify =
      complete && e.kind === "boss" && items[0].edge!.bossC
        ? {
            group: items[0].edge!.group,
            phase: items[0].edge!.phase,
            until: this.w.time + e.timer,
          }
        : undefined;
    s.items = undefined;
    s.origin = undefined;
  }
  onHit(e: Enemy, source: string, dealt: number) {
    const q = e.edge?.qualify;
    if (
      e.kind !== "boss" ||
      e.state !== "recover" ||
      !q ||
      this.w.time > q.until ||
      dealt <= 0 ||
      distance(e, this.w.player) > 2.8 ||
      (!ALL_WEAPONS.includes(source as Skill) && source !== "needleEcho")
    )
      return;
    if (!this.w.challenge.edgePhases.has(q.phase)) {
      this.w.challenge.edgePhases.add(q.phase);
      this.stats.qualified++;
    }
  }
  private move(e: Enemy, dt: number, target = this.w.player) {
    const d = distance(e, target),
      a = edgeMap.heading(e, target),
      speed =
        (e.kind === "boss" ? (d > 4.5 ? 5 : 1.6) : ENEMIES[e.kind].speed) *
        (e.slowUntil > this.w.time ? 1 - e.slow : 1);
    e.facing = a;
    if (d > 0.25)
      edgeMove(
        e,
        { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
        dt,
        e.kind === "boss" ? 0.7 : 0.35,
        this.w.time,
      );
  }
  movePlayer(dt: number) {
    this.clean();
    const w = this.w;
    edgeMove(
      w.player,
      { x: w.move.x * w.speed, y: w.move.y * w.speed },
      dt,
      0.3,
      w.time,
      (a, z, from, to) => this.sample(a, z, from, to),
    );
  }
  sample(a: Point, z: Point, from: number, to: number) {
    const w = this.w;
    for (const h of w.hazards)
      if (h.edge && !h.edge.cancelled) {
        const b = h.edge;
        for (const index of edgeImpacts(h, z, to, from, a)) {
          const f = b.flights.find((f) => f.index === index)!;
          if (f.hit) continue;
          f.hit = true;
          const hp = w.hp;
          w.hurt(h.damage, h.damageLabel!, false, h.source);
          if (w.hp < hp) b.damaged = true;
        }
        if (to >= h.due) h.fired = true;
        b.last = to;
        b.player = { ...z };
      }
  }
  private flight(
    from: Point,
    to: Point,
    due: number,
    speed: number,
    index: number,
    body = false,
  ): EdgeFlight {
    return {
      from: { ...from },
      to: { ...to },
      due,
      end: due + distance(from, to) / speed,
      angle: Math.atan2(to.y - from.y, to.x - from.x),
      halfLength: body ? 0 : 0.45,
      radius: body ? 0.55 : 0.18,
      index,
      hit: false,
    };
  }
  private hazard(
    e: Enemy,
    shape: "blade" | "body",
    flights: EdgeFlight[],
    order: number,
    group: number,
  ): Hazard {
    const w = this.w;
    return {
      id: w.id(),
      source: e.id,
      kind: "circle",
      ...flights[0].from,
      angle: flights[0].angle,
      radius: 0,
      width: 0,
      created: w.time,
      due: flights[0].due,
      until: flights[flights.length - 1].end,
      damage:
        e.kind === "boss"
          ? e.bossPhase === 3
            ? 28
            : 26
          : isElite(e.kind)
            ? 26
            : 22,
      fixedDamage: true,
      damageLabel: shape === "blade" ? "离刃去回" : "本体换步",
      fired: false,
      next: 0,
      edge: {
        shape,
        flights,
        group,
        phase: e.bossPhase,
        bossC: e.kind === "boss" && this.state(e).action === "C",
        order,
        last: w.time,
        player: { ...w.player },
      },
    };
  }
  /** Every origin is the actual owner or a previously authored body endpoint. No independent hull translation. */
  plan(e: Enemy, rotation = 0): Hazard[] {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss",
      phase = boss ? e.bossPhase : 1,
      large = boss || isElite(e.kind),
      warning = large ? 2.2 : 2,
      A = { x: e.x, y: e.y },
      angle = Math.atan2(w.player.y - e.y, w.player.x - e.x) + rotation;
    const point = (p: Point, d: number, a: number) => ({
      x: p.x + Math.cos(a) * d,
      y: p.y + Math.sin(a) * d,
    });
    const group = w.id(),
      items: Hazard[] = [],
      maxStep = phase === 3 ? 3.2 : 3.6;
    let C = point(A, maxStep, angle + (phase === 2 ? 0.85 : -0.59)),
      D = C;
    const double = phase === 3 && (s.action === "B" || s.action === "C");
    if (double) {
      const target = point(A, 1.4, angle - 0.55),
        d = distance(C, target);
      D = point(
        C,
        Math.min(3.2, d),
        Math.atan2(target.y - C.y, target.x - C.x),
      );
    }
    const body = (first: number) => {
      const fs = [this.flight(A, C, w.time + first, 4, 0, true)];
      if (double) fs.push(this.flight(C, D, fs[0].end + 2.2, 4, 1, true));
      return this.hazard(e, "body", fs, 2, group);
    };
    const blade = (
      start: Point,
      end: Point,
      recall: Point,
      due: number,
      order = 1,
      earliestReturn = 0,
    ) => {
      const first = this.flight(start, end, due, 3, 0),
        back = this.flight(
          end,
          recall,
          Math.max(first.end + 2, earliestReturn),
          2.8,
          1,
        );
      return this.hazard(e, "blade", [first, back], order, group);
    };
    const length = Math.min(5, Math.max(3.2, distance(e, w.player) + 0.5));
    if (s.action === "step") {
      items.push(body(warning));
    } else if (
      s.action === "pair" ||
      (boss && phase === 3 && s.action === "A")
    ) {
      const count = boss || e.pattern % 3 === 2 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const turn =
            count === 2 ? (i ? -0.4 : 0.4) : e.pattern % 2 ? 0.3 : -0.3,
          B = point(A, length, angle + turn);
        items.push(blade(A, B, A, w.time + warning + i * 0.8, i + 1));
      }
    } else if (s.action === "B") {
      const step = body(warning);
      items.push(step);
      const due = step.until + warning,
        B = point(D, 3.4, angle + (phase === 2 ? -0.5 : 0.3));
      items.push(blade(D, B, D, due));
    } else if (
      s.action === "mixed" ||
      s.action === "reel" ||
      s.action === "C" ||
      (s.action === "A" && phase >= 2)
    ) {
      const step = body(warning + 0.3),
        B = point(A, length, angle);
      items.push(blade(A, B, D, w.time + warning, 1, step.until + 0.15), step);
    } else {
      const B = point(A, length, angle);
      items.push(blade(A, B, A, w.time + warning));
    }
    return items;
  }
  legal(h: Hazard) {
    return (
      h.edge!.flights.every(
        (f) =>
          distance(f.from, f.to) > 0.05 &&
          distance(f.from, f.to) <=
            (h.edge!.shape === "body" ? 3.6 : 5.2) + 1e-8,
      ) &&
      !edgeSolid(h) &&
      edgeEnvelope(h).every(
        (p) =>
          Math.abs(p.x - this.w.camera.x) < this.w.viewport.x - 0.4 &&
          p.y - this.w.camera.y < this.w.viewport.y - 2.6 &&
          p.y - this.w.camera.y > -this.w.viewport.y + 2.7,
      )
    );
  }
  private recovery(e: Enemy) {
    const a = this.state(e).action;
    return e.kind === "boss"
      ? e.bossPhase === 1
        ? a === "A"
          ? 4
          : a === "B"
            ? 4.2
            : 4.6
        : e.bossPhase === 2
          ? a === "A"
            ? 4.6
            : a === "B"
              ? 4.4
              : 4.8
          : a === "A"
            ? 4.8
            : a === "B"
              ? 5
              : 5.2
      : isElite(e.kind)
        ? 4
        : e.kind === "stepcutter"
          ? 3
          : 3.2;
  }
  begin(e: Enemy) {
    const w = this.w,
      s = this.state(e);
    let items = this.plan(e);
    s.recover = this.recovery(e);
    if (this.slots + items.length > 2) {
      e.attack = 0.2;
      return false;
    }
    let valid = items.every((h) => this.legal(h)) && edgeEscape(w, items);
    if (!valid)
      for (const turn of [
        Math.PI / 6,
        -Math.PI / 6,
        Math.PI / 3,
        -Math.PI / 3,
        Math.PI / 2,
        -Math.PI / 2,
        Math.PI,
      ]) {
        const candidate = this.plan(e, turn);
        if (candidate.every((h) => this.legal(h)) && edgeEscape(w, candidate)) {
          items = candidate;
          valid = true;
          break;
        }
      }
    if (!valid) {
      this.stats.rejected++;
      this.recover(e);
      s.relocate = this.position(
        Math.atan2(e.y - w.player.y, e.x - w.player.x) + Math.PI / 3,
        3.2,
      );
      s.relocateUntil = w.time + 6;
      return false;
    }
    w.hazards.push(...items);
    s.items = items;
    s.origin = { x: e.x, y: e.y };
    s.qualify = undefined;
    s.step = 1;
    s.next = Math.max(...items.map((h) => h.until));
    s.vulnerable = false;
    s.waiting = undefined;
    e.state = "windup";
    e.immovable = true;
    for (const h of items) this.stats[h.edge!.shape]++;
    if (
      e.kind === "boss" &&
      (s.action === "A" || s.action === "B" || s.action === "C")
    ) {
      this.stats.patterns[s.action]++;
      this.stats.phases[e.bossPhase - 1]++;
      this.stats.phasePatterns[e.bossPhase - 1][s.action]++;
    }
    if (e.kind === "twinclamp" || e.kind === "edgepuppeteer") {
      this.stats.eliteCasts[e.kind]++;
      this.lastElite = e.id;
    }
    return true;
  }
  private cancelPending(e: Enemy, dead = false) {
    const s = this.state(e);
    s.qualify = undefined;
    for (const h of s.items ?? [])
      if (h.until > this.w.time && !h.edge!.interrupted) {
        edgeCut(h, this.w.time, dead);
        this.stats.cancelled++;
      }
  }
  /** Move the real body to its exact authored position before collision/rendering, even when a current dash is frozen. */
  syncBody(e: Enemy, time = this.w.time) {
    // A completed dash must not overwrite later seeking/navigation movement.
    if (e.state === "seek") return;
    const s = this.state(e),
      body = s.items?.find((h) => h.edge!.shape === "body");
    if (!body) return;
    let p = s.origin ?? e;
    for (const f of body.edge!.flights) {
      if (f.cancelled || time < f.due) break;
      p = edgePosition(f, time);
      if (time < f.end) e.facing = f.angle;
    }
    e.x = p.x;
    e.y = p.y;
  }
  clean() {
    const w = this.w;
    for (const h of w.hazards)
      if (h.edge && !h.edge.interrupted) {
        const owner = w.enemies.find((e) => e.id === h.source && e.hp > 0);
        if (!owner || owner.freezeUntil > w.time) edgeCut(h, w.time, !owner);
      }
  }
  onDeath(e: Enemy) {
    this.cancelPending(e, true);
    if (
      isElite(e.kind) &&
      !this.w.enemies.some((o) => o.id !== e.id && o.hp > 0 && isElite(o.kind))
    )
      this.rest = this.w.time + (this.w.time >= 360 ? 3 : 6);
    return false;
  }
  private eliteTurn(e: Enemy) {
    const w = this.w,
      s = this.state(e);
    s.waiting ??= w.time;
    const ready = w.enemies
      .filter(
        (o) =>
          o.hp > 0 &&
          isElite(o.kind) &&
          o.state === "seek" &&
          o.attack <= 0 &&
          o.freezeUntil <= w.time,
      )
      .sort(
        (a, b) =>
          (this.state(a).waiting ?? w.time) -
            (this.state(b).waiting ?? w.time) ||
          Number(a.id === this.lastElite) - Number(b.id === this.lastElite) ||
          a.id - b.id,
      );
    return !ready.length || ready[0].id === e.id;
  }
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss";
    this.syncBody(e);
    if (boss) {
      const target = e.hp / e.maxHp <= 0.35 ? 3 : e.hp / e.maxHp <= 0.7 ? 2 : 1;
      if (target > e.bossPhase) {
        e.bossPhase = target;
        this.cancelPending(e);
        s.next = Math.max(
          s.action === "transition" ? s.next : w.time + 1.5,
          ...(s.items ?? []).map((h) => h.until),
        );
        s.action = "transition";
        s.step = 0;
        s.vulnerable = false;
        e.pattern = 0;
        e.state = "windup";
        e.immovable = true;
        w.effects.push({ type: "bossPhase", ...e, value: e.bossPhase });
        return;
      }
    }
    if (e.freezeUntil > w.time) {
      this.cancelPending(e);
      if (s.step && !(s.items ?? []).some((h) => h.until > w.time))
        this.recover(e);
      return;
    }
    if (s.action === "transition") {
      e.timer = Math.max(0, s.next - w.time);
      if (w.time >= s.next) {
        s.action = "blade";
        s.items = undefined;
        s.origin = undefined;
        this.recover(e, 1);
      }
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "seek";
        s.vulnerable = false;
        s.qualify = undefined;
        e.attack = boss || isElite(e.kind) ? 0 : 3.2;
      }
      return;
    }
    if (s.step) {
      const live = (s.items ?? []).filter((h) => h.until > w.time);
      e.timer = Math.max(0, ...live.map((h) => h.due - w.time));
      if (!live.length) this.recover(e);
      return;
    }
    if (e.kind === "scrapbound") {
      this.move(e, dt);
      if (distance(e, w.player) < 0.65) w.hurt(12, e.kind, false);
      return;
    }
    if (
      boss &&
      (w.enemies.some((o) => o.hp > 0 && isElite(o.kind)) ||
        w.hazards.some((h) => h.edge && h.source !== e.id && h.until > w.time))
    ) {
      this.rest = w.time + 3;
      return;
    }
    if (boss && w.time < this.rest) return;
    if (
      !boss &&
      !isElite(e.kind) &&
      w.enemies.some((o) => o.hp > 0 && isElite(o.kind))
    )
      return;
    if (distance(e, w.player) < (boss ? 1 : 0.65))
      w.hurt(boss ? 22 : ENEMIES[e.kind].contact, e.kind, false);
    if (s.relocate) {
      if (w.time < (s.relocateUntil ?? 0) && distance(e, s.relocate) > 0.3) {
        this.move(e, dt, s.relocate);
        return;
      }
      s.relocate = undefined;
    }
    const d = distance(e, w.player);
    if (d > 5 || !w.visible(e, 1.2)) {
      this.move(e, dt);
      return;
    }
    e.attack -= dt;
    if (e.attack > 0) {
      if (d > 3.2) this.move(e, dt);
      return;
    }
    if (isElite(e.kind) && !this.eliteTurn(e)) return;
    if (!boss && !isElite(e.kind) && w.time - this.lastStart < 3) {
      e.attack = 0.2;
      return;
    }
    s.action = boss
      ? ((e.bossPhase === 1
          ? ["A", "B", "C"]
          : e.bossPhase === 2
            ? ["B", "A", "C"]
            : ["C", "B", "A"])[e.pattern % 3] as "A" | "B" | "C")
      : e.kind === "twinclamp"
        ? "pair"
        : e.kind === "edgepuppeteer"
          ? "mixed"
          : e.kind === "stepcutter"
            ? "step"
            : e.kind === "reelstalker"
              ? "reel"
              : "blade";
    if (this.begin(e)) {
      e.pattern++;
      this.lastStart = w.time;
    }
  }
  stepHazard(h: Hazard) {
    const b = h.edge!;
    if (!b.cancelled && b.last < this.w.time)
      this.sample(b.player, this.w.player, b.last, this.w.time);
  }
}
