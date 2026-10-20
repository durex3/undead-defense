import { stageRecoveryFactor } from "./StagePressure";
import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, Kind, isElite } from "./SurvivalConfig";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import { rootMap } from "./RootMap";
import { rootArm, rootHit, rootEscape } from "./RootGeometry";
export const ROOT_KINDS: readonly Kind[] = [
  "rootshuffler",
  "vinecantor",
  "wreathpod",
  "bulbmaw",
  "biforktangler",
  "pairedcalyx",
  "migratorycorolla",
];
export const rootEnemy = (kind: Kind) => ROOT_KINDS.includes(kind);
export interface RootState {
  action:
    | "arm"
    | "ring"
    | "disk"
    | "doubleArm"
    | "beds"
    | "offsetBeds"
    | "A"
    | "B"
    | "C"
    | "transition";
  step: number;
  next: number;
  recover: number;
  vulnerable: boolean;
  follow?: boolean;
  retry: number;
  relocate?: Point;
  direction?: number;
}
export class RootSystem {
  private wave = 0;
  private special = 0;
  private spawned = [false, false, false];
  private boss = false;
  private horde = 0;
  private rest = 0;
  private lastStart = -Infinity;
  private reservations = new Map<number, number>();
  readonly stats = {
    arms: 0,
    rings: 0,
    disks: 0,
    rejected: 0,
    boss: 0,
    cancelled: 0,
    patterns: { A: 0, B: 0, C: 0 },
  };
  constructor(private w: SurvivalWorld) {}
  state(e: Enemy): RootState {
    return (
      e.root ??
      (e.root = {
        action: "arm",
        step: 0,
        next: 0,
        recover: 2,
        vulnerable: false,
        retry: 0,
      })
    );
  }
  get slots() {
    let n = this.w.hazards.filter((h) => h.until > this.w.time).length;
    this.reservations.forEach(
      (r, id) =>
        (n += Math.max(
          0,
          r -
            this.w.hazards.filter(
              (h) => h.source === id && h.until > this.w.time,
            ).length,
        )),
    );
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
      if (distance(p, w.player) > 4 && !rootMap.blocked(p, 0.8)) return p;
    }
  }
  private spawn(kind: Kind, angle: number, reinforcement = false) {
    const w = this.w,
      c = ENEMIES[kind];
    if (
      w.enemies.filter((e) => e.hp > 0 && e.kind === kind).length >=
        Math.min(c.cap, w.time < 125 && kind !== "rootshuffler" ? 1 : c.cap) ||
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
      const boss = w.enemies.find((e) => e.kind === "boss" && e.hp > 0);
      if (
        boss &&
        !elite &&
        t >= this.rest &&
        t >= this.horde &&
        boss.state !== "recover" &&
        boss.root?.action !== "transition" &&
        (t - 360) % 14 < 9
      ) {
        const n = w.enemies.filter(
          (e) => e.hp > 0 && e.kind === "rootshuffler",
        ).length;
        for (let i = 0; i < Math.min(8, 30 - n); i++)
          this.spawn(
            "rootshuffler",
            (i * Math.PI) / 4 + w.random() * 0.3,
            true,
          );
        this.horde = t + 2.5;
      }
      return;
    }
    for (let i = 0; i < 3; i++)
      if (
        !this.spawned[i] &&
        t >= [135, 225, 305][i] &&
        t < 340 &&
        !elite &&
        t >= this.rest
      ) {
        const e = this.spawn(
          (["biforktangler", "migratorycorolla", "pairedcalyx"] as const)[i],
          w.random() * Math.PI * 2,
        );
        if (e) {
          this.spawned[i] = true;
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
      const n = quiet ? 3 : Math.min(16, 6 + Math.floor(t / 40));
      for (let i = 0; i < n; i++)
        this.spawn(
          "rootshuffler",
          (i >= n / 2 ? Math.PI : 0) + i * 0.15 + w.random() * 0.3,
        );
      this.wave = quiet ? 4 : 2.8;
    }
    if (quiet || elite || t < this.rest || this.special > 0 || t < 30) return;
    const kinds: Kind[] =
      t < 65
        ? ["vinecantor"]
        : t < 95
          ? ["wreathpod"]
          : t < 125
            ? ["bulbmaw"]
            : Math.floor(t / 20) % 2
              ? ["vinecantor", "wreathpod"]
              : ["vinecantor", "bulbmaw"];
    if (
      w.enemies.some(
        (e) =>
          e.hp > 0 &&
          ROOT_KINDS.includes(e.kind) &&
          e.kind !== "rootshuffler" &&
          !isElite(e.kind) &&
          !kinds.includes(e.kind),
      )
    )
      return;
    this.spawn(
      kinds[Math.floor(t / 5) % kinds.length],
      w.random() * Math.PI * 2,
    );
    this.special = t < 125 ? 6 : t >= 340 ? 8 : 5;
  }
  private reserve(e: Enemy, n: number) {
    if (this.slots + n > 2) return false;
    this.reservations.set(e.id, n);
    return true;
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
  private move(e: Enemy, dt: number, speed: number, target = this.w.player) {
    const d = distance(e, target);
    if (d < 0.3) return;
    const a = rootMap.heading(e, target),
      step = Math.min(
        d,
        speed * dt * (e.slowUntil > this.w.time ? 1 - e.slow : 1),
      );
    e.facing = a;
    e.x += Math.cos(a) * step;
    e.y += Math.sin(a) * step;
    rootMap.resolve(e, e.kind === "boss" ? 0.7 : 0.35);
  }
  private visible(p: Point, pad = 0) {
    const w = this.w;
    return (
      w.visible(p, 1.1) &&
      p.y - w.camera.y < w.viewport.y - 2.6 - pad &&
      p.y - w.camera.y > -w.viewport.y + 2.7 + pad
    );
  }
  private make(
    e: Enemy,
    shape: "arm" | "ring" | "disk",
    center: Point,
    inner: number,
    radius: number,
    width: number,
    delay: number,
    duration: number,
    damage: number,
    order: number,
    at = this.w.time,
  ): Hazard {
    return {
      id: this.w.id(),
      source: e.id,
      kind: "circle",
      x: center.x,
      y: center.y,
      angle: 0,
      radius,
      width,
      damage,
      fixedDamage: true,
      damageLabel:
        shape === "arm"
          ? "温室摆藤"
          : shape === "ring"
            ? "温室环刺"
            : "温室花爆",
      created: at,
      due: at + delay,
      until: at + delay + duration,
      fired: false,
      next: 0,
      root: {
        shape,
        inner,
        turn: 0,
        order,
        last: this.w.time,
        player: { ...this.w.player },
        hit: false,
      },
    };
  }
  arm(e: Enemy, order = 1, at = this.w.time): Hazard {
    const boss = e.kind === "boss",
      elite = isElite(e.kind),
      extent = ((boss || elite ? 110 : 100) * Math.PI) / 180,
      sign =
        order === 1
          ? e.pattern % 2
            ? -1
            : 1
          : -(this.state(e).direction ?? 1);
    const h = this.make(
      e,
      "arm",
      e,
      boss ? 1.8 : elite ? 1.7 : 1.5,
      boss ? 5.8 : elite ? 5.6 : 5.2,
      boss ? 0.25 : elite ? 0.24 : 0.22,
      boss || elite ? 1.8 : 1.6,
      boss ? 3.2 : elite ? 3 : 2.6,
      boss ? 26 : elite ? 24 : 22,
      order,
      at,
    );
    h.angle =
      Math.atan2(this.w.player.y - e.y, this.w.player.x - e.x) -
      (sign * extent) / 2;
    h.root!.turn = sign * extent;
    return h;
  }
  private ringCenter(e: Enemy): Point | undefined {
    const w = this.w,
      d = distance(e, w.player);
    if (d < 0.1) return;
    const offset = e.kind === "boss" ? 3.1 : isElite(e.kind) ? 2.95 : 2.85;
    return {
      x: w.player.x + ((e.x - w.player.x) * offset) / d,
      y: w.player.y + ((e.y - w.player.y) * offset) / d,
    };
  }
  flower(
    e: Enemy,
    shape: "ring" | "disk",
    order = 1,
    center?: Point,
    at = this.w.time,
  ): Hazard | undefined {
    const boss = e.kind === "boss",
      elite = isElite(e.kind),
      p =
        center ??
        (shape === "disk" ? { ...this.w.player } : this.ringCenter(e));
    if (!p) return;
    return this.make(
      e,
      shape,
      p,
      shape === "ring" ? (boss ? 2.4 : elite ? 2.3 : 2.2) : 0,
      shape === "ring"
        ? boss
          ? 3.8
          : elite
            ? 3.6
            : 3.5
        : boss
          ? 2.4
          : elite
            ? 2.3
            : 2.2,
      0,
      shape === "ring" || boss || elite ? 1.8 : 1.6,
      shape === "ring" ? 0.6 : 0.35,
      shape === "ring"
        ? boss
          ? 26
          : elite
            ? 24
            : 22
        : boss
          ? 28
          : elite
            ? 26
            : 24,
      order,
      at,
    );
  }
  private legal(h: Hazard) {
    const b = h.root!;
    if (b.shape !== "arm")
      return (
        !rootMap.blocked(h, 0.3) &&
        [0, 1, 2, 3].every((i) =>
          this.visible({
            x: h.x + Math.cos((i * Math.PI) / 2) * h.radius,
            y: h.y + Math.sin((i * Math.PI) / 2) * h.radius,
          }),
        )
      );
    // Cover the whole sector, including between angular samples, with a conservative pad.
    for (let i = 0; i <= 64; i++) {
      const t = h.due + ((h.until - h.due) * i) / 64,
        [a, z] = rootArm(h, t),
        pad = h.width + (h.radius * Math.abs(b.turn)) / 128;
      if (
        !this.visible(a, h.width) ||
        !this.visible(z, h.width) ||
        rootMap.blocked(a, pad) ||
        rootMap.blocked(z, pad) ||
        rootMap.segment(a, z, pad)
      )
        return false;
    }
    return true;
  }
  private publish(e: Enemy, items: Hazard[]) {
    const w = this.w;
    if (items.some((h) => !this.legal(h)) || !rootEscape(w, items))
      return false;
    for (const h of items) {
      w.hazards.push(h);
      if (h.root!.shape === "arm") this.stats.arms++;
      else if (h.root!.shape === "ring") this.stats.rings++;
      else this.stats.disks++;
    }
    const s = this.state(e);
    s.step = items[0].root!.order;
    s.next =
      Math.max(...items.map((h) => h.until)) +
      (s.follow ? (e.kind === "boss" ? 0.6 : 0.8) : 0);
    e.state = "windup";
    e.timer = items[0].due - w.time;
    e.immovable = true;
    s.vulnerable = false;
    return true;
  }
  private reject(e: Enemy) {
    this.stats.rejected++;
    this.recover(e);
    const s = this.state(e);
    s.retry++;
    s.relocate = this.position(
      Math.atan2(e.y - this.w.player.y, e.x - this.w.player.x) + Math.PI / 3,
      4.5,
    );
  }
  private plan(e: Enemy) {
    const w = this.w,
      s = this.state(e);
    const items: Hazard[] = [];
    if (
      s.action === "arm" ||
      s.action === "A" ||
      s.action === "doubleArm" ||
      s.action === "C"
    ) {
      const arm = this.arm(e);
      items.push(arm);
      if (s.action === "C") {
        const phase2 = e.bossPhase === 2,
          end = arm.angle + arm.root!.turn,
          center = phase2
            ? { x: e.x + Math.cos(end) * 3.6, y: e.y + Math.sin(end) * 3.6 }
            : { x: e.x, y: e.y };
        const bed = this.flower(
          e,
          phase2 ? "disk" : "ring",
          2,
          center,
          w.time + 1.6,
        );
        if (bed) items.push(bed);
      }
    } else if (s.action === "offsetBeds") {
      const center = this.ringCenter(e),
        first = center && this.flower(e, "ring", 1, center);
      if (first) {
        const second = this.flower(
          e,
          "ring",
          2,
          { x: 2 * w.player.x - center!.x, y: 2 * w.player.y - center!.y },
          first.until + 0.6,
        );
        if (second) items.push(first, second);
      }
    } else if (s.action === "B" || s.action === "beds") {
      const center = this.ringCenter(e),
        ring = center && this.flower(e, "ring", 1, center),
        disk = ring && this.flower(e, "disk", 2, center, ring.until);
      if (ring && disk) items.push(ring, disk);
    } else {
      const h = this.flower(e, s.action === "disk" ? "disk" : "ring");
      if (h) items.push(h);
    }
    return items;
  }
  private preparePosition(e: Enemy) {
    const current = this.plan(e);
    if (current.length && current.every((h) => this.legal(h))) return false;
    const w = this.w,
      angle = Math.atan2(e.y - w.player.y, e.x - w.player.x);
    for (const radius of [3.5, 4.5])
      for (let i = 0; i < 24; i++) {
        const a = angle + (i * Math.PI) / 12,
          p = {
            x: w.player.x + Math.cos(a) * radius,
            y: w.player.y + Math.sin(a) * radius,
          };
        if (
          rootMap.blocked(p, e.kind === "boss" ? 0.7 : 0.35) ||
          !this.visible(p)
        )
          continue;
        const candidate = { ...e, x: p.x, y: p.y },
          items = this.plan(candidate);
        if (items.length && items.every((h) => this.legal(h))) {
          this.state(e).relocate = p;
          return true;
        }
      }
    return false;
  }
  begin(e: Enemy): boolean {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss",
      elite = isElite(e.kind);
    s.recover = boss
      ? s.action === "C"
        ? 4
        : s.action === "B"
          ? 3.6
          : 3.4
      : elite
        ? e.kind === "pairedcalyx" || e.kind === "migratorycorolla"
          ? 3.6
          : 3.4
        : e.kind === "wreathpod"
          ? 2
          : 2.2;
    if (!this.reserve(e, boss || elite ? 2 : 1)) {
      e.attack = 0.3;
      return false;
    }
    s.follow = s.action === "A" || s.action === "doubleArm";
    s.relocate = undefined;
    s.direction = e.pattern % 2 ? -1 : 1;
    const items = this.plan(e);
    if (
      !items.length ||
      ((s.action === "C" ||
        s.action === "B" ||
        s.action === "beds" ||
        s.action === "offsetBeds") &&
        items.length !== 2) ||
      !this.publish(e, items)
    ) {
      this.reject(e);
      return true;
    }
    if (boss) {
      this.stats.boss++;
      if (s.action === "A" || s.action === "B" || s.action === "C")
        this.stats.patterns[s.action]++;
    }
    return true;
  }
  clean() {
    const w = this.w;
    for (const h of w.hazards) {
      if (!h.root) continue;
      const owner = w.enemies.find((e) => e.id === h.source && e.hp > 0);
      if (!owner && (!h.fired || h.root.shape === "arm")) {
        if (h.until > w.time) this.stats.cancelled++;
        h.root.cancelled = true;
        h.until = Math.min(h.until, w.time);
      }
      if (
        owner &&
        h.root.shape === "arm" &&
        h.fired &&
        owner.freezeUntil > w.time
      )
        this.cancelSequence(owner);
    }
    this.reservations.forEach((_, id) => {
      if (!w.enemies.some((e) => e.id === id && e.hp > 0))
        this.reservations.delete(id);
    });
  }
  private cancelSequence(e: Enemy) {
    for (const h of this.w.hazards)
      if (h.source === e.id && h.root && (h.root.shape === "arm" || !h.fired)) {
        if (h.until > this.w.time) this.stats.cancelled++;
        h.root.cancelled = true;
        h.until = Math.min(h.until, this.w.time);
      }
    this.recover(e);
  }
  onDeath(e: Enemy) {
    this.cancelSequence(e);
    if (isElite(e.kind)) this.rest = this.w.time + (this.w.time >= 360 ? 3 : 6);
    return false;
  }
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss";
    if (e.freezeUntil > w.time) {
      if (
        w.hazards.some(
          (h) =>
            h.source === e.id &&
            h.root?.shape === "arm" &&
            h.fired &&
            h.until > w.time,
        )
      ) {
        this.cancelSequence(e);
        return;
      }
      if (s.step > 0) {
        s.next += dt;
        for (const h of w.hazards)
          if (h.source === e.id && h.root && !h.fired && h.until > w.time) {
            h.created += dt;
            h.due += dt;
            h.until += dt;
            h.root.last = w.time;
            h.root.player = { ...w.player };
          }
      }
      return;
    }
    if (boss && e.bossPhase === 1 && e.hp / e.maxHp <= 0.55) {
      e.bossPhase = 2;
      this.cancelSequence(e);
      s.action = "transition";
      s.next = w.time + 1.5;
      e.state = "windup";
      e.immovable = true;
      e.timer = 1.5;
      s.vulnerable = false;
      w.effects.push({ type: "bossPhase", x: e.x, y: e.y });
      return;
    }
    if (s.action === "transition") {
      e.timer = Math.max(0, s.next - w.time);
      if (w.time >= s.next) {
        e.pattern = 0;
        s.action = "arm";
        this.recover(e, 1);
      }
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "seek";
        s.vulnerable = false;
        e.attack = e.kind === "vinecantor" || e.kind === "bulbmaw" ? 3.2 : 3;
      }
      return;
    }
    if (s.step > 0) {
      const live = w.hazards.some((h) => h.source === e.id && h.until > w.time);
      e.timer = Math.max(
        0,
        ...w.hazards
          .filter((h) => h.source === e.id && h.until > w.time)
          .map((h) => h.due - w.time),
      );
      if (!live && w.time >= s.next) {
        if (s.follow && s.step === 1) {
          s.follow = false;
          const h = this.arm(e, 2);
          if (!this.publish(e, [h])) this.reject(e);
        } else this.recover(e);
      }
      return;
    }
    if (s.relocate) {
      if (distance(e, s.relocate) > 0.4) {
        this.move(e, dt, boss ? 1.3 : ENEMIES[e.kind].speed, s.relocate);
        return;
      }
      s.relocate = undefined;
      e.attack = 0.3;
    }
    if (e.kind === "rootshuffler") {
      this.move(e, dt, 1.65);
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
      ((!isElite(e.kind) &&
        w.enemies.some((o) => o.hp > 0 && isElite(o.kind))) ||
        w.enemies.some(
          (o) => o.hp > 0 && o.kind === "boss" && o.state === "recover",
        ))
    )
      return;
    const d = distance(e, w.player);
    if (d > 6 || !w.visible(e, 1)) {
      this.move(e, dt, boss ? 1.3 : ENEMIES[e.kind].speed);
      return;
    }
    e.attack -= dt;
    if (e.attack > 0) {
      if (d > 3.5) this.move(e, dt, boss ? 1.3 : ENEMIES[e.kind].speed);
      if (d < 0.65) w.hurt(boss ? 22 : ENEMIES[e.kind].contact, e.kind, false);
      return;
    }
    if (!boss && !isElite(e.kind) && w.time - this.lastStart < 3) {
      e.attack = 0.3;
      return;
    }
    s.action = boss
      ? ((e.bossPhase === 1 ? ["A", "B", "C"] : ["C", "A", "B"])[
          e.pattern % 3
        ] as "A" | "B" | "C")
      : e.kind === "biforktangler"
        ? "doubleArm"
        : e.kind === "migratorycorolla"
          ? "offsetBeds"
          : e.kind === "pairedcalyx"
            ? "beds"
            : e.kind === "wreathpod"
              ? "ring"
              : e.kind === "bulbmaw"
                ? "disk"
                : "arm";
    if (this.preparePosition(e)) {
      e.attack = 0.3;
      return;
    }
    if (this.begin(e)) {
      e.pattern++;
      this.lastStart = w.time;
    }
  }
  stepHazard(h: Hazard) {
    const w = this.w,
      b = h.root!;
    if (b.cancelled) return;
    const owner = w.enemies.find((e) => e.id === h.source && e.hp > 0);
    if (w.time < h.due) {
      b.last = w.time;
      b.player = { ...w.player };
      return;
    }
    if (!h.fired && (!owner || owner.freezeUntil > w.time)) return;
    if (b.shape === "arm" && (!owner || owner.freezeUntil > w.time)) {
      h.until = w.time;
      return;
    }
    h.fired = true;
    if (!b.hit && rootHit(h, w.player, w.time, b.last, b.player)) {
      b.hit = true;
      w.hurt(h.damage, h.damageLabel!, false);
    }
    b.last = w.time;
    b.player = { ...w.player };
  }
}
