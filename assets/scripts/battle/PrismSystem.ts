import { stageRecoveryFactor } from "./StagePressure";
import {ELITE_TIMES,eliteQuiet,RETURN_ELITE_HEALTH} from "./EncounterPacing";
import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, Kind, isElite } from "./SurvivalConfig";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import {
  prismMap,
  prismAim,
  prismTrace,
  PrismMirror,
  PrismPath,
} from "./PrismMap";
import { prismEscape, prismHead, prismHit } from "./PrismGeometry";
export const PRISM_MAIN: readonly Kind[] = [
  "shardhermit",
  "facetgastropod",
  "prismmason",
  "corebrood",
  "bifacetregent",
  "strataflinger",
];
export const PRISM_KINDS: readonly Kind[] = [
  ...PRISM_MAIN,
  "prismmirror",
  "prismcore",
];
export const prismEnemy = (kind: Kind) => PRISM_KINDS.includes(kind);
export const prismDevice = (kind: Kind) =>
  kind === "prismmirror" || kind === "prismcore";
export interface PrismState {
  action:
    | "bolt"
    | "core"
    | "mirror"
    | "doubleBolt"
    | "doubleCore"
    | "A"
    | "B"
    | "C"
    | "transition";
  step: number;
  next: number;
  recover: number;
  vulnerable: boolean;
  preview?: Hazard;
  site?: Point;
  axis?: "x" | "y";
  expires?: number;
  activeAt?: number;
  hazard?: number;
  mixed?: boolean;
  preparing?: boolean;
  sites?: { point: Point; axis: "x" | "y" }[];
}
export class PrismSystem {
  private wave = 0;
  private special = 0;
  private spawned = [false, false, false];
  private boss = false;
  private horde = 0;
  private rest = 0;
  private lastStart = -Infinity;
  private reservations = new Map<number, number>();
  readonly stats = {
    bolts: 0,
    reflections: 0,
    cores: 0,
    mirrors: 0,
    brokenCores: 0,
    brokenMirrors: 0,
    cancelledRoutes: 0,
    rejected: 0,
    boss: 0,
  };
  constructor(private w: SurvivalWorld) {}
  state(e: Enemy): PrismState {
    return (
      e.prism ??
      (e.prism = {
        action: "bolt",
        step: 0,
        next: 0,
        recover: 2,
        vulnerable: false,
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
  mirrors(): PrismMirror[] {
    return this.w.enemies
      .filter(
        (e) =>
          e.kind === "prismmirror" &&
          e.hp > 0 &&
          (e.prism?.activeAt ?? Infinity) <= this.w.time,
      )
      .map((e) => ({ id: e.id, x: e.x, y: e.y, axis: e.prism!.axis ?? "x" }));
  }
  position(angle: number, r = 9): Point | undefined {
    const w = this.w;
    for (let i = 0; i < 24; i++) {
      const a = angle + (i * Math.PI) / 12,
        p = {
          x: Math.max(-21, Math.min(21, w.player.x + Math.cos(a) * r)),
          y: Math.max(-25, Math.min(25, w.player.y + Math.sin(a) * r)),
        };
      if (distance(p, w.player) > 4 && !prismMap.blocked(p, 0.8)) return p;
    }
  }
  private spawn(kind: Kind, angle: number, reinforcement = false) {
    const w = this.w,
      c = ENEMIES[kind];
    if (
      w.enemies.filter((e) => e.hp > 0 && e.kind === kind).length >=
        Math.min(c.cap, w.time < 125 && kind !== "shardhermit" ? 1 : c.cap) ||
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
        boss.prism?.action !== "transition" &&
        (t - 360) % 14 < 9
      ) {
        const n = w.enemies.filter(
          (e) => e.hp > 0 && e.kind === "shardhermit",
        ).length;
        for (let i = 0; i < Math.min(8, 32 - n); i++)
          this.spawn("shardhermit", (i * Math.PI) / 4 + w.random() * 0.3, true);
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
        const e = this.spawn(
          i === 1 ? "strataflinger" : "bifacetregent",
          w.random() * Math.PI * 2,
        );
        if (e) {
          if(i===2)e.hp=e.maxHp=e.hp*RETURN_ELITE_HEALTH;
          this.spawned[i] = true;
          this.special = 6;
          w.effects.push({ type: "elite", ...e });
        }
        break;
      }
    const quiet =
      eliteQuiet(t) || t >= 350 ||
      (t >= 125 && t < 135) ||
      (t >= 215 && t < 230) ||
      (t >= 255 && t < 265);
    if (this.wave <= 0) {
      const n = quiet ? 3 : Math.min(16, 6 + Math.floor(t / 40));
      for (let i = 0; i < n; i++)
        this.spawn(
          "shardhermit",
          (i >= n / 2 ? Math.PI : 0) + i * 0.15 + w.random() * 0.3,
        );
      this.wave = quiet ? 4 : 2.8;
    }
    if (quiet || elite || t < this.rest || this.special > 0 || t < 30) return;
    const kinds: Kind[] =
      t < 65
        ? ["facetgastropod"]
        : t < 85
          ? ["prismmason"]
          : t < 105
            ? ["prismmason", "facetgastropod"]
            : t < 125
              ? ["corebrood"]
              : t < 175
                ? ["facetgastropod"]
                : Math.floor(t / 20) % 2
                  ? ["facetgastropod", "corebrood"]
                  : ["prismmason", "facetgastropod"];
    if (
      w.enemies.some(
        (e) =>
          e.hp > 0 &&
          PRISM_MAIN.includes(e.kind) &&
          e.kind !== "shardhermit" &&
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
  clean() {
    const w = this.w;
    for (const e of w.enemies)
      if (
        e.kind === "prismmirror" &&
        e.hp > 0 &&
        ((e.prism?.expires ?? 0) <= w.time ||
          !w.enemies.some((o) => o.id === e.owner && o.hp > 0))
      )
        e.hp = 0;
    const mirrors = new Set(this.mirrors().map((m) => m.id));
    for (const e of w.enemies) {
      const preview = e.prism?.preview;
      if (
        preview?.prism?.path.mirror !== undefined &&
        !mirrors.has(preview.prism.path.mirror)
      ) {
        e.prism!.preview = undefined;
        this.stats.cancelledRoutes++;
      }
    }
    for (const h of w.hazards)
      if (h.prism) {
        const b = h.prism,
          owner = w.enemies.find((e) => e.id === h.source && e.hp > 0);
        if (!h.fired && !owner) {
          h.until = w.time;
          this.removeCore(h);
          continue;
        }
        if (b.entity && !w.enemies.some((e) => e.id === b.entity && e.hp > 0)) {
          h.until = w.time;
          continue;
        }
        if (
          b.path.mirror !== undefined &&
          !mirrors.has(b.path.mirror) &&
          b.cut === undefined
        ) {
          const cancelled =
            !h.fired || (w.time - h.due) * b.speed < b.path.lengths[0];
          if (!h.fired) {
            h.until = w.time;
            this.removeCore(h);
          } else if ((w.time - h.due) * b.speed < b.path.lengths[0]) {
            b.cut = b.path.lengths[0];
            h.until = Math.min(h.until, h.due + b.cut / b.speed);
          }
          b.path.mirror = undefined;
          if (cancelled) this.stats.cancelledRoutes++;
        }
        if (h.until <= w.time) this.removeCore(h);
      }
    this.reservations.forEach((_, id) => {
      if (!w.enemies.some((e) => e.id === id && e.hp > 0))
        this.reservations.delete(id);
    });
  }
  private removeCore(h: Hazard) {
    if (h.prism?.entity) {
      const e = this.w.enemies.find((e) => e.id === h.prism!.entity);
      if (e) e.hp = 0;
    }
  }
  onDeath(e: Enemy) {
    const w = this.w;
    this.reservations.delete(e.id);
    if (prismDevice(e.kind)) {
      if (e.kind === "prismcore") {
        this.stats.brokenCores++;
        const h = w.hazards.find((h) => h.prism?.entity === e.id);
        if (h) {
          h.until = w.time;
          const source = w.enemies.find((o) => o.id === h.source && o.hp > 0);
          if (source?.prism)
            source.prism.next = Math.min(source.prism.next, w.time + 0.45);
        }
      } else this.stats.brokenMirrors++;
      return true;
    }
    if (e.prism) {
      e.prism.preview = undefined;
      e.prism.site = undefined;
    }
    for (const h of w.hazards)
      if (h.source === e.id && !h.fired) {
        h.until = w.time;
        this.removeCore(h);
      }
    if (isElite(e.kind)) this.rest = w.time + (w.time >= 360 ? 3 : 6);
    return false;
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
    s.step = 0;
    s.vulnerable = true;
    s.preview = undefined;
    s.site = undefined;
    s.preparing = false;
    s.sites = undefined;
    this.reservations.delete(e.id);
  }
  private move(e: Enemy, dt: number, speed: number) {
    const w = this.w,
      d = distance(e, w.player);
    if (d < 0.6) return;
    const a = prismMap.heading(e, w.player),
      step = Math.min(d, speed * dt * (e.slowUntil > w.time ? 1 - e.slow : 1));
    e.facing = a;
    e.x += Math.cos(a) * step;
    e.y += Math.sin(a) * step;
    prismMap.resolve(e, e.kind === "boss" ? 0.7 : 0.35);
  }
  private visible(h: Hazard) {
    return h.prism!.path.points.every((p) =>
      this.w.visible(p, Math.max(1.3, h.width + 0.1)),
    );
  }
  private bolt(
    e: Enemy,
    order: number,
    at = this.w.time,
    alternate = false,
    allowDirect = false,
  ): Hazard | undefined {
    const w = this.w,
      boss = e.kind === "boss",
      elite = isElite(e.kind),
      s = this.state(e),
      ultimate = s.action === "C",
      radius = boss ? (ultimate ? 0.28 : 0.26) : elite ? 0.25 : 0.22,
      speed = boss ? (ultimate ? 4.2 : 4.4) : elite ? 4.3 : 4.2,
      delay = boss ? (ultimate && order === 1 ? 1.8 : 1.5) : elite ? 1.5 : 1.45;
    let path = prismAim(e, w.player, radius, 12, this.mirrors(), alternate);
    if (!path && allowDirect) {
      const a = Math.atan2(w.player.y - e.y, w.player.x - e.x);
      path = prismTrace(e, a, 12, radius, this.mirrors(), false);
      if (path && path.total < distance(e, w.player) - 0.3) path = undefined;
    }
    if (!path) return;
    return this.make(
      e,
      "bolt",
      path,
      speed,
      radius,
      delay,
      boss ? (ultimate ? 28 : 26) : elite ? 24 : 22,
      order,
      at,
    );
  }
  private core(
    e: Enemy,
    order: number,
    at = this.w.time,
    offset = 0,
  ): Hazard | undefined {
    const w = this.w,
      boss = e.kind === "boss",
      elite = isElite(e.kind),
      radius = boss || elite ? 0.7 : 0.65,
      speed = boss || elite ? 2.1 : 2,
      delay = boss ? 1.7 : elite ? 1.6 : 1.5,
      a = Math.atan2(w.player.y - e.y, w.player.x - e.x),
      origin = { x: e.x - Math.sin(a) * offset, y: e.y + Math.cos(a) * offset },
      angle = Math.atan2(w.player.y - origin.y, w.player.x - origin.x),
      path = prismTrace(origin, angle, 7, radius, [], false);
    if (!path || path.total < 1) return;
    return this.make(
      e,
      "core",
      path,
      speed,
      radius,
      delay,
      boss || elite ? 26 : 24,
      order,
      at,
    );
  }
  private make(
    e: Enemy,
    shape: "bolt" | "core",
    path: PrismPath,
    speed: number,
    width: number,
    delay: number,
    damage: number,
    order: number,
    at: number,
  ): Hazard {
    const p = path.points[0],
      next = path.points[1];
    return {
      id: this.w.id(),
      source: e.id,
      kind: "arrow",
      ...p,
      created: at,
      due: at + delay,
      until: at + delay + path.total / speed,
      radius: path.total,
      width,
      angle: Math.atan2(next.y - p.y, next.x - p.x),
      damage,
      fixedDamage: true,
      damageLabel: shape === "bolt" ? "矿窟折射弹" : "矿窟晶核",
      fired: false,
      next: 0,
      prism: {
        shape,
        path,
        speed,
        order,
        last: at + delay,
        player: { ...this.w.player },
        hit: false,
      },
    };
  }
  private publish(e: Enemy, hazards: Hazard[], preview?: Hazard) {
    const w = this.w,
      s = this.state(e),
      all = [...hazards, ...(preview ? [preview] : [])];
    if (
      all.some((h) => !this.visible(h)) ||
      !prismEscape(w, all) ||
      w.enemies.filter((e) => e.hp > 0).length +
        hazards.filter((h) => h.prism!.shape === "core").length >
        100
    ) {
      this.stats.rejected++;
      return false;
    }
    for (const h of hazards) {
      const b = h.prism!;
      if (b.shape === "core") {
        const entity = w.addEnemy("prismcore", h.x, h.y, true);
        if (!entity) {
          for (const prev of hazards) this.removeCore(prev);
          return false;
        }
        entity.hp = entity.maxHp =
          e.kind === "boss" ? 75 : isElite(e.kind) ? 70 : 60;
        entity.immovable = true;
        entity.state = "arriving";
        entity.timer = Infinity;
        entity.owner = e.id;
        this.state(entity).hazard = h.id;
        b.entity = entity.id;
        this.stats.cores++;
      } else {
        this.stats.bolts++;
        if (b.path.points.length === 3) this.stats.reflections++;
      }
      w.hazards.push(h);
    }
    e.state = "windup";
    e.timer = Math.max(0, hazards[0].due - w.time);
    s.step = hazards[0].prism!.order;
    s.next =
      Math.max(...hazards.map((h) => h.until)) +
      (s.action === "C" ? 0.6 : s.action === "doubleBolt" ? 0.5 : 0.45);
    return true;
  }
  private mirrorSite(e: Enemy) {
    if (this.slots >= 2) return;
    const w = this.w;
    if (
      w.enemies.filter((o) => o.hp > 0 && o.kind === "prismmirror").length >=
        2 ||
      w.enemies.some(
        (o) => o.hp > 0 && o.kind === "prismmirror" && o.owner === e.id,
      ) ||
      w.hazards.some((h) => h.prism?.shape === "bolt" && h.until > w.time)
    )
      return;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        p = {
          x: w.player.x + Math.cos(a) * 4.5,
          y: w.player.y + Math.sin(a) * 4.5,
        };
      if (
        w.visible(p, 1.3) &&
        distance(e, p) < 6 &&
        !prismMap.blocked(p, 1.2) &&
        Math.abs(p.x) < 20 &&
        Math.abs(p.y) < 24 &&
        !w.enemies.some(
          (o) => o.kind === "prismmirror" && o.hp > 0 && distance(o, p) < 2,
        )
      )
        return p;
    }
  }
  private setupSites(e: Enemy) {
    const w = this.w,
      vertical = Math.abs(e.y - w.player.y) > Math.abs(e.x - w.player.x),
      sites: { point: Point; axis: "x" | "y" }[] = [];
    for (const side of [-1, 1]) {
      const axis = vertical ? "x" : "y",
        other = vertical ? "y" : "x",
        line =
          (side > 0
            ? Math.max(e[axis], w.player[axis])
            : Math.min(e[axis], w.player[axis])) +
          side * 3.5,
        plane = line - side * (0.12 + 0.28),
        den = 2 * plane - w.player[axis] - e[axis];
      if (Math.abs(den) < 0.1) return;
      const at = (plane - e[axis]) / den,
        point = { x: 0, y: 0 };
      point[axis] = line;
      point[other] = e[other] + (w.player[other] - e[other]) * at;
      if (
        !w.visible(point, 1.3) ||
        distance(point, w.player) < 2.5 ||
        prismMap.blocked(point, 1.2) ||
        Math.abs(point.x) > 20 ||
        Math.abs(point.y) > 24
      )
        return;
      sites.push({ point, axis });
    }
    return sites;
  }
  private begin(e: Enemy, prepared = false) {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss",
      elite = isElite(e.kind);
    s.preview = undefined;
    s.site = undefined;
    s.preparing = false;
    s.sites = undefined;
    s.vulnerable = false;
    s.recover = boss
      ? s.action === "C"
        ? 3.8
        : s.action === "B"
          ? 3.4
          : 3.2
      : elite
        ? e.kind === "strataflinger"
          ? 3.4
          : 3.2
        : e.kind === "corebrood"
          ? 2.2
          : 2;
    if (s.action === "mirror") {
      const site = this.mirrorSite(e);
      if (!site) {
        this.recover(e);
        return;
      }
      s.site = site;
      s.axis = e.pattern % 2 ? "x" : "y";
      s.next = w.time + 1.3;
      s.step = 1;
      e.state = "windup";
      e.timer = 1.3;
      return;
    }
    if (!this.reserve(e, boss || elite ? 2 : 1)) {
      e.attack = 0.3;
      return;
    }
    if (s.action === "C" && !prepared) {
      const a = this.bolt(e, 1),
        b = e.bossPhase === 2 ? this.core(e, 2) : this.bolt(e, 2, w.time, true);
      if (!a || !b) {
        const sites = this.setupSites(e),
          count = w.enemies.filter(
            (o) => o.hp > 0 && o.kind === "prismmirror",
          ).length;
        if (
          !sites ||
          count + sites.length > 2 ||
          w.enemies.filter((o) => o.hp > 0).length + sites.length > 100
        ) {
          this.stats.rejected++;
          this.recover(e);
          return;
        }
        s.sites = sites;
        s.preparing = true;
        s.step = 1;
        s.next = w.time + 1.3;
        e.state = "windup";
        e.timer = 1.3;
        return;
      }
    }
    let first: Hazard | undefined, second: Hazard | undefined;
    if (s.action === "core" || s.action === "doubleCore")
      first = this.core(e, 1);
    else if (s.action === "B") {
      first = this.core(e, 1, w.time, -1.2);
      second = this.core(e, 2, w.time, 1.2);
      if (!first || !second || !this.publish(e, [first, second]))
        this.recover(e);
      return;
    } else first = this.bolt(e, 1, w.time, false, boss && s.action === "A");
    if (!first) {
      this.stats.rejected++;
      this.recover(e);
      return;
    }
    if (s.action === "C") {
      s.mixed = e.bossPhase === 2;
      second = s.mixed
        ? this.core(e, 2, first.until + 0.6)
        : this.bolt(e, 2, first.until + 0.6, true);
      if (!second) {
        this.stats.rejected++;
        this.recover(e);
        return;
      }
      second.prism!.preview = true;
      s.preview = second;
    }
    if (!this.publish(e, [first], s.preview)) this.recover(e);
  }
  private advance(e: Enemy) {
    const w = this.w,
      s = this.state(e);
    if (s.preparing) {
      const sites = s.sites ?? [];
      if (
        w.hazards.some((h) => h.prism?.shape === "bolt" && h.until > w.time) ||
        w.enemies.filter((o) => o.hp > 0 && o.kind === "prismmirror").length +
          sites.length >
          2 ||
        w.enemies.filter((o) => o.hp > 0).length + sites.length > 100
      ) {
        this.recover(e);
        return;
      }
      for (const { point, axis } of sites) {
        const node = w.addEnemy("prismmirror", point.x, point.y, true);
        if (node) {
          node.hp = node.maxHp = 60;
          node.owner = e.id;
          node.immovable = true;
          node.state = "seek";
          const state = this.state(node);
          state.axis = axis;
          state.activeAt = w.time;
          state.expires = w.time + 12;
          this.stats.mirrors++;
        }
      }
      s.preparing = false;
      s.sites = undefined;
      s.step = 0;
      this.reservations.delete(e.id);
      const before = this.stats.bolts + this.stats.cores;
      this.begin(e, true);
      if (this.stats.bolts + this.stats.cores > before) this.stats.boss++;
      return;
    }
    let h: Hazard | undefined;
    if (s.action === "mirror") {
      const site = s.site;
      if (
        site &&
        !w.hazards.some((h) => h.prism?.shape === "bolt" && h.until > w.time) &&
        !prismMap.blocked(site, 1.2) &&
        distance(site, w.player) >= 2.5 &&
        w.enemies.filter((o) => o.hp > 0 && o.kind === "prismmirror").length < 2
      ) {
        const node = w.addEnemy("prismmirror", site.x, site.y, true);
        if (node) {
          node.hp = node.maxHp = 60;
          node.owner = e.id;
          node.immovable = true;
          node.state = "seek";
          const n = this.state(node);
          n.axis = s.axis;
          n.expires = w.time + 8;
          n.activeAt = w.time;
          this.stats.mirrors++;
        }
      }
      this.recover(e);
      return;
    }
    if ((s.action === "doubleBolt" || s.action === "A") && s.step === 1)
      h = this.bolt(e, 2, w.time, true, e.kind === "boss");
    else if (s.action === "doubleCore" && s.step === 1) h = this.core(e, 2);
    else if (s.action === "C" && s.step === 1 && s.preview) {
      h = s.preview;
      s.preview = undefined;
      h.prism!.preview = false;
      const delay = h.prism!.shape === "core" ? 1.7 : 1.5;
      h.created = w.time;
      h.due = w.time + delay;
      h.until = h.due + h.prism!.path.total / h.prism!.speed;
      h.prism!.last = h.due;
      h.prism!.player = { ...w.player };
      if (
        h.prism!.path.mirror !== undefined &&
        !this.mirrors().some((m) => m.id === h!.prism!.path.mirror)
      )
        h = undefined;
    }
    if (h) {
      if (!this.publish(e, [h])) this.recover(e);
    } else this.recover(e);
  }
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss";
    if (prismDevice(e.kind)) return;
    if (e.freezeUntil > w.time) {
      s.next += dt;
      for (const h of w.hazards)
        if (h.source === e.id && h.prism && !h.fired) {
          h.created += dt;
          h.due += dt;
          h.until += dt;
          h.prism.last += dt;
        }
      if (s.preview) {
        s.preview.created += dt;
        s.preview.due += dt;
        s.preview.until += dt;
        s.preview.prism!.last += dt;
      }
      return;
    }
    if (boss && e.bossPhase === 1 && e.hp / e.maxHp <= 0.55) {
      e.bossPhase = 2;
      s.action = "transition";
      s.preparing = false;
      s.sites = undefined;
      s.step = 0;
      s.preview = undefined;
      s.next = w.time + 1.5;
      this.reservations.delete(e.id);
      for (const h of w.hazards)
        if (h.source === e.id && !h.fired) {
          h.until = w.time;
          this.removeCore(h);
        }
      e.state = "windup";
      e.timer = 1.5;
      w.effects.push({ type: "bossPhase", ...e });
      return;
    }
    if (s.action === "transition") {
      e.timer = Math.max(0, s.next - w.time);
      if (w.time >= s.next) {
        s.action = "bolt";
        e.pattern = 0;
        this.recover(e, 1);
      }
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        s.vulnerable = false;
        e.state = "seek";
        e.attack = 3;
      }
      return;
    }
    if (s.step > 0) {
      const live = w.hazards.find((h) => h.source === e.id && h.until > w.time);
      if (live) e.timer = Math.max(0, live.due - w.time);
      if (w.time >= s.next && !live) this.advance(e);
      return;
    }
    if (e.kind === "shardhermit") {
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
      this.move(e, dt, boss ? 1.35 : ENEMIES[e.kind].speed);
      return;
    }
    e.attack -= dt;
    if (e.attack > 0) {
      if (d > 3.5) this.move(e, dt, boss ? 1.35 : ENEMIES[e.kind].speed);
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
      : e.kind === "prismmason"
        ? "mirror"
        : e.kind === "corebrood"
          ? "core"
          : e.kind === "strataflinger"
            ? "doubleCore"
            : e.kind === "bifacetregent"
              ? "doubleBolt"
              : "bolt";
    const before = this.stats.bolts + this.stats.cores;
    this.begin(e);
    if (s.step > 0 || s.vulnerable) {
      e.pattern++;
      this.lastStart = w.time;
      if (boss && this.stats.bolts + this.stats.cores > before)
        this.stats.boss++;
    }
  }
  stepHazard(h: Hazard) {
    const w = this.w,
      b = h.prism!;
    if (w.time < h.due) {
      b.last = w.time;
      b.player = { ...w.player };
      return;
    }
    const owner = w.enemies.find((e) => e.id === h.source && e.hp > 0);
    if (!h.fired && (!owner || owner.freezeUntil > w.time)) return;
    const core = b.entity
      ? w.enemies.find((e) => e.id === b.entity && e.hp > 0)
      : undefined;
    if (b.shape === "core" && !core) {
      h.until = w.time;
      return;
    }
    if (core && core.freezeUntil > w.time) {
      const dt = Math.max(0, w.time - b.last);
      h.due += dt;
      h.until += dt;
      if (owner?.prism) owner.prism.next += dt;
      b.last = w.time;
      b.player = { ...w.player };
      return;
    }
    h.fired = true;
    if (core) {
      const p = prismHead(h, w.time);
      core.x = p.x;
      core.y = p.y;
      core.state = "seek";
    }
    if (
      !b.hit &&
      prismHit(h, w.player, Math.min(w.time, h.until), b.last, b.player)
    ) {
      b.hit = true;
      w.hurt(h.damage, h.damageLabel!, false);
    }
    b.last = w.time;
    b.player = { ...w.player };
  }
}
