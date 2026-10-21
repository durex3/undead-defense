import type { Graphics } from "cc";
import type { Hazard, Point } from "../../battle/SurvivalTypes";
import {
  edgeFlight,
  edgePosition,
  edgeRestPosition,
} from "../../battle/EdgeCourtGeometry";
import { distance } from "../../battle/SurvivalTypes";
import { ink } from "./Ink";
export function drawEdgeHazard(g: Graphics, h: Hazard, time: number) {
  const b = h.edge!;
  if (b.cancelled || time >= h.until) return;
  const line = (a: Point, z: Point, color: string, width = 3, alpha = 255) => {
    g.strokeColor = ink(color, alpha);
    g.lineWidth = width;
    g.moveTo(a.x * 48, a.y * 48);
    g.lineTo(z.x * 48, z.y * 48);
    g.stroke();
  };
  const active = edgeFlight(h, time);
  for (const f of b.flights) {
    if (f.cancelled || time >= f.end) continue;
    const pending = time < f.due,
      c =
        b.shape === "body" ? "#d6b99e" : f.index === 0 ? "#e9d6a4" : "#b2e4e3";
    if (pending) {
      // Every future source is visible immediately. Only the active prewarning becomes bright.
      const bright = time >= f.due - (f.index ? 2 : 2.2),
        n = 12;
      for (let j = 0; j < n; j += 2)
        line(
          {
            x: f.from.x + ((f.to.x - f.from.x) * j) / n,
            y: f.from.y + ((f.to.y - f.from.y) * j) / n,
          },
          {
            x: f.from.x + ((f.to.x - f.from.x) * (j + 1)) / n,
            y: f.from.y + ((f.to.y - f.from.y) * (j + 1)) / n,
          },
          c,
          bright ? 3.5 : 2,
          bright ? 245 : 105,
        );
      const a = f.angle;
      for (const t of [0.3, 0.7]) {
        const p = {
          x: f.from.x + (f.to.x - f.from.x) * t,
          y: f.from.y + (f.to.y - f.from.y) * t,
        };
        for (const side of [-1, 1])
          line(
            p,
            {
              x: p.x - Math.cos(a + side * 0.6) * 0.28,
              y: p.y - Math.sin(a + side * 0.6) * 0.28,
            },
            c,
            bright ? 3 : 2,
            bright ? 255 : 120,
          );
      }
      g.strokeColor = ink(c, bright ? 255 : 130);
      g.lineWidth = 2.5;
      g.circle(f.from.x * 48, f.from.y * 48, 10);
      g.stroke();
      const x = f.from.x * 48,
        y = f.from.y * 48 + 19,
        remain = Math.max(0, Math.min(1, (f.due - time) / (f.index ? 2 : 2.2)));
      g.lineWidth = 3;
      for (let j = 0; j < 10 * remain; j++) {
        g.moveTo(x + j * 4, y);
        g.lineTo(x + j * 4, y + 4);
      }
      g.stroke();
      for (let j = 0; j < b.order; j++) {
        g.moveTo(x + j * 6, y - 12);
        g.lineTo(x + j * 6, y - 5);
      }
      g.stroke();
    }
  }
  if (active) {
    const p = edgePosition(active, time),
      c = b.shape === "body" ? "#e6b58e" : active.index ? "#c8f4ee" : "#fff0bf";
    const dx = Math.cos(active.angle) * active.halfLength,
      dy = Math.sin(active.angle) * active.halfLength;
    const a = { x: p.x - dx, y: p.y - dy },
      z = { x: p.x + dx, y: p.y + dy };
    line(a, z, "#26313d", active.radius * 96 + 4);
    line(a, z, c, active.radius * 96);
    for (const q of [a, z]) {
      g.fillColor = ink(c);
      g.circle(q.x * 48, q.y * 48, active.radius * 48);
      g.fill();
    }
    if (b.shape === "blade") line(a, z, "#ffffff", 3);
  } else if (b.shape === "blade") {
    const first = b.flights[0];
    if (!first.cancelled && time >= first.end) {
      const p = edgeRestPosition(h, time);
      line(
        { x: p.x - 0.34, y: p.y },
        { x: p.x + 0.34, y: p.y },
        "#647987",
        6,
        230,
      );
      g.strokeColor = ink("#bfd3d9");
      g.lineWidth = 2;
      g.circle(p.x * 48, p.y * 48, 12);
      g.stroke();
    }
  }
  // Harmless source-link is narrow and subdued; no collision is attached to it.
  if (
    b.shape === "blade" &&
    b.flights.length > 1 &&
    time >= b.flights[0].end &&
    time < b.flights[1].due &&
    !b.flights[1].cancelled
  )
    line(b.flights[0].to, b.flights[1].to, "#8e9a9e", 1, 85);
}
