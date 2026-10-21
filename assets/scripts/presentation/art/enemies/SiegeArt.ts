import { Graphics } from "cc";
import { ink } from "../Ink";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { Pose } from "../Actor";
import { createPose, torsoOffset } from "../Actor";
import { enemyArt, type EnemyArt } from "../EnemyCatalog";
import { drawHumanoid, drawQuadruped } from "../Archetypes";
import { detailEllipse, detailLine, detailPoly, eye, rim, Silhouette, lx, ly } from "../Brush";

const HORSE: EnemyArt = (() => {
  const base = enemyArt(1, "flanker");
  return {
    ...base,
    kind: "siegerider",
    height: 46,
    halfWidth: 23,
    scale: 1,
    motionSpeed: 12,
    strideAmp: 5,
    bobAmp: 2,
    look: { ...base.look, head: "beast", tail: true, quills: false, bulk: 1.08 },
  };
})();

const RIDER: EnemyArt = (() => {
  const base = enemyArt(1, "siegerider");
  return {
    ...base,
    height: 44,
    halfWidth: 14,
    scale: 1,
    motionSpeed: 9,
    strideAmp: 2,
    bobAmp: 1.2,
    look: { ...base.look, cape: true, weapon: "lance", shield: "none", bulk: 0.95 },
  };
})();

const riderPose = createPose();

function drawRider(g: Graphics, pose: Pose, art: EnemyArt) {
  drawQuadruped(g, pose, HORSE, {
    details: (gg, p) => {
      if (art.detail < 2) return;
      // Saddle blanket; reins only on the boss-tier rider.
      detailPoly(gg, p, [[-10, 30], [10, 30], [8, 22], [-8, 22]], art.palette.cloth);
      if (art.detail >= 3) {
        detailLine(gg, p, [12, 34], [24, 40], art.palette.metalLight, 1.2);
        detailLine(gg, p, [12, 34], [23, 38], art.palette.metal, 0.8);
      }
    },
  });
  Object.assign(riderPose, pose, {
    y: pose.y + 25 * pose.scale,
    scale: pose.scale * 0.84,
    lift: 0,
  });
  drawHumanoid(g, riderPose, RIDER, {
    hideLegs: true,
    details: (gg, p) => {
      if (art.detail < 3) return;
      // Leg plate over the saddle.
      detailPoly(gg, p, [[-8, 18], [8, 18], [6, 9], [-6, 9]], art.palette.metal);
    },
  });
}

function drawSiegeBone(g: Graphics, pose: Pose, art: EnemyArt) {
  drawHumanoid(g, pose, art, {
    extra: s => {
      const shift=torsoOffset(pose);
      // Exposed skull, broken bone shoulder and hanging rags: a medieval revenant.
      s.poly([[-12,38+shift],[-20,47+shift],[-15,35+shift],[-9,33+shift]]);
    },
    details: (gg, p) => {
      const shift = torsoOffset(p);
      detailPoly(gg, p, [[-7,31+shift],[4,30+shift],[5,17],[0,12],[-2,17],[-7,14]], art.palette.cloth);
      if(art.detail>=1) detailPoly(gg, p, [[-13,39+shift],[-9,42+shift],[-5,39+shift],[-10,37+shift]],art.palette.metalLight);
      // Batch the ribs/spine in one submission for the 100-body crowd budget.
      gg.strokeColor=ink(art.palette.bone,p.alpha);gg.lineWidth=1.4*p.scale;
      for(let i=0;i<3;i++) {
        gg.moveTo(lx(p,-5),ly(p,35+shift-i*3));gg.lineTo(lx(p,4),ly(p,34+shift-i*3));
      }
      gg.moveTo(lx(p,0),ly(p,37+shift));gg.lineTo(lx(p,0),ly(p,27+shift));
      gg.stroke();
    },
  });
}

function drawThornShield(g: Graphics, pose: Pose, art: EnemyArt, enemy: Enemy) {
  drawHumanoid(g, pose, art, {
    extra:
      art.detail >= 2
        ? (s) => {
            // Boss-like shoulder ridges keep the shield silhouette unique.
            s.poly([[-15, 34], [-24, 38], [-14, 40]]);
            s.poly([[15, 34], [24, 38], [14, 40]]);
          }
        : undefined,
    details: (gg, p) => {
      if (art.detail < 1) return;
      detailEllipse(gg, p, 16, 28, 4.2, 4.2, art.palette.metalLight);
      if (art.detail >= 2) {
        detailEllipse(gg, p, 16, 28, 2.2, 2.2, art.palette.accent);
        if ((enemy.shieldClock ?? 0) < 3)
          detailEllipse(gg, p, 16, 28, 5.4, 5.4, art.palette.accent, 170);
      }
    },
  });
}

