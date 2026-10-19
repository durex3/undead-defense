import { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { Pose } from "../Actor";
import type { EnemyArt } from "../EnemyCatalog";
import { drawDevice, drawFloat, drawHumanoid, drawMech } from "../Archetypes";
import { curvedLimb, detailArc, detailEllipse, detailLine, detailPoly } from "../Brush";

function device(g: Graphics, pose: Pose, art: EnemyArt, enemy: Enemy) {
  drawDevice(g, pose, art, {
    extra: (s) => {
      if (enemy.kind === "thunderanchor") {
        s.limb([0, art.height * 0.5], [art.height * 0.22, art.height * 0.2], 1.4, 1.1);
        s.limb([art.height * 0.22, art.height * 0.2], [art.height * 0.34, art.height * 0.1], 1.6, 0.8);
        s.limb([art.height * 0.22, art.height * 0.2], [art.height * 0.12, art.height * 0.06], 1.6, 0.8);
      } else {
        for (const side of [-1, 1]) s.limb([side * art.height * 0.1, art.height * 0.5], [side * art.height * 0.22, art.height * 0.38], 1.2, 0.8);
      }
    },
    details: (gg, p) => {
      if (art.detail < 1) return;
      detailArc(gg, p, 0, art.height * 0.78, art.height * 0.17, 0.2, Math.PI * 1.6, art.palette.eye, 1.6, 220);
      if (enemy.kind === "thunderanchor") detailLine(gg, p, [0, art.height * 0.2], [art.height * 0.2, art.height * 0.12], art.palette.metalLight, 1.2);
    },
  });
}

function rivetWalker(g: Graphics, pose: Pose, art: EnemyArt) {
  drawMech(g, pose, art, {
    extra: (s) => {
      // Smokestack.
      s.plate(art.height * 0.24, art.height * 0.7, art.height * 0.08, art.height * 0.2, 1.4);
    },
    details: (gg, p) => {
      if (art.detail < 1) return;
      detailLine(gg, p, [-art.height * 0.15, art.height * 0.55], [art.height * 0.12, art.height * 0.55], art.palette.metalLight, 1.3);
      for (let i = 0; i < 3; i++) detailEllipse(gg, p, art.height * 0.24, art.height * (0.92 + i * 0.08), 2.2, 1.6, art.palette.shade, 120);
    },
  });
}

function anchorWeaver(g: Graphics, pose: Pose, art: EnemyArt) {
  drawMech(g, pose, art, {
    details: (gg, p) => {
      if (art.detail < 1) return;
      detailArc(gg, p, 0, art.height * 0.35, art.height * 0.34, 0.4, Math.PI * 1.5, art.palette.accent, 1.4);
    },
  });
}

function railSaw(g: Graphics, pose: Pose, art: EnemyArt, enemy: Enemy) {
  drawMech(g, pose, art, {
    details: (gg, p) => {
      const cx = art.height * 0.74, cy = art.height * 0.46;
      const spin = pose.id + (pose.frozen ? 0 : (enemy.sand?.action ? pose.time * 8 : pose.time * 12));
      detailArc(gg, p, cx, cy, art.height * 0.11, spin, spin + Math.PI * 1.5, art.palette.metalLight, 1.5, 220, 10);
      detailEllipse(gg, p, cx, cy, art.height * 0.045, art.height * 0.045, art.palette.eye);
    },
  });
}

function railReaper(g: Graphics, pose: Pose, art: EnemyArt) {
  drawMech(g, pose, art, {
    extra: (s) => {
      // Second saw arm on the opposite side.
      s.limb([-art.height * 0.3, art.height * 0.5], [-art.height * 0.52, art.height * 0.34], 2.2, 1.8);
      s.ellipse(-art.height * 0.58, art.height * 0.34, art.height * 0.12, art.height * 0.12, 10);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        s.poly([
          [-art.height * 0.58 + Math.cos(a) * art.height * 0.1, art.height * 0.34 + Math.sin(a) * art.height * 0.1],
          [-art.height * 0.58 + Math.cos(a + 0.22) * art.height * 0.17, art.height * 0.34 + Math.sin(a + 0.22) * art.height * 0.17],
          [-art.height * 0.58 + Math.cos(a + 0.42) * art.height * 0.1, art.height * 0.34 + Math.sin(a + 0.42) * art.height * 0.1],
        ]);
      }
    },
    details: (gg, p) => {
      if (art.detail < 2) return;
      detailArc(gg, p, -art.height * 0.58, art.height * 0.34, art.height * 0.08, pose.time * 10, pose.time * 10 + Math.PI * 1.5, art.palette.metalLight, 1.3, 220, 8);
    },
  });
}

