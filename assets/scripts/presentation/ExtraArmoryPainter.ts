import { Graphics, Color } from "cc";
import type { SurvivalWorld } from "../battle/SurvivalWorld";
import { COLORS } from "../battle/SurvivalConfig";
const color = (hex: string, alpha = 255) => {
  const c = new Color().fromHEX(hex);
  c.a = alpha;
  return c;
};
/** Ground telegraphs are drawn below actors; enemy warnings remain above every weapon. */
export function drawExtraArmory(
  g: Graphics,
  w: SurvivalWorld,
  ground: boolean,
  reduced: boolean,
) {
  for (const a of w.armory.extra.attacks) {
    if (!a.active || a.age < 0) continue;
    const x = a.x * 48,
      y = a.y * 48,
      r = a.stats.radius * 48,
      m = a.stats.mods,
      has = (id: string) => m.includes(id);
    g.strokeColor = color(COLORS[a.skill], 210);
    g.fillColor = color(COLORS[a.skill], 35);
    g.lineWidth = 2;
    if (ground) {
      if (a.skill === "frost") {
        const edge = has("outward") ? r * Math.min(1, a.age / 0.6) : r;
        if (has("sectors")) {
          const phase = Math.min(2, Math.floor(a.age / 0.22)),
            angle = a.angle + (phase * Math.PI * 2) / 3;
          g.moveTo(x, y);
          g.arc(x, y, r, angle - Math.PI / 3, angle + Math.PI / 3, false);
          g.close();
          g.fill();
          g.stroke();
        } else {
          g.circle(x, y, edge);
          g.stroke();
          g.circle(x, y, Math.max(2, edge - 8));
          g.stroke();
        }
        const n = reduced ? 6 : 12;
        for (let i = 0; i < n; i++) {
          const angle = (i * Math.PI * 2) / n;
          g.moveTo(
            x + Math.cos(angle) * (edge - 7),
            y + Math.sin(angle) * (edge - 7),
          );
          g.lineTo(
            x + Math.cos(angle) * (edge + 7),
            y + Math.sin(angle) * (edge + 7),
          );
        }
        g.stroke();
        if (has("aftershock") && a.phase === 1) {
          g.strokeColor = color("#e1f9ff", 110);
          g.circle(x, y, r * Math.min(1, (a.age - 0.66) / 0.14));
          g.stroke();
        }
      } else if (a.skill === "mine") {
        const armed = a.age >= (has("burrow") ? 1.2 : 0.6);
        g.fillColor = color(COLORS.mine, armed ? 150 : 45);
        g.moveTo(x, y + 12);
        g.lineTo(x + 12, y);
        g.lineTo(x, y - 12);
        g.lineTo(x - 12, y);
        g.close();
        g.fill();
        g.stroke();
        g.circle(
          x,
          y,
          (((has("burrow") ? 0.6 : 0.8) * a.stats.radius) / 1.8) * 48,
        );
        g.stroke();
        if (has("trip")) {
          const b = w.armory.extra.attacks.find(
            (b) =>
              b !== a &&
              b.active &&
              b.group === a.group &&
              b.phase === 0 &&
              b.index === (a.index + 1) % a.stats.count,
          );
          if (b) {
            g.strokeColor = color("#f4d798", armed ? 180 : 65);
            g.moveTo(x, y);
            g.lineTo(b.x * 48, b.y * 48);
            g.stroke();
          }
        }
        if (a.phase === 2 && has("fuse")) {
          g.circle(x, y, r);
          g.stroke();
          g.circle(x, y, r * Math.max(0, 1 - (a.next - a.age) / 0.6));
          g.stroke();
        }
      } else if (a.skill === "void") {
        const final = a.phase === 1,
          outer = final && has("repel") ? r * 1.6 : r;
        g.fillColor = color("#7853b7", final ? 80 : 45);
        g.circle(x, y, outer);
        g.fill();
        g.stroke();
        if (final) {
          g.lineWidth = 4;
          g.circle(x, y, has("repel") ? outer * 0.55 : outer * 0.6);
          g.stroke();
        } else {
          for (let i = 0; i < (reduced ? 2 : 3); i++) {
            const theta = w.time * 2 + i * 2.1;
            g.arc(
              x,
              y,
              r * (0.35 + i * 0.2),
              theta,
              theta + Math.PI * 1.4,
              false,
            );
            g.stroke();
          }
          g.fillColor = color("#20182d");
          g.circle(x, y, 13);
          g.fill();
          g.stroke();
        }
      } else if (a.skill === "holy") {
        const falling = a.phase === 0 || (a.phase === 1 && has("brand")),
          q = falling
            ? Math.max(
                0,
                1 -
                  (a.next - a.age) /
                    (a.phase === 0 ? (has("execution") ? 0.8 : 0.55) : 0.7),
              )
            : 1;
        g.fillColor = color(COLORS.holy, falling ? 20 : 85);
        if (has("cross")) {
          const half = r * 0.28;
          g.rect(x - r * 2, y - half, r * 4, half * 2);
          g.rect(x - half, y - r * 2, half * 2, r * 4);
          g.fill();
          g.stroke();
        } else {
          g.circle(x, y, r);
          g.fill();
          g.stroke();
        }
        g.circle(x, y, Math.max(2, r * q));
        g.stroke();
      } else if (a.skill === "bone" && a.phase === 1) {
        g.lineWidth = 5;
        g.moveTo(a.start.x * 48, a.start.y * 48);
        g.lineTo(a.end!.x * 48, a.end!.y * 48);
        g.stroke();
        for (let i = 0; i < 5; i++) {
          const t = i / 4,
            cx = (a.start.x + (a.end!.x - a.start.x) * t) * 48,
            cy = (a.start.y + (a.end!.y - a.start.y) * t) * 48;
          g.moveTo(cx - 4, cy);
          g.lineTo(cx, cy + 15);
          g.lineTo(cx + 4, cy);
          g.close();
          g.fillColor = color(COLORS.bone, 220);
          g.fill();
        }
      }
      continue;
    }
    g.fillColor = color(COLORS[a.skill], 245);
    if (a.skill === "ghost") {
      g.strokeColor = color(a.phase === 2 ? "#e1fff0" : COLORS.ghost, 220);
      g.lineWidth = 3;
      g.moveTo(x - 8, y + 4);
      g.quadraticCurveTo(x - 12, y + 23, x, y + 27);
      g.quadraticCurveTo(x + 12, y + 23, x + 8, y + 4);
      g.lineTo(x + 4, y + 8);
      g.lineTo(x, y + 2);
      g.lineTo(x - 4, y + 8);
      g.close();
      g.fill();
      g.stroke();
      g.fillColor = color("#21394a");
      g.circle(x - 3, y + 18, 2);
      g.circle(x + 3, y + 18, 2);
      g.fill();
      g.strokeColor = color("#acffdc", 120);
      g.moveTo(x, y);
      g.lineTo(x - Math.cos(a.angle) * 24, y - Math.sin(a.angle) * 24);
      g.stroke();
      if (has("execution")) {
        g.strokeColor = color("#ffe9ab");
        g.circle(x, y + 16, 16);
        g.stroke();
      }
      if (has("haunt") && a.phase === 1) {
        g.arc(
          a.start.x * 48,
          a.start.y * 48,
          29,
          w.time * 8,
          w.time * 8 + 4,
          false,
        );
        g.stroke();
      }
    } else if (a.skill === "bone" && a.phase === 0) {
      const dx = Math.cos(a.angle),
        dy = Math.sin(a.angle),
        length = has("lance") ? 38 : 26;
      g.lineWidth = has("lance") ? 6 : 4;
      g.moveTo(x - dx * length, y - dy * length);
      g.lineTo(x + dx * length * 0.4, y + dy * length * 0.4);
      g.stroke();
      g.moveTo(x + dx * length, y + dy * length);
      g.lineTo(x + dy * 6, y - dx * 6);
      g.lineTo(x - dy * 6, y + dx * 6);
      g.close();
      g.fill();
      if (has("marrow")) {
        g.strokeColor = color("#ffa88e", 180);
        g.moveTo(x - dx * length * 2, y - dy * length * 2);
        g.lineTo(x, y);
        g.stroke();
      }
    } else if (a.skill === "lightning") {
      const n = Math.max(1, a.index),
        storm = has("storm");
      for (let i = 0; i < Math.min(n, a.points.length); i++) {
        const p = a.points[i],
          px = p.x * 48,
          py = p.y * 48;
        g.strokeColor = color(COLORS.lightning, 220);
        g.lineWidth = 3;
        g.moveTo(px, py + 95);
        g.lineTo(px - 9, py + 57);
        g.lineTo(px + 6, py + 49);
        g.lineTo(px, py);
        g.stroke();
        g.circle(px, py, storm ? r : 9);
        g.stroke();
        if ((i > 0 && !storm) || (has("bridge") && i > 0)) {
          const prev = a.points[i - 1],
            sx = prev.x * 48,
            sy = prev.y * 48;
          g.moveTo(sx, sy);
          g.lineTo((sx + px) / 2 + 8, (sy + py) / 2 - 7);
          g.lineTo(px, py);
          g.stroke();
        }
      }
      if (has("echo") && a.phase === 1)
        for (const p of a.points) {
          g.circle(p.x * 48, p.y * 48, 7 + 8 * Math.sin(w.time * 12));
          g.stroke();
        }
    } else if (a.skill === "holy") {
      const waiting = a.phase === 0 || (a.phase === 1 && has("brand")),
        delay = a.phase === 0 ? (has("execution") ? 0.8 : 0.55) : 0.7,
        remain = waiting ? Math.max(0, a.next - a.age) : 0,
        height = waiting ? Math.min(125, (remain / delay) * 160) : 0,
        sy = y + height + 12,
        size = has("execution") ? 45 : 30;
      g.lineWidth = has("execution") ? 7 : 4;
      g.moveTo(x, sy + size);
      g.lineTo(x, sy);
      g.lineTo(x - 7, sy + 12);
      g.moveTo(x, sy);
      g.lineTo(x + 7, sy + 12);
      g.moveTo(x - 12, sy + size - 7);
      g.lineTo(x + 12, sy + size - 7);
      g.stroke();
      if (!waiting) {
        g.strokeColor = color("#fff9db", 220);
        g.lineWidth = 5;
        g.moveTo(x, y + 80);
        g.lineTo(x, y);
        g.stroke();
      }
    }
  }
}
