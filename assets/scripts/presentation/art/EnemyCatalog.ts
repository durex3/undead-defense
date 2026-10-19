import type { Kind } from "../../battle/SurvivalConfig";
import type { StageId } from "../../battle/ProgressionConfig";
import type { MotionSpec } from "./Actor";

/**
 * Data-only enemy art catalog.
 *
 * This is the first file to edit for recolours, size changes or new look
 * parameters. Body construction lives in enemies/*Art.ts. The catalog also
 * owns stage membership so the art layer never needs to import a stage
 * System; tests/art-catalog.test.mjs keeps it in sync with the gameplay lists.
 */

export type Archetype = "humanoid" | "quadruped" | "rider" | "insect" | "mech" | "float" | "device" | "egg" | "grub";
export type WeaponKind =
  | "none"
  | "spear"
  | "axe"
  | "crossbow"
  | "banner"
  | "lance"
  | "halberd"
  | "staff"
  | "saw"
  | "anchor"
  | "coil"
  | "claw"
  | "crusher"
  | "sickle"
  | "spit"
  | "moonblade";
export type ShieldKind = "none" | "round" | "tower" | "thorn";
export type HeadKind = "skull" | "helm" | "horned" | "hood" | "crest" | "insect" | "beast" | "core" | "lantern" | "egg";
export type HornKind = "none" | "small" | "wide" | "crescent" | "moon" | "antler";
export type LegKind = "biped" | "quad" | "insect" | "piston" | "spider" | "track" | "none";

export interface EnemyPalette {
  outline: string;
  shade: string;
  base: string;
  light: string;
  cloth: string;
  metal: string;
  metalLight: string;
  bone: string;
  accent: string;
  eye: string;
}

export interface LookParams {
  weapon: WeaponKind;
  shield: ShieldKind;
  head: HeadKind;
  horns: HornKind;
  legs: LegKind;
  cape: boolean;
  tail: boolean;
  quills: boolean;
  bulk: number;
}

export interface EnemyArt extends MotionSpec {
  kind: Kind;
  /** 0 = generic kind shared by every stage (boss/minion). */
  stage: StageId | 0;
  /** Local body height in pixels at scale 1; feet are (0, 0). */
  height: number;
  /** Local shadow half-width in pixels at scale 1. */
  halfWidth: number;
  archetype: Archetype;
  palette: EnemyPalette;
  look: LookParams;
  /** 0 = fodder silhouette, 1 = special, 2 = elite, 3 = boss. */
  detail: number;
}

const SIEGE: EnemyPalette = {
  outline: "#121820",
  shade: "#46535d",
  base: "#87959a",
  light: "#d5dfd8",
  cloth: "#7d3038",
  metal: "#5d6b73",
  metalLight: "#a9b7b4",
  bone: "#d8cfb8",
  accent: "#d8b273",
  eye: "#ffb464",
};
const SAND: EnemyPalette = {
  outline: "#1b1317",
  shade: "#6d4436",
  base: "#b57952",
  light: "#e8c18f",
  cloth: "#6d4a64",
  metal: "#8a6448",
  metalLight: "#c9a77a",
  bone: "#d9c08e",
  accent: "#ffd27f",
  eye: "#ffe2a0",
};
const THUNDER: EnemyPalette = {
  outline: "#0b151b",
  shade: "#2c3f47",
  base: "#668083",
  light: "#b7c9c2",
  cloth: "#334c54",
  metal: "#5c7478",
  metalLight: "#a9b7ae",
  bone: "#c3c69b",
  accent: "#c39a63",
  eye: "#9bf4e4",
};
const MOON: EnemyPalette = {
  outline: "#131a14",
  shade: "#46543f",
  base: "#7e8f70",
  light: "#c3cfae",
  cloth: "#5c4a63",
  metal: "#69765f",
  metalLight: "#aeb89c",
  bone: "#e6ddc2",
  accent: "#d5b6f0",
  eye: "#ff9d78",
};

