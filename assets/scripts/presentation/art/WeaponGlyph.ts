import {drawGhostForm} from "./WeaponFormArt";
import {drawHolyForm} from "./WeaponFormArt";
import {drawFireForm} from "./WeaponFormArt";
import { drawWaterForm, drawBoneForm, drawBladeForm, drawHammerForm, drawWheelForm } from "./WeaponFormArt";
import type { Graphics } from "cc";
import type { Skill } from "../../battle/SurvivalConfig";
import { COLORS } from "../../battle/SurvivalConfig";
import { ink } from "./Ink";
/** Small program-authored catalogue emblems, not damage/attack previews. */
export function drawWeaponGlyph(g: Graphics, skill: Skill, grade=1) {
  g.fillColor = ink(COLORS[skill]);
  g.strokeColor = ink("#141c25");
  g.lineWidth = 2;
  const poly = (p: number[][]) => {
    p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.close();
    g.fill();
    g.stroke();
  };
  if(skill==="ghost"&&grade>1){drawGhostForm(g,0,0,grade,.8);return;}
  if(skill==="holy"&&grade>1){drawHolyForm(g,0,0,grade,.8);return;}
  if(skill==="fire"&&grade>1){drawFireForm(g,0,0,0,grade,.9);return;}
  if(skill==="water"&&grade>1){drawWaterForm(g,0,0,0,grade,.8);return;}
  if(skill==="bone"&&grade>1){drawBoneForm(g,0,0,.8,grade,.8);return;}
  if(skill==="blade" && grade>1) {drawBladeForm(g,0,0,.8,grade);return;}
  if(skill==="wheel" && grade>2) {drawWheelForm(g,0,0,0,grade,.9);return;}
  if(skill==="hammer" && grade>2) {drawHammerForm(g,0,0,0,grade,.8);return;}
  if(skill==="lamp") {
    poly([[-14,-19],[-11,12],[0,23],[11,12],[14,-19]]);g.fillColor=ink("#e6fff0");poly([[-5,-10],[-6,3],[0,15],[6,1],[5,-10]]);return;
  }
  if(skill==="needle") {
    poly([[-9,-24],[-4,12],[5,25],[10,14],[-1,-5]]);g.strokeColor=ink("#ead4fa");g.lineWidth=2;g.ellipse(4,15,3,6);g.moveTo(8,17);g.quadraticCurveTo(28,4,9,-15);g.stroke();return;
  }
  if (skill === "blade") {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      poly([
        [Math.cos(a) * 8, Math.sin(a) * 8],
        [
          Math.cos(a) * 23 - Math.sin(a) * 3,
          Math.sin(a) * 23 + Math.cos(a) * 3,
        ],
        [
          Math.cos(a) * 20 + Math.sin(a) * 4,
          Math.sin(a) * 20 - Math.cos(a) * 4,
        ],
      ]);
    }
  } else if (skill === "hammer") {
    poly([
      [-3, -21],
      [3, -21],
      [3, 7],
      [-3, 7],
    ]);
    poly([
      [-18, 5],
      [-18, 19],
      [18, 19],
      [18, 5],
    ]);
  } else if (skill === "wheel" || skill === "mine") {
    const n = skill === "wheel" ? 24 : 6,
      p = [];
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        r = skill === "wheel" ? (i % 2 ? 21 : 16) : 19;
      p.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    poly(p);
    g.fillColor = ink("#25363e");
    g.circle(0, 0, skill === "wheel" ? 7 : 4);
    g.fill();
  } else if (skill === "fire")
    poly([
      [-15, -13],
      [-18, 0],
      [-8, 12],
      [-5, 4],
      [4, 23],
      [15, 6],
      [18, -7],
      [8, -18],
      [-5, -18],
    ]);
  else if (skill === "water") {
    poly([
      [-7, 19],
      [7, 19],
      [7, 6],
      [16, -11],
      [12, -20],
      [-12, -20],
      [-16, -11],
      [-7, 6],
    ]);
  } else if (skill === "ghost")
    poly([
      [-18, -20],
      [-15, 9],
      [-5, 22],
      [5, 22],
      [15, 9],
      [18, -20],
      [7, -13],
      [0, -21],
      [-6, -12],
    ]);
  else if (skill === "lightning")
    poly([
      [2, 24],
      [-15, -2],
      [-2, -2],
      [-9, -24],
      [17, 5],
      [4, 5],
    ]);
  else if (skill === "bone" || skill === "holy") {
    poly([
      [-2, -23],
      [2, -23],
      [3, 10],
      [8, 10],
      [0, 25],
      [-8, 10],
      [-3, 10],
    ]);
    if (skill === "holy")
      poly([
        [-15, -4],
        [15, -4],
        [15, 1],
        [-15, 1],
      ]);
  } else if (skill === "frost") {
    g.strokeColor = ink(COLORS[skill]);
    g.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * 22, Math.sin(a) * 22);
      g.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
      g.lineTo(
        Math.cos(a) * 15 + Math.sin(a) * 7,
        Math.sin(a) * 15 - Math.cos(a) * 7,
      );
    }
    g.stroke();
  } else if(skill === "void") {
    g.strokeColor = ink(COLORS[skill]);
    g.lineWidth = 3;
    g.ellipse(0, 0, 22, 12);
    g.stroke();
    g.fillColor = ink("#121922");
    g.circle(0, 0, 10);
    g.fill();
  }
  else {const missing:never=skill;throw Error(`Missing weapon glyph: ${missing}`);}
  if (skill === "ghost") {
    g.fillColor = ink("#18222b");
    g.rect(-9, 4, 5, 4);
    g.rect(4, 4, 5, 4);
    g.fill();
  }
}
