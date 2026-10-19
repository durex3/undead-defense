import { Point, Hazard, segmentDistance, distance } from "./SurvivalTypes";
import { observatorySegment } from "./ObservatoryMap";
/** Four bounded combat-time samples. Hazards receive copies, never this live buffer. */
export class ObservatoryPath {
  readonly points: (Point & { time: number })[] = [];
  private next = 0;
  clear() {
    this.points.length = 0;
    this.next = 0;
  }
  sample(time: number, p: Point) {
    while (this.points.length && this.points[0].time < time - 1.5 - 1e-6)
      this.points.shift();
    if (time + 1e-6 < this.next) return;
    if (this.points.length === 4) this.points.shift();
    this.points.push({ x: p.x, y: p.y, time });
    this.next = time + 0.5;
  }
  segments(count: number, visible: (p: Point) => boolean) {
    const result: { a: Point; b: Point }[] = [];
    for (let i = this.points.length - 1; i > 0 && result.length < count; i--) {
      const a = this.points[i - 1],
        p = this.points[i],
        d = distance(a, p);
      if (d < 0.8) continue;
      const length = Math.min(3, d),
        b = {
          x: a.x + ((p.x - a.x) * length) / d,
          y: a.y + ((p.y - a.y) * length) / d,
        };
      if (
        [a, b].some(
          (p) => Math.abs(p.x) > 22 || Math.abs(p.y) > 26 || !visible(p),
        ) ||
        observatorySegment(a, b, 0.3)
      )
        continue;
      result.push({ a: { x: a.x, y: a.y }, b });
    }
    return result;
  }
}
export function starContains(h: Hazard, p: Point) {
  return h.kind === "starTrace"
    ? segmentDistance(p, h, { x: h.endX ?? h.x, y: h.endY ?? h.y }) < h.width
    : distance(p, h) < h.radius;
}
