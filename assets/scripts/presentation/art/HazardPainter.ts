import {drawLeadHazard} from "./LeadFoundryHazardArt";
import {drawEclipseHazard} from "./EclipseHazardArt";
import {drawEdgeHazard} from "./EdgeCourtHazardArt";
import {drawKilnHazard} from "./KilnHazardArt";
import {drawLoomHazard} from "./LoomHazardArt";
import {drawLibraryHazard} from "./LibraryHazardArt";
import {drawWindHazard} from "./WindHazardArt";
import {drawRootHazard} from "./RootHazardArt";
import {drawPrismHazard,drawPrismPreviews} from "./PrismHazardArt";
import { drawTideHazard,drawTidePreviews } from "./TideHazardArt";
import { drawBellHazard } from "./BellHazardArt";
import { Graphics } from "cc";
import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import type { Hazard } from "../../battle/SurvivalTypes";
import { ink } from "./Ink";
import { drawMoonHazard } from "../MoonPainter";
import { drawThunderHazard, drawThunderPreviews } from "../ThunderPainter";
import { drawSiegeCharge } from "../SiegePainter";

function polygon(g: Graphics, x: number, y: number, angle: number, points: number[][]) {
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  points.forEach(([u, v], i) => {
    const px = x + dx * u - dy * v,
      py = y + dy * u + dx * v;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  });
  g.close();
  g.fill();
}

function crystal(g: Graphics, x: number, y: number, r: number, angle = 0) {
  polygon(g, x, y, angle, [
    [r, 0],
    [0, r * 0.38],
    [-r, 0],
    [0, -r * 0.38],
  ]);
}

