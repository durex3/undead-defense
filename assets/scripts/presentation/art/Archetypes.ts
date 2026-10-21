import { Graphics } from "cc";
import { torsoOffset, type Pose } from "./Actor";
import type { EnemyArt, HornKind } from "./EnemyCatalog";
import {
  Silhouette,
  arcPoints,
  curvedLimb,
  detailArc,
  detailEllipse,
  detailLine,
  detailPoly,
  eye,
  rim,
  type Pt,
} from "./Brush";

/**
 * Shared body archetypes. Stage files pass the catalog entry plus a few
 * optional hooks; the result is one silhouette fill+stroke, then interior
 * material fills. Keep new decorations inside the silhouette or as fill-only
 * details so the outer contour stays clean.
 */

export interface ArtHooks {
  /** Added to the silhouette before the torso (capes, poles, back limbs). */
  back?: (s: Silhouette, pose: Pose, art: EnemyArt) => void;
  /** Added to the silhouette after the torso (extra arms, wings, sacs). */
  extra?: (s: Silhouette, pose: Pose, art: EnemyArt) => void;
  /** Fill-only details after the silhouette is committed. */
  details?: (g: Graphics, pose: Pose, art: EnemyArt) => void;
  /** Mounted riders hide their own legs; the mount supplies them. */
  hideLegs?: boolean;
}

const mirror = (x: number, face: number) => x * face;

function horn(s: Silhouette, base: Pt, dir: number, length: number, curveY: number, width: number) {
  const tip: Pt = [base[0] + dir * length, base[1] + curveY * 0.55];
  const control: Pt = [base[0] + dir * length * 0.45, base[1] + curveY];
  s.poly(curvedLimb(base, control, tip, width, width * 0.18, 5));
}

function crescentHorn(s: Silhouette, base: Pt, dir: number, length: number) {
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const a = -Math.PI * 0.8 + t * Math.PI * 0.95;
    outer.push([base[0] + Math.cos(a) * length * dir, base[1] + Math.sin(a) * length]);
    inner.push([base[0] + Math.cos(a) * length * 0.54 * dir, base[1] + Math.sin(a) * length * 0.6]);
  }
  inner.reverse();
  s.poly(outer.concat(inner));
}

function drawHorns(s: Silhouette, art: EnemyArt, headX: number, headY: number, headR: number) {
  const kind: HornKind = art.look.horns;
  if (kind === "none") return;
  if (kind === "small") {
    horn(s, [headX, headY + headR * 0.5], 1, headR * 1.2, headR * 0.6, headR * 0.24);
    horn(s, [headX, headY + headR * 0.5], -1, headR * 1.2, headR * 0.6, headR * 0.24);
    return;
  }
  if (kind === "wide") {
    horn(s, [headX, headY + headR * 0.35], 1, headR * 2.3, headR * 1.1, headR * 0.3);
    horn(s, [headX, headY + headR * 0.35], -1, headR * 2.3, headR * 1.1, headR * 0.3);
    return;
  }
  if (kind === "crescent") {
    crescentHorn(s, [headX, headY + headR * 0.4], 1, headR * 1.9);
    crescentHorn(s, [headX, headY + headR * 0.4], -1, headR * 1.9);
    return;
  }
  if (kind === "moon") {
    crescentHorn(s, [headX, headY + headR * 0.55], 1, headR * 2.6);
    crescentHorn(s, [headX, headY + headR * 0.55], -1, headR * 2.6);
    return;
  }
  // Antlers: two branching beams.
  for (const side of [-1, 1]) {
    const base: Pt = [headX + side * headR * 0.5, headY + headR * 0.55];
    horn(s, base, side, headR * 1.8, headR * 1.4, headR * 0.22);
    horn(s, [base[0] + side * headR * 0.6, base[1] + headR * 0.7], side, headR * 1.1, headR * 0.8, headR * 0.16);
    horn(s, [base[0] + side * headR * 0.3, base[1] + headR * 1.0], -side, headR * 0.8, headR * 0.6, headR * 0.14);
  }
}

function headSilhouette(s: Silhouette, art: EnemyArt, x: number, y: number, r: number, segments = 12) {
  const look = art.look;
  switch (look.head) {
    case "skull": {
      if(art.stage===1) {
        // One chipped skull contour keeps large first-stage crowds inexpensive.
        s.poly([[x-r*.7,y+r*.7],[x,y+r],[x+r*.7,y+r*.7],
          [x+r*.9,y],[x+r*.5,y-r*.5],[x+r*.45,y-r*.95],
          [x-r*.35,y-r*.95],[x-r*.5,y-r*.5],[x-r*.9,y]]);
        break;
      }
      s.ellipse(x, y, r * 0.92, r, segments);
      s.poly([
        [x - r * 0.32, y - r * 0.88],
        [x + r * 0.5, y - r * 0.85],
        [x + r * 0.55, y - r * 0.45],
        [x - r * 0.38, y - r * 0.5],
      ]);
      s.poly([
        [x - r * 0.85, y - r * 0.15],
        [x - r * 1.05, y + r * 0.15],
        [x - r * 0.7, y + r * 0.4],
      ]);
      break;
    }
    case "hood": {
      s.poly([
        [x - r, y - r * 0.8],
        [x - r * 0.9, y + r * 0.4],
        [x, y + r * 1.35],
        [x + r * 0.9, y + r * 0.4],
        [x + r, y - r * 0.8],
        [x + r * 0.4, y - r * 0.95],
        [x - r * 0.4, y - r * 0.95],
      ]);
      break;
    }
    case "insect": {
      s.ellipse(x, y, r * 0.95, r * 0.82, segments);
      s.poly([
        [x - r * 0.45, y - r * 0.55],
        [x - r * 1.05, y - r * 0.85],
        [x - r * 0.15, y - r * 0.9],
      ]);
      s.poly([
        [x - r * 0.35, y - r * 0.7],
        [x + r * 0.1, y - r * 1.0],
        [x + r * 0.55, y - r * 0.65],
      ]);
      break;
    }
    case "beast": {
      s.ellipse(x, y, r * 1.0, r * 0.88, segments);
      s.plate(x + r * 0.85, y - r * 0.15, r * 0.95, r * 0.62, r * 0.2);
      s.poly([
        [x - r * 0.2, y + r * 0.75],
        [x - r * 0.75, y + r * 1.15],
        [x + r * 0.35, y + r * 0.92],
      ]);
      break;
    }
    case "core": {
      s.ellipse(x, y, r * 0.95, r * 0.95, segments);
      s.plate(x, y, r * 1.9, r * 0.34, r * 0.14);
      break;
    }
    case "lantern": {
      s.plate(x, y, r * 1.6, r * 2.0, r * 0.4);
      s.plate(x, y + r * 1.15, r * 0.9, r * 0.3, r * 0.1);
      s.plate(x, y - r * 1.15, r * 1.05, r * 0.3, r * 0.1);
      break;
    }
    case "egg": {
      s.ellipse(x, y, r * 0.95, r * 1.25, segments);
      break;
    }
    default: {
      s.ellipse(x, y, r * 0.92, r, segments);
      if (look.head === "crest") {
        s.poly([
          [x - r * 0.25, y + r * 0.85],
          [x, y + r * 1.7],
          [x + r * 0.35, y + r * 0.8],
        ]);
      }
    }
  }
  drawHorns(s, art, x, y, r);
}