function gridWarden(g: Graphics, pose: Pose, art: EnemyArt) {
  drawMech(g, pose, art, {
    extra: (s) => {
      for (const side of [-1, 1]) {
        s.ellipse(side * art.height * 0.26, art.height * 0.68, art.height * 0.09, art.height * 0.09, 8);
        s.limb([side * art.height * 0.24, art.height * 0.6], [side * art.height * 0.26, art.height * 0.72], 1.4, 1.2);
      }
    },
    details: (gg, p) => {
      for (const side of [-1, 1]) {
        detailEllipse(gg, p, side * art.height * 0.26, art.height * 0.68, art.height * 0.05, art.height * 0.05, art.palette.eye);
        if (art.detail >= 2) detailArc(gg, p, side * art.height * 0.26, art.height * 0.68, art.height * 0.08, 0.3, Math.PI * 1.5, art.palette.accent, 1.2);
      }
    },
  });
}

function thunderBoss(g: Graphics, pose: Pose, art: EnemyArt, enemy: Enemy) {
  const spread = enemy.bossPhase >= 2 ? 1.28 : 1;
  drawFloat(g, pose, art, {
    extra: (s) => {
      for (const side of [-1, 1]) {
        for (const row of [0, 1]) {
          const y = art.height * (0.48 + row * 0.16);
          s.limb([side * art.height * 0.16, y], [side * art.height * 0.42, y - art.height * 0.12], 2.8, 1.8);
          s.limb([side * art.height * 0.42, y - art.height * 0.12], [side * art.height * 0.64, y + art.height * 0.05], 1.8, 1.2);
          s.ellipse(side * art.height * 0.68, y + art.height * 0.05, art.height * 0.06, art.height * 0.09, 6);
        }
        // Electric wing silhouettes.
        s.poly([
          [side * art.height * 0.2, art.height * 0.52],
          [side * art.height * 0.52 * spread, art.height * (enemy.bossPhase >= 2 ? .85 : .72)],
          [side * art.height * 0.3, art.height * 0.58],
          [side * art.height * 0.56 * spread, art.height * 0.5],
          [side * art.height * 0.24, art.height * 0.44],
        ]);
      }
    },
    details: (gg, p) => {
      detailEllipse(gg, p, 0, art.height * 0.54, art.height * 0.11, art.height * 0.11, art.palette.eye);
      detailEllipse(gg, p, 0, art.height * 0.54, art.height * 0.05, art.height * 0.05, "#eaffff");
      if (art.detail >= 2) {
        for (const side of [-1, 1])
          detailArc(gg, p, 0, art.height * 0.54, art.height * (0.24 + (enemy.bossPhase >= 2 ? 0.08 : 0)), side * pose.time * 1.5, side * pose.time * 1.5 + Math.PI * 1.2, art.palette.accent, 1.6, 220, 10);
      }
      for (const side of [-1, 1]) {
        detailEllipse(gg, p, side * art.height * 0.68, art.height * 0.58, art.height * 0.03, art.height * 0.05, art.palette.eye);
        if (art.detail >= 3) detailEllipse(gg, p, side * art.height * 0.68, art.height * 0.74, art.height * 0.03, art.height * 0.05, art.palette.eye);
      }
    },
  });
}

export function drawThunderBody(g: Graphics, w: SurvivalWorld, enemy: Enemy, art: EnemyArt, pose: Pose) {
  if (enemy.kind === "minion") {
    drawHumanoid(g, pose, art);
    return;
  }
  switch (enemy.kind) {
    case "thunderanchor":
    case "gridelectrode":
      device(g, pose, art, enemy);
      break;
    case "arclantern":
      drawFloat(g, pose, art, {
        details: (gg, p) => {
          const top = art.height * 0.82;
          detailArc(gg, p, 0, top, art.height * 0.22, Math.PI * 0.1, Math.PI * 0.9, art.palette.eye, 1.6, 220);
          if (art.detail >= 2) detailArc(gg, p, 0, top, art.height * 0.16, Math.PI * 1.1, Math.PI * 1.9, art.palette.accent, 1.2, 180);
        },
      });
      break;
    case "rivetwalker":
      rivetWalker(g, pose, art);
      break;
    case "anchorweaver":
      anchorWeaver(g, pose, art);
      break;
    case "railsaw":
      railSaw(g, pose, art, enemy);
      break;
    case "railreaper":
      railReaper(g, pose, art);
      break;
    case "gridwarden":
      gridWarden(g, pose, art);
      break;
    case "boss":
      thunderBoss(g, pose, art, enemy);
      break;
    default:
      drawMech(g, pose, art);
      break;
  }
}
