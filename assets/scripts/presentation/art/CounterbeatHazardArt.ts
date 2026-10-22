import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import type { Hazard } from "../../battle/SurvivalTypes";
import {
  counterEnd,
  type CounterPulse,
} from "../../battle/CounterbeatGeometry";
import { ink } from "./Ink";
function outline(g: Graphics, f: CounterPulse) {
  if (f.shape === "sweep") {
    g.moveTo(f.x * 48, f.y * 48);
    for (let i = 0; i <= 40; i++) {
      const a = f.angle - f.half + (i * 2 * f.half) / 40;
      g.lineTo(
        (f.x + Math.cos(a) * f.radius) * 48,
        (f.y + Math.sin(a) * f.radius) * 48,
      );
    }
    g.close();
    return;
  }
  const z = counterEnd(f),
    nx = -Math.sin(f.angle) * f.width * 48,
    ny = Math.cos(f.angle) * f.width * 48;
  g.moveTo(f.x * 48 + nx, f.y * 48 + ny);
  g.lineTo(z.x * 48 + nx, z.y * 48 + ny);
  for (let i = 0; i <= 16; i++) {
    const a = f.angle + Math.PI / 2 - (i * Math.PI) / 16;
    g.lineTo(
      z.x * 48 + Math.cos(a) * f.width * 48,
      z.y * 48 + Math.sin(a) * f.width * 48,
    );
  }
  g.lineTo(f.x * 48 - nx, f.y * 48 - ny);
  for (let i = 0; i <= 16; i++) {
    const a = f.angle - Math.PI / 2 - (i * Math.PI) / 16;
    g.lineTo(
      f.x * 48 + Math.cos(a) * f.width * 48,
      f.y * 48 + Math.sin(a) * f.width * 48,
    );
  }
  g.close();
}
export function drawCounterbeatHazard(g: Graphics, h: Hazard, time: number) {
  const b = h.counter!;
  for (const f of b.pulses) {
    if (f.cancelled || time >= f.end) continue;
    const live = time >= f.due,
      color = f.order === 1 ? "#f3ca82" : "#afd9f4";
    g.fillColor = ink(color, live ? 150 : 25);
    g.strokeColor = ink(color, live ? 255 : 215);
    g.lineWidth = live ? 3 : 2;
    outline(g, f);
    g.fill();
    g.stroke();
    const dx = Math.cos(f.angle),
      dy = Math.sin(f.angle);
    g.strokeColor = ink(color, 225);
    g.lineWidth = 2;
    for (let i = 0; i < f.order; i++) {
      const x = (f.x + dx * 0.7) * 48 - dy * i * 7,
        y = (f.y + dy * 0.7) * 48 + dx * i * 7;
      g.moveTo(x - dy * 4, y + dx * 4);
      g.lineTo(x + dy * 4, y - dx * 4);
    }
    g.stroke();
    const q = Math.max(
      0,
      Math.min(
        1,
        1 - (f.due - time) / (f.order === 1 ? f.due - h.created : 2.4),
      ),
    );
    g.arc(
      f.x * 48,
      f.y * 48 + 28,
      13 + (f.order - 1) * 6,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * q,
      false,
    );
    g.stroke();
  }
  if (b.pendingAt !== undefined) {
    g.strokeColor = ink("#afd9f4", 180);
    g.lineWidth = 2;
    for (const x of [-5, 5]) {
      g.moveTo(h.x * 48 + x, h.y * 48 + 45);
      g.lineTo(h.x * 48 + x, h.y * 48 + 55);
    }
    g.stroke();
  }
}
export function drawCounterbeatSupport(g: Graphics, w: SurvivalWorld) {
  for (const e of w.enemies)
    if (
      e.hp > 0 &&
      e.kind === "resonancebearer" &&
      e.state !== "arriving" &&
      !e.counter?.retireUntil
    ) {
      g.strokeColor = ink("#8de1d1", 100);
      g.lineWidth = 2;
      g.circle(e.x * 48, e.y * 48, 4 * 48);
      g.stroke();
      for (const o of w.enemies)
        if (
          o.hp > 0 &&
          w.counter.buffed(o) &&
          Math.hypot(o.x - e.x, o.y - e.y) <= 4
        ) {
          g.strokeColor = ink("#9ce9d5", 185);
          g.moveTo(e.x * 48, e.y * 48 + 25);
          g.lineTo(o.x * 48, o.y * 48 + 15);
          g.stroke();
          g.strokeColor = ink("#c5f6da", 230);
          g.circle(o.x * 48, o.y * 48 + 14, 13);
          g.stroke();
          g.strokeColor = ink("#8de1d1", 100);
        }
    }
}