function paintHead(g: Graphics, pose: Pose, art: EnemyArt, x: number, y: number, r: number, detail = 0) {
  const p = art.palette;
  const look = art.look;
  if (detail <= 0) {
    if (look.head === "skull") {
      detailEllipse(g, pose, x - r * 0.35, y + r * 0.1, r * 0.24, r * 0.28, "#11161b");
      detailEllipse(g, pose, x + r * 0.35, y + r * 0.1, r * 0.24, r * 0.28, "#11161b");
    } else if (look.head === "core" || look.head === "lantern") {
      detailEllipse(g, pose, x, y, r * 0.45, r * 0.5, p.eye);
    } else if (look.head === "insect" || look.head === "beast") {
      detailEllipse(g, pose, x, y, r * 0.72, r * 0.62, p.metal);
      eye(g, pose, x + r * 0.26, y + r * 0.15, Math.max(1.2, r * 0.16), p.eye);
    } else {
      detailPoly(g, pose, [[x-r*.8,y-r*.4],[x-r*.8,y+r*.45],
        [x-r*.2,y+r*.9],[x+r*.65,y+r*.5],[x+r*.5,y-r*.4]], p.metalLight);
      eye(g, pose, x + r * 0.22, y, Math.max(1.2, r * 0.15), p.eye);
    }
    return;
  }
  if (look.head === "skull") {
    detailEllipse(g, pose, x - r * 0.35, y + r * 0.15, r * 0.22, r * 0.3, "#11161b");
    detailEllipse(g, pose, x + r * 0.35, y + r * 0.15, r * 0.22, r * 0.3, "#11161b");
    detailLine(g, pose, [x - r * 0.5, y - r * 0.62], [x + r * 0.5, y - r * 0.62], p.shade, 1.4);
  } else if (look.head === "hood") {
    detailPoly(
      g,
      pose,
      [
        [x - r * 0.45, y + r * 0.15],
        [x, y + r * 0.85],
        [x + r * 0.45, y + r * 0.15],
        [x + r * 0.3, y - r * 0.35],
        [x - r * 0.3, y - r * 0.35],
      ],
      p.cloth,
      pose.alpha * 0.9,
    );
    eye(g, pose, x, y - r * 0.05, Math.max(1.5, r * 0.18), p.eye);
  } else if (look.head === "insect") {
    eye(g, pose, x - r * 0.38, y + r * 0.1, Math.max(1.4, r * 0.18), p.eye);
    eye(g, pose, x + r * 0.38, y + r * 0.1, Math.max(1.4, r * 0.18), p.eye);
    detailLine(g, pose, [x - r * 0.2, y - r * 0.55], [x - r * 0.7, y - r * 0.95], p.metal, 1.2);
  } else if (look.head === "beast") {
    eye(g, pose, x + r * 0.25, y + r * 0.18, Math.max(1.4, r * 0.17), p.eye);
    detailLine(g, pose, [x + r * 0.2, y - r * 0.32], [x + r * 0.95, y - r * 0.22], p.shade, 1.2);
  } else if (look.head === "core") {
    detailEllipse(g, pose, x, y, r * 0.52, r * 0.52, p.eye);
    detailEllipse(g, pose, x, y, r * 0.26, r * 0.26, "#eaffff");
    detailArc(g, pose, x, y, r * 0.9, 0.2, Math.PI * 1.5, p.metalLight, 1.4);
  } else if (look.head === "lantern") {
    detailEllipse(g, pose, x, y, r * 0.45, r * 0.6, p.eye);
    detailLine(g, pose, [x, y + r * 0.9], [x, y + r * 1.4], p.metalLight, 1.4);
  } else if (look.head === "egg") {
    detailLine(g, pose, [x - r * 0.2, y - r * 0.4], [x, y - r * 0.15], p.shade, 1.2);
  } else {
    // Helm / horned / crest.
    detailEllipse(g, pose, x, y + r * 0.08, r * 0.7, r * 0.6, p.metal);
    if (detail === 1 || detail >= 3)
      detailLine(g, pose, [x - r * 0.55, y - r * 0.1], [x + r * 0.55, y - r * 0.1], "#10161c", 2);
    eye(g, pose, x + r * 0.25, y - r * 0.02, Math.max(1.2, r * 0.14), p.eye);
    if (look.head === "crest") {
      detailPoly(g, pose, [[x - r * 0.2, y + r * 0.8], [x, y + r * 1.6], [x + r * 0.3, y + r * 0.75]], p.accent);
    }
  }
}

function shieldSilhouette(s: Silhouette, art: EnemyArt, x: number, y: number, size: number) {
  const shield = art.look.shield;
  if (shield === "none") return;
  if (shield === "round") {
    s.ellipse(x, y, size * 0.85, size, 8);
    s.poly([
      [x + size * 0.8, y],
      [x + size * 1.35, y + size * 0.18],
      [x + size * 0.8, y + size * 0.32],
    ]);
  } else {
    // A five-point tower shield is cheaper than a tessellated rounded rect.
    s.poly([
      [x - size * 0.7, y + size * 1.02],
      [x + size * 0.7, y + size * 1.02],
      [x + size * 0.7, y - size * 0.88],
      [x, y - size * 1.12],
      [x - size * 0.7, y - size * 0.88],
    ]);
    if (shield === "thorn") {
      for (const dy of [-size * 0.7, size * 0.15, size * 0.85])
        s.poly([
          [x + size * 0.62, y + dy - size * 0.2],
          [x + size * 1.24, y + dy],
          [x + size * 0.62, y + dy + size * 0.2],
        ]);
    }
  }
}

function paintShield(g: Graphics, pose: Pose, art: EnemyArt, x: number, y: number, size: number, detail = 0) {
  if (art.look.shield === "none") return;
  const p = art.palette;
  const shield = art.look.shield;
  if (detail <= 0) {
    if (shield === "round") detailEllipse(g, pose, x, y, size * 0.72, size * 0.88, p.metal);
    else detailPoly(g, pose, [[x - size * 0.58, y + size * 0.92], [x + size * 0.58, y + size * 0.92], [x + size * 0.58, y - size * 0.92], [x, y - size * 1.06], [x - size * 0.58, y - size * 0.92]], p.metal);
    return;
  }
  if (shield === "round") {
    detailEllipse(g, pose, x, y, size * 0.62, size * 0.78, p.metal);
    if (detail >= 2) detailEllipse(g, pose, x - size * 0.15, y + size * 0.2, size * 0.35, size * 0.38, p.metalLight);
    detailEllipse(g, pose, x, y, size * 0.16, size * 0.2, p.accent);
  } else {
    detailPoly(
      g,
      pose,
      [
        [x - size * 0.55, y + size * 0.9],
        [x + size * 0.55, y + size * 0.9],
        [x + size * 0.55, y - size * 0.9],
        [x, y - size * 1.05],
        [x - size * 0.55, y - size * 0.9],
      ],
      p.metal,
    );
    if (detail >= 2) detailLine(g, pose, [x, y + size * 0.85], [x, y - size * 0.85], p.metalLight, 1.8);
    detailEllipse(g, pose, x, y + size * 0.15, size * 0.18, size * 0.18, p.accent);
  }
}

