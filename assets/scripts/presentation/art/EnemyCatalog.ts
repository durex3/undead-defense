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

const BELL:EnemyPalette={outline:'#191923',shade:'#6d5e68',base:'#baa98c',light:'#ede1bf',cloth:'#665768',metal:'#8e805c',metalLight:'#d9c58d',bone:'#e0d6b6',accent:'#edb76d',eye:'#ffe9b4'};
const TIDE:EnemyPalette={outline:'#101d22',shade:'#314a4d',base:'#6b9390',light:'#b7d0bc',cloth:'#8f6248',metal:'#8e6950',metalLight:'#cfaa7b',bone:'#c6c2a1',accent:'#77d9cf',eye:'#ffc17e'};
const LIBRARY:EnemyPalette={outline:"#1d1b25",shade:"#726354",base:"#c7b999",light:"#f1e5c7",cloth:"#7e708d",metal:"#816345",metalLight:"#c5a172",bone:"#e8daba",accent:"#e8b68e",eye:"#c1d4de"};
const WIND:EnemyPalette={outline:"#182128",shade:"#596975",base:"#b4b8ad",light:"#e8dfc9",cloth:"#607987",metal:"#806653",metalLight:"#c6a67a",bone:"#e9dfc8",accent:"#dfad81",eye:"#b6deea"};
const ROOT:EnemyPalette={outline:"#161e19",shade:"#405243",base:"#7e9675",light:"#c6d3ac",cloth:"#956c75",metal:"#66543d",metalLight:"#d1be8d",bone:"#dfd6b7",accent:"#e3ab78",eye:"#f3d9a0"};
const PRISM:EnemyPalette={outline:"#191625",shade:"#494359",base:"#7b7894",light:"#c6bcd1",cloth:"#665568",metal:"#807666",metalLight:"#c7b5bd",bone:"#d6ceb8",accent:"#edc48c",eye:"#f3dfa7"};
const ECLIPSE:EnemyPalette={outline:"#171823",shade:"#484555",base:"#91889c",light:"#e6ddc5",cloth:"#514761",metal:"#67594d",metalLight:"#c9b17e",bone:"#dad3c3",accent:"#ecd092",eye:"#fff3cd"};
const EDGE:EnemyPalette={outline:"#151d28",shade:"#3d4c5a",base:"#7c929f",light:"#c6d4d7",cloth:"#485563",metal:"#646d7b",metalLight:"#c6c4a5",bone:"#c4c9bb",accent:"#eacb86",eye:"#b3e6df"};
const KILN:EnemyPalette={outline:"#241b20",shade:"#62433e",base:"#b77460",light:"#ead1b0",cloth:"#665951",metal:"#8b6654",metalLight:"#dcc7a0",bone:"#f2dfb8",accent:"#ffac65",eye:"#fff1b7"};
const LOOM:EnemyPalette={outline:"#201a20",shade:"#61505b",base:"#a58e7a",light:"#e9d7bc",cloth:"#827084",metal:"#8b6955",metalLight:"#d8b987",bone:"#eddfc5",accent:"#b8a6d6",eye:"#f6dba5"};
export const STAGE_PALETTES: Record<StageId, EnemyPalette> = {
 14:ECLIPSE,
 13:EDGE,
 12:KILN,
 11:LOOM,
  1: SIEGE,
  2: SAND,
  3: THUNDER,
  4: MOON,
  5: BELL,
  6: TIDE,
  10: LIBRARY,
  9: WIND,
  8: ROOT,
  7: PRISM,
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
 "sealclerk","folioray","spineclasp",
 "reedwhistler","sickleplumer","foldedskimmer",
 "vinecantor","wreathpod","bulbmaw",
  "facetgastropod","prismmason","corebrood",
  "sluiceray","sailharpooner","winchbeast",
  "bellacolyte","waxscribe","waxcrawler",
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
 14:["dialscrap","glowdisc","reversegazer","offsetorrery","twindial","eclipsewarden"],
 13:["scrapbound","edgecaster","stepcutter","reelstalker","twinclamp","edgepuppeteer"],
 12:["glazeling","kilnstoker","forkmason","ashsled","splitcrucible","glazejailer","kilnvalve"],
 11:["ragbound","weftbinder","hemcocoon","shuttlecrawler","twinweftwarden","shuttlejailer"],
  1: ["siegebone", "thornshield", "siegebow", "flanker", "siegeflag", "siegerider"],
  2: ["sandworker", "sandlarva", "sandegg", "shellroller", "sandspitter", "sandstalker", "broodelite", "breakerelite"],
  3: ["rivetwalker", "anchorweaver", "arclantern", "railsaw", "gridwarden", "railreaper", "thunderanchor", "gridelectrode"],
  4: ["thornrunner", "crescentmantis", "vaultlynx", "antlerprowler", "moonreaver", "hornwarden"],
  10: ["paperbonegrub","sealclerk","folioray","spineclasp","sealprovost","claspjailer"],
  9: ["fledglingeffigy","reedwhistler","sickleplumer","foldedskimmer","windarbiter","plumejudge"],
  8: ["rootshuffler","vinecantor","wreathpod","bulbmaw","biforktangler","pairedcalyx","migratorycorolla"],
  7: ["shardhermit","facetgastropod","prismmason","corebrood","bifacetregent","strataflinger","prismmirror","prismcore"],
  6: ["brineporter","sluiceray","sailharpooner","winchbeast","twinlockwarden","severedcrane"],
  5: ["waxbearer","bellacolyte","waxscribe","waxcrawler","twinbell","waxporter"],
};