function drawSiegeBow(g: Graphics, pose: Pose, art: EnemyArt, enemy: Enemy) {
  drawHumanoid(g, pose, art, {
    details: (gg, p) => {
      if (art.detail < 1) return;
      const active = enemy.pattern % 3;
      for (let i = 0; i < 3; i++) {
        const x = -7 + i * 7,
          y = art.height + 10;
        detailEllipse(gg, p, x, y, 2, 2, i === active ? art.palette.accent : art.palette.shade);
      }
      if (art.detail >= 2) {
        detailLine(gg, p, [10, 25], [19, 25], art.palette.metalLight, 1.3);
        detailPoly(gg, p, [[21, 24], [27, 25], [21, 27]], art.palette.bone);
      }
    },
  });
}

function drawSiegeFlag(g: Graphics, pose: Pose, art: EnemyArt) {
  drawHumanoid(g, pose, art, {
    extra: s => {
      const shift=torsoOffset(pose);
      s.poly([[-11,41+shift],[-23,48+shift],[-16,53+shift],[-5,47+shift]]);
      s.poly([[9,42+shift],[19,47+shift],[14,53+shift],[5,48+shift]]);
    },
    details: (gg, p) => {
      if (art.detail >= 2) {
        const shift=torsoOffset(p);
        detailPoly(gg,p,[[-8,43+shift],[7,43+shift],[5,20],[0,14],[-7,20]],art.palette.cloth);
        detailPoly(gg,p,[[-3,39+shift],[3,39+shift],[3,24+shift],[0,21+shift],[-3,24+shift]],art.palette.accent);
      }
      if (art.detail >= 3) {
        detailLine(gg, p, [-9, 60], [-9, 70], art.palette.accent, 2);
        detailEllipse(gg, p, -9, 71, 3, 3, art.palette.accent);
      }
    },
  });
}

function drawSiegeBoss(g: Graphics, pose: Pose, art: EnemyArt, enemy: Enemy) {
  drawHumanoid(g, pose, art, {
    extra: (s) => {
      const spike = enemy.bossPhase >= 2 ? 1.35 : 1;
      const shift=torsoOffset(pose);
      for (const side of [-1, 1]) {
        s.poly([
          [side * 20, 60+shift],
          [side * 33 * spike, 70+shift],
          [side * 22, 72+shift],
        ]);
        s.poly([
          [side * 24, 48+shift],
          [side * 38 * spike, 56+shift],
          [side * 24, 58+shift],
        ]);
      }
      // Crown blades.
      s.poly([
        [-14, 88+shift],
        [-10, 102+shift],
        [-4, 90+shift],
        [0, 106+shift],
        [5, 90+shift],
        [11, 102+shift],
        [14, 88+shift],
      ]);
    },
    details: (gg, p) => {
      const shift=torsoOffset(p);
      // Breastplate and split skirt, rather than stacked circular badges.
      detailPoly(gg,p,[[-15,71+shift],[15,71+shift],[12,53+shift],[0,45+shift],[-12,53+shift]],art.palette.shade);
      detailPoly(gg,p,[[-13,70+shift],[0,67+shift],[0,49+shift],[-10,55+shift]],art.palette.metalLight);
      detailPoly(gg,p,[[-13,46+shift],[12,46+shift],[15,22],[5,27],[0,19],[-6,27],[-15,22]],art.palette.cloth);
      detailPoly(gg,p,[[0,61+shift],[5,57+shift],[0,51+shift],[-5,57+shift]],enemy.bossPhase>=2?"#ff9a70":art.palette.accent);
      rim(gg,p,[[-28,69+shift],[-20,70+shift],[-13,66+shift],[13,66+shift],[20,70+shift],[28,69+shift]],art.palette.metalLight,1.8);
    },
  });
}

export function drawSiegeBody(g: Graphics, _w: SurvivalWorld, enemy: Enemy, art: EnemyArt, pose: Pose) {
  switch (enemy.kind) {
    case "flanker":
      drawQuadruped(g, pose, art, {
        details: (gg, p) => {
          if (art.detail < 1) return;
          // Spiked collar and a hot eye.
          for (let i = 0; i < 3; i++)
            detailPoly(gg, p, [[10 + i * 4, 26], [12 + i * 4, 32], [14 + i * 4, 26]], art.palette.metalLight);
          eye(gg, p, 20, 26, 1.8, art.palette.eye);
        },
      });
      break;
    case "siegerider":
      drawRider(g, pose, art);
      break;
    case "siegebone":
      drawSiegeBone(g, pose, art);
      break;
    case "thornshield":
      drawThornShield(g, pose, art, enemy);
      break;
    case "siegebow":
      drawSiegeBow(g, pose, art, enemy);
      break;
    case "siegeflag":
      drawSiegeFlag(g, pose, art);
      break;
    case "boss":
      drawSiegeBoss(g, pose, art, enemy);
      break;
    default:
      drawHumanoid(g, pose, art);
      break;
  }
}
