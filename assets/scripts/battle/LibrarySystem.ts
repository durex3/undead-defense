import { stageRecoveryFactor } from "./StagePressure";
import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, Kind, isElite } from "./SurvivalConfig";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import { libraryMap } from "./LibraryMap";
import {
  libraryCorners,
  libraryEnvelope,
  libraryPosition,
  libraryLocal,
  librarySolid,
  librarySealGap,
  libraryMove,
  libraryImpact,
  librarySealTime,
  libraryEscape,
} from "./LibraryGeometry";
export const LIBRARY_KINDS: readonly Kind[] = [
  "paperbonegrub",
  "sealclerk",
  "folioray",
  "spineclasp",
  "sealprovost",
  "claspjailer",
];
export const libraryEnemy = (kind: Kind) => LIBRARY_KINDS.includes(kind);
export interface LibraryState {
  action:
    "imprint" | "page" | "clamp" | "pair" | "A" | "B" | "C" | "transition";
  step: number;
  next: number;
  recover: number;
  vulnerable: boolean;
  countered: boolean;
  relocate?: Point;
  waiting?: number;
}
export class LibrarySystem {
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
    imprint: 0,
    page: 0,
    clamp: 0,
    stepped: 0,
    cancelled: 0,
    rejected: 0,
    fallback: 0,
    eliteCasts: { sealprovost: 0, claspjailer: 0 },
    patterns: { A: 0, B: 0, C: 0 },
    phases: [0, 0, 0],
  };
  constructor(private w: SurvivalWorld) {}
  state(e: Enemy): LibraryState {
    return (
      e.library ??
      (e.library = {
        action: "imprint",
        step: 0,
        next: 0,
        recover: 2.8,
        vulnerable: false,
        countered: false,
      })
    );
  }
  get slots() {
    return this.w.hazards.filter(
      (h) => h.until > this.w.time && !h.library?.cancelled,
    ).length;
  }
  position(angle: number, r = 9): Point | undefined {
    for (let i = 0; i < 24; i++) {
      const a = angle + (i * Math.PI) / 12,
        p = {
          x: Math.max(-21, Math.min(21, this.w.player.x + Math.cos(a) * r)),
          y: Math.max(-25, Math.min(25, this.w.player.y + Math.sin(a) * r)),
        };
      if (distance(p, this.w.player) > 3 && !libraryMap.blocked(p, 0.8))
        return p;
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
        boss.library?.action !== "transition" &&
        (t - 360) % 14 < 9
      ) {
        const n = w.enemies.filter(
          (e) => e.hp > 0 && e.kind === "paperbonegrub",
        ).length;
        for (let i = 0; i < Math.min(8, 30 - n); i++)
          this.spawn(
            "paperbonegrub",
            (i * Math.PI) / 4 + w.random() * 0.3,
            true,
          );
        this.horde = t + 2.5;
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
        i === 0 || i === 2 ? "sealprovost" : "claspjailer",
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
          "paperbonegrub",
          (i >= n / 2 ? Math.PI : 0) + i * 0.15 + w.random() * 0.3,
        );
      this.wave = quiet ? 4 : 2.8;
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
        ? ["sealclerk"]
        : t < 95
          ? ["folioray"]
          : t < 125
            ? ["spineclasp"]
            : Math.floor(t / 20) % 2
              ? ["sealclerk", "folioray"]
              : ["folioray", "spineclasp"];
    if (
      w.enemies.some(
        (e) =>
          e.hp > 0 &&
          libraryEnemy(e.kind) &&
          e.kind !== "paperbonegrub" &&
          !isElite(e.kind) &&
          !kinds.includes(e.kind),
      )
    )
      return;
    this.spawn(
      kinds[Math.floor(t / 5) % kinds.length],
      w.random() * Math.PI * 2,
    );
    this.special = t < 125 ? 6 : 5;
  }
  private recover(e: Enemy, seconds = this.state(e).recover) {
    const s = this.state(e);
    e.state = "recover";
    e.timer = seconds * stageRecoveryFactor(this.w.stageId) + (e.kind === "boss" && s.countered ? 0.6 : 0);
    e.immovable = false;
    s.step = 0;
    s.vulnerable = true;
    s.countered = false;
    s.waiting = undefined;
  }
  private move(e: Enemy, dt: number, target = this.w.player) {
    const d = distance(e, target),
      a = libraryMap.heading(e, target),
      speed =
        d > 0.3
          ? (e.kind === "boss" ? 1.25 : ENEMIES[e.kind].speed) *
            (e.slowUntil > this.w.time ? 1 - e.slow : 1)
          : 0;
    e.facing = a;
    libraryMove(
      e,
      { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
      dt,
      e.kind === "boss" ? 0.7 : 0.35,
      this.w.time,
    );
  }
  movePlayer(dt: number) {
    const w = this.w;
    this.clean();
    libraryMove(
      w.player,
      { x: w.move.x * w.speed, y: w.move.y * w.speed },
      dt,
      0.3,
      w.time,
      (a, z, from, to) => this.sample(a, z, from, to),
    );
  }
  /** Process foot/sign and release in temporal order on each actual collision-resolved movement segment. */
  sample(a: Point, z: Point, from: number, to: number) {
    const w = this.w;
    const events = w.hazards
      .filter((h) => h.library && !h.library.cancelled)
      .map((h) => ({ h, time: librarySealTime(h, a, z, from, to) }))
      .filter((e): e is { h: Hazard; time: number } => e.time !== null)
      .sort((a, b) => a.time - b.time || a.h.id - b.h.id);
    for (const { h, time } of events) this.counter(h, time);
    for (const h of w.hazards)
      if (h.library && !h.library.cancelled) {
        const b = h.library;
        if (!b.hit && libraryImpact(h, z, to, from, a) !== null) {
          b.hit = true;
          w.hurt(h.damage, h.damageLabel!, false, h.source);
        }
        if (to >= h.due) h.fired = true;
        b.last = to;
        b.player = { ...z };
      }
  }
  counter(h: Hazard, time = this.w.time) {
    const b = h.library;
    if (
      !b ||
      b.cancelled ||
      h.fired ||
      time > h.due + 1e-9 ||
      time < b.published
    )
      return false;
    b.cancelled = true;
    b.countered = true;
    b.cancelledAt = time;
    h.until = Math.min(h.until, time);
    this.stats.stepped++;
    const owner = this.w.enemies.find((e) => e.id === h.source && e.hp > 0);
    this.w.challenge.seals.add(h.id);
    if(owner?.kind === "boss") this.w.challenge.bossSealPhases.add(owner.bossPhase);
    if (owner) this.state(owner).countered = true;
    this.w.effects.push({
      type: "sealBreak",
      ...b.seal,
      value: 0,
      skill: "封签撤招",
    });
    return true;
  }
  private make(
    e: Enemy,
    shape: "imprint" | "page" | "clamp",
    center: Point,
    half: Point,
    angle: number,
    velocity: Point,
    delay: number,
    duration: number,
    damage: number,
    order = 1,
    at = this.w.time,
  ): Hazard {
    return {
      id: this.w.id(),
      source: e.id,
      kind: "circle",
      x: center.x,
      y: center.y,
      angle,
      radius: Math.hypot(half.x, half.y),
      width: 0,
      damage,
      fixedDamage: true,
      damageLabel:
        shape === "imprint"
          ? "禁库钤印"
          : shape === "page"
            ? "巡裁行页"
            : "合卷夹页",
      created: at,
      due: at + delay,
      until: at + delay + duration,
      fired: false,
      next: 0,
      library: {
        shape,
        half: { ...half },
        velocity: { ...velocity },
        seal: { x: 999, y: 999 },
        order,
        published: this.w.time,
        last: this.w.time,
        player: { ...this.w.player },
        hit: false,
      },
    };
  }
  imprint(
    e: Enemy,
    order = 1,
    center: Point = this.w.player,
    at = this.w.time,
    angle?: number,
  ) {
    const boss = e.kind === "boss",
      elite = isElite(e.kind);
    return this.make(
      e,
      "imprint",
      center,
      { x: 2.5, y: 1 },
      angle ?? [0, Math.PI / 2, Math.PI / 4][e.pattern % 3],
      { x: 0, y: 0 },
      boss ? 2 : 1.9,
      0.25,
      boss ? 26 : elite ? 24 : 22,
      order,
      at,
    );
  }
  page(e: Enemy, order = 1, at = this.w.time) {
    const boss = e.kind === "boss",
      elite = isElite(e.kind),
      a = Math.atan2(this.w.player.y - e.y, this.w.player.x - e.x);
    return this.make(
      e,
      "page",
      e,
      { x: 0.25, y: 0.9 },
      a,
      { x: Math.cos(a) * 3.6, y: Math.sin(a) * 3.6 },
      boss || elite ? 2 : 1.9,
      6 / 3.6,
      boss ? 26 : elite ? 24 : 22,
      order,
      at,
    );
  }
  clamp(e: Enemy, offset = 0) {
    const boss = e.kind === "boss",
      elite = isElite(e.kind),
      angle = boss
        ? e.bossPhase === 1
          ? [0, Math.PI / 2][e.pattern % 2]
          : [Math.PI / 4, -Math.PI / 4][e.pattern % 2]
        : elite && e.pattern >= 2
          ? [Math.PI / 4, -Math.PI / 4][e.pattern % 2]
          : [0, Math.PI / 2][e.pattern % 2],
      nx = -Math.sin(angle),
      ny = Math.cos(angle),
      p = this.w.player;
    return [-1, 1].map((side, i) =>
      this.make(
        e,
        "clamp",
        {
          x: p.x + nx * (side * 2.3 + offset),
          y: p.y + ny * (side * 2.3 + offset),
        },
        { x: 1.6, y: 0.25 },
        angle,
        { x: -side * nx, y: -side * ny },
        boss ? (e.bossPhase === 3 ? 2.3 : 2.1) : 2,
        1.4,
        boss ? (e.bossPhase === 3 ? 28 : 26) : elite ? 24 : 22,
        i + 1,
      ),
    );
  }
  plan(e: Enemy, fallback = false): Hazard[] {
    const s = this.state(e),
      w = this.w;
    if (s.action === "imprint") return [this.imprint(e)];
    if (s.action === "page") return [this.page(e)];
    if (s.action === "clamp") return this.clamp(e);
    if (s.action === "pair") {
      return [
        this.imprint(e, 1, w.player, w.time, fallback ? Math.PI/2 : 0),
        this.page(e, 2, w.time + 0.6),
      ];
    }
    if (s.action === "C")
      return this.clamp(e, e.bossPhase === 3 && !fallback ? 0.6 : 0);
    if (s.action === "A") {
      if (e.bossPhase === 1) return [this.imprint(e)];
      const sign = e.pattern % 2 ? -1 : 1,
        center = w.player,
        first = { x: center.x - 1.4, y: center.y },
        second = { x: center.x + 1.4, y: center.y + 2.2 * sign };
      return [
        this.imprint(e, 1, first, w.time, e.bossPhase === 3 ? Math.PI / 4 : 0),
        this.imprint(
          e,
          2,
          second,
          w.time + 0.8,
          e.bossPhase === 3 ? -Math.PI / 4 : Math.PI / 2,
        ),
      ];
    }
    if (e.bossPhase === 1) return [this.page(e)];
    return [
      this.imprint(e, 1, w.player, w.time, 0),
      this.page(e, 2, w.time + (e.bossPhase === 3 && !fallback ? 0.3 : 0.7)),
    ];
  }
  private visible(p: Point, r = 0) {
    const w = this.w;
    return (
      Math.abs(p.x - w.camera.x) + r < w.viewport.x - 0.4 &&
      p.y + r - w.camera.y < w.viewport.y - 2.6 &&
      p.y - r - w.camera.y > -w.viewport.y + 2.7
    );
  }
  legal(h: Hazard) {
    return !librarySolid(h) && libraryEnvelope(h).every((p) => this.visible(p));
  }
  private sealLegal(h: Hazard, p: Point, previous: Hazard[]) {
    const w = this.w,
      d = distance(p, w.player),
      owner = w.enemies.find((e) => e.id === h.source);
    return (
      d >= 1.2 - 1e-8 &&
      d <= 3.2 + 1e-8 &&
      this.visible(p, 0.55) &&
      Math.abs(p.x) <= 21.5 &&
      Math.abs(p.y) <= 25.5 &&
      !libraryMap.blocked(p, 0.5) &&
      (!owner || distance(p, owner) > 0.95) &&
      previous.every((o) => distance(o.library!.seal, p) >= 1.1) &&
      !w.enemies.some(
        (e) =>
          e.hp > 0 &&
          e.state === "seek" &&
          e.id !== h.source &&
          distance(e, p) < 0.9,
      ) &&
      librarySealGap(h, p) >= 0.4 - 1e-8
    );
  }
  assignSeals(items: Hazard[], variation = 0) {
    const w = this.w,
      done: Hazard[] = [];
    for (const h of items) {
      const b = h.library!,
        normal = h.angle + Math.PI / 2,
        sign = (variation % 2 ? -1 : 1) * (b.order % 2 ? 1 : -1),
        preferred =
          b.shape === "imprint"
            ? {
                x: h.x + Math.cos(normal) * 2.1 * sign,
                y: h.y + Math.sin(normal) * 2.1 * sign,
              }
            : b.shape === "clamp"
              ? {
                  x: h.x + Math.cos(h.angle) * 2.6 * sign,
                  y: h.y + Math.sin(h.angle) * 2.6 * sign,
                }
              : undefined;
      const candidates: Point[] = preferred ? [preferred] : [];
      for (const radius of [2.1, 2.8, 3.2, 1.5])
        for (let i = 0; i < 24; i++) {
          const a = ((i + variation * 5) * Math.PI) / 12;
          candidates.push({
            x: w.player.x + Math.cos(a) * radius,
            y: w.player.y + Math.sin(a) * radius,
          });
        }
      const seal = candidates.find((p) => this.sealLegal(h, p, done));
      if (!seal) return false;
      b.seal = { ...seal };
      done.push(h);
    }
    return true;
  }
  private validPlan(items: Hazard[]) {
    if (!items.length || items.some((h) => !this.legal(h))) return false;
    for (let i = 0; i < 3; i++)
      if (
        this.assignSeals(items, i) &&
        libraryEscape(this.w, items, false) &&
        libraryEscape(this.w, items, true)
      )
        return true;
    return false;
  }
  private recovery(e: Enemy) {
    const s = this.state(e);
    return e.kind === "boss"
      ? e.bossPhase === 1
        ? s.action === "C"
          ? 3.8
          : 3.4
        : e.bossPhase === 2
          ? s.action === "A"
            ? 3.8
            : 4
          : s.action === "A"
            ? 4.1
            : s.action === "B"
              ? 4.2
              : 4.6
      : isElite(e.kind)
        ? e.kind === "sealprovost"
          ? 3.4
          : 3.6
        : e.kind === "sealclerk"
          ? 2.8
          : e.kind === "folioray"
            ? 2.6
            : 3;
  }
  private reject(e: Enemy) {
    this.stats.rejected++;
    this.recover(e);
    let fitted:Point|undefined, cost=Infinity;
    if(isElite(e.kind))for(let i=0;i<24;i++){
      const a=i*Math.PI/12,p={x:this.w.player.x+Math.cos(a)*3.2,y:this.w.player.y+Math.sin(a)*3.2};
      if(Math.abs(p.x)>21.3||Math.abs(p.y)>25.3||libraryMap.blocked(p,.7))continue;
      const probe={...e,...p,pattern:e.pattern+1,library:{...this.state(e)}};
      if([0,1,2,3].some(pattern=>this.plan({...probe,pattern},true).every(h=>this.legal(h)))&&distance(p,e)<cost){fitted=p;cost=distance(p,e);}
    }
    this.state(e).relocate = fitted ?? this.position(
      Math.atan2(e.y - this.w.player.y, e.x - this.w.player.x) + Math.PI / 3,
      3.2,
    );
    if (isElite(e.kind)) this.lastElite = e.id;
  }
  begin(e: Enemy) {
    const s = this.state(e);
    let items = this.plan(e);
    s.recover = this.recovery(e);
    if (this.slots + items.length > 2) {
      e.attack = 0.2;
      return false;
    }
    let valid = this.validPlan(items);
    if(!valid&&isElite(e.kind)){
      // Choose a complete authored orientation before announcing it. No resizing,
      // tracking or bypass of seal/pure-dodge reachability checks.
      search:for(const pattern of [0,1,2,3])for(const fallback of [false,true]){
        const candidate=this.plan({...e,pattern,library:{...s}},fallback);
        if(this.validPlan(candidate)){items=candidate;valid=true;this.stats.fallback++;break search;}
      }
    }
    if (
      !valid &&
      e.kind === "boss" &&
      e.bossPhase === 3 &&
      (s.action === "B" || s.action === "C")
    ) {
      items = this.plan(e, true);
      valid = this.validPlan(items);
      if (valid) this.stats.fallback++;
    }
    if (!valid) {
      this.reject(e);
      return true;
    }
    this.w.hazards.push(...items);
    s.step = 1;
    s.next = Math.max(...items.map((h) => h.until));
    s.vulnerable = false;
    s.countered = false;
    s.waiting = undefined;
    e.state = "windup";
    e.immovable = true;
    for (const h of items) this.stats[h.library!.shape]++;
    if (
      e.kind === "boss" &&
      (s.action === "A" || s.action === "B" || s.action === "C")
    ) {
      this.stats.patterns[s.action]++;
      this.stats.phases[e.bossPhase - 1]++;
    }
    if (e.kind === "sealprovost" || e.kind === "claspjailer") {
      this.stats.eliteCasts[e.kind]++;
      this.lastElite = e.id;
    }
    return true;
  }
  private cancelPending(e: Enemy) {
    for (const h of this.w.hazards)
      if (h.source === e.id && h.library && !h.library.cancelled && !h.fired) {
        h.library.cancelled = true;
        h.library.cancelledAt = this.w.time;
        h.until = Math.min(h.until, this.w.time);
        this.stats.cancelled++;
      }
  }
  clean() {
    const w = this.w;
    for (const e of w.enemies)
      if (e.library?.step && (e.hp <= 0 || e.freezeUntil > w.time)) {
        this.cancelPending(e);
        if (e.hp > 0) {
          e.library.countered = false;
          this.recover(e);
        }
      }
    for (const h of w.hazards)
      if (
        h.library &&
        !h.library.cancelled &&
        !h.fired &&
        !w.enemies.some((e) => e.id === h.source && e.hp > 0)
      ) {
        h.library.cancelled = true;
        h.until = Math.min(h.until, w.time);
      }
  }
  onDeath(e: Enemy) {
    this.cancelPending(e);
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
    if (boss) {
      const target = e.hp / e.maxHp <= 0.35 ? 3 : e.hp / e.maxHp <= 0.7 ? 2 : 1;
      if (target > e.bossPhase) {
        e.bossPhase = target;
        this.cancelPending(e);
        s.countered = false;
        s.next = Math.max(
          s.action === "transition" ? s.next : w.time + 1.5,
          ...w.hazards
            .filter(
              (h) => h.source === e.id && h.fired && !h.library?.cancelled,
            )
            .map((h) => h.until),
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
      if (s.step) {
        this.cancelPending(e);
        this.recover(e);
      }
      return;
    }
    if (s.action === "transition") {
      e.timer = Math.max(0, s.next - w.time);
      if (w.time >= s.next) {
        s.action = "imprint";
        this.recover(e, 1);
      }
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "seek";
        s.vulnerable = false;
        e.attack = e.kind === "spineclasp" ? 3.6 : 3.2;
      }
      return;
    }
    if (s.step) {
      const live = w.hazards.filter(
        (h) =>
          h.source === e.id &&
          h.library &&
          !h.library.cancelled &&
          h.until > w.time,
      );
      e.timer = Math.max(0, ...live.map((h) => h.due - w.time));
      if (!live.length) this.recover(e);
      return;
    }
    if (e.kind === "paperbonegrub") {
      this.move(e, dt);
      if (distance(e, w.player) < 0.65) w.hurt(12, e.kind, false);
      return;
    }
    if (boss && w.enemies.some((o) => o.hp > 0 && isElite(o.kind))) {
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
    if (s.relocate) {
      if (distance(e, s.relocate) > 0.3) {
        this.move(e, dt, s.relocate);
        return;
      }
      s.relocate = undefined;
    }
    const d = distance(e, w.player);
    if (d > 5.5 || !w.visible(e, 1)) {
      this.move(e, dt);
      return;
    }
    if (d < (boss ? 1 : 0.65))
      w.hurt(boss ? 22 : ENEMIES[e.kind].contact, e.kind, false);
    e.attack -= dt;
    if (e.attack > 0) {
      if (d > (boss ? 0.8 : 3.2)) this.move(e, dt);
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
      : e.kind === "sealprovost"
        ? "pair"
        : e.kind === "claspjailer" || e.kind === "spineclasp"
          ? "clamp"
          : e.kind === "folioray"
            ? "page"
            : "imprint";
    if (this.begin(e)) {
      e.pattern++;
      this.lastStart = w.time;
    }
  }
  stepHazard(h: Hazard) {
    const w = this.w,
      b = h.library!;
    if (b.cancelled) return;
    // Move-player normally samples all actual segments; this also handles explicit test/debug time advances.
    if (b.last < w.time) this.sample(b.player, w.player, b.last, w.time);
  }
}
