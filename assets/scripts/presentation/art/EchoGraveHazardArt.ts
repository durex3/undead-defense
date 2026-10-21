import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import type { Hazard } from "../../battle/SurvivalTypes";
import type { GravePulse } from "../../battle/EchoGraveGeometry";
import { ink } from "./Ink";
function outline(g: Graphics, f: GravePulse) {
  g.moveTo(f.x * 48, f.y * 48);
  for (let i = 0; i <= 40; i++) {
    const a = f.angle - f.half + (2 * f.half * i) / 40;
    g.lineTo(
      (f.x + Math.cos(a) * f.radius) * 48,
      (f.y + Math.sin(a) * f.radius) * 48,
    );
  }
  g.close();
}
export function drawGraveHazard(g: Graphics, h: Hazard, t: number) {
  const b = h.grave!;
  for (const [i, f] of b.pulses.entries()) {
    if (f.cancelled || t >= f.end) continue;
    const start = Math.max(h.created, f.due - 2.4);
    if (t < start) continue;
    const live = t >= f.due,
      color = f.old ? "#be9fe5" : "#eee0b5";
    g.fillColor = ink(color, live ? 165 : 18);
    g.strokeColor = ink(color, live ? 255 : 200);
    g.lineWidth = live ? 4 : 2;
    outline(g, f);
    g.fill();
    g.stroke();
    const progress = Math.max(0, Math.min(1, (t - start) / (f.due - start))),
      a = f.angle,
      x = f.x * 48,
      y = f.y * 48;
    g.strokeColor = ink(color, 130);
    g.lineWidth = 2;
    g.moveTo(x, y);
    g.lineTo(
      x + Math.cos(a) * f.radius * 48 * progress,
      y + Math.sin(a) * f.radius * 48 * progress,
    );
    g.stroke();
    // Old site: split coffin. Body: single filled knot. Tick marks encode segment and slot without colour alone.
    if (f.old) {
      g.moveTo(x - 8, y - 8);
      g.lineTo(x - 11, y + 7);
      g.lineTo(x - 2, y + 11);
      g.moveTo(x + 8, y - 8);
      g.lineTo(x + 11, y + 7);
      g.lineTo(x + 2, y + 11);
      g.stroke();
    } else {
      g.fillColor = ink(color);
      g.circle(x, y, 4);
      g.fill();
    }
    for (let j = 0; j <= i; j++) {
      g.moveTo(x - 8 + j * 6, y - 15);
      g.lineTo(x - 8 + j * 6, y - 10);
      g.stroke();
    }
  }
}
export function drawGraveMemory(g: Graphics, w: SurvivalWorld) {
  for (const e of w.enemies) {
    const s = e.grave;
    if (s?.scar && s.scarUntil! > w.time && !s.items?.length && e.hp > 0) {
      g.strokeColor = ink("#aaa2ab", 85);
      g.lineWidth = 1;
      outline(g, s.scar);
      g.stroke();
    }
    if (s?.deadUntil) {
      const x = e.x * 48,
        y = e.y * 48,
        progress = Math.max(
          0,
          Math.min(1, (w.time - (s.reviveAt ?? w.time)) / 2.4),
        );
      g.strokeColor = ink("#b49ad5", 220);
      g.lineWidth = 3;
      for (const side of [-1, 1]) {
        g.moveTo(x + side * (9 + progress * 36), y - 20);
        g.lineTo(x + side * (14 + progress * 36), y + 24);
        g.lineTo(x + side * (4 + progress * 36), y + 39);
        g.stroke();
      }
      g.fillColor = ink("#bbebd4", 150 + progress * 105);
      g.circle(x, y + 15, 5 + progress * 9);
      g.fill();
    }
  }
}
