import type { SurvivalWorld } from "./SurvivalWorld";
import type { ExtraAttack } from "./ExtraArmory";
import type {
  ExtraBehavior,
  ExtraBehaviorPort,
  ExtraCastContext,
} from "./ExtraBehavior";
import { Enemy, distance } from "./SurvivalTypes";
import { isLarge } from "./SurvivalConfig";
import { thunderDevice } from "./ThunderSystem";
/** Void lifecycle, operating on the shared bounded attack pool. */
export class VoidBehavior implements ExtraBehavior {
  constructor(
    private w: SurvivalWorld,
    private port: ExtraBehaviorPort,
  ) {}
  initialize(a: ExtraAttack, { target: t, count, stats }: ExtraCastContext) {
    const side = (a.index - (count - 1) / 2) * stats.radius * 1.5;
    const origin = {
      x: t.x - Math.sin(a.angle) * side,
      y: t.y + Math.cos(a.angle) * side,
    };
    a.x = origin.x;
    a.y = origin.y;
    a.start = { ...origin };
    a.target = { ...origin };
    a.next = (Math.floor((this.w.time + 1e-7) / 0.4) + 1) * 0.4;
  }
  step(
    a: ExtraAttack,
    dt: number,
    ticks: Map<number, { a: ExtraAttack; damage: number }>,
    ends: Map<number, { a: ExtraAttack; damage: number }>,
  ) {
    const w = this.w,
      s = a.stats,
      r = s.radius;
    const collect = (
      map: Map<number, { a: ExtraAttack; damage: number }>,
      e: Enemy,
      d: number,
    ) => {
      const prev = map.get(e.id);
      if (!prev || d > prev.damage) map.set(e.id, { a, damage: d });
    };
    if (a.phase === 1) {
      if (a.age >= a.next) a.active = false;
      return;
    }
    if (w.time >= a.until) {
      const repel = a.stats.mods.includes("repel"),
        radius = r * (repel ? 1.6 : 1);
      for (const e of this.port.enemies(a, radius + 0.35))
        if (!repel || distance(e, a) >= radius * 0.55)
          collect(
            ends,
            e,
            s.damage *
              (a.stats.mods.includes("collapse") ? 6 : 3) *
              (repel ? 1.5 : 1),
          );
      a.phase = 1;
      a.next = a.age + 0.25;
      return;
    }
    if (a.stats.mods.includes("drift")) {
      a.x += Math.cos(a.angle) * 1.3 * dt;
      a.y += Math.sin(a.angle) * 1.3 * dt;
    }
    for (const e of this.port.enemies(a, r + 0.35))
      if (
        !e.immovable &&
        !isLarge(e.kind) &&
        e.state === "seek" &&
        !thunderDevice(e.kind) &&
        !["sandegg", "warflag"].includes(e.kind)
      ) {
        const d = distance(e, a),
          step = Math.min(Math.max(0, d - 0.3), 1.4 * dt);
        if (d > 0) {
          e.x += ((a.x - e.x) * step) / d;
          e.y += ((a.y - e.y) * step) / d;
          w.stageStrategy.map.resolve(e, 0.35);
        }
      }
    if (w.time + 1e-7 >= a.next) {
      a.next = (Math.floor((w.time + 1e-7) / 0.4) + 1) * 0.4;
      for (const e of this.port.enemies(a, r + 0.35))
        collect(ticks, e, s.damage);
    }
  }
}
