import { ElitePositioning } from "./ElitePositioning";
import type { SurvivalWorld } from "./SurvivalWorld";
import type { Enemy, Point } from "./SurvivalTypes";
import { distance } from "./SurvivalTypes";
import { ENEMIES, isElite } from "./SurvivalConfig";
import { advanceTactically } from "./TacticalMovement";
import { RangedTactics } from "./RangedTactics";
interface Flank {
  goal: Point;
  until: number;
  done: boolean;
  anchor: Point;
}
/** Small melee groups use side approaches; special casters retain their own attack AI. */
export class EnemyTactics {
  private flanks = new WeakMap<Enemy, Flank>();
  private observations = new WeakMap<Enemy, { point: Point; at: number }>();
  readonly stats = { flankSteps: 0, eliteSteps: 0, repaths: 0 };
  readonly ranged: RangedTactics;
  readonly elites: ElitePositioning;
  constructor(private w: SurvivalWorld) {
    this.ranged = new RangedTactics(w);
    this.elites = new ElitePositioning(w);
  }
  role(e: Enemy) {
    if (isElite(e.kind)) return "elite";
    const c = ENEMIES[e.kind];
    if ((c.threat === 0 && c.speed > 0) || e.kind === "flanker")
      return e.id % 4 === 0 ? "flank" : "pursue";
    return "specialist";
  }
  step(e: Enemy, dt: number) {
    const w = this.w,
      map = w.stageStrategy.map,
      c = ENEMIES[e.kind];
    if (
      e.kind === "boss" ||
      e.state !== "seek" ||
      e.immovable ||
      e.freezeUntil > w.time ||
      e.sand?.buried ||
      c.speed <= 0 ||
      w.hazards.some((h) => h.source === e.id && h.until > w.time)
    )
      return false;
    // A cached waypoint may belong to an old target or a blocked approach.
    const observation = this.observations.get(e);
    if (!observation)
      this.observations.set(e, { point: { x: e.x, y: e.y }, at: w.time });
    else if (w.time - observation.at >= 1.2) {
      if (
        distance(e, observation.point) < 0.15 &&
        distance(e, w.player) > 1.5 &&
        e.navWaypoint
      ) {
        e.navWaypoint = undefined;
        this.stats.repaths++;
      }
      observation.point = { x: e.x, y: e.y };
      observation.at = w.time;
    }
    if (c.tacticalRange && this.ranged.step(e, dt)) return true;
    const role = this.role(e);
    let goal: Point | undefined;
    if (role === "elite") {
      goal = this.elites.goal(e);
      if (!goal) return false;
    } else if (role === "flank") {
      if (distance(e, w.player) < 4.5) return false;
      let state = this.flanks.get(e);
      if (!state || distance(state.anchor, w.player) > 3) {
        const a =
          Math.atan2(e.y - w.player.y, e.x - w.player.x) +
          ((Math.floor(e.id / 4) % 2 ? 1 : -1) * Math.PI) / 3;
        state = {
          goal: {
            x: w.player.x + Math.cos(a) * 3.1,
            y: w.player.y + Math.sin(a) * 3.1,
          },
          until: w.time + 2.5,
          done: false,
          anchor: { ...w.player },
        };
        this.flanks.set(e, state);
      }
      if (state.done) return false;
      if (w.time >= state.until || distance(e, state.goal) < 0.5) {
        state.done = true;
        return false;
      }
      goal = state.goal;
    } else return false;
    const radius = role === "elite" ? 0.7 : 0.35;
    if (
      Math.abs(goal.x) > 22 - radius ||
      Math.abs(goal.y) > 26 - radius ||
      map.blocked(goal, radius)
    )
      return false;
    const speed = c.speed * (e.slowUntil > w.time ? 1 - e.slow : 1);
    if (advanceTactically(map, e, goal, speed, dt, radius) < 1e-6) return false;
    e.attack = Math.max(0, e.attack - dt);
    if (role === "elite") {
      this.stats.eliteSteps++;
      this.elites.stats.moves++;
    } else this.stats.flankSteps++;
    return true;
  }
}