function arc(g: Graphics, x: number, y: number, r: number, a0: number, a1: number, segments = 24) {
  for (let i = 0; i <= segments; i++) {
    const a = a0 + ((a1 - a0) * i) / segments;
    const px = x + Math.cos(a) * r,
      py = y + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
}

/** Warning colour language shared by every generic hazard. */
function hazardColors(h: Hazard) {
  if (h.kind === "pool") return { edge: "#c7e879", fill: "#a3bc51" };
  if (h.siegeGround) return { edge: "#e3a1ff", fill: "#a454ba" };
  return { edge: "#ff7694", fill: "#ed6c88" };
}

export function drawHazards(g: Graphics, w: SurvivalWorld, reduced: boolean) {
  if (w.stageId === 7) drawPrismPreviews(g,w);
  if (w.stageId === 6) drawTidePreviews(g,w);
  if (w.stageId === 3) drawThunderPreviews(g, w);
  for (const h of w.hazards) {
    if(h.lead){drawLeadHazard(g,h,w.time);continue;}
    if(h.eclipse){drawEclipseHazard(g,h,w.time);continue;}
    if(h.edge){drawEdgeHazard(g,h,w.time);continue;}
    if(h.kiln){drawKilnHazard(g,h,w.time);continue;}
    if(h.loom){drawLoomHazard(g,h,w.time);continue;}
    if(h.library){drawLibraryHazard(g,h,w.time);continue;}
    if(h.wind){drawWindHazard(g,h,w.time);continue;}
    if(h.root){drawRootHazard(g,h,w.time);continue;}
    if(h.prism){drawPrismHazard(g,h,w.time);continue;}
    if(h.tide){drawTideHazard(g,h,w.time);continue;}
    if(h.bell){drawBellHazard(g,h,w.time);continue;}
    if (h.moon) {
      drawMoonHazard(g, h, w.time);
      continue;
    }
    if (h.thunder) {
      drawThunderHazard(g, h, w.time);
      continue;
    }
    if (h.siegeCharge) {
      drawSiegeCharge(g, h, w.time);
      continue;
    }
    if (h.siegeGround) {
      drawSiegeGround(g, h, w.time);
      continue;
    }
    if (h.kind === "frontierLane" || h.kind === "frontierImpact") {
      drawSiegeCharge(g, h, w.time);
      continue;
    }
    if (h.kind === "starTrace") {
      drawStarTrace(g, h, w.time);
      continue;
    }
    if (h.kind === "starLeap") {
      drawStarLeap(g, h, w.time);
      continue;
    }
    if (h.kind === "bellRing" || h.kind === "bellPulse") {
      drawBell(g, h, w.time);
      continue;
    }
    if (h.kind === "flameLine") {
      drawFlameLine(g, h, w.time, reduced);
      continue;
    }
    if (h.kind === "flame") {
      drawFlame(g, h, w.time);
      continue;
    }
    if (h.kind === "arrow") {
      drawArrow(g, h, w.time);
      continue;
    }
    if (h.kind === "line") {
      drawLine(g, h, w.time);
      continue;
    }
    if (h.kind === "sector") {
      drawSector(g, h, w.time);
      continue;
    }
    if (h.kind === "burst" && w.time >= h.due) {
      drawBurst(g, h, w.time);
      continue;
    }
    drawCircle(g, h, w.time);
  }
}

function progressOf(h: Hazard, time: number) {
  return Math.max(0, Math.min(1, (time - h.created) / Math.max(0.001, h.due - h.created)));
}

/** Shared cast cue, drawn above spells on every map. */
export function drawBossCastSignals(g: Graphics, w: SurvivalWorld) {
  for (const boss of w.enemies) {
    if (boss.kind !== "boss" || boss.hp <= 0) continue;
    const pending = w.hazards.filter(h => h.source === boss.id && h.created <= w.time && h.due > w.time && !h.lead?.cancelled && !h.eclipse?.cancelled && !h.edge?.cancelled && !h.kiln?.cancelled && !h.loom?.cancelled && !h.library?.cancelled && !h.wind?.cancelled)
      .sort((a,b) => a.due - b.due)[0];
    if (!pending) continue;
    const x = boss.x * 48, y = boss.y * 48 + 152, p = progressOf(pending,w.time);
    g.fillColor=ink("#24151d",245);g.circle(x,y,24);g.fill();
    g.strokeColor=ink("#fff0bd",255);g.lineWidth=4;g.circle(x,y,24);g.stroke();
    g.strokeColor=ink("#ff765b",255);g.lineWidth=6;
    arc(g,x,y,30,-Math.PI/2,-Math.PI/2+Math.PI*2*p);g.stroke();
    g.strokeColor=ink("#fff0bd",255);g.lineWidth=5;g.moveTo(x,y+12);g.lineTo(x,y-3);g.stroke();
    g.fillColor=ink("#fff0bd",255);g.circle(x,y-12,3);g.fill();
  }
}

function drawCircle(g: Graphics, h: Hazard, time: number) {
  const x = h.x * 48,
    y = h.y * 48,
    r = h.radius * 48,
    p = progressOf(h, time);
  const c = hazardColors(h);
  const active = time >= h.due;
  g.fillColor = ink(c.fill, active ? 70 : 22 + p * 38);
  g.circle(x, y, r);
  g.fill();
  g.strokeColor = ink(c.edge, 235);
  g.lineWidth = 5;
  g.circle(x, y, r);
  g.stroke();
  if (!active) {
    g.strokeColor = ink("#ffd9b6", 160);
    g.lineWidth = 1.4;
    arc(g, x, y, r * 0.92, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    g.stroke();
    // Four boundary ticks make the countdown readable without colour.
    g.moveTo(x - 8, y);
    g.lineTo(x + 8, y);
    g.moveTo(x, y - 8);
    g.lineTo(x, y + 8);
    g.stroke();
  } else {
    g.strokeColor = ink("#ffe7c2", 150);
    g.lineWidth = 1.5;
    arc(g, x, y, r * 0.72, 0.2, Math.PI * 1.5, 16);
    g.stroke();
  }
}

function drawSiegeGround(g: Graphics, h: Hazard, time: number) {
  const x = h.x * 48,
    y = h.y * 48,
    r = h.radius * 48,
    p = progressOf(h, time),
    active = time >= h.due;
  g.fillColor = ink("#c94e86", active ? 120 : 48 + p * 48);
  g.strokeColor = ink("#fff0bd", 255);
  g.lineWidth = 5;
  g.circle(x, y, r);
  g.fill();
  g.stroke();
  if (!active) {
    g.strokeColor = ink("#ffd9ff", 170);
    g.lineWidth = 1.6;
    g.circle(x, y, r * p);
    g.stroke();
    g.moveTo(x - 10, y);
    g.lineTo(x + 10, y);
    g.moveTo(x, y - 10);
    g.lineTo(x, y + 10);
    g.stroke();
  } else {
    g.strokeColor = ink("#ffe0ff", 200);
    g.lineWidth = 1.6;
    g.moveTo(x - 10, y - 10);
    g.lineTo(x + 10, y + 10);
    g.moveTo(x + 10, y - 10);
    g.lineTo(x - 10, y + 10);
    g.stroke();
  }
  if (h.siegeLaunched && !h.fired) {
    const u = Math.max(0, Math.min(1, (time - h.created - (h.sandLaunchDelay ?? 0.2)) / Math.max(0.001, h.due - h.created - (h.sandLaunchDelay ?? 0.2))));
    const sx = (h.endX ?? h.x) * 48,
      sy = (h.endY ?? h.y) * 48;
    g.fillColor = ink("#ffe0a3");
    g.circle(sx + (x - sx) * u, sy + (y - sy) * u + Math.sin(u * Math.PI) * 40, 5);
    g.fill();
  }
}

function drawBell(g: Graphics, h: Hazard, time: number) {
  const x = h.x * 48,
    y = h.y * 48,
    r = h.radius * 48,
    p = progressOf(h, time),
    inner = h.width * 48,
    waiting = time < h.due;
  g.strokeColor = ink(waiting ? "#ead499" : "#b7f3ff", 245);
  g.fillColor = ink(waiting ? "#d9be75" : "#83dff3", waiting ? 35 + p * 35 : 145);
  g.lineWidth = 3;
  if (inner > 0) {
    // Only the annulus is dangerous; keep the safe centre unfilled.
    g.moveTo(x+r,y);arc(g,x,y,r,0,Math.PI*2,40);
    g.lineTo(x+inner,y);arc(g,x,y,inner,Math.PI*2,0,40);
    g.close();g.fill();g.lineWidth=5;
    g.circle(x, y, inner);
    g.stroke();
    g.circle(x, y, r);
    g.stroke();
    const wave = inner + (r - inner) * (waiting ? p : Math.min(1, (time - h.due) / 0.25));
    g.lineWidth = waiting ? 2 : 7;
    g.circle(x, y, wave);
    g.stroke();
  } else {
    g.circle(x, y, r);
    g.stroke();
    g.circle(x, y, r * Math.max(0.05, p));
    g.stroke();
  }
  if (waiting) {
    g.fillColor = ink("#ffe6ae", 180 + p * 60);
    g.circle(x, y, 5 + p * 7);
    g.fill();
  }
}

function drawFlameLine(g: Graphics, h: Hazard, time: number, reduced: boolean) {
  const x = h.x * 48,
    y = h.y * 48,
    r = h.radius * 48,
    dx = Math.cos(h.angle),
    dy = Math.sin(h.angle),
    p = progressOf(h, time);
  if (time < h.due) {
    const pulse = 5 + p * 8;
    g.fillColor = ink("#ffb85a", 180 + p * 60);
    g.circle(x + dx * 24, y + dy * 24 + 20, pulse);
    g.fill();
    g.strokeColor = ink("#ffe6ad", 230);
    g.lineWidth = 2;
    arc(g, x, y + 20, 23, h.angle - 0.6, h.angle + 0.6, 12);
    g.stroke();
  } else {
    const n = reduced ? 6 : 12;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n,
        d = t * r;
      const flicker = Math.sin(i * 2.4 + time * 40);
      const spread = h.width * 48 * (0.55 + 0.2 * flicker);
      const cx = x + dx * d,
        cy = y + dy * d;
      g.fillColor = ink(i % 2 ? "#ff7435" : "#ffbb55", 220);
      g.moveTo(cx - dy * spread, cy + dx * spread);
      g.quadraticCurveTo(cx + dx * 12 - dy * spread, cy + dy * 12 + dx * spread, cx + dx * 30, cy + dy * 30);
      g.quadraticCurveTo(cx - dx * 14 + dy * spread, cy - dy * 14 - dx * spread, cx - dy * spread, cy + dx * spread);
      g.close();
      g.fill();
      g.fillColor = ink("#fff0ac", 230);
      g.circle(cx, cy, 5 + 2 * flicker);
      g.fill();
    }
  }
}

function drawFlame(g: Graphics, h: Hazard, time: number) {
  const x = h.x * 48,
    y = h.y * 48,
    r = h.radius * 48,
    p = progressOf(h, time);
  g.strokeColor = ink("#ffe1a0", 240);
  g.fillColor = ink("#ff713c", time >= h.due ? 100 : 25 + p * 35);
  g.circle(x, y, r);
  g.fill();
  g.stroke();
  if (time < h.due) {
    g.circle(x, y, r * p);
    g.stroke();
  } else {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      g.moveTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
      g.lineTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75 + 12);
    }
    g.stroke();
  }
}

