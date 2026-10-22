import type { SurvivalWorld } from "./SurvivalWorld";
import type { ExtraAttack } from "./ExtraArmory";
import type { ExtraBehavior, ExtraBehaviorPort } from "./ExtraBehavior";
import { Enemy, distance, angleDelta } from "./SurvivalTypes";
import { isElite } from "./SurvivalConfig";
import { thunderDevice } from "./ThunderSystem";
/** Frost lifecycle, operating on the shared bounded attack pool. */
export class FrostBehavior implements ExtraBehavior {
  constructor(
    private w: SurvivalWorld,
    private port: ExtraBehaviorPort,
  ) {}
  initialize(a: ExtraAttack) {
    a.x = this.w.player.x;
    a.y = this.w.player.y;
    a.start = { ...this.w.player };
    a.age = -a.index * 0.22;
  }
  freeze(e: Enemy, a: ExtraAttack) {
    const w = this.w;
    if (e.kind === "prismcore") {
      if (!a.stats.mods.includes("brittle")) w.slow(e, true);
      return;
    }
    if (
      e.kind === "boss" ||
      (e.immovable &&
        !e.root &&
        !e.wind &&
        !e.library &&
        !e.kiln &&
        !e.edge &&
        !e.eclipse &&
        !e.lead &&
        !e.grave) ||
      thunderDevice(e.kind) ||
      (e.state === "charge" && !e.wind)
    )
      return;
    e.slow = 0.4;
    e.slowUntil = Math.max(e.slowUntil, w.time + a.stats.duration);
    if (a.stats.mods.includes("brittle") || e.freezeReady > w.time) return;
    e.freezeUntil = w.time + (isElite(e.kind) ? 0.25 : 0.75);
    e.freezeReady = w.time + 3;
    if (e.eclipse) w.eclipse.clean();
    if (e.lead) w.lead.clean();
    if (e.grave) w.grave.clean();
  }
  step(a: ExtraAttack, dt: number) {
    const w = this.w,
      s = a.stats,
      r = s.radius;
    if (a.phase === 0) {
      const outward = a.stats.mods.includes("outward"),
        sectors = a.stats.mods.includes("sectors");
      const previous = a.age - dt;
      const edge = outward
        ? r * Math.min(1, Math.max(0, (a.age - 0.1) / 0.5))
        : r;
      for (const e of this.port.enemies(a, r + 0.35)) {
        if (a.age < 0.1) continue;
        if (!outward && !sectors && previous >= 0.1) continue;
        if (a.hit.has(e.id)) continue;
        const d = distance(e, a);
        if (d > edge + 0.35) continue;
        if (
          outward &&
          previous >= 0.1 &&
          d < r * Math.min(1, (previous - 0.1) / 0.5) - 0.35
        )
          continue;
        if (sectors) {
          const angle = Math.atan2(e.y - a.y, e.x - a.x);
          let crossed = false;
          for (let sector = 0; sector < 3; sector++) {
            const at = 0.1 + sector * 0.22;
            if (
              previous < at &&
              a.age >= at &&
              Math.abs(
                angleDelta(angle, a.angle + (sector * Math.PI * 2) / 3),
              ) <=
                Math.PI / 3
            )
              crossed = true;
          }
          if (!crossed) continue;
        }
        a.hit.add(e.id);
        const brittle =
          a.stats.mods.includes("brittle") && e.slowUntil > w.time;
        this.port.damage(e, s.damage * (brittle ? 1.35 : 1), a);
        this.freeze(e, a);
      }
      if (a.age >= 0.66) {
        a.phase = 1;
        if (!a.stats.mods.includes("aftershock")) a.active = false;
      }
    } else if (a.phase === 1 && a.age >= 0.8) {
      for (const e of this.port.enemies(a, r + 0.35))
        this.port.damage(e, s.damage * 0.45, a);
      a.phase = 2;
      a.next = a.age + 0.18;
    }
    if (a.phase === 2 && a.age >= a.next) a.active = false;
  }
}
