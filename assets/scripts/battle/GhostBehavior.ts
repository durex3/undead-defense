import type { SurvivalWorld } from "./SurvivalWorld";
import type { ExtraAttack } from "./ExtraArmory";
import type { ExtraBehavior, ExtraBehaviorPort } from "./ExtraBehavior";
import type { WeaponStats } from "./ArmoryConfig";
import { Point, distance, segmentDistance } from "./SurvivalTypes";
/** Ghost lifecycle, operating on the shared bounded attack pool. */
export class GhostBehavior implements ExtraBehavior {
  constructor(
    private w: SurvivalWorld,
    private port: ExtraBehaviorPort,
  ) {}
  count(stats: WeaponStats) {
    return Math.min(8, stats.count);
  }
  prefersThreat(stats: WeaponStats) {
    return stats.mods.includes("execution");
  }
  initialize(a: ExtraAttack) {
    a.speed = 10;
    a.companion = a.index;
  }
  step(a: ExtraAttack, dt: number) {
    const w = this.w,
      s = a.stats,
      old = { x: a.x, y: a.y };
    if (a.age >= 3) {
      a.active = false;
      return;
    }
    if (a.phase === 0) {
      let e = w.enemies.find(
        (e) =>
          e.id === a.targetId &&
          e.hp > 0 &&
          e.state !== "arriving" &&
          !e.sand?.buried,
      );
      if (e && distance(e, w.player) > s.range) e = undefined;
      if (!e && !a.retargeted) {
        a.retargeted = true;
        const reserved = new Set(
          this.port
            .attacks()
            .filter((b) => b !== a && b.active && b.skill === "ghost")
            .map((b) => b.targetId),
        );
        e = this.port
          .enemies(a, s.range)
          .sort(
            (l, r) =>
              Number(reserved.has(l.id)) - Number(reserved.has(r.id)) ||
              distance(l, a) - distance(r, a),
          )[0];
        if (e) a.targetId = e.id;
      }
      if (!e) {
        a.phase = 2;
        a.end = { ...w.player };
        return;
      }
      if (e) a.target = { x: e.x, y: e.y };
      a.angle = Math.atan2(a.target.y - a.y, a.target.x - a.x);
      this.move(a, a.target, a.speed * dt);
      const touched = this.port
        .enemies(a, 0.45 + s.radius)
        .find((e) => e.id === a.targetId);
      if (touched || a.age >= 1.4) {
        if (touched) this.port.damage(touched, s.damage, a);
        a.start = { x: a.x, y: a.y };
        a.phase = !touched ? 2 : a.stats.mods.includes("haunt") ? 1 : 3;
        a.next = a.age + (a.phase === 3 ? 0.22 : 0.3);
        a.travel = a.age + 0.45;
        a.index = 0;
        if (a.phase === 2) a.end = { ...w.player };
      }
    } else if (a.phase === 1) {
      const q = a.age - (a.next - 0.3);
      a.x = a.start.x + Math.cos(q * 10) * 0.6;
      a.y = a.start.y + Math.sin(q * 10) * 0.6;
      a.angle = Math.atan2(a.y - old.y, a.x - old.x);
      if (a.age >= a.next) {
        for (const e of this.port.enemies(a.start, 1 + s.radius))
          this.port.damage(e, s.damage * 0.7, a, a.start);
        a.index++;
        a.next += 0.3;
        if (a.index >= 3) {
          a.phase = 2;
          a.end = { ...w.player };
        }
      }
    } else if (a.phase === 3) {
      const e = w.enemies.find(
        (e) =>
          e.id === a.targetId &&
          e.hp > 0 &&
          e.state !== "arriving" &&
          !e.sand?.buried,
      );
      if (e) {
        a.angle = Math.atan2(e.y - a.y, e.x - a.x);
        this.move(a, e, a.speed * dt);
      }
      if (
        !e ||
        a.age >= a.travel ||
        (a.age >= a.next && distance(e, a) <= s.radius + 0.45)
      ) {
        if (e && a.age >= a.next && distance(e, a) <= s.radius + 0.45)
          this.port.damage(e, s.damage, a);
        a.phase = 2;
        a.end = { ...w.player };
        a.next = a.age;
      }
    } else {
      a.angle = Math.atan2(a.end!.y - a.y, a.end!.x - a.x);
      this.move(a, a.end!, 12 * dt);
      if (a.stats.mods.includes("reap"))
        for (const e of this.port.enemies(a, 1 + 12 * dt))
          if (
            !a.hit.has(e.id) &&
            segmentDistance(e, old, a) < s.radius + 0.45
          ) {
            a.hit.add(e.id);
            this.port.damage(e, s.damage * 0.65, a);
          }
      if (distance(a, a.end!) < 0.1) a.active = false;
    }
  }
  private move(a: Point, t: Point, step: number) {
    const d = distance(a, t);
    if (d > 0) {
      a.x += (t.x - a.x) * Math.min(1, step / d);
      a.y += (t.y - a.y) * Math.min(1, step / d);
    }
  }
}
