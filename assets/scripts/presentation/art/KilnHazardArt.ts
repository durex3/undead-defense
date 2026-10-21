import type { Graphics } from "cc";
import type { Hazard, Point } from "../../battle/SurvivalTypes";
import { kilnSegments, kilnPoint } from "../../battle/KilnGeometry";
import { distance } from "../../battle/SurvivalTypes";
import { ink } from "./Ink";
/** Dim dashed rejected branch, locked arrows, exact finite bright flame and round caps. */
export function drawKilnHazard(g: Graphics, h: Hazard, time: number) {
  const b = h.kiln!;
  if (b.cancelled || time >= h.until) return;
  const line = (
    a: Point,
    z: Point,
    width: number,
    color: string,
    alpha = 255,
  ) => {
    g.strokeColor = ink(color, alpha);
    g.lineWidth = width;
    g.moveTo(a.x * 48, a.y * 48);
    g.lineTo(z.x * 48, z.y * 48);
    g.stroke();
  };
  for (let i = 1; i < b.preview.length; i++) {
    const a = b.preview[i - 1],
      z = b.preview[i];
    for (let j = 0; j < 12; j += 2)
      line(
        { x: a.x + ((z.x - a.x) * j) / 12, y: a.y + ((z.y - a.y) * j) / 12 },
        {
          x: a.x + ((z.x - a.x) * (j + 1)) / 12,
          y: a.y + ((z.y - a.y) * (j + 1)) / 12,
        },
        2,
        "#8c8580",
        95,
      );
  }
  let arc = 0;
  for (let i = 1; i < b.path.length; i++) {
    if (arc >= b.limit) break;
    arc += distance(b.path[i - 1], b.path[i]);
    const a = b.path[i - 1],
      z = b.path[i],
      angle = Math.atan2(z.y - a.y, z.x - a.x);
    line(a, z, 7, "#211b20");
    line(a, z, 4, "#f4d2a0", 255);
    for (let j = 0.5; j < distance(a, z); j += 0.85) {
      const p = { x: a.x + Math.cos(angle) * j, y: a.y + Math.sin(angle) * j };
      for (const side of [-1, 1])
        line(
          p,
          {
            x: p.x - Math.cos(angle + side * 0.65) * 0.22,
            y: p.y - Math.sin(angle + side * 0.65) * 0.22,
          },
          3.5,
          "#fff0c2",
        );
    }
  }
  for (const [a, z] of kilnSegments(h, time)) {
    line(a, z, b.halfWidth * 96, "#ed854f");
    for (const p of [a, z]) {
      g.fillColor = ink("#ed854f");
      g.circle(p.x * 48, p.y * 48, b.halfWidth * 48);
      g.fill();
    }
    line(a, z, 6, "#fff1ba");
  }
  const source = b.path[0],
    end = kilnPoint(h, b.limit);
  for (const p of [source, end]) {
    g.strokeColor = ink("#e6cba1");
    g.lineWidth = 2;
    g.circle(p.x * 48, p.y * 48, 9);
    g.stroke();
  }
  if (b.valveId && b.valve) {
    line(source, b.valve, 1.5, "#d4cbb4", 155);
  }
  const progress = Math.max(
      0,
      Math.min(1, (h.due - time) / (h.due - h.created)),
    ),
    x = source.x * 48,
    y = source.y * 48 + 22;
  g.strokeColor = ink("#ffe1a3");
  g.lineWidth = 3;
  for (let i = 0; i < 10 * progress; i++) {
    g.moveTo(x + i * 4, y);
    g.lineTo(x + i * 4, y + 5);
  }
  g.stroke();
  g.strokeColor = ink("#f0dfc3");
  g.lineWidth = 2;
  for (let i = 0; i < b.order; i++) {
    g.moveTo(x + i * 6, y - 10);
    g.lineTo(x + i * 6, y - 3);
  }
  g.stroke();
}