function weaponSilhouette(
  s: Silhouette,
  art: EnemyArt,
  hand: Pt,
  shoulder: Pt,
  headY: number,
) {
  const w = art.look.weapon;
  if (w === "none") {
    s.ellipse(hand[0], hand[1], 3, 3.4);
    return;
  }
  if (w === "claw") {
    if (art.detail < 1) {
      s.limb(hand, [hand[0] + 12, hand[1] + 1], 2.2, 0.7);
    } else {
      for (const dy of [-4, 2, 7])
        s.poly(curvedLimb(hand, [hand[0] + 8, hand[1] + dy * 0.8], [hand[0] + 13, hand[1] + dy - 3], 1.8, 0.4, 4));
    }
    return;
  }
  if (w === "sickle") {
    if (art.detail < 1) s.limb(hand, [hand[0] + 12, hand[1] + 4], 2.6, 0.7);
    else s.poly(curvedLimb(hand, [hand[0] + 8, hand[1] + 7], [hand[0] + 13, hand[1] - 5], 2.4, 0.6, 5));
    return;
  }
  if (w === "crusher") {
    s.limb(hand, [hand[0] + 10, hand[1] - 2], 4.5, 3.5);
    s.ellipse(hand[0] + 12, hand[1] - 2, 6, 4.5);
    return;
  }
  if (w === "spit") {
    s.poly([
      [hand[0] - 2, hand[1] + 4],
      [hand[0] + 12, hand[1] + 8],
      [hand[0] + 14, hand[1] + 3],
      [hand[0] + 2, hand[1] - 2],
    ]);
    return;
  }
  if (w === "spear") {
    s.limb([hand[0] - 9, hand[1] - 12], [hand[0] + 17, headY + 14], 1.4, 1);
    s.poly([
      [hand[0] + 17, headY + 14],
      [hand[0] + 12, headY + 3],
      [hand[0] + 22, headY + 3],
    ]);
    return;
  }
  if (w === "axe") {
    s.limb([hand[0] - 2, hand[1] - 16], [hand[0] + 8, headY + 10], 1.8, 1.3);
    s.poly([
      [hand[0] + 8, headY + 10],
      [hand[0] + 21, headY + 14],
      [hand[0] + 23, headY + 4],
      [hand[0] + 9, headY + 1],
    ]);
    return;
  }
  if (w === "crossbow") {
    s.poly([
      [hand[0] - 6, hand[1] + 4],
      [hand[0] + 20, hand[1] + 4],
      [hand[0] + 20, hand[1] - 1],
      [hand[0] - 6, hand[1] - 1],
    ]);
    s.poly([
      [hand[0] + 14, hand[1] - 7],
      [hand[0] + 17, hand[1] + 9],
      [hand[0] + 12, hand[1] + 9],
    ]);
    s.limb([hand[0] + 15, hand[1] - 6], [hand[0] + 15, hand[1] + 8], 0.8, 0.8);
    return;
  }
  if (w === "banner") {
    s.limb([hand[0] - 4, hand[1] - 18], [hand[0] + 8, headY + 26], 1.3, 1.1);
    s.poly([
      [hand[0] + 7, headY + 26],
      [hand[0] - 20, headY + 20],
      [hand[0] - 17, headY + 5],
      [hand[0] + 7, headY + 10],
    ]);
    return;
  }
  if (w === "lance") {
    s.limb([hand[0] - 18, hand[1] - 2], [hand[0] + 34, hand[1] + 8], 1.5, 1.0);
    s.poly([
      [hand[0] + 34, hand[1] + 8],
      [hand[0] + 26, hand[1] + 2],
      [hand[0] + 27, hand[1] + 13],
    ]);
    return;
  }
  if (w === "halberd") {
    s.limb([hand[0] - 10, hand[1] - 24], [hand[0] + 20, headY + 30], 1.6, 1.2);
    s.poly([
      [hand[0] + 20, headY + 30],
      [hand[0] + 34, headY + 34],
      [hand[0] + 31, headY + 22],
      [hand[0] + 18, headY + 18],
    ]);
    s.poly([
      [hand[0] + 20, headY + 30],
      [hand[0] + 16, headY + 42],
      [hand[0] + 23, headY + 40],
    ]);
    return;
  }
  if (w === "staff") {
    s.limb([hand[0] - 2, hand[1] - 18], [hand[0] + 5, headY + 18], 1.3, 1.1);
    s.ellipse(hand[0] + 5, headY + 21, 5, 5);
    return;
  }
  if (w === "saw") {
    s.limb([hand[0], hand[1] - 2], [hand[0] + 14, hand[1] + 4], 2.2, 1.8);
    s.ellipse(hand[0] + 20, hand[1] + 4, 10, 10);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      s.poly([
        [hand[0] + 20 + Math.cos(a) * 9, hand[1] + 4 + Math.sin(a) * 9],
        [hand[0] + 20 + Math.cos(a + 0.2) * 14, hand[1] + 4 + Math.sin(a + 0.2) * 14],
        [hand[0] + 20 + Math.cos(a + 0.45) * 9, hand[1] + 4 + Math.sin(a + 0.45) * 9],
      ]);
    }
    return;
  }
  if (w === "anchor") {
    s.limb([hand[0], hand[1]], [hand[0] + 10, hand[1] - 16], 1.2, 1.6);
    s.limb([hand[0] + 10, hand[1] - 16], [hand[0] + 2, hand[1] - 24], 1.6, 0.8);
    s.limb([hand[0] + 10, hand[1] - 16], [hand[0] + 18, hand[1] - 24], 1.6, 0.8);
    return;
  }
  if (w === "coil") {
    s.limb([hand[0] - 1, hand[1] - 16], [hand[0] + 7, headY + 14], 1.3, 1.1);
    s.ellipse(hand[0] + 7, headY + 14, 6, 4);
    s.ellipse(hand[0] + 7, headY + 20, 8, 2.4);
    return;
  }
  if (w === "moonblade") {
    s.poly(curvedLimb([hand[0], hand[1] - 2], [hand[0] + 16, hand[1] + 14], [hand[0] + 24, hand[1] - 6], 2.8, 0.7, 6));
    return;
  }
  s.limb(shoulder, hand, 2.5, 2);
}

