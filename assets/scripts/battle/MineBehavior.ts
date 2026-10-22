import type { SurvivalWorld } from "./SurvivalWorld";
import type { ExtraAttack } from "./ExtraArmory";
import type {
  ExtraBehavior,
  ExtraBehaviorPort,
  ExtraCastContext,
} from "./ExtraBehavior";
import { segmentDistance } from "./SurvivalTypes";
/** Mine lifecycle, operating on the shared bounded attack pool. */
export class MineBehavior implements ExtraBehavior {
  constructor(
    private w: SurvivalWorld,
    private port: ExtraBehaviorPort,
  ) {}
  initialize(a: ExtraAttack, { count }: ExtraCastContext) {
    const theta = a.angle + Math.PI + (2 * Math.PI * a.index) / count,
      r = a.stats.mods.includes("scatter") ? 2.5 : 1.3;
    const origin = {
      x: this.w.player.x + Math.cos(theta) * r,
      y: this.w.player.y + Math.sin(theta) * r,
    };
    this.w.stageStrategy.map.resolve(origin, 0.2);
    a.x = origin.x;
    a.y = origin.y;
    a.start = { ...origin };
    a.target = { ...origin };
  }
  step(a: ExtraAttack) {
    const w = this.w,
      s = a.stats,
      arm = a.stats.mods.includes("burrow") ? 1.2 : 0.6;
    if (a.phase === 0) {
      if (w.time >= a.until) {
        a.active = false;
        return;
      }
      if (a.age < arm) return;
      const trigger =
        ((a.stats.mods.includes("burrow") ? 0.6 : 0.8) * s.radius) / 1.8;
      let ready = this.port.enemies(a, trigger + 0.35).length > 0;
      if (a.stats.mods.includes("trip"))
        for (const b of this.port.attacks())
          if (
            b !== a &&
            b.active &&
            b.group === a.group &&
            b.phase === 0 &&
            b.age >= arm &&
            b.index === (a.index + 1) % s.count
          ) {
            if (
              w.enemies.some(
                (e) =>
                  e.hp > 0 &&
                  e.state !== "arriving" &&
                  !e.sand?.buried &&
                  segmentDistance(e, a, b) <= 0.2,
              )
            ) {
              ready = true;
              b.phase = 1;
              b.next = b.age;
            }
          }
      if (ready) {
        a.phase = 1;
        a.next = a.age;
      }
    }
    if (a.phase === 1 && a.age >= a.next) {
      this.blast(a, s.damage);
      a.phase = 2;
      a.next = a.age + (a.stats.mods.includes("fuse") ? 0.6 : 0.18);
    } else if (a.phase === 2 && a.age >= a.next) {
      if (a.stats.mods.includes("fuse")) this.blast(a, s.damage * 0.65);
      a.phase = 3;
      a.next = a.age + 0.18;
    }
    if (a.phase === 3 && a.age >= a.next) a.active = false;
  }
  private blast(a: ExtraAttack, damage: number) {
    for (const e of this.port.enemies(a, a.stats.radius + 0.35))
      this.port.damage(e, damage, a);
    this.w.effects.push({
      type: "explosion",
      skill: a.skill,
      x: a.x,
      y: a.y,
      radius: a.stats.radius,
    });
  }
}
