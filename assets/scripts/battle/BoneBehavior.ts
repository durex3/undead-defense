import type { SurvivalWorld } from "./SurvivalWorld";
import type { ExtraAttack } from "./ExtraArmory";
import type {
  ExtraBehavior,
  ExtraBehaviorPort,
  ExtraCastContext,
} from "./ExtraBehavior";
import type { WeaponStats } from "./ArmoryConfig";
import { Enemy, distance, segmentDistance } from "./SurvivalTypes";
/** Bone lifecycle, operating on the shared bounded attack pool. */
export class BoneBehavior implements ExtraBehavior {
  constructor(
    private w: SurvivalWorld,
    private port: ExtraBehaviorPort,
  ) {}
  aim(s: WeaponStats, target: Enemy) {
    return this.w.targetPriority(target)
      ? Math.atan2(target.y - this.w.player.y, target.x - this.w.player.x)
      : this.boneDirection(s, target);
  }
  initialize(a: ExtraAttack, { count }: ExtraCastContext) {
    const s = a.stats;
    a.phase = -1;
    a.next = 0.2;
    a.angle +=
      (a.index - (count - 1) / 2) * (s.mods.includes("fan") ? 0.25 : 0.055);
    a.target = {
      x: a.x + Math.cos(a.angle) * s.range,
      y: a.y + Math.sin(a.angle) * s.range,
    };
  }
  private boneDirection(s: WeaponStats, fallback: Enemy) {
    const origin = this.w.player,
      list = this.port.enemies(origin, s.range);
    let best = Math.atan2(fallback.y - origin.y, fallback.x - origin.x),
      score = -1,
      nearest = Infinity;
    for (const candidate of list) {
      const angle = Math.atan2(candidate.y - origin.y, candidate.x - origin.x);
      const end = {
        x: origin.x + Math.cos(angle) * s.range,
        y: origin.y + Math.sin(angle) * s.range,
      };
      const count = list.filter(
        (e) => segmentDistance(e, origin, end) <= s.radius + 0.35,
      ).length;
      const d = distance(origin, candidate);
      if (count > score || (count === score && d < nearest)) {
        best = angle;
        score = count;
        nearest = d;
      }
    }
    return best;
  }
  step(a: ExtraAttack, dt: number) {
    const s = a.stats,
      w = this.w;
    if (a.phase === -1) {
      a.x = w.player.x;
      a.y = w.player.y;
      if (a.age < 0.2) return;
      a.phase = 0;
      dt = Math.min(dt, Math.max(0, a.age - 0.2));
    }
    const old = { x: a.x, y: a.y },
      step = Math.min(a.speed * dt, s.range - a.travel);
    a.x += Math.cos(a.angle) * step;
    a.y += Math.sin(a.angle) * step;
    a.travel += step;
    const hits = w.enemies
      .filter(
        (e) =>
          e.hp > 0 &&
          e.state !== "arriving" &&
          !e.sand?.buried &&
          !a.hit.has(e.id) &&
          segmentDistance(e, old, a) <= s.radius + 0.35,
      )
      .sort((b, c) => distance(b, old) - distance(c, old));
    for (const e of hits) {
      if (e.hp <= 0) continue;
      const stacks = a.stats.mods.includes("marrow")
        ? Math.min(3, a.hit.size)
        : 0;
      this.port.damage(e, s.damage * (1 + stacks * 0.15), a);
      a.hit.add(e.id);
      if (a.stats.mods.includes("ridge") && a.points.length < 3) {
        // Burst at the actual pierced enemy, never an empty far endpoint.
        const center = { x: e.x, y: e.y },
          radius = (0.9 * s.radius) / 0.24;
        a.points.push(center);
        w.effects.push({
          type: "explosion",
          skill: "bone",
          form: "boneBurst",
          grade: w.weaponGrades.bone ?? 1,
          ...center,
          radius,
        });
        for (const other of this.port.enemies(center, radius + 0.35))
          if (!a.secondary.has(other.id)) {
            a.secondary.add(other.id);
            this.port.damage(other, s.damage * 0.35, a, center);
          }
      }
      if (a.stats.mods.includes("marrow"))
        a.speed = 12 * (1 + Math.min(3, a.hit.size) * 0.15);
    }
    if (a.travel >= s.range - 0.001 || a.age >= 2) a.active = false;
  }
}
