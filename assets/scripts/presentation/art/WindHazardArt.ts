import type { Graphics } from "cc";
import type { Hazard, Point } from "../../battle/SurvivalTypes";
import { windPosition } from "../../battle/WindGeometry";
import { ink } from "./Ink";
const S = 48;
export function drawWindHazard(g: Graphics, h: Hazard, time: number) {
  const b = h.wind!;
  if (b.cancelled || time >= h.until) return;
  const active = time >= h.due,
    preview = time < h.created,
    color =
      b.shape === "wind"
        ? "#a9d4df"
        : b.shape === "feather"
          ? "#f0d7ac"
          : "#efaf8a";
  const stroke = (points: Point[], width: number, c: string, alpha = 255) => {
    g.strokeColor = ink(c, alpha);
    g.lineWidth = width;
    points.forEach((p, i) =>
      i ? g.lineTo(p.x * S, p.y * S) : g.moveTo(p.x * S, p.y * S),
    );
    g.stroke();
  };
  let badge = b.points[0];
  if (b.shape === "wind") {
    const c = Math.cos(h.angle),
      s = Math.sin(h.angle),
      point = (x: number, y: number) => ({
        x: h.x + c * x - s * y,
        y: h.y + s * x + c * y,
      });
    const corners = [
      point(-3.5, -1.6),
      point(3.5, -1.6),
      point(3.5, 1.6),
      point(-3.5, 1.6),
    ];
    g.fillColor = ink(color, active ? 20 : 12);
    corners.forEach((p, i) =>
      i ? g.lineTo(p.x * S, p.y * S) : g.moveTo(p.x * S, p.y * S),
    );
    g.close();
    g.fill();
    // Two long edges, broken caps and large arrows denote a finite, open-ended displacement field.
    for (const y of [-1.6, 1.6]) {
      stroke([point(-3.5, y), point(3.5, y)], 6, "#17252e", 210);
      stroke([point(-3.5, y), point(3.5, y)], 2, color);
    }
    for (const x of [-3.5, 3.5])
      for (const side of [-1, 1])
        stroke([point(x, side * 1.6), point(x, side * 0.95)], 2, color, 190);
    for (let i = 0; i < 4; i++) {
      const x = -2.7 + i * 1.7 + (active ? ((time - h.due) * 0.8) % 1.7 : 0);
      if (x > 3) continue;
      stroke(
        [point(x - 0.3, -0.35), point(x, 0), point(x - 0.3, 0.35)],
        7,
        "#17252e",
        220,
      );
      stroke(
        [point(x - 0.3, -0.35), point(x, 0), point(x - 0.3, 0.35)],
        3,
        color,
      );
    }
    badge = point(-3.5, 1.6);
  } else {
    stroke(b.points, 6, "#17252e", preview ? 90 : 190);
    stroke(b.points, 2, color, preview ? 100 : active ? 95 : 230);
    if (b.shape === "glide") {
      const p = b.points[1];
      g.strokeColor = ink(color, 230);
      g.lineWidth = 3;
      g.rect(p.x * S - 8, p.y * S - 8, 16, 16);
      g.stroke();
      // Parallel pause ticks at the bend survive reduced effects.
      stroke(
        [
          { x: p.x - 0.08, y: p.y - 0.1 },
          { x: p.x - 0.08, y: p.y + 0.1 },
        ],
        2,
        color,
      );
      stroke(
        [
          { x: p.x + 0.08, y: p.y - 0.1 },
          { x: p.x + 0.08, y: p.y + 0.1 },
        ],
        2,
        color,
      );
    }
    const end = b.points[b.points.length - 1],
      pre = b.points[b.points.length - 2],
      a = Math.atan2(end.y - pre.y, end.x - pre.x);
    stroke(
      [
        {
          x: end.x - Math.cos(a - 0.6) * 0.3,
          y: end.y - Math.sin(a - 0.6) * 0.3,
        },
        end,
        {
          x: end.x - Math.cos(a + 0.6) * 0.3,
          y: end.y - Math.sin(a + 0.6) * 0.3,
        },
      ],
      3,
      color,
      preview ? 90 : 230,
    );
    if (active && b.shape === "feather") {
      const p = windPosition(h, time),
        old = windPosition(h, time - 0.07);
      stroke([old, p], h.width * 2 * S + 5, "#17252e");
      stroke([old, p], h.width * 2 * S, color);
      g.fillColor = ink("#fff2d3");
      g.circle(p.x * S, p.y * S, 4);
      g.fill();
    }
  }
  const bx = badge.x * S,
    by = badge.y * S + 14;
  g.fillColor = ink("#17252e", 220);
  g.rect(bx - 7, by - 4, 12 + b.order * 8, 21);
  g.fill();
  g.strokeColor = ink(color, preview ? 130 : 255);
  g.lineWidth = 3;
  for (let i = 0; i < b.order; i++) {
    g.moveTo(bx + i * 8, by);
    g.lineTo(bx + i * 8, by + 10);
  }
  g.stroke();
}
