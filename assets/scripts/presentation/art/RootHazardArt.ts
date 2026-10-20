import type { Graphics } from "cc";
import type { Hazard } from "../../battle/SurvivalTypes";
import { rootArm } from "../../battle/RootGeometry";
import { ink } from "./Ink";
const S = 48;
function arc(
  g: Graphics,
  x: number,
  y: number,
  r: number,
  a: number,
  turn: number,
  n = 24,
) {
  for (let i = 0; i <= n; i++) {
    const t = a + (turn * i) / n,
      xx = x + Math.cos(t) * r,
      yy = y + Math.sin(t) * r;
    if (i === 0) g.moveTo(xx, yy);
    else g.lineTo(xx, yy);
  }
}
export function drawRootHazard(g: Graphics, h: Hazard, time: number) {
  if (!h.root || time >= h.until) return;
  const b = h.root,
    x = h.x * S,
    y = h.y * S,
    active = time >= h.due,
    preview = time < h.created;
  const color =
    b.shape === "arm" ? "#e3c794" : b.shape === "ring" ? "#f2c89b" : "#f3b29b";
  g.strokeColor = ink("#17251c", 220);
  g.lineWidth = 6;
  if (b.shape === "arm") {
    const r = h.radius * S,
      inner = b.inner * S;
    const area = () => {
      arc(g, x, y, r, h.angle, b.turn);
      g.lineTo(
        x + Math.cos(h.angle + b.turn) * inner,
        y + Math.sin(h.angle + b.turn) * inner,
      );
      for (let i = 24; i >= 0; i--) {
        const a = h.angle + (b.turn * i) / 24;
        g.lineTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
      }
      g.close();
    };
    g.fillColor = ink(color, active ? 12 : 24);
    area();
    g.fill();
    area();
    g.stroke();
    g.strokeColor = ink(color, active ? 70 : 210);
    g.lineWidth = 2;
    area();
    g.stroke();
    for (const t of [h.due, h.until]) {
      const [a, z] = rootArm(h, t);
      g.moveTo(a.x * S, a.y * S);
      g.lineTo(z.x * S, z.y * S);
    }
    g.stroke();
    // Directional chevrons stay visible in low-power mode.
    g.strokeColor = ink(color, 220);
    g.lineWidth = 2;
    for (const f of [0.25, 0.6]) {
      const a = h.angle + b.turn * f,
        dir = Math.sign(b.turn),
        xx = x + (Math.cos(a) * (r + inner)) / 2,
        yy = y + (Math.sin(a) * (r + inner)) / 2;
      g.moveTo(
        xx - Math.cos(a) * 5 + Math.sin(a) * dir * 9,
        yy - Math.sin(a) * 5 - Math.cos(a) * dir * 9,
      );
      g.lineTo(xx, yy);
      g.lineTo(
        xx + Math.cos(a) * 5 + Math.sin(a) * dir * 9,
        yy + Math.sin(a) * 5 - Math.cos(a) * dir * 9,
      );
    }
    g.stroke();
    if (active) {
      const [a, z] = rootArm(h, time);
      g.strokeColor = ink("#15251b");
      g.lineWidth = h.width * 2 * S + 5;
      g.moveTo(a.x * S, a.y * S);
      g.lineTo(z.x * S, z.y * S);
      g.stroke();
      g.strokeColor = ink("#b1ba76");
      g.lineWidth = h.width * 2 * S;
      g.moveTo(a.x * S, a.y * S);
      g.lineTo(z.x * S, z.y * S);
      g.stroke();
      g.strokeColor = ink("#f3d8a4");
      g.lineWidth = 3;
      g.moveTo(a.x * S, a.y * S + 2);
      g.lineTo(z.x * S, z.y * S + 2);
      g.stroke();
    }
    g.fillColor = ink("#263c2a");
    g.circle(x, y, 9);
    g.fill();
    g.strokeColor = ink(color);
    g.lineWidth = 2;
    g.circle(x, y, 9);
    g.stroke();
  } else {
    const outer = h.radius * S,
      inner = b.inner * S;
    if (b.shape === "ring") {
      // Fill the annular strip without painting over its genuinely safe center.
      g.strokeColor = ink(color, preview ? 18 : active ? 90 : 35);
      g.lineWidth = outer - inner;
      g.circle(x, y, (outer + inner) / 2);
      g.stroke();
    } else {
      g.fillColor = ink(color, preview ? 12 : active ? 75 : 30);
      g.circle(x, y, outer);
      g.fill();
    }
    for (const r of b.shape === "ring" ? [outer, inner] : [outer]) {
      g.strokeColor = ink("#17251c", 220);
      g.lineWidth = 6;
      g.circle(x, y, r);
      g.stroke();
      g.strokeColor = ink(color, preview ? 100 : 240);
      g.lineWidth = 2;
      g.circle(x, y, r);
      g.stroke();
    }
    g.strokeColor = ink(color, preview ? 90 : 220);
    g.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        r = b.shape === "ring" ? (inner + outer) / 2 : outer * 0.65,
        xx = x + Math.cos(a) * r,
        yy = y + Math.sin(a) * r;
      if (b.shape === "ring") {
        g.moveTo(xx - 5, yy - 4);
        g.lineTo(xx, yy + 5);
        g.lineTo(xx + 5, yy - 4);
      } else {
        g.moveTo(xx - Math.cos(a) * 8, yy - Math.sin(a) * 8);
        g.lineTo(xx + Math.cos(a) * 8, yy + Math.sin(a) * 8);
        g.moveTo(
          xx + Math.cos(a) * 3 - Math.sin(a) * 5,
          yy + Math.sin(a) * 3 + Math.cos(a) * 5,
        );
        g.lineTo(xx + Math.cos(a) * 8, yy + Math.sin(a) * 8);
      }
    }
    g.stroke();
  }
  // Distinct badge positions for arm, annulus and disk, even at a shared center.
  const bx =
    b.shape === "arm"
      ? x + Math.cos(h.angle) * (b.inner + 0.9) * S
      : x + (b.shape === "ring" ? -26 : 26);
  const by =
    b.shape === "arm"
      ? y + Math.sin(h.angle) * (b.inner + 0.9) * S
      : y + (b.shape === "ring" ? h.radius * S + 14 : -h.radius * S - 22);
  g.fillColor = ink("#17251c", 210);
  g.rect(bx - 5, by - 4, b.order * 8 + 5, 20);
  g.fill();
  g.strokeColor = ink("#ffe5b8", preview ? 150 : 255);
  g.lineWidth = 3;
  for (let i = 0; i < b.order; i++) {
    g.moveTo(bx + i * 8, by);
    g.lineTo(bx + i * 8, by + 11);
  }
  g.stroke();
}
