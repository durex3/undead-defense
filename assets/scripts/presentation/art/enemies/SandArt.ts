import { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { Pose } from "../Actor";
import type { EnemyArt } from "../EnemyCatalog";
import { drawEgg, drawGrub, drawHumanoid, drawInsect } from "../Archetypes";
import { Silhouette, curvedLimb, detailArc, detailEllipse, detailLine, detailPoly } from "../Brush";
import { ink } from "../Ink";

function buried(g: Graphics, pose: Pose, enemy: Enemy) {
  const s = enemy.sand!;
  const end = s.end ?? { x: enemy.x, y: enemy.y };
  g.strokeColor = ink("#efd29b", 190);
  g.lineWidth = Math.max(2, 4 * pose.scale);
  g.moveTo(end.x * 48, end.y * 48);
  g.lineTo(pose.x, pose.y);
  g.stroke();
  const r = 17 * pose.scale;
  g.fillColor = ink("#e4b776", 210);
  g.ellipse(pose.x, pose.y + 2 * pose.scale, r, 6 * pose.scale);
  g.fill();
  g.fillColor = ink("#b57952", 180);
  g.ellipse(pose.x, pose.y + 4 * pose.scale, r * 0.6, 4 * pose.scale);
  g.fill();
  if (pose.detail) {
    for (let i = 0; i < 3; i++) {
      const a = pose.time * 2 + i * 2.1;
      detailEllipse(g, pose, Math.cos(a) * r * 0.7, 6 + Math.sin(a) * 2, 2.2, 1.4, "#e8c18f", 150);
    }
  }
}

function sandEgg(g: Graphics, pose: Pose, art: EnemyArt, enemy: Enemy, time: number) {
  drawEgg(g, pose, art);
  const hatch = enemy.sand?.hatch;
  if (hatch !== undefined) {
    const u = Math.max(0, Math.min(1, 1 - (hatch - time) / 3.2));
    if (u > 0.25) {
      detailLine(g, pose, [-4, 15], [4, 10], art.palette.shade, 1.2, 200);
      detailLine(g, pose, [4, 10], [-2, 4], art.palette.shade, 1.2, 200);
    }
  }
}

function shellRoller(g: Graphics, pose: Pose, art: EnemyArt, enemy: Enemy) {
  const h = art.height;
  const p = art.palette;
  const r = h * 0.42;
  const rolling = enemy.sand?.action === "roll" && (enemy.state === "charge" || enemy.state === "windup");
  const s = new Silhouette(g, pose, p.base, p.outline, 2.2);
  s.ellipse(0, r, r, r * 0.9, 10);
  if (rolling) {
    // Curled legs tuck under the shell while rolling.
    for (const side of [-1, 1]) s.ellipse(side * r * 0.7, r * 0.3, r * 0.18, r * 0.14, 6);
  } else {
    for (const side of [-1, 1]) {
      s.limb([side * r * 0.55, r * 0.45], [side * r * 0.85, 2], 2.2, 1.4);
    }
    s.ellipse(r * 0.9, r * 0.4, r * 0.25, r * 0.2, 6);
  }
  s.commit();
  detailEllipse(g, pose, -r * 0.1, r * 0.45, r * 0.55, r * 0.35, p.light);
  detailLine(g, pose, [-r * 0.7, r * 0.55], [r * 0.5, r * 0.55], p.shade, 1.3);
  if (rolling) {
    const spin = pose.time * 10;
    detailArc(g, pose, 0, r, r * 0.82, spin, spin + Math.PI * 1.3, p.accent, 2.2, 220, 12);
  } else {
    detailEllipse(g, pose, r * 0.9, r * 0.45, 1.6, 1.6, p.eye);
  }
}

function spitter(g: Graphics, pose: Pose, art: EnemyArt) {
  drawInsect(g, pose, art, {
    extra: (s, p) => {
      // Bloated sand sac on the back.
      s.ellipse(-art.height * 0.2, art.height * 0.58, art.height * 0.24, art.height * 0.2, 10);
    },
    details: (gg, p) => {
      if (art.detail < 1) return;
      detailEllipse(gg, p, -art.height * 0.2, art.height * 0.62, art.height * 0.14, art.height * 0.11, art.palette.cloth);
      detailEllipse(gg, p, -art.height * 0.22, art.height * 0.65, art.height * 0.06, art.height * 0.05, art.palette.light, 170);
    },
  });
}

function stalker(g: Graphics, pose: Pose, art: EnemyArt) {
  drawInsect(g, pose, art, {
    extra: (s) => {
      // Back fins and digging claws.
      for (const u of [-0.45, -0.15, 0.15]) {
        const x = u * art.height * 0.28;
        s.poly([[x - 2, art.height * 0.58], [x + 1, art.height * 0.76], [x + 4, art.height * 0.58]]);
      }
      for (const side of [-1, 1])
        s.poly(curvedLimb([side * 6, 10], [side * 14, 5], [side * 20, 1], 2.2, 0.5, 4));
    },
    details: (gg, p) => {
      if (art.detail < 1) return;
      detailLine(gg, p, [-9, 13], [9, 13], art.palette.shade, 1.2);
    },
  });
}

function broodMother(g: Graphics, pose: Pose, art: EnemyArt) {
  drawInsect(g, pose, art, {
    extra: (s) => {
      s.ellipse(-art.height * 0.34, art.height * 0.55, art.height * 0.26, art.height * 0.28, 10);
      for (const [u, v, r] of [[-0.4, 0.58, 0.07], [-0.28, 0.66, 0.06], [-0.5, 0.48, 0.06]] as const)
        s.ellipse(u * art.height, v * art.height, r * art.height, r * art.height, 6);
    },
    details: (gg, p) => {
      detailEllipse(gg, p, -art.height * 0.36, art.height * 0.62, art.height * 0.18, art.height * 0.2, art.palette.cloth);
      for (const [u, v, r] of [[-0.4, 0.58, 0.05], [-0.28, 0.66, 0.045], [-0.5, 0.48, 0.045]] as const)
        detailEllipse(gg, p, u * art.height, v * art.height, r * art.height, r * art.height, art.palette.bone);
      if (art.detail >= 2) detailArc(gg, p, 0, art.height * 0.45, art.height * 0.35, 0.3, Math.PI * 1.4, art.palette.accent, 1.4);
    },
  });
}

function breaker(g: Graphics, pose: Pose, art: EnemyArt) {
  drawInsect(g, pose, art, {
    extra: (s) => {
      // Heavy shoulder plates.
      for (const side of [-1, 1]) s.ellipse(side * art.height * 0.17, art.height * 0.5, art.height * 0.12, art.height * 0.09, 8);
      s.poly([[0, art.height * 0.62], [art.height * 0.08, art.height * 0.82], [art.height * 0.16, art.height * 0.62]]);
    },
    details: (gg, p) => {
      if (art.detail >= 2) {
        for (const side of [-1, 1]) detailEllipse(gg, p, side * art.height * 0.17, art.height * 0.52, art.height * 0.07, art.height * 0.05, art.palette.metal);
      }
    },
  });
}

function sandBoss(g: Graphics, pose: Pose, art: EnemyArt, enemy: Enemy) {
  drawInsect(g, pose, art, {
    extra: (s) => {
      // Queen crown horns and a huge egg-heavy abdomen.
      for (const side of [-1, 1]) {
        s.poly(curvedLimb([side * 8, art.height * 0.72], [side * 22, art.height * 0.98], [side * 34, art.height * 0.78], 3.2, 0.6, 5));
        s.poly([[side * 16, art.height * 0.58], [side * 30, art.height * 0.66], [side * 18, art.height * 0.72]]);
      }
      if (enemy.bossPhase >= 2) for(const side of [-1,1])
        s.poly([[side*art.height*.15,art.height*.6],[side*art.height*.38,art.height*.95],
          [side*art.height*.3,art.height*.62]]);
      for (const [u, v, r] of [[-0.3, 0.5, 0.09], [-0.44, 0.58, 0.08], [-0.18, 0.62, 0.07]] as const)
        s.ellipse(u * art.height, v * art.height, r * art.height, r * art.height, 8);
    },
    details: (gg, p) => {
      detailEllipse(gg, p, -art.height * 0.34, art.height * 0.55, art.height * 0.2, art.height * 0.24, art.palette.cloth);
      for (const [u, v, r] of [[-0.3, 0.5, 0.06], [-0.44, 0.58, 0.055], [-0.18, 0.62, 0.05]] as const)
        detailEllipse(gg, p, u * art.height, v * art.height, r * art.height, r * art.height, art.palette.bone);
      if (art.detail >= 3) {
        detailArc(gg, p, 0, art.height * 0.45, art.height * 0.4, 0.2, Math.PI * 1.5, art.palette.accent, 1.6);
        detailEllipse(gg, p, 0, art.height * 0.6, art.height * 0.08, art.height * 0.08, "#ffb464");
      }
    },
  });
}

export function drawSandBody(g: Graphics, w: SurvivalWorld, enemy: Enemy, art: EnemyArt, pose: Pose) {
  if (enemy.sand?.buried) {
    buried(g, pose, enemy);
    return;
  }
  if (enemy.kind === "minion") {
    drawHumanoid(g, pose, art);
    return;
  }
  switch (enemy.kind) {
    case "sandegg":
      sandEgg(g, pose, art, enemy, w.time);
      break;
    case "sandlarva":
      if (enemy.state === "windup") sandEgg(g, pose, art, enemy, w.time);
      else drawGrub(g, pose, art);
      break;
    case "shellroller":
      shellRoller(g, pose, art, enemy);
      break;
    case "sandspitter":
      spitter(g, pose, art);
      break;
    case "sandstalker":
      stalker(g, pose, art);
      break;
    case "broodelite":
      broodMother(g, pose, art);
      break;
    case "breakerelite":
      breaker(g, pose, art);
      break;
    case "boss":
      sandBoss(g, pose, art, enemy);
      break;
    default:
      drawInsect(g, pose, art);
      break;
  }
}