function drawArrow(g: Graphics, h: Hazard, time: number) {
  const x = h.x * 48,
    y = h.y * 48,
    r = h.radius * 48,
    dx = Math.cos(h.angle),
    dy = Math.sin(h.angle),
    p = progressOf(h, time);
  if (time < h.due) {
    if (h.fixedDamage) {
      g.strokeColor = ink("#ffc4a0", 180 + p * 65);
      g.lineWidth = 2;
      const spread = h.width * 48;
      g.moveTo(x - dy * spread, y + dx * spread);
      g.lineTo(x + dx * r - dy * spread, y + dy * r + dx * spread);
      g.moveTo(x + dy * spread, y - dx * spread);
      g.lineTo(x + dx * r + dy * spread, y + dy * r - dx * spread);
      g.stroke();
    }
    const flash = Math.sin(p * Math.PI);
    g.strokeColor = ink("#ffe6a5", 100 + flash * 155);
    g.lineWidth = 2 + flash;
    arc(g, x + 18, y + 23, 16, -Math.PI / 2, Math.PI / 2, 10);
    g.stroke();
    g.fillColor = ink("#fff4cc", 100 + flash * 155);
    g.circle(x + 31, y + 23, 2 + flash * 2);
    g.fill();
  } else {
    const d = (time - h.due) * (h.projectileSpeed ?? 4.5) * 48,
      ax = x + dx * d,
      ay = y + dy * d;
    g.lineWidth = 4;
    g.strokeColor = ink("#ffe6a5", 245);
    g.moveTo(ax - dx * 17, ay - dy * 17);
    g.lineTo(ax, ay);
    g.stroke();
    g.lineWidth = 2.4;
    g.moveTo(ax - dx * 8 - dy * 5, ay - dy * 8 + dx * 5);
    g.lineTo(ax, ay);
    g.lineTo(ax - dx * 8 + dy * 5, ay - dy * 8 - dx * 5);
    g.stroke();
  }
}

