import type { SurvivalWorld } from "./SurvivalWorld";
import type { ArmoryShot, ArmoryField } from "./Armory";
import type { WeaponStats } from "./ArmoryConfig";
import { ENEMIES } from "./SurvivalConfig";
import { Enemy, Point, distance } from "./SurvivalTypes";
interface WaterPort {
  enemies(origin: Point, range: number): Enemy[];
  addField(
    skill: "water",
    origin: Point,
    angle: number,
    stats: WeaponStats,
  ): void;
}
/** Water targeting, landing and field movement, independent of shared tick deduplication. */
export class WaterBehavior {
  constructor(
    private w: SurvivalWorld,
    private port: WaterPort,
  ) {}
  target(
    stats: WeaponStats,
    target: Point,
    targets: Enemy[],
    chosen: Point[],
    angle: number,
    index: number,
  ): Point {
    const distinct = targets.find((e) =>
      chosen.every((p) => distance(p, e) > stats.radius * 1.2),
    );
    const point = distinct
      ? { x: distinct.x, y: distinct.y }
      : {
          x: target.x + Math.cos(angle + index * 2.4) * stats.radius,
          y: target.y + Math.sin(angle + index * 2.4) * stats.radius,
        };
    chosen.push(point);
    return point;
  }
  land(p: ArmoryShot) {
    const s = p.stats;
    const q = Math.min(1, p.age / 0.45);
    p.x = p.start.x + (p.target.x - p.start.x) * q;
    p.y = p.start.y + (p.target.y - p.start.y) * q;
    if (q >= 1) {
      this.port.addField("water", p, p.angle, s);
      p.active = false;
    }
  }
  initialize(f: ArmoryField, p: Point) {
    if (f.stats.mods.includes("spring")) f.radius *= 0.45;
    if (this.w.weaponGrades.water > 1)
      this.w.effects.push({
        type: "explosion",
        skill: "water",
        form: "waterSplash",
        grade: this.w.weaponGrades.water,
        ...p,
        radius: f.radius,
      });
  }
  stepField(f: ArmoryField, dt: number) {
    const w = this.w;
    const m = f.stats.mods,
      q = (w.time - f.created) / (f.until - f.created);
    if (m.includes("recall") && q >= 0.5 && !f.returning) {
      f.returning = true;
      f.returnTarget = { ...w.player };
    }
    if (f.returning) {
      // Catch up across empty ground, then stay with enemies instead of outrunning them.
      const covered = this.port.enemies(f, f.radius + 0.35);
      const speed = covered.length
        ? Math.max(
            0.6,
            Math.min(
              1.6,
              ...covered.map((e) =>
                e.freezeUntil > w.time
                  ? 0
                  : ENEMIES[e.kind].speed *
                    (e.slowUntil > w.time ? 1 - e.slow : 1),
              ),
            ),
          )
        : 3.8;
      const t = f.returnTarget!,
        d = distance(f, t),
        step = Math.min(d, speed * dt);
      if (d > 0) {
        f.x += ((t.x - f.x) / d) * step;
        f.y += ((t.y - f.y) / d) * step;
      }
    } else if (m.includes("wave")) {
      f.x += Math.cos(f.angle) * 2.5 * dt;
      f.y += Math.sin(f.angle) * 2.5 * dt;
    } else if (m.includes("spring"))
      f.radius = f.baseRadius * (0.45 + 1.2 * Math.min(1, q * 2));
  }
}
