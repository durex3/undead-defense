import { Graphics, Color } from "cc";
import { SAND_ROCKS, SAND_NESTS, SAND_TRAIL } from "../battle/SandMap";
import { Enemy } from "../battle/SurvivalTypes";
import type { SurvivalWorld } from "../battle/SurvivalWorld";
const palette = new Map<string, Color>();
const ink = (hex: string, a = 255) => {
  const key = hex + ":" + a;
  let c = palette.get(key);
  if (!c) {
    c = new Color().fromHEX(hex);
    c.a = a;
    palette.set(key, c);
  }
  return c;
};
export function drawSandMap(g: Graphics) {
  g.clear();
  g.fillColor = ink("#594034");
  g.rect(-1152, -1344, 2304, 2688);
  g.fill();
  for (let y = -27; y < 28; y++)
    for (let x = -23; x < 24; x++) {
      g.fillColor = ink((x * 7 + y * 3) % 5 ? "#775240" : "#835b42");
      g.rect(x * 48 + 1, y * 48 + 1, 46, 46);
      g.fill();
      if ((x + y) % 4 === 0) {
        g.strokeColor = ink("#a27350", 120);
        g.lineWidth = 2;
        g.moveTo(x * 48 + 6, y * 48 + 12);
        g.lineTo(x * 48 + 31, y * 48 + 16);
        g.stroke();
      }
    }
  g.strokeColor=ink('#b88e59',100);g.lineWidth=18;
  SAND_TRAIL.forEach((p,i)=>{if(i===0)g.moveTo(p.x*48,p.y*48);else g.lineTo(p.x*48,p.y*48);});g.stroke();
  for(const p of SAND_NESTS){const x=p.x*48,y=p.y*48;
    g.fillColor=ink('#392d35',120);g.ellipse(x,y,100,65);g.fill();
    g.strokeColor=ink('#b89b66',150);g.lineWidth=3;g.ellipse(x,y,100,65);g.stroke();
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;g.moveTo(x+Math.cos(a)*85,y+Math.sin(a)*50);g.lineTo(x+Math.cos(a)*115,y+Math.sin(a)*75);}g.stroke();
  }
  for (const p of SAND_ROCKS) {
    const x = (p.x - p.halfWidth) * 48,
      y = (p.y - p.halfHeight) * 48,
      ww = p.halfWidth * 96,
      hh = p.halfHeight * 96;
    g.fillColor = ink("#342e37");
    g.rect(x - 5, y - 7, ww + 10, hh + 14);
    g.fill();
    g.fillColor = ink("#62535a");
    g.rect(x, y, ww, hh);
    g.fill();
    g.fillColor = ink("#8d7270");
    g.rect(x + 7, y + hh - 15, ww - 14, 12);
    g.fill();
    g.strokeColor = ink("#403340");
    g.lineWidth = 5;
    g.moveTo(x + ww * 0.3, y);
    g.lineTo(x + ww * 0.5, y + hh * 0.5);
    g.lineTo(x + ww * 0.2, y + hh);
    g.moveTo(x + ww * 0.7, y + hh * 0.2);
    g.lineTo(x + ww * 0.5, y + hh * 0.5);
    g.lineTo(x + ww, y + hh * 0.7);
    g.stroke();
  }
}
export function drawSandEnemy(g: Graphics, w: SurvivalWorld, e: Enemy) {
  const x = e.x * 48,
    y = e.y * 48,
    s = e.sand,
    boss = e.kind === "boss",
    mother = e.kind === "broodelite",
    breaker = e.kind === "breakerelite",
    egg = e.kind === "sandegg",
    larva = e.kind === "sandlarva";
  if (s?.buried) {
    g.strokeColor = ink("#efd29b", 220);
    g.lineWidth = boss ? 9 : 5;
    g.moveTo((s.end?.x ?? e.x) * 48, (s.end?.y ?? e.y) * 48);
    g.lineTo(x, y);
    g.stroke();
    g.fillColor = ink("#e4b776");
    g.ellipse(x, y, boss ? 28 : 16, 8);
    g.fill();
    return;
  }
  const scale = boss ? 1.65 : mother ? 1.4 : breaker ? 1.3 : larva ? 0.55 : 1,
    face = Math.cos(e.facing) < 0 ? -1 : 1,
    walking = e.state === "seek" || e.state === "charge",
    stride = walking ? Math.sin(w.time * 13 + e.id) * 5 : 0;
  const tint =
    e.freezeUntil > w.time
      ? "#8bd7ed"
      : s?.vulnerable && e.state === "recover"
        ? "#f2cf92"
        : "#be754b";
  const alpha = e.state === "arriving" ? 160 : 255;
  const rect = (a: number, b: number, c: number, d: number, hex: string) => {
    g.fillColor = ink(hex, alpha);
    g.rect(
      x + (face < 0 ? -a - c : a) * scale,
      y + b * scale,
      c * scale,
      d * scale,
    );
    g.fill();
  };
  const oval = (a: number, b: number, rx: number, ry: number, hex: string) => {
    g.fillColor = ink(hex, alpha);
    g.ellipse(x + a * face * scale, y + b * scale, rx * scale, ry * scale);
    g.fill();
  };
  if (egg || (larva && e.state === "windup")) {
    oval(0, 16, 14, 19, "#302d39");
    oval(0, 18, 11, 16, "#c5ab78");
    rect(-6, 12, 4, 10, "#b47766");
    rect(1, 24, 5, 6, "#f9dfa4");
    if (egg) {
      const u = Math.max(
        0,
        Math.min(1, 1 - ((s?.hatch ?? w.time) - w.time) / 3.2),
      );
      g.fillColor = ink("#f5d59a");
      g.rect(x - 14, y + 40, 28 * u, 3);
      g.fill();
    }
    return;
  }
  if (mother) {
    for (const side of [-1, 1])
      for (const a of [14, 26]) {
        rect(side * a - 3, 1 + (side > 0 ? stride : -stride), 6, 42, "#2d2935");
        rect(side * a - 2, 3 + (side > 0 ? stride : -stride), 4, 31, "#ab8663");
      }
    oval(-2, 51, 26, 34, "#312b37");
    oval(-2, 54, 22, 29, "#835f77");
    for (const a of [-13, 0, 13])
      oval(a, 55 + (a === 0 ? 12 : 0), 7, 9, "#e8bf8b");
    oval(14, 31, 13, 15, tint);
    rect(21, 33, 5, 5, "#ffdf99");
    rect(24, 15, 5, 20, "#302b36");
    rect(19, 12, 10, 5, "#e2b579");
  } else {
    const length = breaker ? 24 : larva ? 13 : 22;
    for (const side of [-1, 1])
      for (const a of [-16, 0, 16]) {
        rect(
          a - 3,
          8 + side * 4 + (a === 0 ? -stride : stride),
          6,
          16,
          "#2b2935",
        );
        rect(
          a + (side > 0 ? 1 : -6),
          4 + (a === 0 ? -stride : stride),
          9,
          5,
          "#d69c66",
        );
      }
    oval(-3, 24, length, 18, "#302b36");
    oval(-3, 27, length - 4, 14, tint);
    for (const a of [-17, -6, 5]) rect(a, 17, 3, 22, "#674651");
    oval(19, 23, 13, 12, "#2c2934");
    oval(21, 25, 10, 8, breaker ? "#987b63" : "#dab280");
    rect(22, 27, 6, 3, "#ffe9a3");
    if (e.kind === "shellroller") {
      oval(-4, 32, 23, 20, "#2c2936");
      oval(-4, 34, 19, 16, "#a17b66");
      rect(-19, 33, 30, 4, "#e2b477");
      rect(-5, 20, 4, 29, "#503d48");
      if (e.state === "charge") {
        g.strokeColor = ink("#f0ca8d");
        g.lineWidth = 3;
        g.arc(
          x - 4 * scale,
          y + 30 * scale,
          27 * scale,
          w.time * 12,
          w.time * 12 + Math.PI * 1.5,
          false,
        );
        g.stroke();
      }
    }
    if (e.kind === "sandspitter") {
      oval(-10, 38, 17, 21, "#5d455e");
      oval(-10, 40, 13, 16, "#c8a174");
      rect(28, 20, 13, 8, "#3d2e3d");
      rect(38, 21, 5, 6, "#efc98b");
    }
    if (e.kind === "sandstalker") {
      for (const a of [-21, -9, 3]) {
        rect(a, 39, 6, 10, "#342d3d");
        rect(a + 1, 40, 3, 6, "#e5ae6d");
      }
      rect(27, 14, 6, 14, "#f0c98d");
    }
    if (breaker || boss || e.kind === "sandworker") {
      for (const side of [-1, 1]) {
        rect(24, side > 0 ? 35 : 5, 24, 7, "#302b38");
        rect(27, side > 0 ? 37 : 7, 18, 4, "#e5bc84");
        rect(42, side > 0 ? 26 : 7, 7, 13, "#312b37");
        rect(43, side > 0 ? 27 : 8, 4, 10, "#edc996");
      }
    }
    if (boss) {
      rect(-34, 25, 10, 22, "#332a3d");
      rect(-40, 44, 15, 8, "#7e5571");
      oval(-35, 55, 13, 13, "#382d40");
      oval(-35, 57, 9, 9, "#efbe83");
      for (const a of [-16, -4, 8]) rect(a, 42, 6, 9, "#f0cc8f");
    }
  }
  if (s?.vulnerable && e.state === "recover") {
    g.strokeColor = ink("#ffe0a5");
    g.lineWidth = 3;
    g.moveTo(x - 12, y + 70 * scale);
    g.lineTo(x + 12, y + 59 * scale);
    g.moveTo(x + 12, y + 70 * scale);
    g.lineTo(x - 12, y + 59 * scale);
    g.stroke();
  }
  if (s?.action === "spit" && e.state === "windup") {
    g.strokeColor = ink("#f6d39b", 85);
    g.lineWidth = 2;
    for (let i = s.step + 1; i < 3; i++) {
      const a = s.angle + ((s.target?.x ?? 1) * i * 35 * Math.PI) / 180;
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * 7 * 48, y + Math.sin(a) * 7 * 48);
      g.stroke();
    }
  }
  if (
    s?.action === "roll" &&
    s.step === 0 &&
    (e.state === "windup" || e.state === "charge")
  ) {
    g.strokeColor = ink("#f6d39b", 95);
    g.lineWidth = 2;
    const end = {
      x:
        e.x +
        Math.cos(e.lockedAngle) * (e.state === "charge" ? e.timer * 6 : 5),
      y:
        e.y +
        Math.sin(e.lockedAngle) * (e.state === "charge" ? e.timer * 6 : 5),
    };
    g.moveTo(end.x * 48, end.y * 48);
    g.lineTo(
      (end.x + Math.cos(s.angle) * 4) * 48,
      (end.y + Math.sin(s.angle) * 4) * 48,
    );
    g.stroke();
  }
}
