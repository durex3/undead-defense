import type { SurvivalWorld } from "./SurvivalWorld";
import type { ExtraAttack } from "./ExtraArmory";
import type {
  ExtraBehavior,
  ExtraBehaviorPort,
  ExtraCastContext,
} from "./ExtraBehavior";
import type { WeaponStats } from "./ArmoryConfig";
import { replicaStats } from "./ArmoryConfig";
import { Point, distance, segmentDistance } from "./SurvivalTypes";
/** Lightning lifecycle, operating on the shared bounded attack pool. */
export class LightningBehavior implements ExtraBehavior {
  constructor(
    private w: SurvivalWorld,
    private port: ExtraBehaviorPort,
  ) {}
  count(_stats: WeaponStats) {
    return 1;
  }
  initialize(a: ExtraAttack, { target: t, targets }: ExtraCastContext) {
    const s = a.stats;
    let last: Point = t;
    const seen = new Set<number>();
    for (let j = 0; j < s.count; j++) {
      const e =
        j === 0
          ? t
          : this.port
              .enemies(
                last,
                ((s.mods.includes("relay") ? 5.5 : 3.5) * s.radius) / 0.9,
              )
              .filter((e) => !seen.has(e.id))
              .sort((a, b) => distance(a, last) - distance(b, last))[0];
      if (!e) break;
      seen.add(e.id);
      a.points.push({ x: e.x, y: e.y });
      last = e;
    }
    if (s.mods.includes("storm"))
      a.points = targets.slice(0, s.count).map((e) => ({ x: e.x, y: e.y }));
  }
  step(a: ExtraAttack) {
    const w = this.w,
      s = a.stats,
      storm = a.stats.mods.includes("storm");
    const strike = (
      p: Point,
      stats: WeaponStats,
      scale: number,
      seen: Set<number>,
    ) => {
      for (const e of this.port.enemies(
        p,
        (storm ? stats.radius : (0.48 * stats.radius) / 0.9) + 0.35,
      ))
        if (!seen.has(e.id)) {
          seen.add(e.id);
          this.port.damage(e, stats.damage * scale, a, p);
        }
    };
    if (a.phase === 0) {
      const n = storm ? Math.floor(a.age / 0.18) + 1 : a.points.length;
      while (a.index < Math.min(n, a.points.length)) {
        const i = a.index++,
          p = a.points[i];
        strike(p, replicaStats(s, i), 1, a.hit);
        if (a.stats.mods.includes("bridge") && i > 0) {
          const prev = a.points[i - 1];
          for (const e of w.enemies)
            if (
              e.hp > 0 &&
              e.state !== "arriving" &&
              !e.sand?.buried &&
              !a.secondary.has(e.id) &&
              segmentDistance(e, prev, p) <
                (0.24 * replicaStats(s, i).radius) / 0.9 + 0.35
            ) {
              a.secondary.add(e.id);
              this.port.damage(e, replicaStats(s, i).damage * 0.45, a, p);
            }
        }
      }
      if (a.index >= a.points.length) {
        a.phase = 1;
        a.next = a.age + (a.stats.mods.includes("echo") ? 0.45 : 0.25);
      }
    } else if (a.phase === 1 && a.age >= a.next) {
      if (a.stats.mods.includes("echo")) {
        const seen = new Set<number>();
        for (let i = 0; i < a.points.length; i++)
          strike(a.points[i], replicaStats(s, i), 0.65, seen);
      }
      a.phase = 2;
      a.next = a.age + 0.18;
    }
    if (a.phase === 2 && a.age >= a.next) a.active = false;
  }
}
