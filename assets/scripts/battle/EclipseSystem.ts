import { stageRecoveryFactor } from "./StagePressure";
import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, Kind, isElite } from "./SurvivalConfig";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import { eclipseMap } from "./EclipseMap";
import {
  eclipseMove,
  eclipseImpacts,
  eclipseCut,
  eclipseEscape,
  eclipseSegment,
  eclipseShadowInterval,
} from "./EclipseGeometry";
import type { EclipseSweep } from "./EclipseGeometry";
export const ECLIPSE_KINDS: readonly Kind[] = [
  "dialscrap",
  "glowdisc",
  "reversegazer",
  "offsetorrery",
  "twindial",
  "eclipsewarden",
];
export const eclipseEnemy = (kind: Kind) => ECLIPSE_KINDS.includes(kind);
export interface EclipseState {
  action:
    | "sweep"
    | "reverse"
    | "offset"
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
  shadow?: Record<string, number>;
  earned?: boolean;
}
export class EclipseSystem {
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
    beam: 0,
    rejected: 0,
    cancelled: 0,
    qualified: 0,
    eliteCasts: { twindial: 0, eclipsewarden: 0 },
    patterns: { A: 0, B: 0, C: 0 },
    phases: [0, 0, 0],
    phasePatterns: [
      { A: 0, B: 0, C: 0 },
      { A: 0, B: 0, C: 0 },
      { A: 0, B: 0, C: 0 },
    ],
  };
  constructor(private w: SurvivalWorld) {}
  state(e: Enemy): EclipseState {
    return (
      e.eclipse ??
      (e.eclipse = {
        action: "sweep",
        step: 0,
        next: 0,
        recover: 3,
        vulnerable: false,
      })
    );
  }
  get slots() {
    return this.w.hazards.filter(
      (h) => h.until > this.w.time && !h.eclipse?.cancelled,
    ).length;
  }
  position(angle: number, r = 9): Point | undefined {
    for (let i = 0; i < 24; i++) {
      const a = angle + (i * Math.PI) / 12,
        p = {
          x: Math.max(-21, Math.min(21, this.w.player.x + Math.cos(a) * r)),
          y: Math.max(-25, Math.min(25, this.w.player.y + Math.sin(a) * r)),
        };
      if (distance(p, this.w.player) > 3 && !eclipseMap.blocked(p, 0.8))
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
        boss.eclipse?.action !== "transition" &&
        (t - 360) % 14 < 9
      ) {
        const n = w.enemies.filter(
          (e) => e.hp > 0 && e.kind === "dialscrap",
        ).length;
        for (let i = 0; i < Math.min(6, 28 - n); i++)
          this.spawn("dialscrap", (i * Math.PI) / 4 + w.random() * 0.3, true);
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
        i === 0 || i === 2 ? "twindial" : "eclipsewarden",
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
          "dialscrap",
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
        ? ["glowdisc"]
        : t < 95
          ? ["reversegazer"]
          : t < 125
            ? ["offsetorrery"]
            : t >= 265 && t < 295
              ? ["glowdisc", "reversegazer"]
              : Math.floor(t / 20) % 2
                ? ["glowdisc", "reversegazer"]
                : ["reversegazer", "offsetorrery"];
    if (
      w.enemies.some(
        (e) =>
          e.hp > 0 &&
          eclipseEnemy(e.kind) &&
          e.kind !== "dialscrap" &&
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
          !h.eclipse!.interrupted &&
          !h.eclipse!.damaged &&
          h.eclipse!.sweeps.every(
            (f) => !f.cancelled && f.end <= this.w.time + 1e-8,
          ),
      );
    if (complete && s.earned && e.kind === "boss") {
      const phase = items[0].eclipse!.phase;
      if (phase < 3 || items[0].eclipse!.bossC) {
        this.w.challenge.eclipsePhases.add(phase);
        this.stats.qualified++;
      }
    }
    s.items = undefined;
    s.origin = undefined;
    s.shadow = {};
    s.earned = false;
  }
  private move(e: Enemy, dt: number, target = this.w.player) {
    const d = distance(e, target),
      a = eclipseMap.heading(e, target),
      speed =
        (e.kind === "boss" ? (d > 5.2 ? 5 : 1.6) : ENEMIES[e.kind].speed) *
        (e.slowUntil > this.w.time ? 1 - e.slow : 1);
    e.facing = a;
    if (d > 0.25)
      eclipseMove(
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
    eclipseMove(
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
      if (h.eclipse && !h.eclipse.cancelled) {
        const b = h.eclipse;
        for (const index of eclipseImpacts(h, z, to, from, a)) {
          const f = b.sweeps.find((f) => f.index === index)!;
          if (f.hit) continue;
          f.hit = true;
          const hp = w.hp;
          w.hurt(h.damage, h.damageLabel!, false, h.source);
          if (w.hp < hp) b.damaged = true;
        }
        const owner = w.enemies.find(
          (e) => e.id === h.source && e.hp > 0 && e.kind === "boss",
        );
        if (owner && !b.interrupted) {
          const s = this.state(owner);
          s.shadow ??= {};
          for (const f of b.sweeps) {
            const key = h.id + ":" + f.index;
            const count = Math.max(1, Math.ceil((to - from) / 0.01));
            for (let i = 0; i < count; i++) {
              const t0 = from + ((to - from) * i) / count,
                t1 = from + ((to - from) * (i + 1)) / count;
              const at = (t: number) => {
                const k = to === from ? 1 : (t - from) / (to - from);
                return { x: a.x + (z.x - a.x) * k, y: a.y + (z.y - a.y) * k };
              };
              if (eclipseShadowInterval(f, at(t0), at(t1), t0, t1))
                s.shadow[key] = (s.shadow[key] ?? 0) + (t1 - t0);
              else s.shadow[key] = 0;
              if (s.shadow[key] >= 0.8 - 1e-8) s.earned = true;
            }
          }
        }
        if (to >= h.due) h.fired = true;
        b.last = to;
        b.player = { ...z };
      }
  }
  /** Immutable pivot/angle/timing snapshot. A reverse repeat has its own complete warning. */
  plan(e: Enemy, rotation = 0): Hazard[] {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss",
      phase = boss ? e.bossPhase : 1;
    const group = w.id(),
      warning = boss || isElite(e.kind) ? 2.4 : 2.2;
    const aim = Math.atan2(w.player.y - e.y, w.player.x - e.x) + rotation;
    const point = (d: number, a: number) => ({
      x: e.x + Math.cos(a) * d,
      y: e.y + Math.sin(a) * d,
    });
    const side = point(1.2, aim + Math.PI / 2),
      a = s.action;
    let pivots: Point[] = [{ x: e.x, y: e.y }],
      signs = [a === "reverse" || a === "B" ? -1 : 1];
    let repeat = false;
    if (
      e.kind === "offsetorrery" ||
      e.kind === "eclipsewarden" ||
      (boss && phase >= 2 && a === "B")
    )
      pivots = [side];
    if (
      a === "pair" ||
      a === "mixed" ||
      (boss && (a === "C" || (phase >= 2 && a === "A")))
    ) {
      if (boss && phase === 1)
        pivots = [
          { x: e.x, y: e.y },
          { x: e.x, y: e.y },
        ];
      else if (a === "mixed" || (boss && a === "C"))
        pivots = [point(0.9, aim + Math.PI / 2), point(0.9, aim - Math.PI / 2)];
      else pivots = [{ x: e.x, y: e.y }, side];
      signs = [1, boss && phase === 3 && a === "A" ? 1 : -1];
    }
    if (boss && phase === 3 && a === "B") repeat = true;
    return pivots.map((pivot, i) => {
      const sign = signs[i] ?? signs[0],
        angle =
          aim -
          (sign * Math.PI) / 4 +
          (pivots.length > 1 && phase >= 2
            ? a === "C" || a === "mixed"
              ? i
                ? 0.2
                : -0.2
              : i
                ? -0.2
                : 0
            : 0);
      const due =
        w.time + warning + (i && !(boss && phase === 2 && a === "C") ? 0.8 : 0);
      const sweeps: EclipseSweep[] = [
        {
          pivot: { ...pivot },
          angle,
          sign,
          due,
          end: due + 2.4,
          index: 0,
          hit: false,
        },
      ];
      if (repeat)
        sweeps.push({
          pivot: { ...pivot },
          angle: angle + (sign * Math.PI) / 2,
          sign: -sign,
          due: due + 4.8,
          end: due + 7.2,
          index: 1,
          hit: false,
        });
      return {
        id: w.id(),
        source: e.id,
        kind: "circle",
        ...pivot,
        angle,
        radius: 0,
        width: 0,
        created: w.time,
        due,
        until: sweeps[sweeps.length - 1].end,
        damage: boss
          ? phase === 3 && a === "C"
            ? 28
            : 26
          : isElite(e.kind)
            ? 26
            : 22,
        fixedDamage: true,
        damageLabel: "蚀昼旋光",
        fired: false,
        next: 0,
        eclipse: {
          origin: { x: e.x, y: e.y },
          sweeps,
          group,
          phase,
          bossC: boss && a === "C",
          order: i + 1,
          last: w.time,
          player: { ...w.player },
        },
      };
    });
  }
  legal(h: Hazard) {
    return h.eclipse!.sweeps.every((f) => {
      if (
        eclipseMap.blocked(f.pivot, 0.25) ||
        Math.abs(f.pivot.x) > 21.5 ||
        Math.abs(f.pivot.y) > 25.5
      )
        return false;
      // Validate the visible clipped sweep rather than an unoccluded full-radius bounding box.
      for (let i = 0; i <= 24; i++) {
        const seg = eclipseSegment(f, f.due + (2.4 * i) / 24);
        for (const p of seg ? [seg.a, seg.z] : [f.pivot])
          if (
            Math.abs(p.x - this.w.camera.x) > this.w.viewport.x - 0.35 ||
            p.y - this.w.camera.y > this.w.viewport.y - 2.3 ||
            p.y - this.w.camera.y < -this.w.viewport.y + 2.4
          )
            return false;
      }
      return true;
    });
  }
  private recovery(e: Enemy) {
    const a = this.state(e).action;
    return e.kind === "boss"
      ? e.bossPhase === 1
        ? a === "A"
          ? 4.2
          : a === "B"
            ? 4.4
            : 4.8
        : e.bossPhase === 2
          ? a === "A"
            ? 4.8
            : a === "B"
              ? 4.6
              : 5
          : a === "A"
            ? 5
            : a === "B"
              ? 5.2
              : 5.4
      : isElite(e.kind)
        ? 4.4
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
    let valid = items.every((h) => this.legal(h)) && eclipseEscape(w, items);
    if (!valid)
      for (const turn of Array.from(
        { length: 71 },
        (_, i) => ((i + 1) * Math.PI) / 36,
      )) {
        const candidate = this.plan(e, turn);
        if (
          candidate.every((h) => this.legal(h)) &&
          eclipseEscape(w, candidate)
        ) {
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
    s.shadow = {};
    s.earned = false;
    s.step = 1;
    s.next = Math.max(...items.map((h) => h.until));
    s.vulnerable = false;
    s.waiting = undefined;
    e.state = "windup";
    e.immovable = true;
    this.stats.beam += items.length;
    if (
      e.kind === "boss" &&
      (s.action === "A" || s.action === "B" || s.action === "C")
    ) {
      this.stats.patterns[s.action]++;
      this.stats.phases[e.bossPhase - 1]++;
      this.stats.phasePatterns[e.bossPhase - 1][s.action]++;
    }
    if (e.kind === "twindial" || e.kind === "eclipsewarden") {
      this.stats.eliteCasts[e.kind]++;
      this.lastElite = e.id;
    }
    return true;
  }
  private cancelPending(e: Enemy) {
    const s = this.state(e);
    s.shadow = {};
    s.earned = false;
    for (const h of s.items ?? [])
      if (h.until > this.w.time && !h.eclipse!.interrupted) {
        eclipseCut(h, this.w.time);
        this.stats.cancelled++;
      }
  }
  clean() {
    const w = this.w;
    for (const h of w.hazards)
      if (h.eclipse && !h.eclipse.interrupted) {
        const owner = w.enemies.find((e) => e.id === h.source && e.hp > 0);
        if (!owner || owner.freezeUntil > w.time) eclipseCut(h, w.time);
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
        s.action = "sweep";
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
        s.shadow = {};
        s.earned = false;
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
    if (e.kind === "dialscrap") {
      this.move(e, dt);
      if (distance(e, w.player) < 0.65) w.hurt(12, e.kind, false);
      return;
    }
    if (
      boss &&
      (w.enemies.some((o) => o.hp > 0 && isElite(o.kind)) ||
        w.hazards.some(
          (h) => h.eclipse && h.source !== e.id && h.until > w.time,
        ))
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
    if (s.relocate) {
      if (w.time < (s.relocateUntil ?? 0) && distance(e, s.relocate) > 0.3) {
        this.move(e, dt, s.relocate);
        return;
      }
      s.relocate = undefined;
    }
    const d = distance(e, w.player);
    if (d > 5.5 || !w.visible(e, 1.2)) {
      this.move(e, dt);
      return;
    }
    if (d < (boss ? 1 : 0.65))
      w.hurt(boss ? 22 : ENEMIES[e.kind].contact, e.kind, false);
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
      : e.kind === "twindial"
        ? "pair"
        : e.kind === "eclipsewarden"
          ? "mixed"
          : e.kind === "reversegazer"
            ? "reverse"
            : e.kind === "offsetorrery"
              ? "offset"
              : "sweep";
    if (this.begin(e)) {
      e.pattern++;
      this.lastStart = w.time;
    }
  }
  stepHazard(h: Hazard) {
    const b = h.eclipse!;
    if (!b.cancelled && b.last < this.w.time)
      this.sample(b.player, this.w.player, b.last, this.w.time);
  }
}