function paintWeapon(g: Graphics, pose: Pose, art: EnemyArt, hand: Pt, headY: number, detail = 0) {
  const p = art.palette;
  const w = art.look.weapon;
  if (detail <= 0) {
    if (w === "none" || w === "claw" || w === "sickle" || w === "crusher" || w === "spit" || w === "moonblade") {
      detailLine(g, pose, [hand[0] + 1, hand[1] - 2], [hand[0] + 7, hand[1] + 4], p.metalLight, 1.8);
    } else if (w === "saw") {
      detailEllipse(g, pose, hand[0] + 20, hand[1] + 4, 4.5, 4.5, p.metal);
    } else if (w === "staff" || w === "coil") {
      detailLine(g, pose, [hand[0] - 1, hand[1] - 14], [hand[0] + 5, headY + 16], p.metalLight, 1);
    } else {
      detailLine(g, pose, [hand[0] - 8, hand[1] - 10], [hand[0] + (w === "lance" ? 30 : 16), headY + 9], p.metalLight, 1);
    }
    if (w === "spear") detailPoly(g, pose, [[hand[0] + 17, headY + 14], [hand[0] + 12, headY + 3], [hand[0] + 22, headY + 3]], p.metalLight);
    else if (w === "axe") detailPoly(g, pose, [[hand[0] + 8, headY + 12], [hand[0] + 19, headY + 17], [hand[0] + 25, headY + 8], [hand[0] + 18, headY - 1], [hand[0] + 9, headY + 1]], p.metalLight);
    return;
  }
  if (w === "spear" || w === "axe") {
    detailLine(g, pose, [hand[0] - 1, hand[1] - 14], [hand[0] + (w === "spear" ? 17 : 8), headY + 10], p.metalLight, 1);
    if (w === "spear") detailPoly(g, pose, [[hand[0] + 17, headY + 14], [hand[0] + 12, headY + 3], [hand[0] + 22, headY + 3]], p.metalLight);
    else detailPoly(g, pose, [[hand[0] + 8, headY + 12], [hand[0] + 19, headY + 17], [hand[0] + 25, headY + 8], [hand[0] + 18, headY - 1], [hand[0] + 9, headY + 1]], p.metalLight);
    if (detail >= 3) detailEllipse(g, pose, hand[0] + (w === "spear" ? 17 : 8), headY + 11, 2.4, 2.4, p.accent);
  } else if (w === "banner") {
    detailPoly(g, pose, [[hand[0] + 6, headY + 24], [hand[0] - 19, headY + 19], [hand[0] - 16, headY + 6], [hand[0] + 6, headY + 11]], p.cloth);
    if (detail >= 3) detailLine(g, pose, [hand[0] - 2, headY + 14], [hand[0] + 5, headY + 14], p.accent, 1.2);
  } else if (w === "lance" || w === "halberd") {
    detailLine(g, pose, [hand[0] - 12, hand[1] - 4], [hand[0] + 26, headY + 26], p.metalLight, 1.2);
    if (detail >= 3) detailEllipse(g, pose, hand[0] + 10, hand[1] + 2, 2.2, 2.2, p.accent);
  } else if (w === "crossbow") {
    detailLine(g, pose, [hand[0] + 15, hand[1] + 10], [hand[0] + 15, hand[1] - 6], "#e8dcc0", 1);
    if (detail >= 3) detailLine(g, pose, [hand[0] + 4, hand[1] + 2], [hand[0] + 24, hand[1] + 2], p.metalLight, 1);
  } else if (w === "staff" || w === "coil") {
    detailEllipse(g, pose, hand[0] + 6, headY + 20, 3.4, 3.4, p.eye);
  } else if (w === "saw") {
    detailEllipse(g, pose, hand[0] + 20, hand[1] + 4, 5.5, 5.5, p.metal);
    detailEllipse(g, pose, hand[0] + 20, hand[1] + 4, 2, 2, p.eye);
  } else if (w === "anchor") {
    detailLine(g, pose, [hand[0] + 6, hand[1] - 8], [hand[0] + 14, hand[1] - 14], p.metalLight, 1.2);
  } else if (w === "moonblade") {
    detailLine(g, pose, [hand[0] + 4, hand[1] + 2], [hand[0] + 21, hand[1] + 6], p.accent, 1.4);
  }
}

function drawCape(s: Silhouette, art: EnemyArt, hipY: number, shoulderY: number, width: number, sway = 0): Pt[] | null {
  if (!art.look.cape) return null;
  const points: Pt[] = [
    [-width * 0.7, shoulderY + 3],
    [-width * 1.15 - sway, hipY - 8],
    [-width * 0.9 - sway, hipY - 16],
    [-width * 0.2, hipY - 10],
    [width * 0.3, shoulderY + 2],
  ];
  s.poly(points);
  return points;
}