export const STAGE_PALETTES: Record<StageId, EnemyPalette> = {
  1: SIEGE,
  2: SAND,
  3: THUNDER,
  4: MOON,
};

function look(overrides: Partial<LookParams> = {}): LookParams {
  return {
    weapon: "none",
    shield: "none",
    head: "helm",
    horns: "none",
    legs: "biped",
    cape: false,
    tail: false,
    quills: false,
    bulk: 1,
    ...overrides,
  };
}

const DETAIL_ONE = new Set<Kind>([
  "thornshield",
  "siegebow",
  "sandegg",
  "shellroller",
  "sandspitter",
  "sandstalker",
  "anchorweaver",
  "arclantern",
  "railsaw",
  "thunderanchor",
  "gridelectrode",
  "crescentmantis",
  "vaultlynx",
  "antlerprowler",
  "thornrunner",
]);

function art(
  kind: Kind,
  stage: StageId | 0,
  archetype: Archetype,
  height: number,
  halfWidth: number,
  palette: EnemyPalette,
  lookParams: Partial<LookParams>,
  motion: Partial<MotionSpec> = {},
): EnemyArt {
  const scale = motion.scale ?? 1;
  return {
    kind,
    stage,
    archetype,
    height,
    halfWidth,
    palette,
    look: look(lookParams),
    scale,
    motionSpeed: motion.motionSpeed ?? 10,
    strideAmp: motion.strideAmp ?? 3,
    bobAmp: motion.bobAmp ?? 1.5,
    detail: kind === "boss" ? 3 : scale > 1.2 ? 2 : DETAIL_ONE.has(kind) ? 1 : 0,
  };
}

/* Stage membership is duplicated here on purpose (art must not import stage
 * systems); tests/art-catalog.test.mjs compares it with SIEGE_KINDS etc. */
export const CATALOG_STAGE_KINDS: Record<StageId, readonly Kind[]> = {
  1: ["siegebone", "thornshield", "siegebow", "flanker", "siegeflag", "siegerider"],
  2: ["sandworker", "sandlarva", "sandegg", "shellroller", "sandspitter", "sandstalker", "broodelite", "breakerelite"],
  3: ["rivetwalker", "anchorweaver", "arclantern", "railsaw", "gridwarden", "railreaper", "thunderanchor", "gridelectrode"],
  4: ["thornrunner", "crescentmantis", "vaultlynx", "antlerprowler", "moonreaver", "hornwarden"],
};

const STAGE_OF: Partial<Record<Kind, StageId>> = {};
for (const stage of [1, 2, 3, 4] as const)
  for (const kind of CATALOG_STAGE_KINDS[stage]) STAGE_OF[kind] = stage;

export function catalogStage(kind: Kind): StageId | 0 {
  return STAGE_OF[kind] ?? 0;
}

export function isDeviceKind(kind: Kind) {
  return kind === "thunderanchor" || kind === "gridelectrode";
}

