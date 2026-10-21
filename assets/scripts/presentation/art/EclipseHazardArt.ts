import type { Graphics } from "cc";
import type { Hazard, Point } from "../../battle/SurvivalTypes";
import {
  eclipseSegment,
  eclipseAngle,
  BEAM_NEAR,
} from "../../battle/EclipseGeometry";
import { ink } from "./Ink";
export function drawEclipseHazard(g: Graphics, h: Hazard, t: number) {
  const b = h.eclipse!;
  if (b.cancelled || t >= h.until) return;
  const line = (a: Point, z: Point, c: string, width: number, alpha = 255) => {
    g.strokeColor = ink(c, alpha);
    g.lineWidth = width;
    g.moveTo(a.x * 48, a.y * 48);
    g.lineTo(z.x * 48, z.y * 48);
    g.stroke();
  };
  for (const f of b.sweeps) {
    if (f.cancelled || t >= f.end) continue;
    const pending = t < f.due,
      bright = t >= f.due - 2.4,
      color = b.order === 2 ? "#c7b4ed" : "#ffe4aa";
    const pivot = f.pivot;
    line(b.origin, pivot, "#b6a07a", 6, bright ? 220 : 75);
    g.strokeColor = ink(color, bright ? 200 : 70);
    g.lineWidth = 2;
    g.circle(pivot.x * 48, pivot.y * 48, BEAM_NEAR * 48);
    g.stroke();
    if (pending) {
      for (const time of [f.due, f.end]) {
        const s = eclipseSegment(f, time);
        if (s) line(s.a, s.z, color, 2, bright ? 145 : 45);
      }
      // Short rotating arrow shows direction. Warning fan and floor trails are deliberately unfilled.
      const a = eclipseAngle(f, f.due + 1.2),
        r = 2.1,
        tip = { x: pivot.x + Math.cos(a) * r, y: pivot.y + Math.sin(a) * r };
      const back = {
        x: tip.x + Math.sin(a) * f.sign * 0.4,
        y: tip.y - Math.cos(a) * f.sign * 0.4,
      };
      line(back, tip, color, 3, bright ? 220 : 65);
      line(
        tip,
        { x: back.x + Math.cos(a) * 0.18, y: back.y + Math.sin(a) * 0.18 },
        color,
        3,
        bright ? 220 : 65,
      );
    }
    const ray = eclipseSegment(f, pending ? f.due : t);
    if (ray) {
      line(
        ray.a,
        ray.z,
        color,
        pending ? 3 : 19.2,
        pending ? (bright ? 170 : 45) : 220,
      );
      if (!pending) {
        line(ray.a, ray.z, "#fff9e0", 5);
        for (const p of [ray.a, ray.z]) {
          g.fillColor = ink(color, 220);
          g.circle(p.x * 48, p.y * 48, 9.6);
          g.fill();
        }
      }
    }
    g.fillColor = ink("#e5d1a0", bright ? 230 : 80);
    g.circle(pivot.x * 48, pivot.y * 48, 7);
    g.fill();
  }
}