export function drawHumanoid(g: Graphics, pose: Pose, art: EnemyArt, hooks: ArtHooks = {}) {
  const h = art.height;
  const b = art.look.bulk;
  const hipY = h * 0.4;
  const shoulderY = h * 0.7;
  const headR = h * (art.detail === 0 ? 0.128 : 0.115);
  const headY = h * 0.845;
  const shoulderW = h * (art.detail === 0 ? 0.185 : 0.17) * b;
  const hipW = h * 0.13 * b;
  const stride = pose.stride * 0.9;
  const bodyShift = torsoOffset(pose);
  const p = art.palette;
  const rich = art.detail >= 1;
  const articulated = art.detail >= 2;
  const detailedLimbs = art.detail >= 3;
  const lineWidth = art.kind === "boss" ? 3.4 : art.detail >= 2 ? 2.6 : 2.1;
  const shieldSize = headR * (art.look.shield === "thorn" ? 1.9 : art.look.shield === "tower" ? 1.7 : 1.45);
  const shieldX = shoulderW * (art.look.shield === "thorn" ? 1.3 : 1.1);
  const shieldY = hipY + bodyShift + (art.look.shield === "thorn" ? 14 : 10);

  // A cape is a separate layer behind the body; otherwise its fill would
  // cover the torso. Only elites/bosses carry capes, so the extra pass is cheap.
  if (art.look.cape && articulated) {
    const cs = new Silhouette(g, pose, p.cloth, p.outline, lineWidth);
    const points: Pt[] = [
      [-shoulderW * 0.7, shoulderY + bodyShift + 3],
      [-shoulderW * 1.12, hipY - 8],
      [-shoulderW * 0.88, hipY - 16],
      [-shoulderW * 0.2, hipY - 10],
      [shoulderW * 0.3, shoulderY + bodyShift + 2],
    ];
    cs.poly(points);
    cs.commit();
  }

  const s = new Silhouette(g, pose, p.base, p.outline, lineWidth);
  hooks.back?.(s, pose, art);

  // Legs. Fodder uses one segment per leg; elites get knees and feet.
  if (!hooks.hideLegs) {
    for (const side of [-1, 1]) {
      const hipX = side * hipW * 0.55;
      const footX = side * hipW * 0.65 + side * stride * 1.2;
      if (detailedLimbs) {
        const kneeX = side * hipW * 0.72 + side * stride;
        s.limb([hipX, hipY + bodyShift], [kneeX, hipY * 0.45], 3.1 * b, 2.3 * b);
        s.limb([kneeX, hipY * 0.45], [footX, 2], 2.3 * b, 1.8 * b);
        s.poly([
          [footX - 2.6, 0.4],
          [footX + 2.6, 0.4],
          [footX + 2.4, 3.4],
          [footX - 2.4, 3.4],
        ]);
      } else {
        s.limb([hipX, hipY + bodyShift], [footX, 2], 3.0 * b, 2.0 * b);
        s.poly([
          [footX - 2.6, 0.4],
          [footX + 2.6, 0.4],
          [footX + 2.4, 3.4],
          [footX - 2.4, 3.4],
        ]);
      }
    }
  }

  // Torso.
  s.poly([
    [-hipW, hipY + bodyShift],
    [-hipW * 0.9, hipY * 0.72],
    [hipW * 0.9, hipY * 0.72],
    [hipW, hipY + bodyShift],
    [shoulderW, shoulderY + bodyShift + 2],
    [shoulderW * 0.82, shoulderY + bodyShift + headR * 0.75],
    [-shoulderW * 0.82, shoulderY + bodyShift + headR * 0.75],
    [-shoulderW, shoulderY + bodyShift + 2],
  ]);
  if (detailedLimbs) {
    for (const side of [-1, 1])
      s.ellipse(side * shoulderW * 0.92, shoulderY + bodyShift + 1, 4.6 * b, 3.8 * b, 8);
  }

  // Arms.
  const backShoulder: Pt = [-shoulderW * 0.88, shoulderY + bodyShift - 1];
  const backHand: Pt = [-shoulderW * 1.15, hipY + bodyShift + 2];
  if (detailedLimbs) {
    s.limb(backShoulder, [-shoulderW * 1.05, (shoulderY + hipY) * 0.5 + bodyShift], 2.5 * b, 2.1 * b);
    s.limb([-shoulderW * 1.05, (shoulderY + hipY) * 0.5 + bodyShift], backHand, 2.1 * b, 1.9 * b);
    s.poly([
      [backHand[0] - 2.2, backHand[1] - 2.4],
      [backHand[0] + 2.2, backHand[1] - 2.4],
      [backHand[0] + 2.2, backHand[1] + 2.4],
      [backHand[0] - 2.2, backHand[1] + 2.4],
    ]);
  } else {
    s.limb(backShoulder, backHand, 2.5 * b, 2.0 * b);
  }

  const frontShoulder: Pt = [shoulderW * 0.88, shoulderY + bodyShift - 1];
  const frontHand: Pt = [shoulderW * 1.18 - pose.windup * 5 + pose.lean, hipY + bodyShift + 5 + pose.windup * 10];
  if (detailedLimbs) {
    s.limb(frontShoulder, [shoulderW * 1.08, (shoulderY + hipY) * 0.5 + bodyShift], 2.7 * b, 2.2 * b);
    s.limb([shoulderW * 1.08, (shoulderY + hipY) * 0.5 + bodyShift], frontHand, 2.2 * b, 2.0 * b);
    s.poly([
      [frontHand[0] - 2.3, frontHand[1] - 2.5],
      [frontHand[0] + 2.3, frontHand[1] - 2.5],
      [frontHand[0] + 2.3, frontHand[1] + 2.5],
      [frontHand[0] - 2.3, frontHand[1] + 2.5],
    ]);
  } else {
    s.limb(frontShoulder, frontHand, 2.7 * b, 2.1 * b);
  }
  const weaponHeadY = headY + bodyShift + pose.windup * 8 - pose.recover * 4;
  weaponSilhouette(s, art, frontHand, frontShoulder, weaponHeadY);
  shieldSilhouette(s, art, shieldX, shieldY, shieldSize);
  headSilhouette(s, art, 0, headY + bodyShift, headR, art.detail >= 3 ? 12 : art.detail >= 1 ? 10 : 8);
  hooks.extra?.(s, pose, art);
  s.commit();

  // Materials.
  // Broad planes read at phone scale; the light is fixed at world upper-left.
  const lit = pose.face < 0 ? 1 : -1;
  detailPoly(g, pose, [[0, hipY + bodyShift], [lit * shoulderW * .76, shoulderY + bodyShift + 5],
    [lit * shoulderW * .93, shoulderY + bodyShift], [lit * hipW * .72, hipY + bodyShift]], p.light, pose.alpha * .68);
  detailPoly(
    g,
    pose,
    [
      [-hipW * 0.82, hipY + 1],
      [hipW * 0.82, hipY + 1],
      [hipW * 0.64, hipY - 9],
      [-hipW * 0.64, hipY - 9],
    ],
    p.cloth,
  );
  if (rich) {
    detailPoly(g, pose, [[-shoulderW*.57,shoulderY+bodyShift+1],[shoulderW*.57,shoulderY+bodyShift+1],
      [shoulderW*.47,hipY+bodyShift+7],[0,hipY+bodyShift+3],[-shoulderW*.47,hipY+bodyShift+7]], p.metal);
    if (detailedLimbs) {
      detailLine(g, pose, [-hipW, hipY + 10], [hipW, hipY + 10], p.metal, 2);
      detailEllipse(g, pose, 0, shoulderY - 1, shoulderW * 0.4, h * 0.1, p.light);
      for (const side of [-1, 1])
        detailEllipse(g, pose, side * shoulderW * 0.92, shoulderY + 1, 3.2 * b, 2.4 * b, p.metalLight, pose.alpha);
    }
  }
  paintHead(g, pose, art, 0, headY + bodyShift, headR, art.detail);
  paintWeapon(g, pose, art, frontHand, weaponHeadY, art.detail);
  paintShield(g, pose, art, shieldX, shieldY, shieldSize, art.detail);
  if (pose.detail && detailedLimbs)
    rim(
      g,
      pose,
      [[-shoulderW * 0.7, shoulderY + headR * 0.5], [-shoulderW * 0.2, shoulderY + headR * 0.8], [shoulderW * 0.2, shoulderY + headR * 0.7]],
      p.light,
      1.1,
    );
  hooks.details?.(g, pose, art);
}

