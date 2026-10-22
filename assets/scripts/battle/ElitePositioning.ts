import type { SurvivalWorld } from "./SurvivalWorld";
import type { Enemy, Point } from "./SurvivalTypes";
import { distance, angleDelta } from "./SurvivalTypes";
import { isElite, ENEMIES } from "./SurvivalConfig";
interface Intent {
  partner: number;
  anchor: Point;
  goal: Point;
  until: number;
  rest: number;
}
/** Waiting actors improve their approach; original stage coordinators still own casts. */
export class ElitePositioning {
  private intents = new WeakMap<Enemy, Intent>();
  private retry = new WeakMap<Enemy, number>();
  readonly stats = { moves: 0, searches: 0, yields: 0 };
  constructor(private w: SurvivalWorld) {}
  goal(e: Enemy): Point | undefined {
    const w = this.w,
      active = w.hazards.filter((h) => h.until > w.time);
    if (!isElite(e.kind) || (active.length < 2 && e.attack <= 0)) return;
    const other = w.enemies.find(
      (o) =>
        o !== e &&
        o.hp > 0 &&
        isElite(o.kind) &&
        active.some((h) => h.source === o.id),
    );
    if (!other || w.time < (this.retry.get(e) ?? 0)) return;
    let intent = this.intents.get(e);
    if (intent && w.time < intent.rest) return;
    if (intent && w.time >= intent.until) {
      intent.rest = w.time + 0.8;
      intent.until = Infinity;
      this.stats.yields++;
      return;
    }
    if (
      !intent ||
      intent.partner !== other.id ||
      distance(intent.anchor, w.player) > 1 ||
      !Number.isFinite(intent.until)
    ) {
      const map = w.stageStrategy.map,
        base = Math.atan2(other.y - w.player.y, other.x - w.player.x),
        style = ENEMIES[e.kind].elitePosition ?? "flank",
        r = style === "anchor" ? 4.6 : 3.8;
      let best: Point | undefined,
        score = Infinity;
      this.stats.searches++;
      for (const turn of [
        Math.PI / 2,
        -Math.PI / 2,
        (Math.PI * 5) / 12,
        (-Math.PI * 5) / 12,
        (Math.PI * 2) / 3,
        (-Math.PI * 2) / 3,
        Math.PI,
      ]) {
        const a = base + turn,
          p = {
            x: w.player.x + Math.cos(a) * r,
            y: w.player.y + Math.sin(a) * r,
          };
        if (
          Math.abs(p.x) > 21.3 ||
          Math.abs(p.y) > 25.3 ||
          map.blocked(p, 0.7) ||
          map.segment(p, w.player, 0.3)
        )
          continue;
        const current = Math.atan2(e.y - w.player.y, e.x - w.player.x);
        const cost = distance(e, p) + Math.abs(angleDelta(a, current)) * 0.4;
        if (cost < score) {
          score = cost;
          best = p;
        }
      }
      if (!best) {
        this.retry.set(e, w.time + 0.6);
        return;
      }
      intent = {
        partner: other.id,
        anchor: { ...w.player },
        goal: best,
        until:
          intent && intent.partner === other.id && Number.isFinite(intent.until)
            ? intent.until
            : w.time + 1.5,
        rest: 0,
      };
      this.intents.set(e, intent);
      e.navWaypoint = undefined;
    }
    if (distance(e, intent.goal) < 0.4) return;
    return intent.goal;
  }
}
