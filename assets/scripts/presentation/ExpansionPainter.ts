import { Graphics, Color } from "cc";
import { SurvivalWorld } from "../battle/SurvivalWorld";
import { formTier } from "../battle/WeaponForms";
import { COLORS, Card } from "../battle/SurvivalConfig";
const color = (hex: string, a = 255) => {
  const c = new Color().fromHEX(hex);
  c.a = a;
  return c;
};
export function expansionGlyph(
  g: Graphics,
  key: Card,
  x: number,
  y: number,
  s: number,
): boolean {
  if (key === "water") {
    g.roundRect(x - s * 0.5, y - s * 0.7, s, s * 1.2, s * 0.2);
    g.fill();
    g.rect(x - s * 0.22, y + s * 0.4, s * 0.44, s * 0.45);
    g.fill();
    g.strokeColor = color("#ecffff");
    g.lineWidth = 2;
    g.moveTo(x, y - s * 0.4);
    g.lineTo(x, y + s * 0.2);
    g.moveTo(x - s * 0.25, y - s * 0.1);
    g.lineTo(x + s * 0.25, y - s * 0.1);
    g.stroke();
  } else if (key === "poison") {
    for (let i = 0; i < 3; i++) {
      g.circle(x + (i - 1) * s * 0.45, y + Math.sin(i * 2) * s * 0.3, s * 0.5);
      g.fill();
    }
    g.fillColor = color("#24382e");
    g.circle(x - s * 0.2, y + s * 0.1, s * 0.1);
    g.circle(x + s * 0.2, y + s * 0.1, s * 0.1);
    g.fill();
  } else if (key === "bone") {
    g.lineWidth = s * 0.23;
    g.moveTo(x - s * 0.6, y - s * 0.6);
    g.lineTo(x + s * 0.6, y + s * 0.6);
    g.stroke();
    for (const k of [-1, 1]) {
      g.circle(x + k * s * 0.6 - s * 0.13, y + k * s * 0.6 + s * 0.13, s * 0.2);
      g.circle(x + k * s * 0.6 + s * 0.13, y + k * s * 0.6 - s * 0.13, s * 0.2);
      g.fill();
    }
  } else if (key === "mine") {
    g.circle(x, y, s * 0.65);
    g.fill();
    g.strokeColor = color("#fff4c4");
    g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      let a = (i * Math.PI) / 2;
      g.moveTo(x + Math.cos(a) * s * 0.35, y + Math.sin(a) * s * 0.35);
      g.lineTo(x + Math.cos(a) * s * 0.85, y + Math.sin(a) * s * 0.85);
      g.stroke();
    }
    g.fillColor = color("#fff4c4");
    g.circle(x, y, s * 0.15);
    g.fill();
  } else if (key === "void") {
    for (let i = 0; i < 3; i++) {
      g.arc(
        x,
        y,
        s * (0.35 + i * 0.25),
        i * 0.9,
        i * 0.9 + Math.PI * 1.6,
        false,
      );
      g.stroke();
    }
    g.fillColor = color("#1c1731");
    g.circle(x, y, s * 0.3);
    g.fill();
  } else if (key === "axe") {
    g.lineWidth = Math.max(2, s * .18); g.moveTo(x-s*.55,y-s*.55); g.lineTo(x+s*.55,y+s*.55); g.stroke();
    g.arc(x-s*.35,y-s*.35,s*.45,-.5,1.7,false); g.stroke();
  } else if (key === "chain" || key === "soul") {
    g.lineWidth = Math.max(2, s * .16); for (let i=-1;i<=1;i++){ g.circle(x+i*s*.35,y,s*.25); g.stroke(); }
  } else if (key === "pillar" || key === "meteor") {
    g.moveTo(x,y-s*.8); g.lineTo(x-s*.35,y+s*.55); g.lineTo(x+s*.35,y+s*.55); g.close(); g.fill(); g.stroke();
  } else if (key === "totem") {
    g.rect(x-s*.3,y-s*.65,s*.6,s*1.3); g.fill(); g.circle(x,y-s*.8,s*.2); g.fill();
  } else if (key === "bat") {
    g.moveTo(x, y + s * 0.15);
    g.lineTo(x - s, y + s * 0.6);
    g.lineTo(x - s * 0.75, y - s * 0.25);
    g.lineTo(x - s * 0.3, y);
    g.lineTo(x, y - s * 0.5);
    g.lineTo(x + s * 0.3, y);
    g.lineTo(x + s * 0.75, y - s * 0.25);
    g.lineTo(x + s, y + s * 0.6);
    g.close();
    g.fill();
    g.circle(x, y + s * 0.2, s * 0.22);
    g.fill();
  } else return false;
  return true;
}
// Stage thresholds are shared by every field weapon; evolution keeps its own silhouette.
function stage(w: SurvivalWorld, skill: "water" | "poison" | "void" | "mine" | "bat") {
  return formTier(w.skills[skill], !!w.evolutions[skill]);
}
function polygon(g: Graphics, x: number, y: number, radius: number, sides: number, angle = 0) {
  for (let i = 0; i < sides; i++) {
    const a = angle + i * Math.PI * 2 / sides;
    if (i === 0) g.moveTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    else g.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
  }
  g.close();
}
export function drawExpansion(g: Graphics, w: SurvivalWorld) {
  for (const f of w.expansion.fields) {
    const x = f.x * 48, y = f.y * 48, r = f.radius * 48;
    const form = stage(w, f.skill), phase = w.time * 1.5;
    if (w.time < f.due) {
      const t = (w.time - f.created) / (f.due - f.created);
      const px = (f.origin.x + (f.x - f.origin.x) * t) * 48;
      const py = (f.origin.y + (f.y - f.origin.y) * t) * 48 + Math.sin(t * Math.PI) * 60 + 15;
      g.fillColor = color(COLORS.water); g.strokeColor = color("#ecffff", 180); g.lineWidth = 2;
      if (form === 0) expansionGlyph(g, "water", px, py, 8);
      else {
        // Flask becomes a flying chalice, then a faceted reliquary.
        polygon(g, px, py, 9, form >= 2 ? 6 : 4, phase); g.fill(); g.stroke();
        g.moveTo(px - 5, py + 11); g.lineTo(px + 5, py + 11); g.moveTo(px, py + 6); g.lineTo(px, py + 15); g.stroke();
      }
      continue;
    }
    // This outer circle is always the actual damage boundary.
    g.fillColor = color(COLORS[f.skill], f.skill === "void" ? 28 : 20);
    g.strokeColor = color(COLORS[f.skill], 90); g.lineWidth = 1.5;
    g.circle(x, y, r); g.fill(); g.stroke();
    if (f.skill === "water") {
      g.strokeColor = color("#c4ffff", 115); g.lineWidth = 2;
      if (f.follow) {
        // Moving crests distinguish the personal tide from stationary altar seals.
        g.strokeColor = color("#b6ffff", 175); g.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          const angle = phase + i * Math.PI * 2 / 3;
          g.arc(x, y, r * 0.82, angle, angle + 1.5, false); g.stroke();
          polygon(g, x + Math.cos(angle) * r * 0.8, y + Math.sin(angle) * r * 0.8, 9, 3, angle + Math.PI / 2);
          g.fillColor = color("#b6ffff", 160); g.fill();
        }
        g.lineWidth = 1.5;
        g.circle(x, y, r * (0.4 + Math.sin(phase * 2) * 0.1)); g.stroke();
      } else if (form === 0) {
        for (let i = 0; i < 2; i++) { g.circle(x, y, r * ((w.time * .6 + i * .5) % 1)); g.stroke(); }
      } else if (form === 1) {
        // A rotating four-petal tidal seal replaces plain ripples.
        for (let i = 0; i < 4; i++) { const a = phase + i * Math.PI / 2; g.arc(x + Math.cos(a) * r * .25, y + Math.sin(a) * r * .25, r * .35, a, a + Math.PI, false); g.stroke(); }
      } else {
        polygon(g, x, y, r * .72, form === 2 ? 6 : 8, phase * .15); g.stroke();
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.moveTo(x + Math.cos(a) * r * .16, y + Math.sin(a) * r * .16); g.lineTo(x + Math.cos(a) * r * .6, y + Math.sin(a) * r * .6); }
        g.stroke();
        if (form >= 3) { g.circle(x, y, r * (.25 + Math.sin(phase) * .04)); g.stroke(); }
        if (w.evolutions[f.skill]) { g.lineWidth = 4; g.moveTo(x - r * .2, y); g.lineTo(x + r * .2, y); g.moveTo(x, y - r * .3); g.lineTo(x, y + r * .4); g.stroke(); }
      }
    } else if (f.skill === "void") {
      g.fillColor = color("#191329", 180);
      if (form < 2) { g.circle(x, y, r * .22); g.fill(); }
      else { polygon(g, x, y, r * .3, form === 2 ? 4 : 6, -phase); g.fill(); }
      g.strokeColor = color("#bb9eff", 120); g.lineWidth = 2;
      if(f.form === "singularity"){g.lineWidth=4;polygon(g,x,y,r*.6,3,-phase);g.stroke();g.circle(x,y,r*.18);g.fill();}
      else if (form === 0) {
        for (let i = 0; i < 3; i++) { const a = phase + i * 2.1; g.arc(x, y, r * (.45 + i * .18), a, a + 1.8, false); g.stroke(); }
      } else {
        // Inward spiral arms become a rotating aperture, then an eclipse.
        for (let i = 0; i < 4; i++) {
          const a = -phase + i * Math.PI / 2;
          g.moveTo(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8);
          g.quadraticCurveTo(x + Math.cos(a + 1) * r * .6, y + Math.sin(a + 1) * r * .6, x + Math.cos(a + 1.8) * r * .28, y + Math.sin(a + 1.8) * r * .28);
        } g.stroke();
        if (form >= 2) { polygon(g, x, y, r * .65, form === 2 ? 4 : 6, phase * .3); g.stroke(); }
        if (form >= 3) { g.arc(x, y, r * .4, phase, phase + Math.PI * 1.7, false); g.stroke(); }
        if (w.evolutions[f.skill]) { g.lineWidth = 4; g.arc(x, y, r * .31, -phase, -phase + Math.PI, false); g.stroke(); }
      }
    } else {
      g.strokeColor = color("#d8ffa4", 110); g.lineWidth = 2;
      if(f.form === "venom") {
        g.strokeColor=color("#e7ff87",190);g.lineWidth=3;
        polygon(g,x,y,r*.7,3,-Math.PI/2);g.stroke();
        g.fillColor=color("#d0f578",110);g.circle(x,y,r*.25);g.fill();
        for(let i=0;i<5;i++){const a=i*Math.PI*2/5+phase;g.circle(x+Math.cos(a)*r*.55,y+Math.sin(a)*r*.55,3);g.fill();}
      } else if (form === 0) {
        for (let i = 0; i < 4; i++) { const a = i * 1.57 + phase * .1; g.fillColor = color(COLORS.poison, 22); g.circle(x + Math.cos(a) * r * .4, y + Math.sin(a) * r * .4, r * .35); g.fill(); }
      } else {
        // Toxic puddle develops roots, thorned leaves, then a spore flower.
        const petals = form === 1 ? 3 : form === 2 ? 4 : 6;
        for (let i = 0; i < petals; i++) {
          const a = i * Math.PI * 2 / petals + Math.sin(phase) * .08;
          const tipX = x + Math.cos(a) * r * .78, tipY = y + Math.sin(a) * r * .78;
          g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a - .5) * r * .55, y + Math.sin(a - .5) * r * .55, tipX, tipY);
          g.quadraticCurveTo(x + Math.cos(a + .5) * r * .55, y + Math.sin(a + .5) * r * .55, x, y);
        } g.stroke();
        if (form >= 2) { polygon(g, x, y, r * .23, 6, -phase * .2); g.stroke(); }
        if (form >= 3) { g.fillColor = color("#ddffb3", 110); for (let i = 0; i < 3; i++) { const a = phase + i * 2.094; g.circle(x + Math.cos(a) * r * .37, y + Math.sin(a) * r * .37, 3); } g.fill(); }
        if (w.evolutions[f.skill]) { g.moveTo(x - r * .12, y + r * .1); g.lineTo(x + r * .12, y + r * .1); g.moveTo(x, y); g.lineTo(x, y - r * .18); g.stroke(); }
      }
    }
  }
  for (const m of w.expansion.mines) {
    const x = m.x * 48, y = m.y * 48, form = stage(w, "mine");
    g.fillColor = color(COLORS.mine, m.armed > w.time ? 80 : 230); g.strokeColor = color("#fff4c4", 190); g.lineWidth = 2;
    if(m.form === "demolition"){g.roundRect(x-13,y-10,26,20,3);g.fill();g.moveTo(x-8,y-7);g.lineTo(x+8,y+7);g.moveTo(x-8,y+7);g.lineTo(x+8,y-7);g.stroke();}
    else if (form === 0) expansionGlyph(g, "mine", x, y, 9);
    else {
      // Round charge -> jaw trap -> runic plate -> mechanical star.
      polygon(g, x, y, 10, form === 1 ? 4 : form === 2 ? 6 : 8, Math.PI / 4); g.fill(); g.stroke();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.moveTo(x + Math.cos(a - .2) * 15, y + Math.sin(a - .2) * 15); g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); g.lineTo(x + Math.cos(a + .2) * 15, y + Math.sin(a + .2) * 15); } g.stroke();
      if (form >= 2) { polygon(g, x, y, 5, 3, -w.time); g.stroke(); }
      if (form >= 3) { g.circle(x, y, 18); g.stroke(); }
      if (w.evolutions.mine) { g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.moveTo(x, y - 6); g.lineTo(x, y + 6); g.stroke(); }
    }
    if (m.armed <= w.time) { g.fillColor = color("#fff1a3", 180 + Math.sin(w.time * 10) * 50); g.circle(x, y, 3); g.fill(); }
  }
  for (const b of w.expansion.bats) {
    const form = stage(w, "bat"), x = b.x * 48, y = b.y * 48 + 14;
    g.fillColor = color(b.returning ? "#eea5b8" : COLORS.bat); g.strokeColor = color("#f6b8d0", 170); g.lineWidth = 1.5;
    if(b.form === "bloodhunt"){g.fillColor=color("#ffb3d3",230);polygon(g,x,y,16,3,-Math.PI/2);g.fill();for(const side of [-1,1]){g.moveTo(x,y);g.lineTo(x+side*24,y+8);g.lineTo(x+side*13,y-7);g.close();g.fill();}}
    else if (form === 0) expansionGlyph(g, "bat", x, y + Math.sin(w.time * 22 + b.id) * 3, 9);
    else {
      // Animated membrane wings; higher forms gain hooked tips and a crown.
      const flap = Math.sin(w.time * 22 + b.id), wing = 13 + form * 2;
      for (const side of [-1, 1]) {
        g.moveTo(x, y + 3); g.lineTo(x + side * wing, y + 8 + flap * 5);
        g.lineTo(x + side * wing * .8, y - 5); g.lineTo(x + side * wing * .5, y - 1 + flap * 2); g.lineTo(x + side * 3, y - 5); g.close(); g.fill(); g.stroke();
        if (form >= 2) { g.moveTo(x + side * wing, y + 8 + flap * 5); g.lineTo(x + side * (wing + 3), y + 13 + flap * 5); g.stroke(); }
      }
      g.fillColor = color("#442139"); polygon(g, x, y, 5, 4); g.fill();
      if (form >= 3) { g.strokeColor = color("#ffe0ad"); g.moveTo(x - 5, y + 6); g.lineTo(x - 4, y + 11); g.lineTo(x, y + 8); g.lineTo(x + 4, y + 11); g.lineTo(x + 5, y + 6); g.stroke(); }
      if (w.evolutions.bat) { g.strokeColor = color("#ff91af", 140); g.arc(x, y, 11, w.time * 3, w.time * 3 + Math.PI, false); g.stroke(); }
    }
  }
}