export function drawQuadruped(g: Graphics, pose: Pose, art: EnemyArt, hooks: ArtHooks = {}) {
  const h = art.height;
  const b = art.look.bulk;
  const bodyY = h * 0.54 - pose.crouch * 0.6 + pose.bob * .45;
  const bodyRX = h * 0.4;
  const bodyRY = h * 0.22;
  const legY = h * 0.38 - pose.crouch * .22;
  const stride = pose.stride;
  const headX = h * 0.46 + pose.lean * .8;
  const headY = h * 0.72 - pose.crouch * .55 + pose.bob * .45;
  const headR = h * (art.detail === 0 ? 0.17 : 0.15);
  const rich = art.detail >= 1;
  const articulated = art.detail >= 2;
  const detailedLimbs = art.detail >= 3;
  const p = art.palette;

  const s = new Silhouette(g, pose, p.base, p.outline, art.kind === "boss" ? 3.4 : art.detail >= 2 ? 2.6 : 2.1);
  hooks.back?.(s, pose, art);

  for (const side of [-1, 1]) {
    const offset = side * h * 0.23;
    const swing = stride * (side > 0 ? 1 : -1);
    if (detailedLimbs) {
      s.limb([offset, legY], [offset + swing * 0.5, legY * 0.45], 3.4 * b, 2.4 * b);
      s.limb([offset + swing * 0.5, legY * 0.45], [offset + swing, 1.5], 2.2 * b, 1.8 * b);
      s.plate(offset + swing, 2, 5, 3, 1.2);
    } else {
      s.limb([offset, legY], [offset + swing, 1.5], 3.1 * b, 1.9 * b);
      if (art.detail >= 2)
        s.poly([[offset + swing - 2.4, 0.4], [offset + swing + 2.4, 0.4], [offset + swing + 2.2, 3.2], [offset + swing - 2.2, 3.2]]);
    }
  }

  const bodySegments = art.detail >= 2 ? (detailedLimbs ? 12 : 10) : 8;
  const headSegments = art.detail >= 2 ? (detailedLimbs ? 10 : 8) : 6;
  s.ellipse(0, bodyY, bodyRX, bodyRY, bodySegments);
  if (rich) s.ellipse(bodyRX * 0.72, bodyY + h * 0.1, bodyRX * 0.36, bodyRY * 0.9, detailedLimbs ? 8 : 6);
  for (const side of [-1, 1]) {
    const offset = bodyRX * 0.55;
    const swing = stride * (side > 0 ? -1 : 1);
    if (detailedLimbs) {
      s.limb([offset, legY], [offset + swing * 0.5, legY * 0.45], 3.2 * b, 2.2 * b);
      s.limb([offset + swing * 0.5, legY * 0.45], [offset + swing, 1.5], 2.1 * b, 1.7 * b);
      s.plate(offset + swing, 2, 4.8, 3, 1.2);
    } else {
      s.limb([offset, legY], [offset + swing, 1.5], 2.9 * b, 1.8 * b);
      if (art.detail >= 2)
        s.poly([[offset + swing - 2.2, 0.4], [offset + swing + 2.2, 0.4], [offset + swing + 2, 3], [offset + swing - 2, 3]]);
    }
  }
  s.ellipse(headX, headY, headR * 1.05, headR * 0.9, headSegments);
  s.poly([
    [headX + headR * 0.4, headY - headR * 0.42],
    [headX + headR * 1.32, headY - headR * 0.28],
    [headX + headR * 1.28, headY + headR * 0.16],
    [headX + headR * 0.4, headY + headR * 0.22],
  ]);
  if (art.look.tail)
    s.poly(curvedLimb([-bodyRX * 0.85, bodyY + 2], [-bodyRX * 1.25, bodyY + h * 0.25], [-bodyRX * 1.3, bodyY + h * 0.05], 2.4 * b, 0.6, rich ? 5 : 4));
  if (art.look.quills) {
    for (const u of [-0.55, -0.25, 0.05, 0.35]) {
      const x = u * bodyRX;
      const y = bodyY + bodyRY * 0.85;
      s.poly([[x - 3, y - 1], [x + 1, y + h * 0.24], [x + 4, y - 1]]);
    }
  }
  drawHorns(s, art, headX, headY, headR);
  hooks.extra?.(s, pose, art);
  s.commit();

  if (detailedLimbs) detailEllipse(g, pose, headX + headR * 0.2, headY + headR * 0.1, headR * 0.62, headR * 0.55, p.base);
  eye(g, pose, headX + headR * 0.45, headY + headR * 0.2, Math.max(1.3, headR * 0.18), p.eye);
  {
    detailPoly(g, pose, [[-bodyRX*.83,bodyY+bodyRY*.3],[-bodyRX*.45,bodyY+bodyRY*.86],
      [bodyRX*.28,bodyY+bodyRY*.85],[bodyRX*.66,bodyY+bodyRY*.36],[bodyRX*.12,bodyY+bodyRY*.12],[-bodyRX*.52,bodyY]], p.light);
    if (rich) detailPoly(g,pose,[[-bodyRX*.72,bodyY-bodyRY*.28],[-bodyRX*.2,bodyY-bodyRY*.65],
      [bodyRX*.65,bodyY-bodyRY*.28],[bodyRX*.4,bodyY-bodyRY*.7],[-bodyRX*.4,bodyY-bodyRY*.8]],p.shade);
    if (art.detail >= 2)
      detailLine(g, pose, [-bodyRX * 0.5, bodyY - bodyRY * 0.35], [bodyRX * 0.3, bodyY - bodyRY * 0.35], p.shade, 1.2);
  }
  if (art.look.quills && rich) {
    for (const u of [-0.55, -0.25, 0.05, 0.35]) {
      const x = u * bodyRX;
      const y = bodyY + bodyRY * 0.85;
      detailLine(g, pose, [x - 1.5, y], [x + 0.5, y + h * 0.2], p.bone, 1.1);
    }
  }
  if (pose.detail && detailedLimbs)
    rim(g, pose, [[-bodyRX * 0.8, bodyY + bodyRY * 0.2], [-bodyRX * 0.2, bodyY + bodyRY * 0.9], [bodyRX * 0.45, bodyY + bodyRY * 0.75]], p.light, 1.1);
  hooks.details?.(g, pose, art);
}

export function drawInsect(g: Graphics, pose: Pose, art: EnemyArt, hooks: ArtHooks = {}) {
  const h = art.height;
  const b = art.look.bulk;
  const bodyY = h * 0.46 - pose.crouch * 0.4;
  const abdomenX = -h * 0.24;
  const abdomenRX = h * 0.28 * b;
  const abdomenRY = h * 0.2 * b;
  const thoraxY = bodyY + h * 0.02;
  const headX = h * 0.3;
  const headY = bodyY + h * 0.08;
  const headR = h * 0.135;
  const stride = pose.stride;
  const rich = art.detail >= 1;
  const detailedLimbs = art.detail >= 3;
  const p = art.palette;

  const s = new Silhouette(g, pose, p.base, p.outline, art.kind === "boss" ? 3.4 : art.detail >= 2 ? 2.6 : 2.1);
  hooks.back?.(s, pose, art);

  // Abdomen and thorax.
  s.ellipse(abdomenX, bodyY, abdomenRX, abdomenRY, art.detail >= 2 ? 10 : 8);
  s.ellipse(0, thoraxY, h * 0.2 * b, h * 0.16 * b, art.detail >= 2 ? 8 : 6);

  // Legs: three pairs.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      const swing = stride * (row % 2 ? 1 : -1) * (side > 0 ? 1 : -1);
      const hipX = side * h * 0.12,
        hipY = thoraxY - h * 0.03,
        footX = side * h * (0.3 + row * 0.04) + swing,
        footY = 1.5;
      if (detailedLimbs) {
        const kneeX = side * h * 0.34 + swing * 0.4,
          kneeY = h * 0.25;
        s.limb([hipX, hipY], [kneeX, kneeY], 2.1 * b, 1.7 * b);
        s.limb([kneeX, kneeY], [footX, footY], 1.7 * b, 1.3 * b);
      } else {
        s.limb([hipX, hipY], [footX, footY], 1.9 * b, 1.2 * b);
      }
    }
  }

  // Head and mandibles.
  s.ellipse(headX, headY, headR, headR * 0.82, art.detail >= 2 ? 8 : 6);
  s.poly([
    [headX + headR * 0.5, headY - headR * 0.45],
    [headX + headR * 1.15, headY - headR * 0.6],
    [headX + headR * 0.55, headY - headR * 0.1],
  ]);
  s.poly([
    [headX + headR * 0.45, headY + headR * 0.35],
    [headX + headR * 1.0, headY + headR * 0.5],
    [headX + headR * 0.5, headY + headR * 0.05],
  ]);

  // Forelimbs / weapon identity.
  const fore: Pt = [headX - headR * 0.4, bodyY + h * 0.12];
  if (art.look.weapon === "sickle") {
    if (art.detail < 1) s.limb(fore, [fore[0] + h * 0.34, fore[1] + h * 0.02], 2.6 * b, 0.7);
    else s.poly(curvedLimb(fore, [fore[0] + h * 0.28, fore[1] + h * 0.1], [fore[0] + h * 0.42, fore[1] - h * 0.1], 2.4 * b, 0.6, 5));
  } else if (art.look.weapon === "claw") {
    if (art.detail < 1) {
      s.limb(fore, [fore[0] + h * 0.34, fore[1] + h * 0.05], 2.3 * b, 0.6);
    } else {
      for (const dy of [-0.06, 0.06]) {
        s.poly(curvedLimb(fore, [fore[0] + h * 0.2, fore[1] + h * dy * 2], [fore[0] + h * 0.3, fore[1] - h * 0.04], 2.2 * b, 0.5, 4));
      }
    }
  } else if (art.look.weapon === "crusher") {
    s.limb(fore, [fore[0] + h * 0.28, fore[1] - h * 0.05], 4.2 * b, 3.2 * b);
    s.ellipse(fore[0] + h * 0.34, fore[1] - h * 0.05, h * 0.12, h * 0.09, 8);
  } else if (art.look.weapon === "spit") {
    s.poly([
      [headX - headR * 0.2, headY + headR * 0.2],
      [headX + h * 0.32, headY + headR * 0.34],
      [headX + h * 0.34, headY + headR * 0.05],
      [headX - headR * 0.1, headY - headR * 0.1],
    ]);
  }
  for (const side of [-1, 1]) {
    const base: Pt = [headX - headR * 0.1, headY + headR * 0.5];
    if (detailedLimbs) {
      s.poly(curvedLimb(base, [headX - headR * 0.3, headY + headR * 1.2], [headX + side * headR * 1.2, headY + headR * 1.5], 1.0, 0.4, 4));
    } else {
      s.limb(base, [headX + side * headR * 1.1, headY + headR * 1.3], 0.9, 0.35);
    }
  }
  hooks.extra?.(s, pose, art);
  s.commit();

  // Materials.
  if (rich) detailPoly(g, pose, [[abdomenX-abdomenRX*.82,bodyY+abdomenRY*.25],
    [abdomenX-abdomenRX*.3,bodyY+abdomenRY*.85],[abdomenX+abdomenRX*.55,bodyY+abdomenRY*.62],
    [abdomenX+abdomenRX*.3,bodyY+abdomenRY*.1],[abdomenX-abdomenRX*.4,bodyY]], p.light);
  detailEllipse(g, pose, headX + headR * 0.25, headY + headR * 0.15, Math.max(1.2, headR * 0.18), Math.max(1.2, headR * 0.18), p.eye);
  if (art.detail >= 2) {
    detailEllipse(g, pose, headX - headR * 0.25, headY + headR * 0.1, Math.max(1.1, headR * 0.14), Math.max(1.1, headR * 0.14), p.eye);
    for (let i = -1; i <= 1; i++)
      detailLine(g, pose, [abdomenX + i * abdomenRX * 0.45, bodyY - abdomenRY * 0.8], [abdomenX + i * abdomenRX * 0.45, bodyY + abdomenRY * 0.8], p.shade, 1.1);
  }
  if (art.look.weapon === "sickle" || art.look.weapon === "claw" || art.look.weapon === "crusher")
    detailLine(g, pose, fore, [fore[0] + h * 0.28, fore[1] - h * 0.02], p.metalLight, 1.2);
  hooks.details?.(g, pose, art);
}