const COMMON: Partial<Record<Kind, EnemyArt>> = {
  siegebone: art("siegebone", 1, "humanoid", 54, 13, SIEGE, { weapon: "spear", head: "helm", bulk: 1.08 }),
  thornshield: art("thornshield", 1, "humanoid", 56, 18, SIEGE, {
    weapon: "axe",
    shield: "thorn",
    head: "helm",
    bulk: 1.14,
  }),
  siegebow: art("siegebow", 1, "humanoid", 52, 16, SIEGE, { weapon: "crossbow", head: "helm", bulk: 0.96 }),
  flanker: art("flanker", 1, "quadruped", 34, 20, SIEGE, { head: "beast", tail: true, bulk: 0.95 }, {
    motionSpeed: 14,
    strideAmp: 4.5,
    bobAmp: 2,
  }),
  siegeflag: art("siegeflag", 1, "humanoid", 62, 16, SIEGE, {
    weapon: "banner",
    head: "horned",
    cape: true,
    horns: "small",
    bulk: 1.04,
  }, { scale: 1.28, motionSpeed: 9 }),
  siegerider: art("siegerider", 1, "rider", 66, 24, SIEGE, {
    weapon: "lance",
    head: "helm",
    cape: true,
    bulk: 1.06,
  }, { scale: 1.32, motionSpeed: 12, strideAmp: 5, bobAmp: 2 }),

  sandworker: art("sandworker", 2, "insect", 40, 18, SAND, { weapon: "sickle", head: "insect", legs: "insect" }, {
    motionSpeed: 11,
    strideAmp: 3.5,
  }),
  sandlarva: art("sandlarva", 2, "grub", 18, 8, SAND, { head: "insect" }, { motionSpeed: 5, strideAmp: 0.6, bobAmp: 0.8 }),
  sandegg: art("sandegg", 2, "egg", 26, 12, SAND, { head: "egg" }, { motionSpeed: 3, strideAmp: 0, bobAmp: 0.6 }),
  shellroller: art("shellroller", 2, "insect", 34, 16, SAND, { head: "insect", legs: "insect", bulk: 1.08 }, {
    motionSpeed: 10,
    strideAmp: 2,
  }),
  sandspitter: art("sandspitter", 2, "insect", 46, 17, SAND, { weapon: "spit", head: "insect", legs: "insect" }, {
    motionSpeed: 9,
    strideAmp: 3,
  }),
  sandstalker: art("sandstalker", 2, "insect", 38, 16, SAND, { weapon: "claw", head: "insect", legs: "insect" }, {
    motionSpeed: 12,
    strideAmp: 4,
  }),
  broodelite: art("broodelite", 2, "insect", 62, 24, SAND, {
    weapon: "claw",
    head: "insect",
    legs: "insect",
    bulk: 1.2,
  }, { scale: 1.25, motionSpeed: 8, strideAmp: 2.6 }),
  breakerelite: art("breakerelite", 2, "insect", 64, 24, SAND, {
    weapon: "crusher",
    head: "insect",
    horns: "small",
    legs: "insect",
    bulk: 1.3,
  }, { scale: 1.3, motionSpeed: 9, strideAmp: 2.8 }),

  rivetwalker: art("rivetwalker", 3, "mech", 42, 18, THUNDER, { head: "core", legs: "piston", bulk: 0.9 }, {
    motionSpeed: 10,
    strideAmp: 2.5,
    bobAmp: 0.9,
  }),
  anchorweaver: art("anchorweaver", 3, "mech", 48, 20, THUNDER, { weapon: "anchor", head: "core", legs: "spider" }, {
    motionSpeed: 8,
    strideAmp: 2,
    bobAmp: 0.9,
  }),
  arclantern: art("arclantern", 3, "float", 46, 15, THUNDER, { weapon: "coil", head: "lantern", legs: "none" }, {
    motionSpeed: 4,
    strideAmp: 0,
    bobAmp: 3,
  }),
  railsaw: art("railsaw", 3, "mech", 40, 20, THUNDER, { weapon: "saw", head: "core", legs: "track", bulk: 1.05 }, {
    motionSpeed: 11,
    strideAmp: 2.5,
    bobAmp: 0.8,
  }),
  gridwarden: art("gridwarden", 3, "mech", 54, 20, THUNDER, {
    weapon: "coil",
    head: "core",
    horns: "small",
    legs: "spider",
    bulk: 1.1,
  }, { scale: 1.25, motionSpeed: 8, strideAmp: 2 }),
  railreaper: art("railreaper", 3, "mech", 56, 22, THUNDER, {
    weapon: "saw",
    head: "core",
    horns: "small",
    legs: "track",
    bulk: 1.15,
  }, { scale: 1.28, motionSpeed: 9, strideAmp: 2.2 }),
  thunderanchor: art("thunderanchor", 3, "device", 46, 12, THUNDER, { weapon: "anchor", head: "core", legs: "none" }, {
    motionSpeed: 0,
    strideAmp: 0,
    bobAmp: 0,
  }),
  gridelectrode: art("gridelectrode", 3, "device", 48, 12, THUNDER, { weapon: "coil", head: "core", legs: "none" }, {
    motionSpeed: 0,
    strideAmp: 0,
    bobAmp: 0,
  }),

  thornrunner: art("thornrunner", 4, "quadruped", 38, 19, MOON, {
    head: "beast",
    quills: true,
    tail: true,
    bulk: 0.95,
  }, { motionSpeed: 13, strideAmp: 5, bobAmp: 2 }),
  crescentmantis: art("crescentmantis", 4, "insect", 52, 16, MOON, {
    weapon: "moonblade",
    head: "insect",
    legs: "biped",
    bulk: 0.9,
  }, { motionSpeed: 9, strideAmp: 3 }),
  vaultlynx: art("vaultlynx", 4, "quadruped", 40, 19, MOON, { weapon: "claw", head: "beast", tail: true }, {
    motionSpeed: 13,
    strideAmp: 5,
    bobAmp: 2,
  }),
  antlerprowler: art("antlerprowler", 4, "quadruped", 46, 20, MOON, {
    head: "beast",
    horns: "antler",
    tail: true,
    bulk: 1.1,
  }, { motionSpeed: 10, strideAmp: 4, bobAmp: 1.8 }),
  moonreaver: art("moonreaver", 4, "insect", 56, 18, MOON, {
    weapon: "moonblade",
    head: "insect",
    cape: true,
    horns: "crescent",
    legs: "biped",
    bulk: 1,
  }, { scale: 1.28, motionSpeed: 9, strideAmp: 3 }),
  hornwarden: art("hornwarden", 4, "quadruped", 60, 22, MOON, {
    head: "beast",
    horns: "moon",
    tail: true,
    bulk: 1.2,
  }, { scale: 1.3, motionSpeed: 9, strideAmp: 3.5, bobAmp: 1.8 }),

  minion: art("minion", 0, "humanoid", 50, 13, SIEGE, { head: "skull", weapon: "claw", bulk: 0.9 }),
};

