import type { SurvivalWorld } from "./SurvivalWorld";
import type { ArmoryShot, Cast } from "./Armory";
import type { WeaponStats } from "./ArmoryConfig";
import { Enemy, Point, distance } from "./SurvivalTypes";
interface FirePort {
  enemies(origin: Point, range: number): Enemy[];
  hit(enemy: Enemy, damage: number, origin: Point, skill: "fire"): void;
  addField(
    skill: "fire",
    origin: Point,
    angle: number,
    stats: WeaponStats,
  ): void;
  launch(cast: Cast, child: boolean): void;
}
/** Fire-specific contacts and descendants; shared pools remain owned by Armory. */
export class FireBehavior {
  constructor(
    private w: SurvivalWorld,
    private port: FirePort,
  ) {}
  target(
    stats: WeaponStats,
    target: Point,
    targets: Enemy[],
    index: number,
  ): Point {
    return stats.mods.includes("salvo") && targets.length
      ? { ...targets[index % Math.min(3, targets.length)] }
      : { ...target };
  }
  delay(stats: WeaponStats, index: number) {
    return stats.mods.includes("heavy")
      ? 0.35
      : stats.mods.includes("salvo")
        ? Math.floor((index * 3) / stats.count) * 0.12
        : 0;
  }
  contact(p: ArmoryShot, old: Point, e: Enemy) {
    // Resolve at first contact, even when a fast shot crosses a whole enemy in one frame.
    const dx = p.x - old.x,
      dy = p.y - old.y,
      len = Math.hypot(dx, dy);
    if (len > 0) {
      const along = ((e.x - old.x) * dx + (e.y - old.y) * dy) / len;
      const across2 = (e.x - old.x) ** 2 + (e.y - old.y) ** 2 - along ** 2;
      const contact = Math.max(
        0,
        Math.min(len, along - Math.sqrt(Math.max(0, 0.69 ** 2 - across2))),
      );
      p.x = old.x + (dx / len) * contact;
      p.y = old.y + (dy / len) * contact;
    }
    this.explode(p);
  }
  explode(p: ArmoryShot) {
    p.active = false;
    const s = p.stats,
      m = s.mods;
    for (const e of this.port.enemies(p, s.radius + 0.45)) {
      const heavy = !p.child && m.includes("heavy");
      const damage =
        heavy && distance(e, p) > s.radius * 0.55
          ? (s.damage * 1.25) / 1.8
          : s.damage;
      this.port.hit(e, damage, p, "fire");
    }
    this.w.effects.push({
      type: "explosion",
      x: p.x,
      y: p.y,
      radius: s.radius,
      skill: "fire",
      grade: this.w.weaponGrades.fire,
      form: p.child ? "ember" : m.includes("heavy") ? "heavy" : "base",
    });
    if (p.child) return;
    if (m.includes("flame")) this.port.addField("fire", p, p.angle, s);
    const explosionAngle = p.angle;
    if (m.includes("embers"))
      for (let i = 0; i < 2; i++) {
        const a = explosionAngle + (i ? 0.85 : -0.85),
          child = {
            ...s,
            damage: s.damage * 0.35,
            radius: s.radius * 0.6,
            mods: [],
          };
        this.port.launch(
          {
            skill: "fire",
            stats: child,
            origin: { x: p.x, y: p.y },
            target: { x: p.x + Math.cos(a) * 1.5, y: p.y + Math.sin(a) * 1.5 },
            group: p.group,
            index: i,
            due: this.w.time,
          },
          true,
        );
      }
  }
}