function drawLine(g: Graphics, h: Hazard, time: number) {
  if (time >= h.due) return;
  const x = h.x * 48,
    y = h.y * 48,
    dx = Math.cos(h.angle),
    dy = Math.sin(h.angle),
    p = progressOf(h, time);
  const length = Math.min(h.radius, 1.6) * 48;
  g.strokeColor = ink("#ff9aab", 150 + p * 90);
  g.lineWidth = 3;
  g.moveTo(x + dx * 20, y + dy * 20);
  g.lineTo(x + dx * length, y + dy * length);
  g.moveTo(x + dx * (length - 14) - dy * 10, y + dy * (length - 14) + dx * 10);
  g.lineTo(x + dx * length, y + dy * length);
  g.lineTo(x + dx * (length - 14) + dy * 10, y + dy * (length - 14) - dx * 10);
  g.stroke();
}

function drawSector(g: Graphics, h: Hazard, time: number) {
  const x = h.x * 48,
    y = h.y * 48,
    r = h.radius * 48,
    p = progressOf(h, time),
    start = h.angle - h.width / 2,
    end = h.angle + h.width / 2;
  g.fillColor = ink("#ed6c88", time < h.due ? 24 + p * 30 : 82);
  g.moveTo(x, y);
  // Keep the centre and arc in one subpath: an arc starting with moveTo
  // closes to a chord and hides the dangerous inner portion of the fan.
  for (let i = 0; i <= 24; i++) {
    const a = start + (end - start) * i / 24;
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.close();
  g.fill();
  g.strokeColor = ink("#ff7694", 240);
  g.lineWidth = 3;
  g.moveTo(x, y);
  for (let i = 0; i <= 24; i++) {
    const a = start + (end - start) * i / 24;
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.close();
  g.stroke();
  if (time < h.due) {
    for (const a of [start, end]) {
      g.moveTo(x + Math.cos(a) * r * 0.84, y + Math.sin(a) * r * 0.84);
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      g.stroke();
    }
    g.fillColor = ink("#ffbd9d", 160 + p * 90);
    g.circle(x + Math.cos(h.angle) * 22, y + Math.sin(h.angle) * 22, 5 + p * 6);
    g.fill();
  } else {
    for (let i = 0; i < 3; i++) {
      g.strokeColor = ink(i === 0 ? "#fff0cb" : "#ff997f", 240 - i * 45);
      g.lineWidth = 7 - i * 2;
      arc(g, x, y, r * (1 - i * 0.1), start, end, 24);
      g.stroke();
    }
  }
}

function drawBurst(g: Graphics, h: Hazard, time: number) {
  const x = h.x * 48,
    y = h.y * 48;
  g.fillColor = ink("#efaaac");
  g.strokeColor = ink("#ffd9c0", 180);
  g.lineWidth = 1.2;
  for (let i = 0; i < 8; i++) {
    const a = h.angle + (i * Math.PI) / 4,
      d = (time - h.due) * 3 * 48;
    g.circle(x + Math.cos(a) * d, y + Math.sin(a) * d, 9);
    g.fill();
    g.stroke();
  }
}

function drawStarTrace(g: Graphics, h: Hazard, time: number) {
  const x = h.x * 48,
    y = h.y * 48,
    bx = (h.endX ?? h.x) * 48,
    by = (h.endY ?? h.y) * 48,
    a = Math.atan2(by - y, bx - x),
    r = h.width * 48,
    dx = -Math.sin(a) * r,
    dy = Math.cos(a) * r,
    p = progressOf(h, time);
  g.fillColor = ink("#dc9fc9", time >= h.due ? 120 : 20 + p * 35);
  g.strokeColor = ink("#f7b4d9", 240);
  g.lineWidth = 2;
  g.moveTo(x + dx, y + dy);
  for (let i = 0; i <= 12; i++) {
    const t = a + Math.PI / 2 - (i * Math.PI) / 12;
    g.lineTo(bx + Math.cos(t) * r, by + Math.sin(t) * r);
  }
  for (let i = 0; i <= 12; i++) {
    const t = a - Math.PI / 2 - (i * Math.PI) / 12;
    g.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
  }
  g.close();
  g.fill();
  g.stroke();
  crystal(g, x, y, 4);
  crystal(g, bx, by, 4);
}

function drawStarLeap(g: Graphics, h: Hazard, time: number) {
  const x = h.x * 48,
    y = h.y * 48,
    r = h.radius * 48,
    p = progressOf(h, time);
  g.strokeColor = ink("#ffc3e3", 240);
  g.fillColor = ink("#e1a2c7", h.fired ? 110 : 20 + p * 40);
  g.circle(x, y, r);
  g.fill();
  g.stroke();
  g.circle(x, y, r * p);
  g.stroke();
  crystal(g, x, y, 8, Math.PI / 4);
}
