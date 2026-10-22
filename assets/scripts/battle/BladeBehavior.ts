import type { SurvivalWorld } from "./SurvivalWorld";
import type { ArmoryShot, Cast } from "./Armory";
import type { Enemy, Point } from "./SurvivalTypes";
import { distance, angleDelta } from "./SurvivalTypes";
import { isElite } from "./SurvivalConfig";
import { orbitProgress } from "./ArmoryConfig";
import type { WeaponStats } from "./ArmoryConfig";
export interface BladePort {
  shots(): ArmoryShot[];
  stepIndex(): number;
  filterPending(keep: (cast: Cast) => boolean): void;
  enemies(origin: Point, range: number): Enemy[];
  hit(
    e: Enemy,
    damage: number,
    origin: Point,
    skill: "blade",
    projectile: boolean,
    parent?: ArmoryShot,
  ): void;
  finish(shot: ArmoryShot): void;
  launch(cast: Cast, child: boolean): void;
}
/** Owns blade groups, mode transitions, orbit/flight steering and bounded descendants. */
export class BladeBehavior {
  readonly groups = new Map<number, { left: number; shards: boolean }>();
  constructor(
    private w: SurvivalWorld,
    private port: BladePort,
  ) {}
  begin(group: number, stats: WeaponStats) {
    this.groups.set(group, {
      left: stats.count,
      shards: stats.mods.includes("shards"),
    });
  }
  onModification(id: string) {
    if (id !== "hunt") return;
    const retired = new Set<number>();
    for (const p of this.port.shots())
      if (p.active && p.skill === "blade" && p.orbit) {
        p.active = false;
        retired.add(p.group);
      }
    this.port.filterPending((c) => {
      if (c.skill === "blade" && !c.stats.mods.includes("hunt")) {
        retired.add(c.group);
        return false;
      }
      return true;
    });
    for (const group of Array.from(retired)) this.groups.delete(group);
  }
  stepOrbit(p: ArmoryShot, dt: number) {
    const w = this.w,
      s = p.stats,
      m = s.mods,
      old = { x: p.x, y: p.y };

    const oldQ = Math.max(0, Math.min(1, (p.age - dt) / s.duration));
    const q = p.age + 1e-8 >= s.duration ? 1 : Math.min(1, p.age / s.duration),
      radius =
        ((m.includes("orbit") ? 2.7 : 1.9) +
          (m.includes("return") ? 1.1 * Math.sin(q * Math.PI) : 0)) *
        playerAttributesFrom(s);
    // Start on the circumference: never sweep a phantom damage line through the hero.
    if (p.age === dt) {
      old.x = w.player.x + Math.cos((p.index * Math.PI * 2) / s.count) * radius;
      old.y = w.player.y + Math.sin((p.index * Math.PI * 2) / s.count) * radius;
    }
    p.angle =
      (p.index * Math.PI * 2) / s.count + orbitProgress(q) * Math.PI * 2;
    p.x = w.player.x + Math.cos(p.angle) * radius;
    p.y = w.player.y + Math.sin(p.angle) * radius;
    // Sample the actual circular sweep, not a chord through its empty centre.
    const slices = Math.max(
      1,
      Math.ceil((orbitProgress(q) - orbitProgress(oldQ)) * 48),
    );
    for (let i = 0; i <= slices; i++) {
      const t = oldQ + ((q - oldQ) * i) / slices;
      if (m.includes("return") && t >= 0.5 && !p.returning) {
        p.returning = true;
        p.hit.clear();
      }
      const rr =
        ((m.includes("orbit") ? 2.7 : 1.9) +
          (m.includes("return") ? 1.1 * Math.sin(t * Math.PI) : 0)) *
        playerAttributesFrom(s);
      const angle =
        (p.index * Math.PI * 2) / s.count + orbitProgress(t) * Math.PI * 2;
      const sample = {
        x: w.player.x + Math.cos(angle) * rr,
        y: w.player.y + Math.sin(angle) * rr,
      };
      for (const e of this.port.enemies(sample, s.radius + 0.45))
        if (!p.hit.has(e.id)) {
          p.hit.add(e.id);
          this.port.hit(e, s.damage, sample, "blade", true, p);
        }
    }
    if (q >= 1) this.port.finish(p);
    return;
  }
  steer(p: ArmoryShot, dt: number): boolean {
    const w = this.w,
      m = p.stats.mods;
    if (p.skill === "blade" && p.child && p.shardTarget !== undefined) {
      const target = w.enemies.find(
        (e) =>
          e.id === p.shardTarget &&
          e.hp > 0 &&
          e.state !== "arriving" &&
          !e.sand?.buried,
      );
      if (target && distance(target, p.start) <= p.range + 0.45) {
        const desired = Math.atan2(target.y - p.y, target.x - p.x);
        p.angle += Math.max(
          -dt * 6,
          Math.min(dt * 6, angleDelta(desired, p.angle)),
        );
      } else p.shardTarget = undefined;
    }
    if (p.skill === "blade" && !p.child) {
      if (p.returning) {
        const t = p.end!;
        p.angle = Math.atan2(t.y - p.y, t.x - p.x);
        if (distance(p, t) <= p.speed * dt) {
          this.port.finish(p);
          return true;
        }
      } else if (m.includes("hunt")) {
        const t = this.port
          .enemies(p, 6)
          .filter((e) => !p.hit.has(e.id))
          .sort(
            (a, b) =>
              Number(isElite(b.kind) || /bow|spitter/.test(b.kind)) -
                Number(isElite(a.kind) || /bow|spitter/.test(a.kind)) ||
              distance(a, p) - distance(b, p),
          )[0];
        if (t)
          p.angle += Math.max(
            -dt * 2.2,
            Math.min(
              dt * 2.2,
              angleDelta(Math.atan2(t.y - p.y, t.x - p.x), p.angle),
            ),
          );
      }
    }
    return false;
  }
  terminal(p: ArmoryShot) {
    if (!p.child && !p.returning && p.stats.mods.includes("return")) {
      p.returning = true;
      p.hit.clear();
      p.travel = 0;
      p.end = { ...this.w.player };
      p.range = distance(p, p.end) + 0.1;
      return;
    }
    this.port.finish(p);
  }
  onFinish(p: ArmoryShot) {
    if (p.child || p.skill !== "blade") return;
    const g = this.groups.get(p.group);
    if (!g) return;
    g.left--;
    if (g.left <= 0) this.groups.delete(p.group);
  }
  onHit(p: ArmoryShot, hit: Enemy) {
    const g = this.groups.get(p.group);
    if (!g?.shards) return;
    g.shards = false;
    const origin = { x: hit.x, y: hit.y };
    const targets = this.port
      .enemies(origin, 2.8)
      .sort(
        (a, b) =>
          Number(a.id === hit.id) - Number(b.id === hit.id) ||
          distance(a, origin) - distance(b, origin) ||
          a.id - b.id,
      );
    if (!targets.length) return;
    for (let i = 0; i < 2; i++) {
      const t = targets[Math.min(i, targets.length - 1)];
      const s = {
        ...p.stats,
        damage: p.stats.damage * 0.6,
        mods: [],
        range: 2.8,
      };
      this.port.launch(
        {
          skill: "blade",
          stats: s,
          due: this.w.time,
          index: i,
          group: p.group,
          origin: { ...origin },
          target: { x: t.x, y: t.y },
        },
        true,
      );
      const child = this.port
        .shots()
        .find(
          (q) =>
            q.active &&
            q.child &&
            q.group === p.group &&
            q.index === i &&
            q.spawnStep === this.port.stepIndex(),
        );
      if (child) {
        child.shardTarget = t.id;
        if (t.id !== hit.id) child.hit.add(hit.id);
        if (distance(t, origin) < 0.05)
          child.angle = p.angle + (i ? 0.28 : -0.28);
      }
    }
  }
}
function playerAttributesFrom(s: WeaponStats) {
  return s.radius / 0.21;
}
