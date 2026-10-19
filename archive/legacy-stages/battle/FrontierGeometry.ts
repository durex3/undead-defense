import { Hazard, Point, segmentDistance } from './SurvivalTypes';
export function frontierContains(h:Hazard,p:Point) {
  return h.kind==='frontierLane'
    ? segmentDistance(p,h,{x:h.endX??h.x,y:h.endY??h.y}) < h.width
    : Math.hypot(p.x-h.x,p.y-h.y)<h.radius;
}
