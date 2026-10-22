import type { SurvivalWorld } from "./SurvivalWorld";
import type { ExtraAttack } from "./ExtraArmory";
import type { ExtraBehavior, ExtraBehaviorPort } from "./ExtraBehavior";
import type { WeaponStats } from "./ArmoryConfig";
/** Holy lifecycle, operating on the shared bounded attack pool. */
export class HolyBehavior implements ExtraBehavior {
  constructor(
    _w: SurvivalWorld,
    private port: ExtraBehaviorPort,
  ) {}
  prefersThreat(_stats: WeaponStats) {
    return true;
  }
  initialize(a: ExtraAttack) {
    a.x = a.target.x;
    a.y = a.target.y;
    a.start = { ...a.target };
    const mods = a.stats.mods;
    a.next =
      (mods.includes("execution") ? 0.8 : 0.55) +
      (mods.includes("rain") ? a.index * 0.18 : 0);
  }
  step(a: ExtraAttack) {
    const s = a.stats;
    const impact = (mult: number) => {
      for (const e of this.port.enemies(
        a,
        s.radius * (a.stats.mods.includes("cross") ? 2 : 1) + 0.35,
      )) {
        const dx = Math.abs(e.x - a.x),
          dy = Math.abs(e.y - a.y);
        if (
          a.stats.mods.includes("cross") &&
          !(
            Math.min(dx, dy) <= s.radius * 0.28 + 0.35 &&
            Math.max(dx, dy) <= s.radius * 2 + 0.35
          )
        )
          continue;
        this.port.damage(e, s.damage * mult, a);
      }
    };
    if (a.phase === 0 && a.age >= a.next) {
      impact(1);
      a.impactAt = a.age;
      a.phase = 1;
      a.next = a.age + (a.stats.mods.includes("brand") ? 0.7 : 0.25);
    } else if (a.phase === 1 && a.age >= a.next) {
      if (a.stats.mods.includes("brand")) {
        impact(0.65);
        a.impactAt = a.age;
      }
      a.phase = 2;
      a.next = a.age + 0.25;
    }
    if (a.phase === 2 && a.age >= a.next) a.active = false;
  }
}
