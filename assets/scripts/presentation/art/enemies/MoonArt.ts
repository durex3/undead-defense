import { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import { torsoOffset, type Pose } from "../Actor";
import type { EnemyArt } from "../EnemyCatalog";
import { drawHumanoid, drawQuadruped } from "../Archetypes";
import { Silhouette, arcPoints, curvedLimb, detailArc, detailEllipse, detailLine, detailPoly, eye } from "../Brush";

function drawMantis(g: Graphics, pose: Pose, art: EnemyArt, enemy: Enemy) {
  const h = art.height;
  const p = art.palette;
  const b = art.look.bulk;
  const rich = art.detail >= 1;
  const detailed = art.detail >= 3;
  const shift=torsoOffset(pose)*.55;
  const hipY = h * 0.4 + shift*.6;
  const shoulderY = h * 0.68 + shift;
  const headY = h * 0.84 + shift;
  const headR = h * 0.1;
  const stance = -pose.windup*4 + pose.recover*4;
  const stride = pose.stride;

  // Cape behind an elite.
  if (art.look.cape && art.detail >= 2) {
    const cs = new Silhouette(g, pose, art.palette.cloth, p.outline, 2.6);
    cs.poly([
      [-h * 0.12, shoulderY + 3],
      [-h * 0.24, hipY - 4],
      [-h * 0.2, hipY - 14],
      [-h * 0.02, hipY - 7],
      [h * 0.04, shoulderY + 1],
    ]);
    cs.commit();
  }

  const s = new Silhouette(g, pose, art.palette.base, p.outline, art.detail >= 2 ? 2.6 : 2.1);
  // Abdomen and thorax.
  s.ellipse(-h * 0.12, hipY - 3, h * 0.16 * b, h * 0.2 * b, art.detail >= 2 ? 10 : 8);
  s.poly([
    [-h * 0.09, hipY + 2],
    [h * 0.07, hipY + 2],
    [h * 0.1, shoulderY],
    [-h * 0.08, shoulderY],
  ]);
  // Legs.
  for (const side of [-1, 1]) {
    const footX = side * h * 0.14 + side * stride * 1.2;
    if (detailed) {
      s.limb([side * 4, hipY], [side * h * 0.12 + side * stride, hipY * 0.45], 2.4, 1.8);
      s.limb([side * h * 0.12 + side * stride, hipY * 0.45], [footX, 1.5], 1.8, 1.4);
    } else {
      s.limb([side * 4, hipY], [footX, 1.5], 2.2, 1.5);
    }
    s.poly([
      [footX - 2.4, 0.4],
      [footX + 2.4, 0.4],
      [footX + 2.2, 3.2],
      [footX - 2.2, 3.2],
    ]);
  }
  // Head.
  s.ellipse(0, headY, headR, headR * 0.86, art.detail >= 2 ? 8 : 6);
  s.poly([
    [-headR * 0.45, headY + headR * 0.6],
    [-headR * 0.75, headY + headR * 1.15],
    [-headR * 0.2, headY + headR * 0.75],
  ]);
  // Blade arms.
  const bladeAngle = -pose.windup*.7 + pose.recover*.65 + Math.max(0,pose.lean)*.08;
  for (const side of [-1, 1]) {
    const shoulder: [number, number] = [side * h * 0.08, shoulderY - 2];
    const hand: [number, number] = [side * h * 0.18 + Math.sin(bladeAngle) * 8, shoulderY - h * 0.12 + stance + side * 2];
    if (detailed) {
      s.limb(shoulder, [side * h * 0.16, shoulderY - h * 0.08], 2.2, 1.8);
      s.limb([side * h * 0.16, shoulderY - h * 0.08], hand, 1.8, 1.4);
    } else {
      s.limb(shoulder, hand, 2.1, 1.5);
    }
    const tip: [number, number] = [hand[0] + side * h * 0.28, hand[1] + h * (.18 + pose.windup*.2 - Math.max(0,pose.lean)*.012)];
    const control: [number, number] = [hand[0] + side * h * 0.16, hand[1] + h * 0.03];
    s.poly(curvedLimb(hand, control, tip, 3.2, 0.5, 6));
    if (art.detail >= 2) s.poly(curvedLimb([hand[0] - side * 2, hand[1]], [hand[0] + side * 10, hand[1] + 4], [hand[0] + side * 20, hand[1] + 1], 1.4, 0.3, 4));
  }
  s.commit();

  // Materials.
  detailPoly(g,pose,[[-h*.24,hipY],[-h*.17,hipY+h*.12],[-h*.06,hipY+h*.1],
    [-h*.04,hipY-h*.02],[-h*.14,hipY-h*.1]],art.palette.light);
  if (rich) {
    detailLine(g, pose, [-h * 0.05, hipY + 4], [h * 0.06, hipY + 4], art.palette.shade, 1.2);
    eye(g, pose, h * 0.02, headY + 1, Math.max(1.3, headR * 0.2), art.palette.eye);
    detailLine(g, pose, [-headR * 0.4, headY + headR * 0.6], [-headR * 0.7, headY + headR * 1.1], art.palette.metalLight, 1);
  }
  if (art.detail >= 2) {
    for (const side of [-1, 1]) {
      const shoulder: [number, number] = [side * h * 0.08, shoulderY - 2];
      const hand: [number, number] = [side * h * 0.18 + Math.sin(bladeAngle)*8, shoulderY - h * 0.12 + stance + side * 2];
      detailLine(g, pose, hand, [hand[0] + side * h * 0.24, hand[1] + h * 0.15], art.palette.accent, 1.5);
      detailArc(g, pose, shoulder[0], shoulder[1], h * 0.1, side > 0 ? -1.2 : 1.9, side > 0 ? 0.4 : 3.5, art.palette.metalLight, 1.1, 200, 8);
    }
  }
  if (enemy.moon?.action === "sweeps" || enemy.moon?.action === "blades") {
    detailArc(g, pose, 0, shoulderY, h * 0.34, 0.2, Math.PI * 1.7, art.palette.accent, 1.2, 150, 12);
  }
}

function moonBeast(g: Graphics, pose: Pose, art: EnemyArt, enemy: Enemy) {
  drawQuadruped(g, pose, art, {
    details: (gg, p) => {
      if (art.detail >= 2) {
        const haloX = -art.height * 0.08,
          haloY = art.height * 0.6,
          haloR = art.height * 0.36;
        detailArc(gg, p, haloX, haloY, haloR, 0.2, Math.PI * 1.4, art.palette.accent, 1.4, 150, 12);
        if (enemy.bossPhase >= 2) detailArc(gg, p, haloX, haloY, haloR * 0.8, Math.PI * 1.1, Math.PI * 2.1, art.palette.eye, 1.2, 130, 10);
      }
    },
  });
}

function moonBoss(g: Graphics, pose: Pose, art: EnemyArt, enemy: Enemy) {
  const h = art.height;
  const p = art.palette;
  drawQuadruped(g, pose, art, {
    back: (s) => {
      // A crescent rises behind the shoulders, leaving the elk's torso visible.
      const outer = arcPoints(-h*.16,h*.76,h*.38,.8,Math.PI*1.5,12);
      const inner = arcPoints(-h*.03,h*.79,h*.31,Math.PI*1.5,.8,12);
      s.poly(outer.concat(inner));
    },
    extra: (s) => {
      for (const side of [-1, 1]) s.poly(curvedLimb([side * h * 0.12, h * 0.68], [side * h * 0.3, h * 0.95], [side * h * 0.46, h * 0.7], 2.4, 0.6, 5));
      if (enemy.bossPhase >= 2) for (const side of [-1,1]) {
        s.limb([side*h*.26,h*.87],[side*h*.45,h*1.1],2.5,.6);
        s.limb([side*h*.36,h*.98],[side*h*.54,h*.99],1.8,.4);
      }
    },
    details: (gg, q) => {
      detailLine(gg, q, [-h*.26,h*.91],[-h*.4,h*.78],art.palette.accent,1.7,190);
      detailPoly(gg, q, [[-h*.15,h*.59],[h*.15,h*.66],[h*.28,h*.5],[h*.1,h*.4],[-h*.12,h*.45]],art.palette.cloth,170);
      if (enemy.bossPhase >= 2) {
        detailArc(gg, q, -h * 0.1, h * 0.62, h * 0.23, Math.PI * 1.1, Math.PI * 2.2, art.palette.eye, 1.4, 170, 12);
      }
    },
  });
}

export function drawMoonBody(g: Graphics, _w: SurvivalWorld, enemy: Enemy, art: EnemyArt, pose: Pose) {
  if (enemy.kind === "minion") {
    drawHumanoid(g, pose, art);
    return;
  }
  switch (enemy.kind) {
    case "crescentmantis":
    case "moonreaver":
      drawMantis(g, pose, art, enemy);
      break;
    case "boss":
      moonBoss(g, pose, art, enemy);
      break;
    default:
      moonBeast(g, pose, art, enemy);
      break;
  }
}
