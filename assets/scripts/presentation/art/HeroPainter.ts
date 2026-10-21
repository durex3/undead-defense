import { Graphics } from "cc";
import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import type { CharacterId } from "../../battle/ProgressionConfig";
import { createPose, type Pose } from "./Actor";
import type { EnemyArt, EnemyPalette } from "./EnemyCatalog";

import { detailEllipse, detailLine, detailPoly, groundShadow, Silhouette, type Pt } from "./Brush";
import { ink } from "./Ink";

const RANGER: EnemyPalette = {
  outline: "#101820",
  shade: "#142e40",
  base: "#27596a",
  light: "#e4e7cf",
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
      height: 64,
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
      height: 68,
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
      height: 64,
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

/** Authored adventurer silhouettes, separate from the enemy humanoid template. */
export function drawHeroBody(g: Graphics, w: SurvivalWorld) {
  updateHeroPose(w);
  const id=w.character??"ranger",p=pose,b=p.bob,stride=p.stride;
  const ranger=id==="ranger",alchemist=id==="alchemist";
  const cloak=ranger?"#27596a":alchemist?"#ded9bf":"#49345e";
  const dark=ranger?"#142e40":alchemist?"#244c51":"#231d36";
  const trim=ranger?"#e8b46b":alchemist?"#73e5c6":"#d9c4f0";
  const shape=new Silhouette(g,p,cloak,"#101824",2.2);
  // Short, grounded boots and broad head read at native phone resolution.
  for(const side of [-1,1]) {
    const x=side*5+side*stride;
    shape.limb([side*5,22+b],[x,3],3.3,2.7);
    shape.poly([[x-3,1],[x+5,1],[x+4,6],[x-3,6]]);
  }
  const flutter=p.moving?Math.sin(w.time*8)*2:0;
  if(ranger)shape.poly([[-7,42+b],[-18,35+b],[-23-flutter,15],[-15,19],[-12,12],[1,28]]);
  else shape.poly([[-10,39+b],[-14,12],[-6,15],[0,10],[8,14],[13,12],[10,40+b]]);
  shape.poly([[-9,40+b],[8,40+b],[10,28+b],[7,19],[-8,19],[-11,29+b]]);
  shape.limb([-9,37+b],[-14,25+b],4.2,3.1);
  shape.limb([8,37+b],[14,27+b],4.2,3.1);
  // Oversized angular hood/hairstyle replaces the tiny generic enemy head.
  shape.poly([[-10,44+b],[-11,53+b],[-6,60+b],[3,62+b],[11,54+b],[10,44+b],[4,40+b],[-4,41+b]]);
  if(!ranger && !alchemist) {
    shape.poly([[-10,53+b],[-14,64+b],[-5,58+b],[0,66+b],[5,58+b],[12,63+b],[10,52+b]]);
    shape.limb([17,15],[17,58+b],1.5,1.8);
    shape.poly([[12,58+b],[17,65+b],[23,58+b],[17,51+b]]);
  }
  if(alchemist) {shape.plate(-14,33+b,10,21,2);shape.plate(-14,46+b,5,7,1);}
  shape.commit();
  const poly=(points:Pt[],color:string)=>detailPoly(g,p,points,color);
  // Large value blocks, with only a few high-contrast equipment details.
  poly([[-8,39+b],[7,39+b],[6,23],[-7,23]],dark);
  poly([[-8,24],[8,24],[8,20],[-8,20]],"#986843");
  poly([[-2,24],[2,24],[2,20],[-2,20]],trim);
  for(const side of [-1,1]) {
    const x=side*5+side*stride;
    poly([[x-3,2],[x+4,2],[x+3,9],[x-3,9]],dark);
  }
  poly([[-8,51+b],[-3,57+b],[6,56+b],[9,51+b],[6,44+b],[-4,44+b],[-8,47+b]],alchemist?"#f4dbbc":ranger?"#edc6a3":"#dccbd4");
  if(ranger) {
    poly([[-10,54+b],[-5,61+b],[4,62+b],[10,55+b],[4,56+b],[-3,52+b]],dark);
    poly([[-9,44+b],[8,44+b],[6,39+b],[-7,39+b]],trim);
    poly([[-7,42+b],[-19-flutter,38+b],[-26-flutter,42+b],[-22-flutter,33+b],[-8,37+b]],"#be774e");
    poly([[7,38+b],[10,36+b],[-6,24],[-8,27]],"#b98b5a");
    poly([[13,28+b],[17,29+b],[19,17+b],[15,20+b]],"#d8e6e4");
  } else if(alchemist) {
    poly([[-10,54+b],[-7,59+b],[6,60+b],[10,55+b],[6,52+b],[-7,52+b]],dark);
    for(const x of [-4,4]) {detailEllipse(g,p,x,53+b,3.3,2.7,"#b99354");detailEllipse(g,p,x,53+b,2,1.8,"#73e5c6");}
    poly([[-10,38+b],[-5,40+b],[-2,29+b],[-7,32+b]],"#f6f0d7");
    poly([[8,38+b],[4,40+b],[1,29+b],[6,32+b]],"#f6f0d7");
    detailEllipse(g,p,15,26+b,5.2,6.3,"#bfe7dd");detailEllipse(g,p,15,25+b,3.6,4.1,"#45cfab");
    poly([[-17,42+b],[-12,42+b],[-12,28+b],[-17,28+b]],"#54b9a5");
  } else {
    poly([[-10,54+b],[-5,60+b],[3,61+b],[10,54+b],[7,50+b],[1,55+b],[-6,50+b]],dark);
    poly([[-10,40+b],[-6,44+b],[0,37+b],[6,44+b],[11,40+b],[7,34+b],[-6,34+b]],"#e4d7b8");
    poly([[-11,21],[-15,25],[-18,23],[-17,14],[-10,12]],"#a795bc");
    detailEllipse(g,p,17,58+b,3.2,4.3,"#d5a6ff");
  }
  if(!alchemist) {
    detailLine(g,p,[-4,50+b],[-1,50+b],dark,1.5);
    detailLine(g,p,[3,50+b],[6,50+b],dark,1.5);
  }
  if(w.invulnerable>0 && Math.floor(w.time*10)%2)
    detailArc(g,p,0,29,23,.2,Math.PI*1.7,"#ffb0b0",1.6,150,12);
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
