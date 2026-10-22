import type { Graphics } from "cc";
import type { Hazard } from "../../battle/SurvivalTypes";
import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import { tracePosition } from "../../battle/TraceCourtGeometry";
import { ink } from "./Ink";
export function drawTraceMemory(g: Graphics, w: SurvivalWorld) {
  g.strokeColor = ink("#b5a38e", 55);
  g.lineWidth = 1.2;
  const ps = w.trace.history.samples;
  for (let i = 0; i < ps.length; i += 12) {
    const p = ps[i];
    g.moveTo(p.x * 48 - 3, p.y * 48);
    g.lineTo(p.x * 48 + 3, p.y * 48 + 3);
  }
  g.stroke();
  for (const e of w.enemies)
    if (e.kind === "boss" && e.trace?.deadUntil) {
      g.strokeColor = ink("#d5b188", 190);
      g.lineWidth = 3;
      g.circle(e.x * 48, e.y * 48 + 18, 35);
      g.stroke();
      g.moveTo(e.x * 48 - 25, e.y * 48);
      g.lineTo(e.x * 48 - 38, e.y * 48 + 35);
      g.moveTo(e.x * 48 + 25, e.y * 48);
      g.lineTo(e.x * 48 + 38, e.y * 48 + 35);
      g.stroke();
    }
}
export function drawTraceHazard(g: Graphics, h: Hazard, time: number) {
  const b = h.trace!;
  if (b.cancelled) return;
  for (const [index, f] of b.legs.entries()) {
    if (time >= f.end) continue;
    const live = time >= f.due,
      a = f.from,
      z = f.to,
      dx = z.x - a.x,
      dy = z.y - a.y,
      n = Math.hypot(dx, dy) || 1,
      nx = (-dy / n) * b.radius * 48,
      ny = (dx / n) * b.radius * 48;
    g.strokeColor = ink(f.pass === 2 ? "#d5a7ef" : "#f0bc7e", live ? 80 : 190);
    g.lineWidth = live ? 1.5 : 2;
    for (const side of [-1, 1]) {
      g.moveTo(a.x * 48 + nx * side, a.y * 48 + ny * side);
      g.lineTo(z.x * 48 + nx * side, z.y * 48 + ny * side);
    }
    g.stroke();
    for (let j = 0; j <= index; j++) {
      g.moveTo(a.x * 48 - 8 + j * 5, a.y * 48 - 10);
      g.lineTo(a.x * 48 - 8 + j * 5, a.y * 48 - 5);
    }
    g.stroke();
    for (let t = 0.15; t < 1; t += 0.25) {
      const x = (a.x + dx * t) * 48,
        y = (a.y + dy * t) * 48;
      g.moveTo(
        x - (dx / n) * 6 - (dy / n) * 5,
        y - (dy / n) * 6 + (dx / n) * 5,
      );
      g.lineTo(x, y);
      g.lineTo(
        x - (dx / n) * 6 + (dy / n) * 5,
        y - (dy / n) * 6 - (dx / n) * 5,
      );
    }
    g.stroke();
  }
  const f = b.legs.find((f) => time >= f.due && time < f.end);
  if (f) {
    const p = tracePosition(h, time);
    g.fillColor = ink("#f5b56e", 95);
    g.circle(p.x * 48, p.y * 48, b.radius * 48);
    g.fill();
    g.strokeColor = ink("#ffe3b3", 230);
    g.stroke();
  }
  const sweep = b.sweep;
  if (sweep && !sweep.cancelled && time < sweep.end) {
    g.moveTo(sweep.x * 48, sweep.y * 48);
    for (let i = 0; i <= 40; i++) {
      const a = sweep.angle - sweep.half + (2 * sweep.half * i) / 40;
      g.lineTo(
        (sweep.x + Math.cos(a) * sweep.radius) * 48,
        (sweep.y + Math.sin(a) * sweep.radius) * 48,
      );
    }
    g.close();
    g.fillColor = ink("#e9a18f", time < sweep.due ? 26 : 145);
    g.fill();
    g.strokeColor = ink("#ffcdaf", 220);
    g.lineWidth = 2;
    g.stroke();
  }
}
