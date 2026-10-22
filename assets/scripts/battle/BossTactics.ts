import { advanceTactically } from "./TacticalMovement";
import type { SurvivalWorld } from "./SurvivalWorld";
import type { Enemy, Point } from "./SurvivalTypes";
import { distance, segmentDistance, angleDelta } from "./SurvivalTypes";
interface Observation {
  anchor: Point;
  since: number;
  position?: Point;
  waypoint?: Point;
  next: number;
  attempt: number;
}
/** Positioning intent only: moves around terrain; never modifies a published attack. */
export class BossTactics {
  private observations = new Map<number, Observation>();
  readonly stats = { approaches: 0 };
  constructor(private w: SurvivalWorld) {}
  private position(e: Enemy, attempt: number, close: boolean) {
    const w = this.w,
      special = !close && w.stageStrategy.bossPosition?.(e);
    if (special) return special;
    const map = w.stageStrategy.map,
      edge = Math.abs(w.player.x) > 17 || Math.abs(w.player.y) > 21;
    const desired =
      (edge
        ? Math.atan2(w.player.y, w.player.x)
        : Math.atan2(e.y - w.player.y, e.x - w.player.x)) +
      ((attempt % 6) * Math.PI) / 3;
    let best: Point | undefined,
      score = Infinity;
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12,
        r = close ? 0.75 : edge ? 1.2 : 1.8,
        p = {
          x: w.player.x + Math.cos(a) * r,
          y: w.player.y + Math.sin(a) * r,
        };
      if (
        Math.abs(p.x) > 20.95 ||
        Math.abs(p.y) > 24.95 ||
        map.blocked(p, 0.7) ||
        map.segment(p, w.player, 0.3)
      )
        continue;
      const value = distance(p, e) - Math.cos(a - desired) * (edge ? 8 : 2);
      if (value < score) {
        score = value;
        best = p;
      }
    }
    return best;
  }
  approach(e: Enemy, dt: number) {
    const w = this.w;
    let o = this.observations.get(e.id);
    if (!o || distance(o.anchor, w.player) > 0.7) {
      o = { anchor: { ...w.player }, since: w.time, next: 0, attempt: 0 };
      this.observations.set(e.id, o);
    }
    if (w.lastHurt > o.since) {
      o.since = w.lastHurt;
      o.position = undefined;
      o.waypoint = undefined;
      o.attempt = 0;
    }
    if (
      w.time - o.since < 10 ||
      w.time < o.next ||
      e.state !== "seek" ||
      e.immovable ||
      e.freezeUntil > w.time ||
      e.sand?.buried ||
      w.hazards.some((h) => h.until > w.time)
    )
      return false;
    o.position ??= this.position(e, o.attempt, w.time - o.since >= 30);
    if (!o.position) {
      o.next = w.time + 1;
      return false;
    }
    if (distance(e, o.position) < 0.1) {
      o.position = undefined;
      o.waypoint = undefined;
      o.next = w.time + 5;
      o.attempt++;
      return false;
    }
    if (o.waypoint && distance(e, o.waypoint) < 0.3) o.waypoint = undefined;
    const map = w.stageStrategy.map;
    if (!o.waypoint && distance(e, w.player) > 1.4 && segmentDistance(w.player, e, o.position) < Math.min(0.95, distance(o.position, w.player) - 0.05)) {
      const a = Math.atan2(e.y - w.player.y, e.x - w.player.x),
        targetAngle = Math.atan2(
          o.position.y - w.player.y,
          o.position.x - w.player.x,
        ),
        delta = angleDelta(targetAngle, a);
      const turn = Math.sign(delta) * Math.min(Math.abs(delta), Math.PI / 3);
      const sides = [turn, -turn]
        .map((turn) => ({
          x: w.player.x + Math.cos(a + turn) * 1.2,
          y: w.player.y + Math.sin(a + turn) * 1.2,
        }))
        .filter(
          (p) =>
            Math.abs(p.x) <= 21.3 &&
            Math.abs(p.y) <= 25.3 &&
            !map.blocked(p, 0.7),
        );
      o.waypoint = sides[0];
    }
    const target = o.waypoint ?? o.position,
      speed = 2.2 * (e.slowUntil > w.time ? 1 - e.slow : 1);
    if (advanceTactically(map, e, target, speed, dt, 0.7) < 1e-6) {
      o.position = undefined;
      o.waypoint = undefined;
      o.next = w.time + 1;
      return false;
    }
    e.attack = Math.max(0, e.attack - dt);
    this.stats.approaches++;
    return true;
  }
}