const STAGE_OF: Partial<Record<Kind, StageId>> = {};
for (const stage of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const)
  for (const kind of CATALOG_STAGE_KINDS[stage]) STAGE_OF[kind] = stage;

export function catalogStage(kind: Kind): StageId | 0 {
  return STAGE_OF[kind] ?? 0;
}

export function isDeviceKind(kind: Kind) {
  return kind === "kilnvalve" || kind === "thunderanchor" || kind === "gridelectrode" || kind === "prismmirror" || kind === "prismcore";
}

const COMMON: Partial<Record<Kind, EnemyArt>> = {
  siegebone: art("siegebone", 1, "humanoid", 54, 13, SIEGE, { weapon: "spear", head: "skull", bulk: 0.94 }),
  thornshield: art("thornshield", 1, "humanoid", 56, 18, SIEGE, {
    weapon: "axe",
    shield: "thorn",
    head: "skull",
    bulk: 1.14,
  }),
  siegebow: art("siegebow", 1, "humanoid", 52, 16, SIEGE, { weapon: "crossbow", head: "skull", bulk: 0.9 }),
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
 14:art("boss",14,"float",125,65,ECLIPSE,{head:"core",legs:"none"},{scale:1.2,motionSpeed:3,strideAmp:0}),
 13:art("boss",13,"mech",122,68,EDGE,{head:"core",legs:"quad"},{scale:1.2,motionSpeed:5,strideAmp:1.4}),
 12:art("boss",12,"mech",115,66,KILN,{head:"core",legs:"quad"},{scale:1.2,motionSpeed:4,strideAmp:1.4}),
 11:art("boss",11,"mech",130,74,LOOM,{head:"core",legs:"quad"},{scale:1.2,motionSpeed:4,strideAmp:1.5}),
 10:art("boss",10,"humanoid",125,69,LIBRARY,{head:"core",legs:"spider"},{scale:1.2,motionSpeed:4,strideAmp:1.5}),
 9:art("boss",9,"humanoid",125,65,WIND,{head:"beast",legs:"biped"},{scale:1.2,motionSpeed:5,strideAmp:1.5}),
  8:art("boss",8,"grub",140,52,ROOT,{head:"core",legs:"spider"},{scale:1.18,motionSpeed:4,bobAmp:1.1}),
  7:art("boss",7,"quadruped",124,52,PRISM,{head:"core",legs:"quad"},{scale:1.3,motionSpeed:5,bobAmp:.8}),
  6: art("boss",6,"mech",104,58,TIDE,{head:"core",legs:"quad",weapon:"anchor"},{scale:1.3,motionSpeed:5,bobAmp:1}),
  5: art("boss",5,"float",94,34,BELL,{head:"core",legs:"spider",weapon:"staff",bulk:1.4},{scale:1.45}),
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
 14:{...COMMON.minion!,stage:14,palette:ECLIPSE},
 13:{...COMMON.minion!,stage:13,palette:EDGE},
 12:{...COMMON.minion!,stage:12,palette:KILN},
 11:{...COMMON.minion!,stage:11,palette:LOOM},
 10:{...COMMON.minion!,stage:10,palette:LIBRARY},
 9:{...COMMON.minion!,stage:9,palette:WIND},
  8:{...COMMON.minion!,stage:8,palette:ROOT},
  7:{...COMMON.minion!,stage:7,palette:PRISM},
  6:{...COMMON.minion!,stage:6,palette:TIDE},
  5:{...COMMON.minion!,stage:5,palette:BELL},
  1: { ...COMMON.minion!, palette: SIEGE },
  2: { ...COMMON.minion!, palette: SAND },
  3: { ...COMMON.minion!, palette: THUNDER },
  4: { ...COMMON.minion!, palette: MOON },
};

