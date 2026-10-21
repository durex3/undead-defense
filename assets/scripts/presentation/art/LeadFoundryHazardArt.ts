import type { Graphics } from "cc";
import type { Hazard, Point } from "../../battle/SurvivalTypes";
import { leadPosition } from "../../battle/LeadFoundryGeometry";
import { ink } from "./Ink";
export function drawLeadHazard(g: Graphics, h: Hazard, t: number) {
  const b = h.lead!;
  if (b.cancelled || t >= h.until) return;
  const line = (a: Point, z: Point, c: string, width = 2, alpha = 160) => {
    g.strokeColor = ink(c, alpha);
    g.lineWidth = width;
    g.moveTo(a.x * 48, a.y * 48);
    g.lineTo(z.x * 48, z.y * 48);
    g.stroke();
  };
  const mount = { x: b.origin.x, y: b.origin.y + 0.8 };
  line(b.body, mount, "#998b77", 4, b.interrupted ? 65 : 170);
  g.strokeColor = ink("#d8bb91", b.interrupted ? 80 : 235);
  g.lineWidth = 3;
  g.moveTo(mount.x * 48 - 10, mount.y * 48 + 4);
  g.lineTo(mount.x * 48 - 8, mount.y * 48 - 6);
  g.lineTo(mount.x * 48 + 8, mount.y * 48 - 6);
  g.lineTo(mount.x * 48 + 10, mount.y * 48 + 4);
  g.stroke();
  for (const f of b.legs) {
    if (f.cancelled || t >= f.end) continue;
    const x = f.to.x * 48,
      y = f.to.y * 48,
      r = 0.8 * 48,
      color = b.order === 1 ? "#efbd8b" : "#c5b4e0",
      active = t >= f.due,
      soon = t >= f.due - 2.4;
    if (active) {
      g.fillColor = ink(color, 125);
      g.circle(x, y, r);
      g.fill();
      g.fillColor = ink("#8d9c97");
      g.circle(x, y, 10);
      g.fill();
      g.strokeColor = ink("#fff0cd", 240);
      g.lineWidth = 4;
      g.circle(x, y, r);
      g.stroke();
    } else {
      g.strokeColor = ink(color, soon ? 180 : 75);
      g.lineWidth = 2;
      g.circle(x, y, r);
      g.stroke();
      const q = Math.max(0, Math.min(1, (t - (f.due - 2.4)) / 2.4));
      g.strokeColor = ink(color, soon ? 235 : 95);
      g.lineWidth = 3;
      g.moveTo(x + r, y);
      g.arc(x, y, r, 0, Math.PI * 2 * q, false);
      g.stroke();
      // Numbered short bars, and a separated source-group dot, stay readable without a text node.
      for (let i = 0; i <= f.index; i++) {
        g.moveTo(x - 6 + 6 * i, y - 5);
        g.lineTo(x - 6 + 6 * i, y + 5);
      }
      g.stroke();
      g.fillColor = ink(color, 190);
      for (let i = 0; i < b.order; i++) {
        g.circle(x - 3 + i * 6, y - r - 6, 2);
        g.fill();
      }
    }
    if (t < f.launch) {
      for (let i = 0; i < 8; i += 2)
        line(
          {
            x: f.from.x + ((f.to.x - f.from.x) * i) / 8,
            y: f.from.y + ((f.to.y - f.from.y) * i) / 8,
          },
          {
            x: f.from.x + ((f.to.x - f.from.x) * (i + 1)) / 8,
            y: f.from.y + ((f.to.y - f.from.y) * (i + 1)) / 8,
          },
          "#a4aba7",
          1,
          65,
        );
    }
  }
  const f = b.legs.find((f) => !f.cancelled && t >= f.launch && t < f.due);
  if (f) {
    const p = leadPosition(f, t),
      x = p.x * 48,
      y = p.y * 48;
    g.strokeColor = ink("#c3c9c3", 170);
    g.lineWidth = 1.8;
    g.ellipse(x, y, 12, 5);
    g.stroke();
    g.fillColor = ink("#252b31");
    g.strokeColor = ink("#ebd6ad");
    g.lineWidth = 2;
    g.circle(x, y + p.z * 48, 11);
    g.fill();
    g.stroke();
    g.fillColor = ink("#afbab3");
    g.circle(x - 3, y + p.z * 48 + 3, 4);
    g.fill();
  } else {
    const done = b.legs.filter((f) => !f.cancelled && f.end <= t).slice(-1)[0],
      next = b.legs.find((f) => !f.cancelled && f.launch > t);
    if (done && next) {
      g.strokeColor = ink("#b7bfba", 160);
      g.lineWidth = 2;
      g.circle(done.to.x * 48, done.to.y * 48, 8);
      g.stroke();
    }
  }
}
