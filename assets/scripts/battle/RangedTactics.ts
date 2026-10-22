import type { SurvivalWorld } from "./SurvivalWorld";
import type { Enemy, Point } from "./SurvivalTypes";
import { distance } from "./SurvivalTypes";
import { ENEMIES } from "./SurvivalConfig";
import { advanceTactically } from "./TacticalMovement";
interface Spacing {
  goal?: Point;
  anchor: Point;
  since: number;
  next: number;
  yieldUntil: number;
  retreatUntil: number;
}
/** Seeking movement only. Published warnings and attack decisions belong to stage AI. */
export class RangedTactics {
  private states = new WeakMap<Enemy, Spacing>();
  readonly stats = { moves: 0, searches: 0, yields: 0 };
  constructor(private w: SurvivalWorld) {}
  step(e: Enemy, dt: number) {
    const w = this.w,
      c = ENEMIES[e.kind],
      range = c.tacticalRange;
    if (!range) return false;
    let s = this.states.get(e);
    if (!s) {
      s = {
        anchor: { ...w.player },
        since: w.time,
        next: 0,
        yieldUntil: 0,
        retreatUntil: 0,
      };
      this.states.set(e, s);
    }
    if (w.time < s.yieldUntil) return false;
    const map = w.stageStrategy.map,
      d = distance(e, w.player);
    const blocked = map.segment(e, w.player, 0.25);
    const close = d < range.min;
    if (!blocked && !close && d <= range.max) {
      s.goal = undefined;
      s.since = w.time;
      s.retreatUntil = 0;
      // Hold spacing while reloading, then let the original controller cast.
      if (e.attack > dt) {
        e.attack -= dt;
        return true;
      }
      return false;
    }
    if (close && !s.retreatUntil) s.retreatUntil = w.time + 1.25;
    if ((close && w.time >= s.retreatUntil) || w.time - s.since > 2.5) {
      s.goal = undefined;
      s.yieldUntil = w.time + 0.8;
      s.since = s.yieldUntil;
      s.retreatUntil = 0;
      this.stats.yields++;
      return false;
    }
    if (distance(s.anchor, w.player) > 1) {
      s.goal = undefined;
      s.anchor = { ...w.player };
      e.navWaypoint = undefined;
    }
    if ((!s.goal || distance(e, s.goal) < 0.3) && w.time >= s.next) {
      s.next = w.time + 0.6;
      this.stats.searches++;
      let score = Infinity;
      const base = Math.atan2(e.y - w.player.y, e.x - w.player.x);
      for (let i = 0; i < 16; i++) {
        const a = base + (i * Math.PI) / 8,
          p = {
            x: w.player.x + Math.cos(a) * range.preferred,
            y: w.player.y + Math.sin(a) * range.preferred,
          };
        if (
          Math.abs(p.x) > 21.65 ||
          Math.abs(p.y) > 25.65 ||
          map.blocked(p, 0.35) ||
          map.segment(p, w.player, 0.25)
        )
          continue;
        const cost = distance(e, p);
        if (cost < score) {
          score = cost;
          s.goal = p;
        }
      }
      // If there is no clear firing point, use existing navigation to close in.
      s.goal ??= { ...w.player };
      e.navWaypoint = undefined;
    }
    if (!s.goal) return false;
    const moved = advanceTactically(
      map,
      e,
      s.goal,
      c.speed * (e.slowUntil > w.time ? 1 - e.slow : 1),
      dt,
      0.35,
    );
    if (moved < 1e-6) {
      s.goal = undefined;
      e.navWaypoint = undefined;
      return false;
    }
    e.attack = Math.max(0, e.attack - dt);
    this.stats.moves++;
    return true;
  }
}
