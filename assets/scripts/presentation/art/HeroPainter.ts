import { Graphics } from "cc";
import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import type { CharacterId } from "../../battle/ProgressionConfig";
import { createPose, type Pose } from "./Actor";
import type { EnemyArt, EnemyPalette } from "./EnemyCatalog";
import { drawHumanoid } from "./Archetypes";
import { detailEllipse, detailLine, detailPoly, groundShadow } from "./Brush";
import { ink } from "./Ink";

const RANGER: EnemyPalette = {
  outline: "#101820",
  shade: "#31452f",
  base: "#748266",
  light: "#d6d7ac",
  cloth: "#a4573b",
  metal: "#6f7f68",
  metalLight: "#c7d3b0",
  bone: "#e6dcc0",
  accent: "#e8c06a",
  eye: "#ffe2a0",
};
const ALCHEMIST: EnemyPalette = {
  outline: "#0d1a1b",
  shade: "#265f5a",
  base: "#3f8b7f",
  light: "#a9e3cd",
  cloth: "#415b6e",
  metal: "#7f9b91",
  metalLight: "#c9e1d7",
  bone: "#f0e6c8",
  accent: "#e7c974",
  eye: "#c8fff0",
};
const NECROMANCER: EnemyPalette = {
  outline: "#120d18",
  shade: "#463362",
  base: "#6b4f93",
  light: "#cdb8ef",
  cloth: "#35294b",
  metal: "#8b7a9e",
  metalLight: "#cbbce0",
  bone: "#efe2c9",
  accent: "#c79cff",
  eye: "#e7d7ff",
};

const HERO_ART_CACHE: Partial<Record<CharacterId, EnemyArt>> = {};

function heroArt(character: CharacterId): EnemyArt {
  const cached = HERO_ART_CACHE[character];
  if (cached) return cached;
  let result: EnemyArt;
  if (character === "alchemist")
    result = {
      kind: "minion",
      stage: 0,
      archetype: "humanoid",
      height: 52,
      halfWidth: 14,
      scale: 1,
      motionSpeed: 10,
      strideAmp: 3,
      bobAmp: 1.4,
      detail: 3,
      palette: ALCHEMIST,
      look: {
        weapon: "none",
        shield: "none",
        head: "hood",
        horns: "none",
        legs: "biped",
        cape: false,
        tail: false,
        quills: false,
        bulk: 0.95,
      },
    };
  else if (character === "necromancer")
    result = {
      kind: "minion",
      stage: 0,
      archetype: "humanoid",
      height: 56,
      halfWidth: 14,
      scale: 1,
      motionSpeed: 9,
      strideAmp: 2.6,
      bobAmp: 1.3,
      detail: 3,
      palette: NECROMANCER,
      look: {
        weapon: "staff",
        shield: "none",
        head: "hood",
        horns: "none",
        legs: "biped",
        cape: true,
        tail: false,
        quills: false,
        bulk: 0.95,
      },
    };
  else
    result = {
      kind: "minion",
      stage: 0,
      archetype: "humanoid",
      height: 54,
      halfWidth: 14,
      scale: 1,
      motionSpeed: 10,
      strideAmp: 3,
      bobAmp: 1.5,
      detail: 3,
      palette: RANGER,
      look: {
        weapon: "none",
        shield: "none",
        head: "hood",
        horns: "none",
        legs: "biped",
        cape: true,
        tail: false,
        quills: false,
        bulk: 0.95,
      },
    };
  HERO_ART_CACHE[character] = result;
  return result;
}

const pose = createPose();

function updateHeroPose(w: SurvivalWorld) {
  const moving = Math.hypot(w.move.x, w.move.y) > 0.1;
  pose.x = w.player.x * 48;
  pose.y = w.player.y * 48;
  pose.scale = 1.08;
  pose.face = (w.move.x || w.lastMove.x) < 0 ? -1 : 1;
  pose.lift = 0;
  pose.alpha = w.invulnerable > 0 && Math.floor(w.time * 10) % 2 ? 180 : 255;
  pose.detail = true;
  pose.frozen = false;
  pose.slowed = false;
  pose.burning = false;
  pose.moving = moving;
  pose.windup = 0;
  pose.recover = 0;
  pose.crouch = 0;
  pose.lean = 0;
  pose.stride = moving ? Math.sin(w.time * 10) * 3 : Math.sin(w.time * 2) * 0.25;
  pose.bob = moving ? Math.abs(Math.cos(w.time * 10)) * 1.4 : Math.sin(w.time * 2) * 0.4;
  pose.time = w.time;
  pose.id = -1;
  pose.flash = 0;
}

