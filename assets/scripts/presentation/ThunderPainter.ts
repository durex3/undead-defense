import { Graphics } from "cc";
import { warningGlyph } from "./art/VfxBrush";
import { THUNDER_BASES } from "../battle/ThunderMap";
import type { SurvivalWorld } from "../battle/SurvivalWorld";
import type { Hazard } from "../battle/SurvivalTypes";
import { ink } from "./StagePalette";
export function drawThunderMap(g: Graphics) {
  g.clear();
  g.fillColor = ink("#18272d");
  g.rect(-1152, -1344, 2304, 2688);
  g.fill();
  for (let y = -27; y < 28; y++)
    for (let x = -23; x < 24; x++) {
      g.fillColor = ink((x + y) % 3 ? "#263a40" : "#2c4147");
      g.rect(x * 48 + 2, y * 48 + 2, 44, 44);
      g.fill();
    }
  g.strokeColor = ink("#577579", 130);
  g.lineWidth = 4;
  for (const offset of [-34, 34]) {
    g.moveTo(-1056, offset);
    g.lineTo(1056, offset);
    g.moveTo(offset, -1248);
    g.lineTo(offset, 1248);
  }
  g.stroke();
  g.strokeColor = ink("#456369", 140);
  g.lineWidth = 2;
  for (const r of [5, 17]) {
    g.circle(0, 0, r * 48);
    g.stroke();
  }
  for (const p of THUNDER_BASES) {
    const x = (p.x - p.halfWidth) * 48,
      y = (p.y - p.halfHeight) * 48,
      ww = p.halfWidth * 96,
      hh = p.halfHeight * 96;
    g.fillColor = ink("#101e27");
    g.rect(x - 5, y - 6, ww + 10, hh + 12);
    g.fill();
    g.fillColor = ink("#657774");
    g.rect(x, y, ww, hh);
    g.fill();
    g.strokeColor = ink("#c3c69b");
    g.lineWidth = 3;
    g.rect(x + 7, y + 7, ww - 14, hh - 14);
    g.stroke();
    for (let i = 0; i < 4; i++) {
      g.fillColor = ink("#334c54");
      g.rect(x + 18, y + 20 + i * 44, ww - 36, 22);
      g.fill();
      g.fillColor = ink("#9ba799");
      g.rect(x + 22, y + 24 + i * 44, ww - 44, 5);
      g.fill();
    }
  }
}
function digit(g: Graphics, n: number, x: number, y: number) {
  const segments = [
      [0, 10, 7, 10],
      [7, 10, 7, 5],
      [7, 5, 7, 0],
      [0, 0, 7, 0],
      [0, 5, 0, 0],
      [0, 10, 0, 5],
      [0, 5, 7, 5],
    ],
    mask = [0, 6, 91, 79][n] ?? 6;
  g.lineWidth = 2;
  for (let i = 0; i < 7; i++)
    if (mask & (1 << i)) {
      const s = segments[i];
      g.moveTo(x + s[0], y + s[1]);
      g.lineTo(x + s[2], y + s[3]);
    }
  g.stroke();
}
export function drawThunderHazard(
  g: Graphics,
  h: Hazard,
  time: number,
  preview = false,
) {
  const t = h.thunder;
  if (!t || h.until <= time) return;
  const active = time >= h.due && !preview,
    c = Math.cos(h.angle),
    s = Math.sin(h.angle),
    x = h.x * 48,
    y = h.y * 48;
  const contact = active ? Math.max(0, 1 - (time - h.due) / .16) : 0;
  g.strokeColor = ink(active ? contact > 0 ? "#fff2d1" : "#ffe0a8" : "#ffac7a", preview ? 100 : 245);
  g.fillColor = ink("#ed674a", active ? 100 + Math.round(contact * 45) : preview ? 10 : 55);
  g.lineWidth = active ? 4 + contact * 2 : 4;
  const at = (u: number, v: number) => ({
    x: x + (u * c - v * s) * 48,
    y: y + (u * s + v * c) * 48,
  });
  const stroke = (
    u: number,
    v: number,
    uu: number,
    vv: number,
    dashed = false,
  ) => {
    const a = at(u, v),
      b = at(uu, vv),
      length = Math.hypot(b.x - a.x, b.y - a.y),
      count = dashed ? Math.ceil(length / 14) : 1;
    for (let i = 0; i < count; i++) {
      const lo = i / count,
        hi = dashed ? Math.min(1, (i + 0.6) / count) : 1;
      g.moveTo(a.x + (b.x - a.x) * lo, a.y + (b.y - a.y) * lo);
      g.lineTo(a.x + (b.x - a.x) * hi, a.y + (b.y - a.y) * hi);
    }
    g.stroke();
  };
  const box = (u: number, v: number, ww: number, hh: number) => {
    const p = [at(u, v), at(u + ww, v), at(u + ww, v + hh), at(u, v + hh)];
    g.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < 4; i++) g.lineTo(p[i].x, p[i].y);
    g.close();
    g.fill();
  };
  if (t.shape === "wall") {
    const front = active
        ? Math.min(t.travel ?? 6, (time - h.due) * (t.speed ?? 2.8))
        : 0,
      gap = t.gap ?? 0;
    for (const [lo, hi] of [
      [-h.radius / 2, gap - 1.8],
      [gap + 1.8, h.radius / 2],
    ]) {
      box(front - h.width / 2, lo, h.width, hi - lo);
      stroke(front, lo, front, hi, !active);
      if (!active) {
        stroke(0, lo, t.travel ?? 6, lo, true);
        stroke(0, hi, t.travel ?? 6, hi, true);
      }
    }
    // Gap stays blank; caps and a central travel arrow remain visible in reduced mode.
    for (const edge of [gap - 1.8, gap + 1.8])
      stroke(front - 0.3, edge, front + 0.3, edge);
    stroke(front, gap, front + 0.8, gap);
    stroke(front + 0.8, gap, front + 0.5, gap - 0.22);
    stroke(front + 0.8, gap, front + 0.5, gap + 0.22);
  } else if (t.shape === "line") {
    box(-h.radius / 2, -h.width, h.radius, h.width * 2);
    for (const edge of [-h.width, h.width])
      stroke(-h.radius / 2, edge, h.radius / 2, edge, !active);
    for (const end of [-h.radius / 2, h.radius / 2]) {
      const p = at(end, 0);
      g.circle(p.x, p.y, 6);
      g.stroke();
    }
  } else if (t.shape === "sector") {
    g.moveTo(x, y);
    // Cocos arc() starts a new subpath and its clockwise flag follows
    // engine coordinates. Build the full damaging fan explicitly instead.
    for (let i = 0; i <= 32; i++) {
      const a = h.angle - h.width / 2 + h.width * i / 32;
      g.lineTo(x + Math.cos(a) * h.radius * 48, y + Math.sin(a) * h.radius * 48);
    }
    g.close();
    g.fill();
    g.stroke();
  } else {
    g.circle(x, y, h.radius * 48);
    g.fill();
    g.stroke();
    if (!active) {
      const u = Math.max(
        0,
        Math.min(1, (time - h.created) / (h.due - h.created)),
      );
      for (let i = 0; i <= 32; i++) {
        const a = u * Math.PI * 2 * i / 32, r = h.radius * 48 - 5;
        if (i === 0) g.moveTo(x + r, y);
        else g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.stroke();
    }
  }
  if (t.launch !== undefined && time >= t.launch && time < h.due - 0.45) {
    const ownerX = h.endX ?? h.x,
      ownerY = h.endY ?? h.y,
      u = Math.max(
        0,
        Math.min(1, (time - t.launch) / (h.due - 0.45 - t.launch)),
      );
    g.fillColor = ink("#ffe5a6");
    g.circle(
      (ownerX + (h.x - ownerX) * u) * 48,
      (ownerY + (h.y - ownerY) * u) * 48 + Math.sin(u * Math.PI) * 45,
      6,
    );
    g.fill();
  }
  if (!active) {
    const p = at(0, 0);
    digit(g, t.order ?? 1, p.x + 9, p.y + 9);
    g.circle(p.x, p.y, 4);
    g.stroke();
  }
  warningGlyph(g, x, y, t.shape === "wall" ? "wall" : t.shape === "line" ? "line" : t.shape === "sector" ? "sector" : "landing", active ? "#fff0ce" : "#ffb38c", active);
}
/** Future route previews are informational only and have no damage/collision. */
export function drawThunderPreviews(g: Graphics, w: SurvivalWorld) {
  for (const e of w.enemies) {
    const t = e.thunder;
    if (!t || e.hp <= 0) continue;
    if (t.action === "walls" && t.step === 0 && t.points.length > 1) {
      const p = t.points[0],
        v = t.points[1];
      drawThunderHazard(
        g,
        {
          id: 0,
          source: e.id,
          kind: "line",
          ...p,
          angle: v.y,
          radius: 12,
          width: 0.6,
          created: w.time,
          due: t.next + 1.35,
          until: t.next + 4,
          damage: 0,
          fired: false,
          next: 0,
          thunder: {
            shape: "wall",
            devices: [],
            gap: v.x,
            travel: 6,
            speed: 2.8,
            order: 2,
          },
        },
        w.time,
        true,
      );
    }
    if (t.action === "saw" && (e.state === "windup" || e.state === "charge")) {
      g.strokeColor = ink("#ffae7e", 125);
      g.lineWidth = 2;
      g.moveTo(t.points[0].x * 48, t.points[0].y * 48);
      g.lineTo(t.points[2].x * 48, t.points[2].y * 48);
      g.stroke();
      for (let i = t.step; i < 3; i++) {
        const p = t.points[i];
        g.moveTo(p.x * 48, p.y * 48);
        g.lineTo(
          (p.x + Math.cos(t.angle) * 3.2) * 48,
          (p.y + Math.sin(t.angle) * 3.2) * 48,
        );
        g.stroke();
        digit(g, i + 1, p.x * 48 + 5, p.y * 48 + 5);
      }
    }
  }
}
