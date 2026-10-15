import { Graphics, Color } from "cc";
import { THUNDER_BASES } from "../battle/ThunderMap";
import { thunderDevice } from "../battle/ThunderSystem";
import type { SurvivalWorld } from "../battle/SurvivalWorld";
import type { Enemy, Hazard } from "../battle/SurvivalTypes";
const colors = new Map<string, Color>();
function ink(hex: string, a = 255) {
  const key = hex + ":" + a;
  let c = colors.get(key);
  if (!c) {
    c = new Color().fromHEX(hex);
    c.a = a;
    colors.set(key, c);
  }
  return c;
}
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
export function drawThunderEnemy(g: Graphics, w: SurvivalWorld, e: Enemy) {
  const x = e.x * 48,
    y = e.y * 48,
    device = thunderDevice(e.kind),
    boss = e.kind === "boss",
    elite = e.kind === "gridwarden" || e.kind === "railreaper",
    scale = boss ? 1.65 : elite ? 1.3 : 1;
  const a = e.state === "arriving" ? 140 : 255,
    metal =
      e.freezeUntil > w.time
        ? "#9ad9f3"
        : (e.state === "recover" && elite) || (e.state === "recover" && boss)
          ? "#e0c888"
          : "#91acae",
    pulse = e.state === "windup" ? "#ffb271" : "#b4eee5";
  const rect = (u: number, v: number, ww: number, hh: number, c: string) => {
    g.fillColor = ink(c, a);
    g.rect(x + u * scale, y + v * scale, ww * scale, hh * scale);
    g.fill();
  };
  const circle = (u: number, v: number, r: number, c: string) => {
    g.fillColor = ink(c, a);
    g.circle(x + u * scale, y + v * scale, r * scale);
    g.fill();
  };
  const line = (
    u: number,
    v: number,
    uu: number,
    vv: number,
    c: string,
    width = 4,
  ) => {
    g.strokeColor = ink(c, a);
    g.lineWidth = width * scale;
    g.moveTo(x + u * scale, y + v * scale);
    g.lineTo(x + uu * scale, y + vv * scale);
    g.stroke();
  };
  const stride = e.state === "seek" ? Math.sin(w.time * 12 + e.id) * 4 : 0;
  if (device) {
    rect(-12, 0, 24, 8, "#101f29");
    rect(-7, 8, 14, 25, "#d0b17c");
    rect(-12, 21, 24, 7, metal);
    circle(0, 36, 7, pulse);
    if (e.kind === "thunderanchor") {
      line(-16, 4, 0, 17, metal);
      line(16, 4, 0, 17, metal);
    } else {
      line(-13, 33, -13, 46, metal);
      line(13, 33, 13, 46, metal);
      line(-13, 46, 13, 46, metal);
    }
    g.fillColor = ink("#10212a");
    g.rect(x - 18, y + 56, 36, 5);
    g.fill();
    g.fillColor = ink("#f6ca7d");
    g.rect(x - 18, y + 56, 36 * Math.max(0, e.hp / e.maxHp), 5);
    g.fill();
    const remain = Math.max(
      0,
      Math.ceil((e.thunder?.expires ?? w.time) - w.time),
    );
    for (let i = 0; i < Math.min(8, remain); i++) {
      g.fillColor = ink("#c8d6cf", 190);
      g.rect(x - 17 + i * 5, y + 65, 3, 3);
      g.fill();
    }
    return;
  }
  if (boss) {
    // Four articulated arms and broad electric wings, visibly unlike previous bosses.
    for (const side of [-1, 1])
      for (const row of [0, 1]) {
        const spread = e.state === "windup" ? 8 : 0;
        line(
          side * 16,
          28 + row * 25,
          side * (38 + spread),
          15 + row * 48,
          metal,
          7,
        );
        line(
          side * (38 + spread),
          15 + row * 48,
          side * 60,
          34 + row * 28,
          "#bcd2c7",
          5,
        );
        rect(side > 0 ? 52 : -66, 28 + row * 28, 14, 26, "#243c49");
        rect(side > 0 ? 58 : -62, 32 + row * 28, 4, 18, pulse);
      }
    circle(0, 43, 26, "#102331");
    circle(0, 43, 21, metal);
    circle(0, 43, 12, pulse);
    rect(-8, 2, 16, 24, "#d7bb82");
    line(-14, 9, 0, -2, metal);
    line(14, 9, 0, -2, metal);
    rect(-12, 70, 24, 8, "#e2c695");
  } else if (e.kind === "arclantern") {
    const bob = Math.sin(w.time * 3 + e.id) * 3;
    circle(0, 32 + bob, 17, "#122735");
    circle(0, 32 + bob, 11, pulse);
    line(-22, 16 + bob, -22, 53 + bob, metal, 5);
    line(22, 16 + bob, 22, 53 + bob, metal, 5);
    line(-22, 16 + bob, 22, 16 + bob, metal, 4);
    line(-22, 53 + bob, -10, 58 + bob, "#d6c18d");
    line(22, 53 + bob, 10, 58 + bob, "#d6c18d");
    line(0, 12, 0, 3, "#78999b", 2);
  } else if (e.kind === "railsaw" || e.kind === "railreaper") {
    const wide = e.kind === "railreaper";
    rect(wide ? -32 : -24, 4, wide ? 64 : 48, 18, "#122430");
    for (const side of [-1, 1]) {
      circle(side * (wide ? 25 : 18), 9, 10, "#102029");
      circle(side * (wide ? 25 : 18), 9, 5, metal);
    }
    rect(wide ? -28 : -20, 19, wide ? 56 : 40, 18, metal);
    rect(-10, 25, 20, 5, pulse);
    if (wide) {
      for (const side of [-1, 1]) {
        line(side * 24, 33, side * 38, 51, metal, 6);
        line(side * 38, 51, side * 52, 33, "#e5c991", 6);
      }
    } else {
      circle(25, 28, 15, "#e5c991");
      circle(25, 28, 10, "#314b54");
      for (let i = 0; i < 8; i++) {
        const t = (i * Math.PI) / 4 + w.time * 4;
        line(
          25 + Math.cos(t) * 9,
          28 + Math.sin(t) * 9,
          25 + Math.cos(t) * 18,
          28 + Math.sin(t) * 18,
          "#ead7b0",
          3,
        );
      }
    }
  } else if (e.kind === "anchorweaver" || e.kind === "gridwarden") {
    const grid = e.kind === "gridwarden";
    for (const side of [-1, 1])
      for (const row of [0, 1]) {
        line(side * 10, 35, side * (22 + row * 8), 20, metal, 5);
        line(
          side * (22 + row * 8),
          20,
          side * (24 + row * 9),
          stride,
          "#c1d0bd",
          4,
        );
      }
    rect(-15, 31, 30, 18, "#17303c");
    rect(-11, 35, 22, 10, metal);
    circle(0, 22, 9, "#d7ba83");
    line(0, 17, 0, 6, "#d7ba83");
    if (grid) {
      for (const side of [-1, 1]) {
        circle(side * 20, 52, 12, "#172b35");
        circle(side * 20, 52, 8, "#d0bd8a");
        circle(side * 20, 52, 4, "#4a7378");
      }
    } else rect(-5, 51, 10, 7, pulse);
  } else {
    for (const side of [-1, 1])
      for (const u of [-15, 0, 15]) {
        line(u, 17, u + side * 8, 8, metal, 4);
        line(u + side * 8, 8, u + side * 11, side * stride, "#c2c8ac", 3);
      }
    rect(-21, 13, 42, 18, "#122731");
    rect(-17, 18, 34, 12, metal);
    rect(16, 13, 15, 8, "#d6c494");
    for (const u of [-11, 0, 11]) rect(u - 2, 24, 4, 4, "#e1d0a0");
    rect(18, 25, 7, 4, pulse);
  }
  if (e.state === "recover" && (elite || boss)) {
    line(-9, 88, 9, 76, "#ffe1a2", 3);
    line(9, 88, -9, 76, "#ffe1a2", 3);
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
  g.strokeColor = ink(active ? "#ffe0a8" : "#ffac7a", preview ? 100 : 245);
  g.fillColor = ink("#ed674a", active ? 100 : preview ? 10 : 28);
  g.lineWidth = active ? 4 : 2;
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
    g.arc(
      x,
      y,
      h.radius * 48,
      h.angle - h.width / 2,
      h.angle + h.width / 2,
      false,
    );
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
      g.arc(x, y, h.radius * 48 - 5, 0, u * Math.PI * 2, false);
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
