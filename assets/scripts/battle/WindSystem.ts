import { stageRecoveryFactor } from "./StagePressure";
import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, Kind, isElite } from "./SurvivalConfig";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import { windMap } from "./WindMap";
import {
  windCurve,
  windLengths,
  windPosition,
  windMove,
  windEscape,
  windHit,
} from "./WindGeometry";
export const WIND_KINDS: readonly Kind[] = [
  "fledglingeffigy",
  "reedwhistler",
  "sickleplumer",
  "foldedskimmer",
  "windarbiter",
  "plumejudge",
];
export const windEnemy = (k: Kind) => WIND_KINDS.includes(k);
export interface WindState {
  action: "wind" | "feather" | "glide" | "A" | "B" | "C" | "transition";
  next: number;
  step: number;
  recover: number;
  vulnerable: boolean;
  follow?: boolean;
  relocate?: Point;
  pairWait?: number;
}
export class WindSystem {
  private wave = 0;
  private special = 0;
  private rounds = [false, false, false, false];
  private firstReturn = 0;
  private boss = false;
  private horde = 0;
  private rest = 0;
  private lastStart = -Infinity;
  private reservations = new Map<number, number>();
  readonly stats = {
    wind: 0,
    feather: 0,
    glide: 0,
    pairs: 0,
    rejected: 0,
    cancelled: 0,
    patterns: { A: 0, B: 0, C: 0 },
  };
  constructor(private w: SurvivalWorld) {}
  state(e: Enemy): WindState {
    return (
      e.wind ??
      (e.wind = {
        action: "feather",
        next: 0,
        step: 0,
        recover: 2.2,
        vulnerable: false,
      })
    );
  }
  get slots() {
    let n = this.w.hazards.filter(
      (h) => h.until > this.w.time && !h.wind?.cancelled,
    ).length;
    this.reservations.forEach(
      (count, id) =>
        (n += Math.max(
          0,
          count -
            this.w.hazards.filter(
              (h) =>
                h.source === id && h.until > this.w.time && !h.wind?.cancelled,
            ).length,
        )),
    );
    return n;
  }
  position(angle: number, r = 9): Point | undefined {
    for (let i = 0; i < 24; i++) {
      const a = angle + (i * Math.PI) / 12,
        p = {
          x: Math.max(-21, Math.min(21, this.w.player.x + Math.cos(a) * r)),
          y: Math.max(-25, Math.min(25, this.w.player.y + Math.sin(a) * r)),
        };
      if (distance(p, this.w.player) > 3 && !windMap.blocked(p, 0.8)) return p;
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
        boss.wind?.action !== "transition" &&
        (t - 360) % 14 < 9
      ) {
        const n = w.enemies.filter(
          (e) => e.hp > 0 && e.kind === "fledglingeffigy",
        ).length;
        for (let i = 0; i < Math.min(8, 30 - n); i++)
          this.spawn(
            "fledglingeffigy",
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
        i === 0 || i === 2 ? "windarbiter" : "plumejudge",
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
          "fledglingeffigy",
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
        ? ["reedwhistler"]
        : t < 95
          ? ["sickleplumer"]
          : t < 125
            ? ["foldedskimmer"]
            : Math.floor(t / 20) % 2
              ? ["reedwhistler", "sickleplumer"]
              : ["sickleplumer", "foldedskimmer"];
    if (
      w.enemies.some(
        (e) =>
          e.hp > 0 &&
          windEnemy(e.kind) &&
          e.kind !== "fledglingeffigy" &&
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
    e.timer = seconds * stageRecoveryFactor(this.w.stageId);
    e.immovable = false;
    s.step = 0;
    s.follow = false;
    s.vulnerable = true;
    this.reservations.delete(e.id);
  }
  private move(e: Enemy, dt: number, target = this.w.player) {
    const d = distance(e, target),
      a = windMap.heading(e, target),
      speed =
        d > 0.3
          ? (e.kind === "boss" ? 1.3 : ENEMIES[e.kind].speed) *
            (e.slowUntil > this.w.time ? 1 - e.slow : 1)
          : 0;
    e.facing = a;
    windMove(
      e,
      { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
      dt,
      e.kind === "boss" ? 0.7 : 0.35,
      this.w.hazards,
      this.w.time,
    );
  }
  private make(
    e: Enemy,
    shape: "wind" | "feather" | "glide",
    points: Point[],
    delay: number,
    speed: number,
    width: number,
    damage: number,
    order = 1,
    at = this.w.time,
  ): Hazard {
    const lengths = windLengths(points),
      radius =
        shape === "wind"
          ? 3.5
          : Math.min(
              shape === "feather" ? 8 : 5.4,
              lengths[lengths.length - 1],
            );
    return {
      id: this.w.id(),
      source: e.id,
      kind: "circle",
      ...points[0],
      angle: 0,
      radius,
      width,
      damage,
      fixedDamage: true,
      damageLabel:
        shape === "feather"
          ? "风廊曲羽"
          : shape === "glide"
            ? "折翼滑翔"
            : "定向风带",
      created: at,
      due: at + delay,
      until:
        at +
        delay +
        (shape === "wind"
          ? 2.6
          : radius / speed + (shape === "glide" ? 0.35 : 0)),
      fired: false,
      next: 0,
      wind: {
        shape,
        points,
        lengths,
        speed,
        order,
        last: this.w.time,
        player: { ...this.w.player },
        hit: false,
      },
    };
  }
  windBand(e: Enemy, order = 1) {
    const h = this.make(
      e,
      "wind",
      [{ ...this.w.player }, { ...this.w.player }],
      1.8,
      0.8,
      1.6,
      0,
      order,
    );
    h.angle =
      e.kind === "boss"
        ? (e.bossPhase === 1 ? [0, Math.PI / 2] : [Math.PI / 4, -Math.PI / 4])[
            Math.floor(e.pattern / 3) % 2
          ]
        : [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4][e.pattern % 4];
    return h;
  }
  feather(e: Enemy, order = 1, at = this.w.time) {
    const w = this.w,
      boss = e.kind === "boss",
      elite = isElite(e.kind),
      d = distance(e, w.player),
      a = Math.atan2(w.player.y - e.y, w.player.x - e.x),
      sign = e.pattern % 2 ? -1 : 1;
    const end = {
        x: e.x + Math.cos(a) * Math.min(d, 7.5),
        y: e.y + Math.sin(a) * Math.min(d, 7.5),
      },
      c = {
        x: (e.x + end.x) / 2 - Math.sin(a) * sign * 1.4,
        y: (e.y + end.y) / 2 + Math.cos(a) * sign * 1.4,
      };
    return this.make(
      e,
      "feather",
      windCurve(e, c, end),
      boss ? 1.8 : elite ? 1.7 : 1.6,
      boss ? 4.1 : elite ? 4.2 : 4.3,
      boss ? 0.26 : elite ? 0.24 : 0.22,
      boss ? 26 : elite ? 24 : 22,
      order,
      at,
    );
  }
  glide(e: Enemy, order = 1, at = this.w.time) {
    const w = this.w,
      d = distance(e, w.player),
      a = Math.atan2(w.player.y - e.y, w.player.x - e.x),
      sign = e.pattern % 2 ? -1 : 1,
      end = {
        x: e.x + Math.cos(a) * Math.min(d, 4.5),
        y: e.y + Math.sin(a) * Math.min(d, 4.5),
      },
      bend = {
        x: (e.x + end.x) / 2 - Math.sin(a) * 0.9 * sign,
        y: (e.y + end.y) / 2 + Math.cos(a) * 0.9 * sign,
      };
    return this.make(
      e,
      "glide",
      [{ x: e.x, y: e.y }, bend, end],
      1.8,
      3.8,
      e.kind === "boss" ? 0.65 : 0.45,
      e.kind === "boss" ? 26 : 22,
      order,
      at,
    );
  }
  private visible(p: Point, r: number) {
    const w = this.w;
    return (
      Math.abs(p.x - w.camera.x) + r < w.viewport.x - 0.4 &&
      p.y + r - w.camera.y < w.viewport.y - 2.6 &&
      p.y - r - w.camera.y > -w.viewport.y + 2.7
    );
  }
  legal(h: Hazard) {
    const b = h.wind!;
    if (b.shape === "wind") {
      // Check all of the oriented rectangle, rather than only its center or long axis.
      const c = Math.cos(h.angle),
        s = Math.sin(h.angle);
      for (let x = -3.5; x <= 3.501; x += 0.175)
        for (let y = -1.6; y <= 1.601; y += 0.16) {
          const p = { x: h.x + c * x - s * y, y: h.y + s * x + c * y };
          if (
            !this.visible(p, 0) ||
            windMap.blocked(p, 0.13) ||
            Math.abs(p.x) > 21.7 ||
            Math.abs(p.y) > 25.7
          )
            return false;
        }
      return true;
    }
    for (let i = 0; i < b.points.length; i++) {
      const p = b.points[i];
      if (
        !this.visible(p, h.width) ||
        Math.abs(p.x) > 22 - h.width ||
        Math.abs(p.y) > 26 - h.width ||
        windMap.blocked(p, h.width + 0.002) ||
        (i && windMap.segment(b.points[i - 1], p, h.width + 0.002))
      )
        return false;
    }
    return b.lengths[b.lengths.length - 1] <= h.radius + 0.001;
  }
  private plan(e: Enemy) {
    const s = this.state(e),
      now = this.w.time;
    if (s.action === "wind") return [this.windBand(e)];
    if (s.action === "feather") return [this.feather(e)];
    if (s.action === "glide") return [this.glide(e)];
    if (s.action === "A") return [this.feather(e)];
    const band = this.windBand(e),
      other =
        s.action === "B"
          ? this.glide(e, 2, now + 0.8)
          : this.feather(e, 2, now + 0.8);
    if (s.action === "C") other.damage = 28;
    return [band, other];
  }
  private publish(items: Hazard[]) {
    const w = this.w;
    if (
      items.some((h) => !this.legal(h)) ||
      items.filter((h) => h.wind!.shape === "wind").length +
        w.hazards.filter(
          (h) =>
            h.wind?.shape === "wind" && !h.wind.cancelled && h.until > w.time,
        ).length >
        1 ||
      !windEscape(w, items)
    )
      return false;
    w.hazards.push(...items);
    for (const h of items) this.stats[h.wind!.shape]++;
    for (const id of new Set(items.map((h) => h.source))) {
      const e = w.enemies.find((e) => e.id === id)!;
      const s = this.state(e),
        mine = items.filter((h) => h.source === id);
      s.step = 1;
      s.pairWait = undefined;
      s.next = Math.max(...mine.map((h) => h.until)) + (s.follow ? 0.6 : 0);
      s.vulnerable = false;
      e.state = "windup";
      e.immovable = true;
    }
    return true;
  }
  private reject(e: Enemy) {
    this.stats.rejected++;
    this.recover(e);
    this.state(e).relocate = this.position(
      Math.atan2(e.y - this.w.player.y, e.x - this.w.player.x) + Math.PI / 3,
      3.5,
    );
  }
  begin(e: Enemy) {
    const s = this.state(e),
      boss = e.kind === "boss",
      items = this.plan(e),
      n = s.action === "A" ? 2 : items.length;
    s.recover = boss
      ? s.action === "C"
        ? 4
        : s.action === "B"
          ? 3.6
          : 3.4
      : isElite(e.kind)
        ? e.kind === "windarbiter"
          ? 3.2
          : 3
        : e.kind === "reedwhistler"
          ? 2.8
          : e.kind === "foldedskimmer"
            ? 2.4
            : 2.2;
    if (this.slots + n > 2) {
      e.attack = 0.3;
      return false;
    }
    this.reservations.set(e.id, n);
    s.follow = s.action === "A";
    if (!this.publish(items)) {
      this.reject(e);
      return true;
    }
    if (boss && (s.action === "A" || s.action === "B" || s.action === "C"))
      this.stats.patterns[s.action]++;
    return true;
  }
  private pair(e: Enemy) {
    if (!isElite(e.kind) || this.slots) return false;
    const w = this.w,
      other = w.enemies.find(
        (o) =>
          o.hp > 0 &&
          o.id !== e.id &&
          isElite(o.kind) &&
          o.state === "seek" &&
          o.attack <= 0 &&
          o.freezeUntil <= w.time,
      );
    if (!other) return false;
    const arb = e.kind === "windarbiter" ? e : other,
      judge = e.kind === "plumejudge" ? e : other;
    const a = this.windBand(arb),
      b = this.feather(judge, 2, w.time + 0.8),
      pair = w.id();
    a.wind!.pair = b.wind!.pair = pair;
    if (!this.publish([a, b])) return false;
    this.state(arb).recover = 3.2;
    this.state(judge).recover = 3;
    arb.pattern++;
    judge.pattern++;
    this.stats.pairs++;
    return true;
  }
  private cancel(e: Enemy) {
    const w = this.w,
      pairs = new Set<number>();
    for (const h of w.hazards)
      if (
        h.source === e.id &&
        h.wind &&
        (!h.fired || h.wind.shape === "glide")
      ) {
        if (h.wind.pair) pairs.add(h.wind.pair);
        h.wind.cancelled = true;
        h.until = Math.min(h.until, w.time);
        this.stats.cancelled++;
      }
    for (const h of w.hazards)
      if (h.wind?.pair && pairs.has(h.wind.pair) && !h.fired) {
        h.wind.cancelled = true;
        h.until = Math.min(h.until, w.time);
      }
    this.recover(e);
  }
  clean() {
    const w = this.w;
    for (const e of w.enemies)
      if (e.wind && e.wind.step > 0 && (e.hp <= 0 || e.freezeUntil > w.time))
        this.cancel(e);
    for (const h of w.hazards)
      if (h.wind && !h.wind.cancelled && h.until > w.time) {
        const owner = w.enemies.find((e) => e.id === h.source && e.hp > 0);
        if (!owner && (!h.fired || h.wind.shape === "glide")) {
          h.wind.cancelled = true;
          h.until = w.time;
        }
      }
    this.reservations.forEach((_, id) => {
      if (!w.enemies.some((e) => e.id === id && e.hp > 0))
        this.reservations.delete(id);
    });
  }
  onDeath(e: Enemy) {
    this.cancel(e);
    if (
      isElite(e.kind) &&
      !this.w.enemies.some((o) => o.id !== e.id && o.hp > 0 && isElite(o.kind))
    )
      this.rest = this.w.time + (this.w.time >= 360 ? 3 : 6);
    return false;
  }
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss";
    if (e.freezeUntil > w.time) {
      if (s.step) this.cancel(e);
      if (!e.immovable)
        windMove(e, { x: 0, y: 0 }, dt, boss ? 0.7 : 0.35, w.hazards, w.time);
      return;
    }
    if (boss && e.bossPhase === 1 && e.hp / e.maxHp <= 0.55) {
      e.bossPhase = 2;
      this.cancel(e);
      s.action = "transition";
      s.next = w.time + 1.5;
      e.state = "windup";
      e.immovable = true;
      s.vulnerable = false;
      w.effects.push({ type: "bossPhase", ...e });
      return;
    }
    if (s.action === "transition") {
      if (w.time >= s.next) {
        e.pattern = 0;
        s.action = "feather";
        this.recover(e, 1);
      }
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      windMove(e, { x: 0, y: 0 }, dt, boss ? 0.7 : 0.35, w.hazards, w.time);
      if (e.timer <= 0) {
        e.state = "seek";
        s.vulnerable = false;
        e.attack =
          e.kind === "reedwhistler" || e.kind === "foldedskimmer" ? 3.2 : 3;
      }
      return;
    }
    if (s.step) {
      const live = w.hazards.filter(
        (h) =>
          h.source === e.id && h.wind && !h.wind.cancelled && h.until > w.time,
      );
      const glide = live.find(
        (h) => h.wind!.shape === "glide" && w.time >= h.due,
      );
      if (glide) {
        const p = windPosition(glide, w.time);
        e.x = p.x;
        e.y = p.y;
        e.state = "charge";
      }
      e.timer = Math.max(0, ...live.map((h) => h.due - w.time));
      if (!live.length && w.time >= s.next) {
        if (s.follow) {
          s.follow = false;
          const h = this.feather(e, 2);
          if (this.publish([h])) s.next = h.until;
          else this.reject(e);
        } else this.recover(e);
      }
      return;
    }
    if (e.kind === "fledglingeffigy") {
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
    ) {
      windMove(e, { x: 0, y: 0 }, dt, 0.35, w.hazards, w.time);
      return;
    }
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
    e.attack -= dt;
    if (e.attack > 0) {
      this.move(e, dt, d > 3.5 ? w.player : e);
      if (d < 0.65) w.hurt(boss ? 22 : ENEMIES[e.kind].contact, e.kind, false);
      return;
    }
    if (this.pair(e)) {
      s.pairWait = undefined;
      return;
    }
    // A short rendezvous window aligns the two independent recovery clocks.
    // Invalid combined geometry still falls back to each taught single attack.
    if (isElite(e.kind)) {
      const partner = w.enemies.find(
        (o) => o.id !== e.id && o.hp > 0 && isElite(o.kind),
      );
      if (partner) {
        s.pairWait ??= w.time;
        if (w.time - s.pairWait < 3.2) {
          windMove(e, { x: 0, y: 0 }, dt, 0.35, w.hazards, w.time);
          return;
        }
      }
      s.pairWait = undefined;
    }
    if (!boss && !isElite(e.kind) && w.time - this.lastStart < 3) {
      e.attack = 0.3;
      return;
    }
    s.action = boss
      ? ((e.bossPhase === 1 ? ["A", "B", "C"] : ["C", "A", "B"])[
          e.pattern % 3
        ] as "A" | "B" | "C")
      : e.kind === "reedwhistler" || e.kind === "windarbiter"
        ? "wind"
        : e.kind === "foldedskimmer"
          ? "glide"
          : "feather";
    if (this.begin(e)) {
      e.pattern++;
      this.lastStart = w.time;
    }
  }
  stepHazard(h: Hazard) {
    const w = this.w,
      b = h.wind!;
    if (b.cancelled) return;
    if (w.time < h.due) {
      b.last = w.time;
      b.player = { ...w.player };
      return;
    }
    const owner = w.enemies.find((e) => e.id === h.source && e.hp > 0);
    if (!h.fired && (!owner || owner.freezeUntil > w.time)) {
      b.cancelled = true;
      h.until = w.time;
      return;
    }
    h.fired = true;
    if (!b.hit && windHit(h, w.player, w.time, b.last, b.player)) {
      b.hit = true;
      w.hurt(h.damage, h.damageLabel!, false);
    }
    if (b.shape === "glide" && owner) {
      const p = windPosition(h, Math.min(w.time, h.until));
      owner.x = p.x;
      owner.y = p.y;
    }
    b.last = w.time;
    b.player = { ...w.player };
  }
}