export function drawMech(g: Graphics, pose: Pose, art: EnemyArt, hooks: ArtHooks = {}) {
  const h = art.height;
  const b = art.look.bulk;
  const bodyY = h * 0.48 - pose.crouch * 0.65 + pose.bob * .4;
  const bodyW = h * 0.44 * b;
  const bodyH = h * 0.3 * b;
  const detail = art.detail;
  const p = art.palette;
  const s = new Silhouette(g, pose, p.base, p.outline, art.kind === "boss" ? 3.4 : detail >= 2 ? 2.6 : 2.1);
  const plate = (u: number, v: number, w: number, hh: number, r: number) => {
    if (detail >= 2) s.plate(u, v, w, hh, r);
    else
      s.poly([
        [u - w / 2, v - hh / 2],
        [u + w / 2, v - hh / 2],
        [u + w / 2, v + hh / 2],
        [u - w / 2, v + hh / 2],
      ]);
  };
  hooks.back?.(s, pose, art);

  if (art.look.legs === "track") {
    for (const side of [-1, 1]) plate(side * bodyW * 0.52, h * 0.16, bodyW * 0.34, h * 0.2, h * 0.07);
  } else if (art.look.legs === "spider") {
    for (const side of [-1, 1])
      for (const row of [0, 1]) {
        const swing = pose.stride * (row ? 1 : -1) * (side > 0 ? 1 : -1);
        s.limb([side * bodyW * 0.38, bodyY - bodyH * 0.2], [side * bodyW * 0.75 + swing, h * 0.24], 2.2 * b, 1.6 * b);
        s.limb([side * bodyW * 0.75 + swing, h * 0.24], [side * bodyW * 0.9 + swing, 1.5], 1.6 * b, 1.2 * b);
      }
  } else if (art.look.legs === "piston") {
    for (const side of [-1, 1]) {
      const swing = pose.stride * (side > 0 ? 1 : -1);
      s.limb([side * bodyW * 0.32, bodyY - bodyH * 0.4], [side * bodyW * 0.42 + swing, h * 0.22], 2.4 * b, 1.8 * b);
      s.limb([side * bodyW * 0.42 + swing, h * 0.22], [side * bodyW * 0.5 + swing, 1.5], 1.8 * b, 1.4 * b);
    }
  } else if (art.look.legs === "none") {
    s.ellipse(0, h * 0.16, bodyW * 0.5, h * 0.1, 8);
  }

  plate(0, bodyY, bodyW, bodyH, h * 0.06);
  plate(0, bodyY + bodyH * 0.45, bodyW * 0.7, bodyH * 0.2, h * 0.04);
  // Core eye.
  s.ellipse(bodyW * 0.18, bodyY + bodyH * 0.15, h * 0.09, h * 0.09, 8);

  const weapon = art.look.weapon;
  const hand: Pt = [bodyW * 0.5 + pose.lean * .7, bodyY + bodyH * 0.1 + pose.windup * 5];
  if (weapon === "saw") {
    s.limb(hand, [hand[0] + h * 0.16, hand[1] + h * 0.06], 2.2 * b, 1.8 * b);
    s.ellipse(hand[0] + h * 0.24, hand[1] + h * 0.06, h * 0.13, h * 0.13, 10);
    const sawTeeth = detail >= 2 ? 8 : 6;
    for (let i = 0; i < sawTeeth; i++) {
      const a = (i * Math.PI * 2) / sawTeeth;
      s.poly([
        [hand[0] + h * 0.24 + Math.cos(a) * h * 0.11, hand[1] + h * 0.06 + Math.sin(a) * h * 0.11],
        [hand[0] + h * 0.24 + Math.cos(a + 0.18) * h * 0.19, hand[1] + h * 0.06 + Math.sin(a + 0.18) * h * 0.19],
        [hand[0] + h * 0.24 + Math.cos(a + 0.4) * h * 0.11, hand[1] + h * 0.06 + Math.sin(a + 0.4) * h * 0.11],
      ]);
    }
  } else if (weapon === "anchor") {
    s.limb([hand[0], hand[1]], [hand[0] + h * 0.2, hand[1] - h * 0.2], 1.4 * b, 1.8 * b);
    s.limb([hand[0] + h * 0.2, hand[1] - h * 0.2], [hand[0] + h * 0.06, hand[1] - h * 0.3], 1.8 * b, 0.9 * b);
    s.limb([hand[0] + h * 0.2, hand[1] - h * 0.2], [hand[0] + h * 0.34, hand[1] - h * 0.3], 1.8 * b, 0.9 * b);
  } else if (weapon === "coil") {
    plate(bodyW * 0.55, bodyY + bodyH * 0.5, h * 0.16, h * 0.22, h * 0.04);
    s.ellipse(bodyW * 0.55, bodyY + bodyH * 0.5 + h * 0.14, h * 0.08, h * 0.03, 8);
  }
  hooks.extra?.(s, pose, art);
  s.commit();

  // Materials.
  if(detail===0) detailPoly(g,pose,[[-bodyW*.42,bodyY+bodyH*.32],[bodyW*.26,bodyY+bodyH*.32],
    [bodyW*.12,bodyY+bodyH*.1],[-bodyW*.42,bodyY+bodyH*.02]],p.metalLight,pose.alpha*.8);
  detailEllipse(g, pose, bodyW * 0.18, bodyY + bodyH * 0.15, h * 0.055, h * 0.055, p.eye);
  if (detail >= 1) {
    detailLine(g, pose, [-bodyW * 0.4, bodyY - bodyH * 0.25], [bodyW * 0.4, bodyY - bodyH * 0.25], p.metal, 1.6);
    detailPoly(g, pose, [[-bodyW*.4,bodyY+bodyH*.34],[bodyW*.28,bodyY+bodyH*.34],
      [bodyW*.18,bodyY+bodyH*.12],[-bodyW*.4,bodyY+bodyH*.06]], p.metalLight);
  }
  if (detail >= 2) {
    for (const side of [-1, 1]) detailLine(g, pose, [side * bodyW * 0.4, bodyY + bodyH * 0.45], [side * bodyW * 0.4, bodyY - bodyH * 0.4], p.shade, 1.2);
    detailArc(g, pose, bodyW * 0.18, bodyY + bodyH * 0.15, h * 0.1, 0.2, Math.PI * 1.5, p.metalLight, 1.2);
  }
  if (weapon === "saw") detailEllipse(g, pose, hand[0] + h * 0.24, hand[1] + h * 0.06, h * 0.06, h * 0.06, p.metal);
  if (weapon === "saw" && detail >= 1) detailLine(g, pose, hand, [hand[0] + h * 0.18, hand[1] + h * 0.05], p.metalLight, 1.1);
  hooks.details?.(g, pose, art);
}

