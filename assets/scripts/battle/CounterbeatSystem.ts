import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, isElite, type Kind, type Skill } from "./SurvivalConfig";
import { distance, type Enemy, type Hazard, type Point } from "./SurvivalTypes";
import { counterbeatMap } from "./CounterbeatMap";
import { CounterbeatDirector } from "./CounterbeatDirector";
import { BossPlanChoice, type BossAction } from "./BossPlanChoice";
import { advanceTactically } from "./TacticalMovement";
import {
  counterCut,
  counterDistance,
  counterEnd,
  counterEscape,
  counterImpact,
  counterMove,
  type CounterPulse,
} from "./CounterbeatGeometry";
export const COUNTERBEAT_KINDS: readonly Kind[] = [
  "chimeshard",
  "forklancer",
  "pipereader",
  "resonancebearer",
  "broadcantor",
  "needleconductor",
];
export const counterEnemy = (k: Kind) => COUNTERBEAT_KINDS.includes(k);
export interface CounterState {
  action: BossAction;
  vulnerable: boolean;
  item?: Hazard;
  waitUntil?: number;
  nextPair?: number;
  retireUntil?: number;
  milestones?: number;
}
interface PairProof {
  id: number;
  items: Hazard[];
  damaged: boolean;
  interrupted: boolean;
  counted: boolean;
}
export class CounterbeatSystem {
  readonly forms = 1;
  readonly choices = new BossPlanChoice();
  readonly schedule: CounterbeatDirector;
  readonly pairs = new Map<number, PairProof>();
  readonly stats = {
    patterns: { A: 0, B: 0, C: 0 },
    eliteCasts: { broadcantor: 0, needleconductor: 0 },
    pairs: 0,
    secondLocks: 0,
    cancelled: 0,
    rejected: 0,
    retired: 0,
  };
  private lastElite = 0;
  constructor(private w: SurvivalWorld) {
    this.schedule = new CounterbeatDirector(w, this);
  }
  state(e: Enemy): CounterState {
    return e.counter ?? (e.counter = { action: "A", vulnerable: false });
  }
  get slots() {
    return this.w.hazards.filter(
      (h) => h.until > this.w.time && !h.counter?.cancelled,
    ).length;
  }
  director(dt: number) {
    this.schedule.step(dt);
  }
  initialize(_e: Enemy) {}
  keep(_e: Enemy) {
    return false;
  }
  tick() {}
  progress(e: Enemy) {
    return {
      form: 1,
      livesRemaining: e.hp > 0 ? 1 : 0,
      remaining: Math.max(0, e.hp) / e.maxHp,
    };
  }
  supplies(e: Enemy) {
    const s = this.state(e);
    s.milestones ??= 0;
    while (
      s.milestones < 3 &&
      Math.max(0, e.hp) <= e.maxHp * (0.75 - s.milestones * 0.25)
    ) {
      this.w.dropBossPotion(e);
      s.milestones++;
    }
  }
  buffed(e: Enemy) {
    return (
      e.kind === "chimeshard" &&
      !e.counter?.retireUntil &&
      this.w.enemies.some(
        (o) =>
          o.hp > 0 &&
          o.state !== "arriving" &&
          o.kind === "resonancebearer" &&
          !o.counter?.retireUntil &&
          distance(o, e) <= 4,
      )
    );
  }
  armor(e: Enemy) {
    return this.buffed(e) ? 0.35 : undefined;
  }
  retireSpecials() {
    for (const e of this.w.enemies)
      if (
        e.hp > 0 &&
        counterEnemy(e.kind) &&
        e.kind !== "chimeshard" &&
        !isElite(e.kind)
      ) {
        const s = this.state(e);
        if (!s.retireUntil) {
          if (s.item) counterCut(s.item, this.w.time);
          s.retireUntil = Math.max(this.w.time, s.item?.until ?? 0) + 0.6;
          e.immovable = true;
          this.stats.retired++;
        }
        if (this.w.time >= s.retireUntil) e.hp = 0;
      }
  }
  pulse(
    e: Enemy,
    action: BossAction,
    order: number,
    at = this.w.time,
  ): CounterPulse {
    const boss = e.kind === "boss",
      elite = isElite(e.kind),
      normal = !boss && !elite;
    const shape = normal
      ? "thrust"
      : boss
        ? action === "A"
          ? order === 1
            ? "sweep"
            : "thrust"
          : action === "B"
            ? order === 1
              ? "thrust"
              : "sweep"
            : "sweep"
        : e.kind === "broadcantor"
          ? "sweep"
          : "thrust";
    const angle =
      Math.atan2(this.w.player.y - e.y, this.w.player.x - e.x) +
      (boss && action === "C" ? ((order === 1 ? -1 : 1) * Math.PI) / 4 : 0);
    const f: CounterPulse = {
      x: e.x,
      y: e.y,
      shape,
      angle,
      radius: shape === "sweep" ? 3.6 : e.kind === "forklancer" ? 4.4 : 6.2,
      half: (65 * Math.PI) / 180,
      width:
        e.kind === "forklancer" ? 0.35 : e.kind === "pipereader" ? 0.32 : 0.42,
      due: at + (normal ? 2.2 : 2.4),
      end: at + (normal ? 2.4 : 2.6),
      damage: normal ? 22 : shape === "thrust" && boss ? 28 : 26,
      order,
      threatens: false,
      hit: false,
    };
    f.threatens = counterDistance(f, this.w.player) <= 0.3 + 1e-9;
    return f;
  }
  plan(e: Enemy, action: BossAction): Hazard[] {
    const w = this.w,
      f = this.pulse(e, action, 1),
      boss = e.kind === "boss";
    return [
      {
        id: w.id(),
        source: e.id,
        kind: "circle",
        x: e.x,
        y: e.y,
        angle: f.angle,
        radius: 0,
        width: 0,
        created: w.time,
        due: f.due,
        until: boss ? w.time + 3.5 : f.end,
        damage: f.damage,
        fixedDamage: true,
        damageLabel: "错拍鸣庭",
        fired: false,
        next: 0,
        counter: {
          pulses: [f],
          action,
          last: w.time,
          player: { ...w.player },
          pendingAt: boss ? w.time + 0.9 : undefined,
          second: boss,
        },
      },
    ];
  }
  legal(h: Hazard) {
    const w = this.w,
      visible = (p: Point, r: number) =>
        Math.abs(p.x - w.camera.x) + r < w.viewport.x - 0.4 &&
        p.y - w.camera.y + r < w.viewport.y - 2.6 &&
        p.y - w.camera.y - r > -w.viewport.y + 2.7;
    return h.counter!.pulses.every((f) => {
      if (f.cancelled) return true;
      if (f.shape === "thrust")
        return [f, counterEnd(f)].every((p) => visible(p, f.width + 0.3));
      return (
        Array.from(
          { length: 33 },
          (_, i) => f.angle - f.half + (2 * f.half * i) / 32,
        ).every((a) =>
          visible(
            {
              x: f.x + Math.cos(a) * f.radius,
              y: f.y + Math.sin(a) * f.radius,
            },
            0.3,
          ),
        ) && visible(f, 0.3)
      );
    });
  }
  private publish(e: Enemy, h: Hazard) {
    const s = this.state(e);
    s.item = h;
    s.action = h.counter!.action;
    s.vulnerable = false;
    s.waitUntil = undefined;
    e.state = "windup";
    e.immovable = true;
    e.facing =
      h.counter!.pulses[0]?.angle ??
      Math.atan2(this.w.player.y - e.y, this.w.player.x - e.x);
    this.w.hazards.push(h);
    if (e.kind === "boss") {
      this.choices.commit(e, s.action);
      this.stats.patterns[s.action]++;
    } else if (isElite(e.kind)) {
      this.stats.eliteCasts[e.kind as "broadcantor" | "needleconductor"]++;
      this.lastElite = e.id;
    }
  }
  begin(e: Enemy, action: BossAction = this.state(e).action) {
    if (this.slots >= 2) return false;
    let h: Hazard | undefined;
    if (e.kind === "boss")
      h = this.choices.choose(
        e,
        action,
        (_eAction, turn) => (turn ? [] : this.plan(e, _eAction)),
        (items) =>
          items.every((f) => this.legal(f)) && counterEscape(this.w, items),
        (items) => items[0].counter!.pulses[0].threatens,
      )?.items[0];
    else {
      const p = this.plan(e, action)[0];
      if (this.legal(p) && counterEscape(this.w, [p])) h = p;
    }
    if (!h) {
      this.stats.rejected++;
      e.attack = 0.4;
      return false;
    }
    this.publish(e, h);
    return true;
  }
  pair(first: Enemy, second: Enemy) {
    const w = this.w;
    if (this.slots > 0) return false;
    const a = this.plan(first, first.kind === "broadcantor" ? "A" : "B")[0],
      b = this.plan(second, second.kind === "broadcantor" ? "A" : "B")[0];
    // Preview the partner only to reject obviously impossible groups; actual aim is locked later.
    b.counter!.pulses[0].due += 0.9;
    b.counter!.pulses[0].end += 0.9;
    b.until += 0.9;
    if (!this.legal(a) || !this.legal(b) || !counterEscape(w, [a, b]))
      return false;
    const id = w.id();
    a.counter!.pair = b.counter!.pair = id;
    b.counter!.pulses = [];
    b.counter!.pendingAt = w.time + 0.9;
    b.counter!.second = false;
    b.due = w.time + 3.3;
    this.pairs.set(id, {
      id,
      items: [a, b],
      damaged: false,
      interrupted: false,
      counted: false,
    });
    this.publish(first, a);
    this.publish(second, b);
    // Remember the leader rather than the last published participant.
    this.lastElite = first.id;
    this.stats.pairs++;
    return true;
  }
  private lockSecond(e: Enemy, h: Hazard) {
    const b = h.counter!,
      f = this.pulse(e, b.action, 2);
    const proposal: Hazard = {
      ...h,
      until: f.end,
      counter: { ...b, pulses: [...b.pulses, f], pendingAt: undefined },
    };
    b.pendingAt = undefined;
    if (this.legal(proposal) && counterEscape(this.w, [proposal])) {
      b.pulses.push(f);
      h.until = f.end;
      this.stats.secondLocks++;
      e.facing = f.angle;
    } else {
      b.interrupted = true;
      this.stats.cancelled++;
      const pair = b.pair && this.pairs.get(b.pair);
      if (pair) pair.interrupted = true;
      h.until = Math.max(
        this.w.time,
        ...b.pulses.filter((p) => !p.cancelled).map((p) => p.end),
      );
      if (!b.pulses.length) b.cancelled = true;
    }
  }
  private sample(p: Point, time: number, previous: number, old: Point) {
    for (const h of this.w.hazards) {
      const b = h.counter;
      if (!b) continue;
      for (const f of b.pulses)
        if (!f.hit && counterImpact(f, p, time, previous, old)) {
          f.hit = true;
          b.collided = true;
          const pair = b.pair && this.pairs.get(b.pair);
          if (pair) pair.damaged = true;
          const owner = this.w.enemies.find((e) => e.id === h.source);
          this.w.hurt(f.damage, owner?.kind ?? "错拍鸣庭", false, h.source);
        }
      b.last = time;
      b.player = { ...p };
    }
  }
  movePlayer(dt: number) {
    // A freeze applied by the preceding frame's weapons predates this movement.
    // Cancel future windows before sampling the next frame, not after it crosses their due time.
    const from = this.w.time - dt;
    for (const h of this.w.hazards) {
      if (!h.counter || h.counter.interrupted) continue;
      const owner = this.w.enemies.find((e) => e.id === h.source);
      if (!owner || owner.hp <= 0 || owner.freezeUntil > from) {
        counterCut(h, from);
        const pair = h.counter.pair && this.pairs.get(h.counter.pair);
        if (pair) pair.interrupted = true;
      }
    }
    counterMove(
      this.w.player,
      { x: this.w.move.x * this.w.speed, y: this.w.move.y * this.w.speed },
      dt,
      0.3,
      this.w.time,
      (a, z, from, to) => this.sample(z, to, from, a),
    );
  }
  stepHazard(h: Hazard) {
    const b = h.counter!;
    this.sampleHazard(h, b.last, b.player);
  }
  private sampleHazard(h: Hazard, previous: number, old: Point) {
    const b = h.counter!;
    for (const f of b.pulses)
      if (
        !f.hit &&
        counterImpact(f, this.w.player, this.w.time, previous, old)
      ) {
        f.hit = true;
        b.collided = true;
        const pair = b.pair && this.pairs.get(b.pair);
        if (pair) pair.damaged = true;
        const owner = this.w.enemies.find((e) => e.id === h.source);
        this.w.hurt(f.damage, owner?.kind ?? "错拍鸣庭", false, h.source);
      }
    b.last = this.w.time;
    b.player = { ...this.w.player };
  }
  clean() {
    if (!this.w.active) return;
    for (const h of this.w.hazards) {
      if (!h.counter) continue;
      const e = this.w.enemies.find((e) => e.id === h.source),
        b = h.counter;
      if (!e || e.hp <= 0 || e.freezeUntil > this.w.time) {
        if (!b.interrupted) counterCut(h, this.w.time);
        const pair = b.pair && this.pairs.get(b.pair);
        if (pair) pair.interrupted = true;
        continue;
      }
      if (b.pendingAt !== undefined && this.w.time + 1e-9 >= b.pendingAt)
        this.lockSecond(e, h);
    }
    for (const [id, pair] of this.pairs)
      if (this.w.time > Math.max(...pair.items.map((h) => h.until)) + 4)
        this.pairs.delete(id);
  }
  private recover(e: Enemy) {
    e.state = "recover";
    e.immovable = false;
    const s = this.state(e);
    s.vulnerable = true;
    e.timer =
      e.kind === "boss"
        ? [5.6, 5.8, 6]["ABC".indexOf(s.action)] * 0.35
        : isElite(e.kind)
          ? (e.kind === "broadcantor" ? 5 : 5.4) * 0.35
          : e.kind === "forklancer"
            ? 1.2
            : 1.4;
    e.pattern++;
  }
  onHit(e: Enemy, source: string, dealt: number) {
    const s = this.state(e),
      h = s.item,
      b = h?.counter,
      skill = source === "needleEcho" ? "needle" : (source as Skill);
    if (
      !b ||
      dealt <= 0 ||
      !this.w.skills[skill] ||
      e.state !== "recover" ||
      !s.vulnerable
    )
      return;
    if (e.kind === "boss") {
      if (
        b.proved ||
        b.interrupted ||
        b.collided ||
        b.pendingAt !== undefined ||
        b.pulses.length !== 2 ||
        !b.pulses.every(
          (f) => !f.cancelled && f.threatens && this.w.time >= f.end,
        ) ||
        distance(e, this.w.player) > 2.8
      )
        return;
      b.proved = true;
      this.w.challenge.counterGroups[b.action] = Math.min(
        2,
        this.w.challenge.counterGroups[b.action] + 1,
      );
    } else if (b.pair) {
      const pair = this.pairs.get(b.pair);
      if (
        !pair ||
        pair.counted ||
        (this.w.lastHurt >= Math.min(...pair.items.map((h) => h.created)) &&
          this.w.lastHurt < Math.max(...pair.items.map((h) => h.until))) ||
        pair.damaged ||
        pair.interrupted ||
        !pair.items.every(
          (p) =>
            p.counter!.pendingAt === undefined &&
            !p.counter!.interrupted &&
            p.counter!.pulses.length === 1 &&
            p.counter!.pulses.every(
              (f) => !f.cancelled && f.threatens && this.w.time >= f.end,
            ),
        )
      )
        return;
      pair.counted = true;
      this.w.challenge.counterElite = true;
    }
  }
  onDeath(e: Enemy) {
    const s = this.state(e);
    if (s.item) {
      counterCut(s.item, this.w.time);
      const id = s.item.counter!.pair;
      if (id) {
        const p = this.pairs.get(id);
        if (p) p.interrupted = true;
      }
    }
    this.schedule.onDeath(e);
    return false;
  }
  move(e: Enemy, dt: number, target: Point = this.w.player) {
    const speed =
      e.kind === "boss"
        ? distance(e, this.w.player) > 6
          ? 5
          : 2.2
        : ENEMIES[e.kind].speed;
    advanceTactically(
      counterbeatMap,
      e,
      target,
      speed * (e.slowUntil > this.w.time ? 1 - e.slow : 1),
      dt,
      e.kind === "boss" || isElite(e.kind) ? 0.7 : 0.35,
    );
  }
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w,
      s = this.state(e);
    if (s.retireUntil) return;
    if (e.freezeUntil > w.time) {
      if (s.item && !s.item.counter!.interrupted) counterCut(s.item, w.time);
      if (!s.item || s.item.until <= w.time) {
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
      if (w.time >= s.item.until && s.item.counter!.pendingAt === undefined)
        this.recover(e);
      return;
    }
    const d = distance(e, w.player);
    if (e.kind === "chimeshard") {
      this.move(e, dt);
      if (distance(e, w.player) < 0.65) w.hurt(12, e.kind);
      return;
    }
    if (e.kind === "resonancebearer") {
      if (d > 2.8) this.move(e, dt);
      if (d < 0.65) w.hurt(12, e.kind);
      return;
    }
    if (
      e.kind !== "boss" &&
      !isElite(e.kind) &&
      w.enemies.some((o) => o.hp > 0 && isElite(o.kind))
    )
      return;
    if (d < (e.kind === "boss" ? 1 : 0.65))
      w.hurt(e.kind === "boss" ? 22 : ENEMIES[e.kind].contact, e.kind, false);
    e.attack -= dt;
    const preferred = e.kind === "pipereader" ? 5.5 : 3.4;
    if (d > preferred || !w.visible(e, 1)) {
      this.move(e, dt);
      return;
    }
    if (e.attack > 0) {
      if (d > 3.2) this.move(e, dt);
      return;
    }
    if (isElite(e.kind)) {
      const ready = w.enemies
        .filter(
          (o) =>
            o.hp > 0 &&
            isElite(o.kind) &&
            o.state === "seek" &&
            o.attack <= 0 &&
            !o.counter?.retireUntil,
        )
        .sort(
          (a, b) =>
            Number(a.id === this.lastElite) - Number(b.id === this.lastElite) ||
            a.id - b.id,
        );
      if (ready.length && ready[0] !== e) return;
      const other = ready.find(
        (o) => o.id !== e.id && distance(o, w.player) <= 5 && w.visible(o, 1),
      );
      if (other && w.time >= (s.nextPair ?? 0) && this.pair(e, other)) {
        s.nextPair = w.time + 1.5;
        return;
      }
      const partner = w.enemies.find(
        (o) => o.hp > 0 && o.id !== e.id && isElite(o.kind),
      );
      if (partner && w.time >= (s.nextPair ?? 0)) {
        s.waitUntil ??= w.time + 1.5;
        if (w.time < s.waitUntil) {
          this.move(e, dt);
          return;
        }
        s.nextPair = w.time + 3;
        s.waitUntil = undefined;
      }
    }
    s.action =
      e.kind === "boss"
        ? ("ABC"[e.pattern % 3] as BossAction)
        : e.kind === "broadcantor"
          ? "A"
          : "B";
    if (!this.begin(e, s.action)) this.move(e, dt);
  }
}