export const BOSS_ART: Record<StageId, EnemyArt> = {
  1: art("boss", 1, "humanoid", 92, 28, SIEGE, {
    weapon: "halberd",
    shield: "tower",
    head: "horned",
    horns: "wide",
    cape: true,
    bulk: 1.35,
  }, { scale: 1.5, motionSpeed: 7, strideAmp: 2.5, bobAmp: 1.6 }),
  2: art("boss", 2, "insect", 92, 30, SAND, {
    weapon: "crusher",
    head: "insect",
    horns: "crescent",
    legs: "insect",
    bulk: 1.4,
  }, { scale: 1.5, motionSpeed: 7, strideAmp: 2.6, bobAmp: 1.6 }),
  3: art("boss", 3, "float", 92, 28, THUNDER, {
    weapon: "coil",
    head: "core",
    horns: "small",
    legs: "none",
    bulk: 1.3,
  }, { scale: 1.5, motionSpeed: 6, strideAmp: 2, bobAmp: 3 }),
  4: art("boss", 4, "quadruped", 94, 30, MOON, {
    head: "beast",
    horns: "moon",
    tail: true,
    bulk: 1.4,
  }, { scale: 1.55, motionSpeed: 7, strideAmp: 3, bobAmp: 1.8 }),
};

const MINION_ART: Record<StageId, EnemyArt> = {
  1: { ...COMMON.minion!, palette: SIEGE },
  2: { ...COMMON.minion!, palette: SAND },
  3: { ...COMMON.minion!, palette: THUNDER },
  4: { ...COMMON.minion!, palette: MOON },
};

export function enemyArt(stage: StageId, kind: Kind): EnemyArt {
  if (kind === "boss") return BOSS_ART[stage];
  if (kind === "minion") return MINION_ART[stage];
  return COMMON[kind] ?? MINION_ART[stage];
}