const BELL_ART:Partial<Record<Kind,EnemyArt>>={
 waxbearer:art('waxbearer',5,'humanoid',66,20,BELL,{weapon:'staff'}),
 bellacolyte:art('bellacolyte',5,'humanoid',70,22,BELL,{weapon:'staff',head:'hood'}),
 waxscribe:art('waxscribe',5,'humanoid',50,27,BELL,{weapon:'sickle'}),
 waxcrawler:art('waxcrawler',5,'insect',34,36,BELL,{legs:'quad'}),
 twinbell:art('twinbell',5,'humanoid',82,32,BELL,{weapon:'staff',head:'hood'},{scale:1.3}),
 waxporter:art('waxporter',5,'humanoid',70,35,BELL,{weapon:'crusher'},{scale:1.3}),
};
const TIDE_ART:Partial<Record<Kind,EnemyArt>>={
 brineporter:art('brineporter',6,'humanoid',63,24,TIDE,{head:'hood'},{strideAmp:3.5}),
 sluiceray:art('sluiceray',6,'quadruped',40,38,TIDE,{head:'beast',legs:'none'},{motionSpeed:4,bobAmp:1}),
 sailharpooner:art('sailharpooner',6,'humanoid',72,32,TIDE,{weapon:'spear'}),
 winchbeast:art('winchbeast',6,'quadruped',42,44,TIDE,{weapon:'anchor',legs:'quad'}),
 twinlockwarden:art('twinlockwarden',6,'humanoid',77,39,TIDE,{head:'helm'},{scale:1.28}),
 severedcrane:art('severedcrane',6,'mech',80,34,TIDE,{weapon:'anchor',legs:'spider'},{scale:1.3}),
};
const PRISM_ART:Partial<Record<Kind,EnemyArt>>={
 shardhermit:art('shardhermit',7,'quadruped',50,39,PRISM,{head:'beast',legs:'quad'}),
 facetgastropod:art('facetgastropod',7,'quadruped',69,40,PRISM,{weapon:'spit',legs:'none'},{motionSpeed:5,strideAmp:.5}),
 prismmason:art('prismmason',7,'mech',74,30,PRISM,{head:'core',legs:'spider'}),
 corebrood:art('corebrood',7,'grub',50,39,PRISM,{head:'beast',legs:'quad'},{motionSpeed:7,strideAmp:2}),
 bifacetregent:art('bifacetregent',7,'humanoid',83,45,PRISM,{weapon:'staff',head:'core'},{scale:1.28}),
 strataflinger:art('strataflinger',7,'quadruped',78,47,PRISM,{head:'core',legs:'quad'},{scale:1.3}),
 prismmirror:art('prismmirror',7,'device',42,34,PRISM,{head:'core',legs:'none'},{motionSpeed:0,strideAmp:0,bobAmp:0}),
 prismcore:art('prismcore',7,'device',38,32,PRISM,{head:'core',legs:'none'},{motionSpeed:0,strideAmp:0,bobAmp:0}),
};
const ROOT_ART:Partial<Record<Kind,EnemyArt>>={
 migratorycorolla:art("migratorycorolla",8,"grub",90,52,ROOT,{head:"core",legs:"insect"},{scale:1.2,motionSpeed:6,strideAmp:1.8}),
 rootshuffler:art("rootshuffler",8,"grub",48,34,ROOT,{head:"core",legs:"insect"},{motionSpeed:9,strideAmp:2}),
 vinecantor:art("vinecantor",8,"humanoid",80,32,ROOT,{head:"core",legs:"spider"},{motionSpeed:6,strideAmp:1.5}),
 wreathpod:art("wreathpod",8,"grub",57,38,ROOT,{head:"core",legs:"none"},{motionSpeed:5,strideAmp:1}),
 bulbmaw:art("bulbmaw",8,"grub",81,25,ROOT,{head:"lantern",legs:"spider"},{motionSpeed:5,strideAmp:1.5}),
 biforktangler:art("biforktangler",8,"humanoid",95,42,ROOT,{head:"core",legs:"spider"},{scale:1.24,motionSpeed:5}),
 pairedcalyx:art("pairedcalyx",8,"grub",85,56,ROOT,{head:"core",legs:"spider"},{scale:1.22,motionSpeed:5}),
};
const WIND_ART:Partial<Record<Kind,EnemyArt>>={
 fledglingeffigy:art("fledglingeffigy",9,"humanoid",40,26,WIND,{head:"beast",legs:"biped"},{scale:1,motionSpeed:6,strideAmp:2}),
 reedwhistler:art("reedwhistler",9,"humanoid",77,22,WIND,{head:"beast",legs:"biped"},{scale:1,motionSpeed:6,strideAmp:2}),
 sickleplumer:art("sickleplumer",9,"humanoid",64,33,WIND,{head:"beast",legs:"biped"},{scale:1,motionSpeed:6,strideAmp:2}),
 foldedskimmer:art("foldedskimmer",9,"humanoid",72,35,WIND,{head:"beast",legs:"biped"},{scale:1,motionSpeed:6,strideAmp:2}),
 windarbiter:art("windarbiter",9,"humanoid",100,45,WIND,{head:"beast",legs:"biped"},{scale:1.2,motionSpeed:6,strideAmp:2}),
 plumejudge:art("plumejudge",9,"humanoid",90,53,WIND,{head:"beast",legs:"biped"},{scale:1.2,motionSpeed:6,strideAmp:2}),
};
const LIBRARY_ART:Partial<Record<Kind,EnemyArt>>={
 paperbonegrub:art("paperbonegrub",10,"grub",38,30,LIBRARY,{head:"core",legs:"spider"},{scale:1,motionSpeed:6,strideAmp:1.7}),
 sealclerk:art("sealclerk",10,"humanoid",79,26,LIBRARY,{head:"core",legs:"spider"},{scale:1,motionSpeed:6,strideAmp:1.7}),
 folioray:art("folioray",10,"quadruped",48,42,LIBRARY,{head:"core",legs:"spider"},{scale:1,motionSpeed:6,strideAmp:1.7}),
 spineclasp:art("spineclasp",10,"quadruped",53,38,LIBRARY,{head:"core",legs:"spider"},{scale:1,motionSpeed:6,strideAmp:1.7}),
 sealprovost:art("sealprovost",10,"humanoid",101,42,LIBRARY,{head:"core",legs:"spider"},{scale:1.22,motionSpeed:6,strideAmp:1.7}),
 claspjailer:art("claspjailer",10,"quadruped",77,54,LIBRARY,{head:"core",legs:"spider"},{scale:1.22,motionSpeed:6,strideAmp:1.7}),
};
const LOOM_ART:Partial<Record<Kind,EnemyArt>>={
 ragbound:art("ragbound",11,"humanoid",44,25,LOOM,{head:"skull"}),
 weftbinder:art("weftbinder",11,"humanoid",80,32,LOOM,{head:"skull"}),
 hemcocoon:art("hemcocoon",11,"float",80,38,LOOM,{head:"core",legs:"spider"}),
 shuttlecrawler:art("shuttlecrawler",11,"quadruped",49,49,LOOM,{head:"core",legs:"quad"}),
 twinweftwarden:art("twinweftwarden",11,"humanoid",105,46,LOOM,{head:"skull"},{scale:1.18}),
 shuttlejailer:art("shuttlejailer",11,"quadruped",80,65,LOOM,{head:"core",legs:"quad"},{scale:1.18}),
};
const KILN_ART:Partial<Record<Kind,EnemyArt>>={glazeling:art("glazeling",12,"mech",48,24,KILN,{head:"core",legs:"quad"},{scale:1,strideAmp:1.4}),kilnstoker:art("kilnstoker",12,"mech",70,32,KILN,{head:"core",legs:"quad"},{scale:1,strideAmp:1.4}),forkmason:art("forkmason",12,"mech",77,37,KILN,{head:"core",legs:"quad"},{scale:1,strideAmp:1.4}),ashsled:art("ashsled",12,"mech",45,42,KILN,{head:"core",legs:"quad"},{scale:1,strideAmp:1.4}),splitcrucible:art("splitcrucible",12,"mech",92,48,KILN,{head:"core",legs:"quad"},{scale:1.18,strideAmp:1.4}),glazejailer:art("glazejailer",12,"mech",80,56,KILN,{head:"core",legs:"quad"},{scale:1.18,strideAmp:1.4}),kilnvalve:art("kilnvalve",12,"device",36,18,KILN,{head:"core",legs:"quad"},{scale:1,strideAmp:1.4}),};
const EDGE_ART:Partial<Record<Kind,EnemyArt>>={scrapbound:art("scrapbound",13,"mech",45,26,EDGE,{head:"core",legs:"quad"},{scale:1,strideAmp:1.6}),edgecaster:art("edgecaster",13,"mech",75,35,EDGE,{head:"core",legs:"quad"},{scale:1,strideAmp:1.6}),stepcutter:art("stepcutter",13,"mech",69,30,EDGE,{head:"core",legs:"quad"},{scale:1,strideAmp:1.6}),reelstalker:art("reelstalker",13,"mech",44,44,EDGE,{head:"core",legs:"quad"},{scale:1,strideAmp:1.6}),twinclamp:art("twinclamp",13,"mech",85,55,EDGE,{head:"core",legs:"quad"},{scale:1.2,strideAmp:1.6}),edgepuppeteer:art("edgepuppeteer",13,"mech",105,46,EDGE,{head:"core",legs:"quad"},{scale:1.18,strideAmp:1.6}),};
const ECLIPSE_ART:Partial<Record<Kind,EnemyArt>>={dialscrap:art("dialscrap",14,"mech",40,25,ECLIPSE,{head:"core",legs:"quad"},{scale:1,strideAmp:1.4}),glowdisc:art("glowdisc",14,"float",60,37,ECLIPSE,{head:"core",legs:"none"},{scale:1,strideAmp:1.4}),reversegazer:art("reversegazer",14,"mech",90,32,ECLIPSE,{head:"core",legs:"quad"},{scale:1,strideAmp:1.4}),offsetorrery:art("offsetorrery",14,"mech",60,43,ECLIPSE,{head:"core",legs:"quad"},{scale:1,strideAmp:1.4}),twindial:art("twindial",14,"mech",96,53,ECLIPSE,{head:"core",legs:"quad"},{scale:1,strideAmp:1.4}),eclipsewarden:art("eclipsewarden",14,"mech",110,52,ECLIPSE,{head:"core",legs:"quad"},{scale:1,strideAmp:1.4})};
Object.assign(COMMON,ECLIPSE_ART,EDGE_ART,KILN_ART,BELL_ART,TIDE_ART,PRISM_ART,ROOT_ART,WIND_ART,LIBRARY_ART,LOOM_ART);
export function enemyArt(stage: StageId, kind: Kind): EnemyArt {
  if(stage===5&&BELL_ART[kind])return BELL_ART[kind]!;
  if (kind === "boss") return BOSS_ART[stage];
  if (kind === "minion") return MINION_ART[stage];
  return COMMON[kind] ?? MINION_ART[stage];
}