export function drawHeroShadow(g: Graphics, w: SurvivalWorld) {
  updateHeroPose(w);
  groundShadow(g, pose, 14, 1, 62, false);
  g.strokeColor = ink("#e8d6a4", 180);
  g.lineWidth = 2;
  g.moveTo(pose.x - 13, pose.y - 4);
  g.quadraticCurveTo(pose.x, pose.y - 12, pose.x + 13, pose.y - 4);
  g.stroke();
}

export function drawHeroBody(g: Graphics, w: SurvivalWorld) {
  updateHeroPose(w);
  const character = (w.character ?? "ranger") as CharacterId;
  const art = heroArt(character);
  drawHumanoid(g, pose, art, {
    extra: s => {
      if(character === "alchemist") {
        s.plate(-12,29,12,16,2);s.plate(-12,39,4,6,1);
      } else if(character === "necromancer") {
        s.poly([[-9,42],[-16,53],[-5,47]]);
      } else s.poly([[-9,42],[-21,39],[-31,46],[-25,33],[-11,36]]);
      // Stable, angular shoulder silhouettes survive the small game scale.
      s.poly([[-11,39],[-16,44],[-13,48],[-5,44]]);
      s.poly([[6,42],[12,46],[16,40],[12,37]]);
    },
    details: (gg, p) => {
      // Character-specific hand props.
      const shoulderW = art.height * 0.17 * art.look.bulk;
      const hipY = art.height * 0.4;
      const handX = shoulderW * 1.18;
      const handY = hipY + 5;
      detailPoly(gg,p,[[-13,44],[-11,47],[-5,43],[-8,41]],art.palette.light);
      detailPoly(gg,p,[[7,42],[12,45],[14,41],[11,39]],art.palette.metalLight);
      if (character === "ranger") {
        detailPoly(gg,p,[[-10,41],[-21,38],[-28,43],[-24,35],[-11,37]],art.palette.cloth);
        detailLine(gg, p, [handX, handY], [handX + 5, handY - 13], "#d9e2d0", 2);
        detailPoly(gg, p, [[handX+2,handY-8],[handX+8,handY-9],
          [handX+9,handY-20],[handX+5,handY-16]], art.palette.metalLight);
      } else if (character === "alchemist") {
        detailPoly(gg,p,[[-16,34],[-9,34],[-9,23],[-16,23]],"#85cdb0");
        detailEllipse(gg, p, handX + 3, handY - 4, 5, 6, art.palette.light);
        detailEllipse(gg, p, handX + 3, handY - 3, 3, 4, "#7be8b0");
        detailLine(gg, p, [handX + 3, handY + 2], [handX + 3, handY + 7], art.palette.metalLight, 1.4);
      } else {
        detailEllipse(gg, p, handX + 6, handY + 20, 4, 4, "#efe2c9");
        detailEllipse(gg, p, handX + 5, handY + 21, 1.3, 1.5, "#2a1735");
        detailEllipse(gg, p, handX + 8, handY + 21, 1.3, 1.5, "#2a1735");
      }
      if (w.invulnerable > 0 && Math.floor(w.time * 10) % 2) {
        detailArc(gg, p, 0, art.height * 0.5, 22, 0.2, Math.PI * 1.7, "#ffb0b0", 1.6, 150, 12);
      }
    },
  });
}

/** Sparse locator above friendly effects, always below enemy warnings.
 * Open head/shoulder strokes carry no collision or invulnerability meaning. */
export function drawHeroReadability(g: Graphics, w: SurvivalWorld) {
  updateHeroPose(w);
  const art = heroArt((w.character ?? "ranger") as CharacterId);
  const head = art.height * .845;
  const path = () => {
    for (const side of [-1, 1]) {
      g.moveTo(pose.x + side * 7 * pose.scale, pose.y + (head + 9) * pose.scale);
      g.lineTo(pose.x + side * 11 * pose.scale, pose.y + (head + 4) * pose.scale);
      g.moveTo(pose.x + side * 12 * pose.scale, pose.y + 44 * pose.scale);
      g.lineTo(pose.x + side * 16 * pose.scale, pose.y + 40 * pose.scale);
    }
  };
  g.strokeColor = ink(art.palette.outline, 220); g.lineWidth = 4;
  path(); g.stroke();
  g.strokeColor = ink(art.palette.light, 210); g.lineWidth = 1.8;
  path(); g.stroke();
}

function detailArc(
  g: Graphics,
  p: Pose,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  color: string,
  width: number,
  alpha: number,
  segments: number,
) {
  const n = Math.max(4, segments);
  g.strokeColor = ink(color, alpha);
  g.lineWidth = Math.max(1, width * p.scale);
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const x = p.x + Math.cos(a) * r * p.scale,
      y = p.y + (cy + Math.sin(a) * r) * p.scale;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
}
