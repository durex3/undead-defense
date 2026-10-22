import type { Enemy, Point } from "./SurvivalTypes";
import { distance } from "./SurvivalTypes";
interface NavigationMap {
  heading(e: Enemy, target: Point): number;
  resolve(p: Point, r: number): void;
}
/** The same small terrain-constrained steps for tactical movement; never teleport to a goal. */
export function advanceTactically(
  map: NavigationMap,
  e: Enemy,
  target: Point,
  speed: number,
  dt: number,
  radius: number,
) {
  const before = { x: e.x, y: e.y },
    length = Math.min(speed * dt, distance(e, target)),
    steps = Math.max(1, Math.ceil(length / 0.12));
  for (let i = 0; i < steps; i++) {
    const a = map.heading(e, target);
    e.facing = a;
    e.x = Math.max(
      -22 + radius,
      Math.min(22 - radius, e.x + (Math.cos(a) * length) / steps),
    );
    map.resolve(e, radius);
    e.y = Math.max(
      -26 + radius,
      Math.min(26 - radius, e.y + (Math.sin(a) * length) / steps),
    );
    map.resolve(e, radius);
  }
  return distance(e, before);
}
