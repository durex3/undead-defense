import {
  distance,
  segmentDistance,
  angleDelta,
  type Point,
} from "./SurvivalTypes";
import { traceMap } from "./TraceCourtMap";
export type TraceDirection = "left" | "right";
interface Sample extends Point {
  time: number;
}
export interface TraceRoute {
  points: Point[];
  genuine: boolean;
  direction?: TraceDirection;
}
function simplify(p: Point[]): Point[] {
  if (p.length <= 2) return p.map((q) => ({ ...q }));
  let max = 0,
    index = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const d = segmentDistance(p[i], p[0], p[p.length - 1]);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  if (max <= 0.12) return [{ ...p[0] }, { ...p[p.length - 1] }];
  return [
    ...simplify(p.slice(0, index + 1)).slice(0, -1),
    ...simplify(p.slice(index)),
  ];
}
export class TraceHistory {
  readonly samples: Sample[] = [];
  clear() {
    this.samples.length = 0;
  }
  record(p: Point, time: number) {
    const last = this.samples[this.samples.length - 1];
    if (last && distance(last, p) < 1e-7 && time - last.time < 0.05) return;
    this.samples.push({ ...p, time });
    while (
      this.samples.length &&
      (this.samples[0].time < time - 3 || this.samples.length > 1024)
    )
      this.samples.shift();
  }
  route(body: Point, time: number, reverse = false): TraceRoute | undefined {
    const raw = this.samples.filter((p) => p.time >= time - 3),
      end = raw.length - 1;
    let best: TraceRoute | undefined,
      score = -Infinity;
    for (let i = 0; i < end; i += 2) {
      const history = simplify(raw.slice(i));
      if (reverse) history.reverse();
      if (history.length > 4 || distance(body, history[0]) > 1.2) continue;
      const points = [
        { x: body.x, y: body.y },
        ...history.map((p) => ({ x: p.x, y: p.y })),
      ].filter((p, j, a) => !j || distance(p, a[j - 1]) > 1e-5);
      const length = points
          .slice(1)
          .reduce((n, p, j) => n + distance(p, points[j]), 0),
        hl = history
          .slice(1)
          .reduce((n, p, j) => n + distance(p, history[j]), 0);
      if (
        hl < 0.8 ||
        points.length < 2 ||
        length > 7.2 ||
        length < 0.8 ||
        points.some((p) => Math.abs(p.x) > 21.3 || Math.abs(p.y) > 25.3) ||
        points.slice(1).some((p, j) => traceMap.segment(points[j], p, 0.7))
      )
        continue;
      let turn = 0;
      for (let j = 1; j < history.length - 1; j++) {
        const a = Math.atan2(
            history[j].y - history[j - 1].y,
            history[j].x - history[j - 1].x,
          ),
          b = Math.atan2(
            history[j + 1].y - history[j].y,
            history[j + 1].x - history[j].x,
          ),
          d = angleDelta(b, a);
        if (Math.abs(d) > Math.abs(turn) + 1e-9) turn = d;
      }
      const genuine = hl >= 3.6 && Math.abs(turn) >= (35 * Math.PI) / 180,
        rank = Number(genuine) * 100 + hl;
      if (rank > score) {
        score = rank;
        best = {
          points,
          genuine,
          direction: genuine ? (turn > 0 ? "left" : "right") : undefined,
        };
      }
    }
    return best;
  }
}
