import { gradeOf } from "../../battle/WeaponGrade";
import { drawHammerForm, drawWheelForm } from "./WeaponFormArt";
import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import { ink } from "./Ink";
export function drawUnlockedSpells(
  g: Graphics,
  w: SurvivalWorld,
  reduced = false,
  crowded = false,
) {
  for (const a of w.armory.unlocked.attacks) {
    if (!a.active || a.created > w.time + 0.35 || !w.visible(a, -1)) continue;
    const s = a.stats,
      age = w.time - a.created,
      heavy = s.mods.includes("heavy"),
      scale = heavy ? 1.4 : 1;
    g.fillColor = ink(a.skill === "hammer" ? "#b98a57" : "#7eaf9f");
    g.strokeColor = ink("#172028");
    g.lineWidth = 3;
    if (a.skill === "wheel") {
      const x = a.x * 48,
        y = a.y * 48,
        r = (12 + s.radius * 16) * scale,
        turn = age * 9;
      const grade=gradeOf("wheel",w.weaponGrades);
      if(grade>2)drawWheelForm(g,x,y,turn,grade,r/23,a.phase===2);
      else {
      for (let i = 0; i < 20; i++) {
        const ang = turn + (i * Math.PI) / 10,
          rad = r * (i % 2 ? 1 : 0.76);
        if (!i) g.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
        else g.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
      }
      g.close();
      g.fill();
      g.stroke();
      g.fillColor = ink("#d4e5c7");
      g.circle(x, y, r * 0.42);
      g.fill();
      g.strokeColor = ink("#435e5c");
      g.lineWidth = 2;
      g.moveTo(x - r * 0.28, y);
      g.lineTo(x + r * 0.28, y);
      g.stroke();
      }
      if (!reduced && !crowded && s.mods.includes("grind") && a.phase === 1) {
        g.strokeColor = ink("#dfe3a7");
        for (let i = 0; i < 5; i++) {
          const b = age * 7 + i * 1.256;
          g.moveTo(x + Math.cos(b) * r, y + Math.sin(b) * r);
          g.lineTo(x + Math.cos(b) * (r + 9), y + Math.sin(b) * (r + 9));
        }
        g.stroke();
      }
      if (!reduced && !crowded && s.mods.includes("curve") && a.phase === 2) {
        g.strokeColor = ink("#b7e4cf", 140);
        g.lineWidth = 2;
        g.moveTo(x - Math.cos(a.angle) * 30, y - Math.sin(a.angle) * 30);
        g.quadraticCurveTo(
          x + Math.sin(a.angle) * 12,
          y - Math.cos(a.angle) * 12,
          x,
          y,
        );
        g.stroke();
      }
    } else if (a.phase === 3) {
      const x = a.x * 48,
        y = a.y * 48;
      g.strokeColor = ink(gradeOf("hammer",w.weaponGrades)===4?"#e4c5ff":"#eed59b");
      g.lineWidth = 4;
      g.moveTo(x - Math.cos(a.angle) * 24, y - Math.sin(a.angle) * 24);
      g.lineTo(x + Math.sin(a.angle) * 8, y - Math.cos(a.angle) * 8);
      g.lineTo(x, y);
      g.stroke();
    } else {
      const q = Math.max(0, Math.min(1, age / 0.18)),
        ang = a.angle + (a.returning ? 1 : -1) * (1 - q) * 1.1,
        r = s.radius * 48 * 0.65,
        x = a.x * 48 + Math.cos(ang) * r,
        y = a.y * 48 + Math.sin(ang) * r;
      g.strokeColor = ink("#202329");
      g.lineWidth = 8;
      g.moveTo(a.x * 48, a.y * 48 + 12);
      g.lineTo(x, y);
      g.stroke();
      g.strokeColor = ink("#bbaa7b");
      g.lineWidth = 4;
      g.moveTo(a.x * 48, a.y * 48 + 12);
      g.lineTo(x, y);
      g.stroke();
      const nx = Math.cos(ang) * 12 * scale,
        ny = Math.sin(ang) * 12 * scale,
        px = -Math.sin(ang) * 21 * scale,
        py = Math.cos(ang) * 21 * scale;
      const grade=gradeOf("hammer",w.weaponGrades);
      if(grade>2) drawHammerForm(g,x,y,ang,grade,scale);
      else {
      g.moveTo(x - nx - px, y - ny - py);
      g.lineTo(x + nx - px, y + ny - py);
      g.lineTo(x + nx + px, y + ny + py);
      g.lineTo(x - nx + px, y - ny + py);
      g.close();
      g.fill();
      g.strokeColor = ink("#27272b");
      g.lineWidth = 3;
      g.stroke();
      g.strokeColor = ink("#f4dfaa");
      g.lineWidth = 3;
      g.moveTo(x - nx * 0.3 - px * 0.7, y - ny * 0.3 - py * 0.7);
      g.lineTo(x - nx * 0.3 + px * 0.7, y - ny * 0.3 + py * 0.7);
      g.stroke();
      }
      if (age >= 0) {
        g.strokeColor = ink("#dbc397", 160);
        g.lineWidth = 3;
        g.arc(a.x * 48, a.y * 48, r, a.angle - 0.8, a.angle + 0.8, false);
        g.stroke();
      }
    }
  }
}
