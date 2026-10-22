import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import type { Hazard } from "../../battle/SurvivalTypes";
import { gateBody, gateHeads } from "../../battle/TwingateGeometry";
import { ink } from "./Ink";
export function drawTwingateHazard(g: Graphics, h: Hazard, t: number) {
  const b = h.twin!,
    color = b.role === "hunter" ? "#ebc38d" : "#acd6de";
  for (const f of b.parts) {
    if (f.cancelled || t >= Math.min(f.end, f.cutAt ?? Infinity)) continue;
    const live = t >= f.due;
    g.strokeColor = ink(color, live ? 120 : 210);
    g.lineWidth = 2;
    if (f.kind === "sweep") {
      g.moveTo(f.x * 48, f.y * 48);
      for (let i = 0; i <= 40; i++) {
        const a = f.angle - f.half + (i * f.half) / 20;
        g.lineTo(
          (f.x + Math.cos(a) * f.length) * 48,
          (f.y + Math.sin(a) * f.length) * 48,
        );
      }
      g.close();
      g.fillColor = ink(color, live ? 150 : 25);
      g.fill();
      g.stroke();
    } else if (!live) {
      for (const turn of f.kind === "split"
        ? [(-28 * Math.PI) / 180, (28 * Math.PI) / 180]
        : [0]) {
        const a = f.angle + turn,
          nx = -Math.sin(a) * f.radius * 48,
          ny = Math.cos(a) * f.radius * 48,
          z = {
            x: f.x + Math.cos(a) * f.length,
            y: f.y + Math.sin(a) * f.length,
          };
        for (const side of [-1, 1]) {
          g.moveTo(f.x * 48 + nx * side, f.y * 48 + ny * side);
          g.lineTo(z.x * 48 + nx * side, z.y * 48 + ny * side);
        }
        g.stroke();
        for (const k of [0.3, 0.6, 0.9]) {
          const x = (f.x + Math.cos(a) * f.length * k) * 48,
            y = (f.y + Math.sin(a) * f.length * k) * 48;
          g.moveTo(
            x - Math.cos(a) * 6 - Math.sin(a) * 4,
            y - Math.sin(a) * 6 + Math.cos(a) * 4,
          );
          g.lineTo(x, y);
          g.lineTo(
            x - Math.cos(a) * 6 + Math.sin(a) * 4,
            y - Math.sin(a) * 6 - Math.cos(a) * 4,
          );
        }
        g.stroke();
      }
    } else {
      const ps = f.kind === "charge" ? [gateBody(h, t)] : gateHeads(f, t);
      for (const p of ps) {
        g.fillColor = ink(color, 180);
        g.circle(p.x * 48, p.y * 48, f.radius * 48);
        g.fill();
        g.strokeColor = ink("#fff1cc");
        g.stroke();
      }
    }
    if (!live) {
      const q = Math.max(0, Math.min(1, (t - f.locked) / (f.due - f.locked)));
      g.strokeColor = ink(color, 230);
      g.lineWidth = 2;
      g.arc(
        f.x * 48,
        f.y * 48 + 25,
        14,
        -Math.PI / 2,
        -Math.PI / 2 + q * Math.PI * 2,
        false,
      );
      g.stroke();
    }
  }
  if (b.pendingAt !== undefined || b.follow) {
    g.strokeColor = ink(color, 180);
    g.lineWidth = 2;
    for (const side of [-1, 1]) {
      g.moveTo(h.x * 48 + side * 5, h.y * 48 + 42);
      g.lineTo(h.x * 48 + side * 5, h.y * 48 + 52);
    }
    g.stroke();
  }
}
export function drawTwingateInheritance(g: Graphics, w: SurvivalWorld) {
  if (!w.twingate.encounter.solo || w.time >= w.twingate.encounter.soloAt)
    return;
  for (const e of w.twingate.encounter.alive) {
    g.strokeColor = ink("#d4c39a", 200);
    g.lineWidth = 3;
    for (const side of [-1, 1]) {
      g.moveTo(e.x * 48 + side * 20, e.y * 48 + 12);
      g.lineTo(e.x * 48 + side * 35, e.y * 48 + 40);
      g.lineTo(e.x * 48 + side * 20, e.y * 48 + 65);
    }
    g.stroke();
  }
}
