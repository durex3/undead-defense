import { Hazard, Point, segmentDistance } from "./SurvivalTypes";
/** Same finite capsule for warning, damage and escape planning. */
export function hazardLaneEnd(h: Pick<Hazard,"x"|"y"|"angle"|"radius">): Point {
  return {x:h.x+Math.cos(h.angle)*h.radius,y:h.y+Math.sin(h.angle)*h.radius};
}
export function hazardLaneContains(h: Pick<Hazard,"x"|"y"|"angle"|"radius"|"width">, p: Point) {
  return h.width>0 && segmentDistance(p,h,hazardLaneEnd(h))<h.width;
}
