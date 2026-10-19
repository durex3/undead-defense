import { Color, Graphics } from "cc";
import { MOON_BASES } from "../battle/MoonMap";
import { moonCurve, moonPose } from "../battle/MoonGeometry";
import type { MoonMotion } from "../battle/MoonGeometry";
import type { SurvivalWorld } from "../battle/SurvivalWorld";
import type { Enemy, Hazard, Point } from "../battle/SurvivalTypes";
import { ink } from "./StagePalette";
function line(g: Graphics, a: Point, b: Point) {
  g.moveTo(a.x * 48, a.y * 48);
  g.lineTo(b.x * 48, b.y * 48);
}
function curve(g: Graphics, a: Point, c: Point, b: Point, dashed = false) {
  for (let i = 0; i < 24; i++) {
    if (dashed && i % 3 === 2) continue;
    line(g, moonCurve(a, c, b, i / 24), moonCurve(a, c, b, (i + 1) / 24));
  }
  g.stroke();
}
function arrow(g: Graphics, p: Point, a: number, double = false) {
  for (let i = 0; i < (double ? 2 : 1); i++) {
    const x = p.x * 48 - Math.cos(a) * i * 8,
      y = p.y * 48 - Math.sin(a) * i * 8;
    g.moveTo(x - Math.cos(a - 0.6) * 10, y - Math.sin(a - 0.6) * 10);
    g.lineTo(x, y);
    g.lineTo(x - Math.cos(a + 0.6) * 10, y - Math.sin(a + 0.6) * 10);
  }
  g.stroke();
}
export function drawMoonMap(g: Graphics) {
  g.clear();
  g.fillColor = ink("#182923");
  g.rect(-1152, -1344, 2304, 2688);
  g.fill();
  g.strokeColor = ink("#3b5143");
  g.lineWidth = 28;
  for (const side of [-1, 1]) {
    g.moveTo(0, -1152);
    g.quadraticCurveTo(side * 850, -400, side * 680, 0);
    g.quadraticCurveTo(side * 850, 400, 0, 1152);
    g.stroke();
  }
  g.strokeColor = ink("#536b58", 130);
  g.lineWidth = 3;
  g.circle(0, 0, 6 * 48);
  g.stroke();
  for (let y = -25; y <= 25; y += 2)
    for (let x = -21; x <= 21; x += 2) {
      g.fillColor = ink((x + y) % 3 ? "#2b4031" : "#42533d");
      g.rect(x * 48 + (y % 3) * 8, y * 48, 5, 11);
      g.fill();
    }
  for (const b of MOON_BASES) {
    const x = b.x * 48,
      y = b.y * 48;
    g.fillColor = ink("#53615a");
    g.roundRect(
      x - b.halfWidth * 48,
      y - b.halfHeight * 48,
      b.halfWidth * 96,
      b.halfHeight * 96,
      8,
    );
    g.fill();
    g.strokeColor = ink("#9da79a");
    g.lineWidth = 3;
    g.roundRect(
      x - b.halfWidth * 48,
      y - b.halfHeight * 48,
      b.halfWidth * 96,
      b.halfHeight * 96,
      8,
    );
    g.stroke();
    g.fillColor = ink("#9b9d85");
    g.rect(x - 20, y - 30, 40, 60);
    g.fill();
    g.fillColor = ink("#4a5146");
    g.rect(x - 5, y - 18, 10, 36);
    g.fill();
  }
}
/** Distinct silhouettes: low quilled pack beast, two-legged mantis, long-tail cat, antler quadrupeds. */
export function drawMoonEnemy(g: Graphics, w: SurvivalWorld, e: Enemy) {
  const boss = e.kind === "boss",
    elite = e.kind === "moonreaver" || e.kind === "hornwarden";
  const scale = boss ? 2.25 : elite ? 1.5 : 1,
    x = e.x * 48;
  const s = e.moon;
  let height = 0;
  if (
    s?.jumpAt !== undefined &&
    s.jumpDue !== undefined &&
    w.time >= s.jumpAt &&
    w.time < s.jumpDue
  )
    height = Math.sin(((w.time - s.jumpAt) / 0.45) * Math.PI) * 50;
  const y = e.y * 48 + height,
    pulse =
      e.state === "windup"
        ? Math.sin(w.time * 12) * 2
        : Math.sin(w.time * 7 + e.id) * 2;
  const fill = (c: string) => (g.fillColor = ink(c)),
    stroke = (c: string) => {
      g.strokeColor = ink(c);
      g.lineWidth = 3 * scale;
    };
  const rect = (a: number, b: number, c: number, d: number) => {
    g.rect(x + a * scale, y + b * scale, c * scale, d * scale);
    g.fill();
  };
  const seg = (a: number, b: number, c: number, d: number) => {
    g.moveTo(x + a * scale, y + b * scale);
    g.lineTo(x + c * scale, y + d * scale);
    g.stroke();
  };
  if (e.kind === "crescentmantis" || e.kind === "moonreaver") {
    fill(elite ? "#817395" : "#829570");
    rect(-8, -12, 16, 34);
    rect(-11, 20, 22, 12);
    stroke("#b5c3a3");
    seg(-5, -10, -17, -25);
    seg(5, -10, 17, -25);
    seg(-7, 15, -24, 31 + pulse);
    seg(7, 15, 24, 31 + pulse);
    stroke("#f4e5b8");
    for (const side of [-1, 1]) {
      g.arc(
        x + side * 25 * scale,
        y + (36 + pulse) * scale,
        13 * scale,
        side > 0 ? -1.6 : 0.2,
        side > 0 ? 1.5 : 3.1,
        false,
      );
      g.stroke();
    }
    fill("#ffcb78");
    rect(-7, 25, 4, 4);
    rect(3, 25, 4, 4);
    if (elite) {
      stroke("#b39ccb");
      seg(0, -10, 23, -16);
      seg(23, -16, 29, -9);
    }
  } else {
    const lynx = e.kind === "vaultlynx",
      fodder = e.kind === "thornrunner";
    fill(fodder ? "#8e9271" : lynx ? "#998277" : boss ? "#b3a8aa" : "#8b8697");
    g.ellipse(x, y + 4 * scale, (fodder ? 21 : 24) * scale, 13 * scale);
    g.fill();
    rect(11, 7, 17, 16);
    for (const side of [-1, 1]) {
      rect(side < 0 ? -19 : 9, -17 - pulse, 7, 20);
      rect(side < 0 ? -14 : 17, -19 + pulse, 6, 19);
    }
    stroke(lynx ? "#bca292" : "#a0a298");
    seg(-18, 7, -31, lynx ? 22 : 13);
    if (lynx) seg(-31, 22, -36, 35);
    fill("#f9cd89");
    rect(21, 17, 4, 4);
    if (fodder) {
      fill("#d2c6a0");
      for (const a of [-13, -2, 9]) {
        g.moveTo(x + (a - 5) * scale, y + 12 * scale);
        g.lineTo(x + a * scale, y + (26 + pulse) * scale);
        g.lineTo(x + (a + 4) * scale, y + 12 * scale);
        g.close();
        g.fill();
      }
    } else if (lynx) {
      fill("#c8ab96");
      rect(14, 22, 5, 9);
      rect(25, 22, 5, 9);
      rect(12, -19, 14, 5);
    } else {
      stroke(boss ? "#f3e4cb" : "#d3c7c4");
      for (const side of [-1, 1]) {
        seg(19, 24, 19 + side * 17, 42);
        seg(19 + side * 17, 42, 19 + side * 28, 40);
        seg(19 + side * 17, 42, 19 + side * 18, 57);
        seg(19 + side * 12, 36, 19 + side * 27, 53);
      }
      if (boss) {
        g.strokeColor = ink("#d2c1ed", 150);
        g.lineWidth = 3;
        g.circle(x - 29 * scale, y + 18 * scale, 11 * scale);
        g.stroke();
      }
    }
  }
  if (e.state === "recover") {
    g.strokeColor = ink("#a6dfb6");
    g.lineWidth = 2;
    g.ellipse(x, e.y * 48 - 6, 27 * scale, 11 * scale);
    g.stroke();
  }
  if (height > 0 && s?.jumpStart && s.jumpEnd) {
    g.strokeColor = ink("#e9bba0", 160);
    g.lineWidth = 2;
    line(g, s.jumpStart, s.jumpEnd);
    g.stroke();
  }
}
function sweepPreview(g: Graphics, m: MoonMotion) {
  for (const u of [0, 1]) {
    const o = moonCurve(m.start, m.control, m.end, u),
      a = m.angle + m.turn * u;
    line(g, o, {
      x: o.x + Math.cos(a) * m.radius,
      y: o.y + Math.sin(a) * m.radius,
    });
  }
  for (let i = 0; i < 24; i++) {
    if (i % 3 === 2) continue;
    const a = moonPose(m, m.due + (m.out * i) / 24),
      b = moonPose(m, m.due + (m.out * (i + 1)) / 24 - 1e-7);
    line(g, a.tip!, b.tip!);
  }
  g.stroke();
  const v = moonPose(m, m.due + m.out * 0.5);
  arrow(g, v.tip!, m.angle + m.turn * 0.5 + (Math.sign(m.turn) * Math.PI) / 2);
  if (Math.hypot(m.end.x - m.start.x, m.end.y - m.start.y) > 0.1) {
    line(g, m.start, m.end);
    g.stroke();
    arrow(g, m.end, Math.atan2(m.end.y - m.start.y, m.end.x - m.start.x));
  }
}
export function drawMoonHazard(g: Graphics, h: Hazard, time: number) {
  const m = h.moon!.motion,
    v = moonPose(m, time),
    waiting = time < m.due;
  g.strokeColor = ink("#ffa97e", waiting ? 230 : 170);
  g.lineWidth = 2;
  if (m.shape === "blade") {
    // Both immutable legs are shown from the initial warning; double chevrons identify return.
    curve(g, m.start, m.control, m.end, true);
    g.strokeColor = ink("#f8d2ad", time >= m.due + m.out ? 255 : 185);
    curve(g, m.end, m.returnControl, m.home, true);
    arrow(
      g,
      moonCurve(m.start, m.control, m.end, 0.65),
      Math.atan2(m.end.y - m.control.y, m.end.x - m.control.x),
    );
    arrow(
      g,
      moonCurve(m.end, m.returnControl, m.home, 0.65),
      Math.atan2(m.home.y - m.returnControl.y, m.home.x - m.returnControl.x),
      true,
    );
    if (waiting) {
      g.circle(
        m.start.x * 48,
        m.start.y * 48,
        10 + (1 - Math.min(1, (time - h.created) / (m.due - h.created))) * 12,
      );
      g.stroke();
    } else {
      const x = v.point.x * 48,
        y = v.point.y * 48;
      g.fillColor = ink(v.leg ? "#fff1c7" : "#ce9a7f");
      g.circle(x, y, m.radius * 48);
      g.fill();
      g.strokeColor = ink("#ffb974");
      g.lineWidth = 5;
      g.arc(x, y, 17, -0.8, 2.5, false);
      g.stroke();
    }
    // Numbered dot clusters avoid allocating text nodes each frame.
    g.fillColor = ink("#ffd6b0");
    for (let i = 0; i < h.moon!.order; i++) {
      g.circle(m.start.x * 48 + i * 7, m.start.y * 48 + 24, 2.5);
      g.fill();
    }
  } else if (m.shape === "landing") {
    const x = m.end.x * 48,
      y = m.end.y * 48;
    g.circle(x, y, m.radius * 48);
    g.stroke();
    g.strokeColor = ink("#ffd7b6");
    g.circle(
      x,
      y,
      m.radius * 48 * (waiting ? 1 + Math.max(0, m.due - time) * 0.4 : 1.1),
    );
    g.stroke();
    line(g, m.start, m.end);
    g.stroke();
    arrow(g, m.end, Math.atan2(m.end.y - m.start.y, m.end.x - m.start.x));
  } else {
    sweepPreview(g, m);
    if (m.shape === "claw" && v.leg) {
      g.fillColor = ink("#ffbe91", 120);
      g.moveTo(v.point.x * 48, v.point.y * 48);
      for (let i = 0; i <= 16; i++) {
        const a = m.angle + (m.turn * i) / 16;
        g.lineTo(
          (v.point.x + Math.cos(a) * m.radius) * 48,
          (v.point.y + Math.sin(a) * m.radius) * 48,
        );
      }
      g.close();
      g.fill();
      return;
    }
    if (v.leg) {
      g.strokeColor = ink("#fff0bd");
      g.lineWidth = m.width * 96;
      line(g, v.inner!, v.tip!);
      g.stroke();
      g.strokeColor = ink("#ff9e6b");
      g.lineWidth = 2;
      line(g, v.inner!, v.tip!);
      g.stroke();
    }
  }
}
