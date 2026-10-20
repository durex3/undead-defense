import type { Graphics } from "cc";
import type { Hazard } from "../../battle/SurvivalTypes";
import { bellCovered, bellMap } from "../../battle/BellMap";
import { ink } from "./Ink";
export function drawBellHazard(g: Graphics, h: Hazard, t: number) {
  if (!h.bell || t > h.until) return;
  const b = h.bell,
    warning = t < h.due,
    x = h.x * 48,
    y = h.y * 48;
  g.strokeColor = ink("#17191e", 240);
  g.lineWidth = 7;
  const path = () => {
    if (b.shape === "wax") {
      const r = h.radius * 48;
      for (let i = 0; i < 24; i++) {
        if (warning && i % 3 === 2) continue;
        const a = (i * Math.PI) / 12,
          c = ((i + 1) * Math.PI) / 12;
        g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        g.lineTo(x + Math.cos(c) * r, y + Math.sin(c) * r);
      }
    } else if (b.shape === "dash") {
      const nx = -Math.sin(h.angle) * h.width * 48,
        ny = Math.cos(h.angle) * h.width * 48;
      for (const side of [-1, 1]) {
        g.moveTo(b.from.x * 48 + nx * side, b.from.y * 48 + ny * side);
        g.lineTo(b.to.x * 48 + nx * side, b.to.y * 48 + ny * side);
      }
    } else {
      const r = warning
          ? h.radius
          : Math.min(h.radius, Math.max(0, t - h.due) * b.speed),
        width = h.widthAngle!;
      for (let i = 0; i < 48; i++) {
        if (warning && i % 3 === 2) continue;
        const a = h.angle - width / 2 + (width * i) / 48,
          c = h.angle - width / 2 + (width * (i + 1)) / 48,
          p = {
            x: h.x + Math.cos((a + c) / 2) * r,
            y: h.y + Math.sin((a + c) / 2) * r,
          };
        if (bellCovered(h, p, 0.3)) continue;
        g.moveTo(x + Math.cos(a) * r * 48, y + Math.sin(a) * r * 48);
        g.lineTo(x + Math.cos(c) * r * 48, y + Math.sin(c) * r * 48);
      }
      if (warning)
        for (const a of [h.angle - width / 2, h.angle + width / 2]) {
          let d = 0;
          for (; d < h.radius; d += 0.1)
            if (
              bellMap.blocked(
                { x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d },
                0,
              )
            )
              break;
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(a) * d * 48, y + Math.sin(a) * d * 48);
        }
    }
  };
  path();
  g.stroke();
  g.strokeColor = ink(warning ? "#ff9a69" : "#ffcf9d");
  g.lineWidth = warning ? 2.5 : 4;
  path();
  g.stroke();
  if (b.shape === "wax") {
    g.fillColor = ink("#e1bf89", warning ? 25 : 100);
    g.circle(x, y, h.radius * 48);
    g.fill();
  }
  // Sequence ticks remain visible even when reduced decoration is enabled.
  g.strokeColor = ink("#ffe6bc");
  g.lineWidth = 3;
  for (let i = 0; i < b.order; i++) {
    g.moveTo(x - 4 + i * 8, y + 12);
    g.lineTo(x - 4 + i * 8, y + 23);
  }
  g.stroke();
}