export function drawFloat(g: Graphics, pose: Pose, art: EnemyArt, hooks: ArtHooks = {}) {
  const h = art.height;
  const p = art.palette;
  const bob = pose.frozen ? 0 : Math.sin(pose.time * 2.5 + pose.id) * 1.5;
  const bodyY = h * 0.54 + bob - pose.windup * 3 + Math.max(0,pose.lean)*.4;
  const s = new Silhouette(g, pose, p.base, p.outline, art.detail >= 2 ? 2.6 : 2.1);
  hooks.back?.(s, pose, art);
  s.ellipse(0, bodyY, h * 0.22, h * 0.2, 10);
  if (art.look.head === "lantern") {
    s.plate(0, bodyY, h * 0.3, h * 0.42, h * 0.08);
    for (const side of [-1, 1]) s.limb([side * h * 0.3, bodyY - h * 0.15], [side * h * 0.28, bodyY + h * 0.28], 1.4, 1.1);
    s.limb([-h * 0.28, bodyY + h * 0.28], [h * 0.28, bodyY + h * 0.28], 1.2, 1.2);
  } else {
    s.plate(0, bodyY, h * 0.34, h * 0.3, h * 0.08);
  }
  s.ellipse(0, h * 0.16, h * 0.26, h * 0.1, 8);
  hooks.extra?.(s, pose, art);
  s.commit();
  if(art.kind==="boss") detailPoly(g,pose,[[-h*.15,bodyY+h*.1],[h*.13,bodyY+h*.12],
    [h*.09,bodyY+h*.03],[-h*.16,bodyY]],p.metalLight,pose.alpha*.8);
  if (art.look.head === "lantern") {
    detailEllipse(g, pose, 0, bodyY, h * 0.1, h * 0.14, p.eye);
    detailLine(g, pose, [0, bodyY + h * 0.28], [0, bodyY + h * 0.42], p.metalLight, 1.3);
  } else {
    detailEllipse(g, pose, 0, bodyY, h * 0.1, h * 0.1, p.eye);
    detailEllipse(g, pose, 0, bodyY, h * 0.045, h * 0.045, "#eaffff");
  }
  detailLine(g, pose, [-h * 0.2, h * 0.16], [h * 0.2, h * 0.16], p.metalLight, 1.2);
  hooks.details?.(g, pose, art);
}

export function drawDevice(g: Graphics, pose: Pose, art: EnemyArt, hooks: ArtHooks = {}) {
  const h = art.height;
  const p = art.palette;
  const s = new Silhouette(g, pose, p.base, p.outline, 2.3);
  const plate = (u: number, v: number, w: number, hh: number, r: number) => {
    if (art.detail >= 2) s.plate(u, v, w, hh, r);
    else
      s.poly([
        [u - w / 2, v - hh / 2],
        [u + w / 2, v - hh / 2],
        [u + w / 2, v + hh / 2],
        [u - w / 2, v + hh / 2],
      ]);
  };
  plate(0, h * 0.2, h * 0.42, h * 0.12, h * 0.03);
  s.limb([-h * 0.18, h * 0.2], [-h * 0.28, 1.5], 1.5, 1.1);
  s.limb([h * 0.18, h * 0.2], [h * 0.28, 1.5], 1.5, 1.1);
  s.limb([0, h * 0.2], [0, 1.5], 1.5, 1.1);
  plate(0, h * 0.5, h * 0.16, h * 0.48, h * 0.03);
  s.ellipse(0, h * 0.78, h * 0.11, h * 0.11, 8);
  hooks.extra?.(s, pose, art);
  s.commit();
  detailEllipse(g, pose, 0, h * 0.78, h * 0.055, h * 0.055, p.eye);
  detailLine(g, pose, [-h * 0.12, h * 0.36], [h * 0.12, h * 0.36], p.metalLight, 1.4);
  detailLine(g, pose, [-h * 0.12, h * 0.28], [h * 0.12, h * 0.28], p.metal, 1.1);
  hooks.details?.(g, pose, art);
}

export function drawEgg(g: Graphics, pose: Pose, art: EnemyArt) {
  const h = art.height;
  const s = new Silhouette(g, pose, art.palette.base, art.palette.outline, 2.2);
  s.ellipse(0, h * 0.42, h * 0.3, h * 0.4);
  s.commit();
  const p = art.palette;
  detailEllipse(g, pose, -h * 0.07, h * 0.52, h * 0.16, h * 0.24, p.light);
  detailLine(g, pose, [-h * 0.05, h * 0.7], [h * 0.04, h * 0.5], p.shade, 1.4);
  detailLine(g, pose, [h * 0.04, h * 0.5], [-h * 0.02, h * 0.34], p.shade, 1.4);
  if (pose.detail) rim(g, pose, [[-h * 0.18, h * 0.55], [-h * 0.05, h * 0.76], [h * 0.12, h * 0.68]], p.light, 1.1);
}

export function drawGrub(g: Graphics, pose: Pose, art: EnemyArt) {
  const h = art.height;
  const s = new Silhouette(g, pose, art.palette.base, art.palette.outline, 2.2);
  const segments = 4;
  for (let i = 0; i < segments; i++) {
    const u = -h * 0.35 + i * h * 0.22;
    s.ellipse(u, h * 0.32 + Math.sin(pose.time * 3 + i) * 0.6, h * 0.16, h * 0.2);
  }
  s.ellipse(h * 0.42, h * 0.34, h * 0.17, h * 0.16);
  s.commit();
  const p = art.palette;
  eye(g, pose, h * 0.46, h * 0.37, Math.max(1.2, h * 0.06), p.eye);
  if (art.detail < 1) return;
  for (let i = 0; i < segments; i++) {
    const u = -h * 0.35 + i * h * 0.22;
    detailLine(g, pose, [u - h * 0.1, h * 0.4], [u + h * 0.1, h * 0.24], p.shade, 1.1);
  }
  if (pose.detail) rim(g, pose, [[-h * 0.4, h * 0.38], [-h * 0.2, h * 0.5], [h * 0.1, h * 0.47]], p.light, 1);
}
