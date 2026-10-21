/**
 * Offline art contact sheets.
 *
 * Run `node tools/build` (or `npm run art:preview`) after changing the art
 * layer. The script transpiles the battle/presentation code, draws fake
 * scenes through the same painters the game uses, and writes approximate SVG
 * and PNG sheets plus a budget report.
 *
 * The SVG renderer is a stub (tools/cc-stub.mjs), not Cocos. Use these sheets
 * to judge composition, silhouettes, readability and draw budgets; final
 * rendering still needs Creator/WeChat device review.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

execFileSync(process.execPath, ["tools/test-build.mjs"], { stdio: "inherit" });

const { Graphics } = await import("../temp/tests/node_modules/cc/index.mjs");
const { BattlePainter } = await import("../temp/tests/presentation/BattlePainter.mjs");
const { isElite, isLarge } = await import("../temp/tests/battle/SurvivalConfig.mjs");
const {
  makeWorld,
  addEnemy,
  addShield,
  setVulnerable,
  setBuried,
  setJump,
  setDevice,
  makeShot,
  makeField,
  makeCast,
  makeExtra,
  makeHazard,
  makeMoonHazard,
  makeThunderHazard,
  makeSiegeCharge,
  makeSiegeGround,
  makeFrontierLane,
} = await import("./art-fixtures.mjs");

const OUT = "artifacts/art-preview";
fs.mkdirSync(OUT, { recursive: true });

const STAGE_BG = {
  1: ["#28272b", "#39353a"],
  2: ["#594034", "#775240"],
  3: ["#18272d", "#263a40"],
  4: ["#182923", "#2b4031"],
};
const STAGE_NAMES = { 1: "siege", 2: "sand", 3: "thunder", 4: "moon" };
const STAGE_KINDS = {
  1: ["siegebone", "thornshield", "siegebow", "flanker", "siegeflag", "siegerider", "boss"],
  2: ["sandworker", "sandlarva", "sandegg", "shellroller", "sandspitter", "sandstalker", "broodelite", "breakerelite", "boss"],
  3: ["rivetwalker", "anchorweaver", "arclantern", "railsaw", "gridwarden", "railreaper", "thunderanchor", "gridelectrode", "boss"],
  4: ["thornrunner", "crescentmantis", "vaultlynx", "antlerprowler", "moonreaver", "hornwarden", "boss"],
};

const cells = [];
const budget = [];

const SPECIAL = new Set([
  "thornshield",
  "siegebow",
  "sandegg",
  "shellroller",
  "sandspitter",
  "sandstalker",
  "anchorweaver",
  "arclantern",
  "railsaw",
  "crescentmantis",
  "vaultlynx",
  "antlerprowler",
]);
function tierOf(kind) {
  if (kind === "boss") return "boss";
  if (isElite(kind)) return "elite";
  if (kind === "thunderanchor" || kind === "gridelectrode") return "device";
  if (SPECIAL.has(kind)) return "special";
  return "fodder";
}
// Limits include one status overlay (freeze/slow) on top of the base body.
const LIMITS = {
  fodder: { ops: 15, verts: 240 },
  special: { ops: 22, verts: 360 },
  device: { ops: 16, verts: 260 },
  elite: { ops: 27, verts: 540 },
  boss: { ops: 38, verts: 950 },
};

function drawWorld(world, withHero = false) {
  const g = new Graphics();
  new BattlePainter(g, { noHero: !withHero }).draw(world, 1 / 60, [], false);
  return g;
}

function addCell(sheet, label, draw, options = {}) {
  cells.push({ sheet, label, draw, stage: options.stage ?? 1 });
}

/* ---------------- enemies ---------------- */

function enemyCell(stage, kind, state, options = {}) {
  const world = makeWorld(stage);
  if (options.shieldPartner) {
    addShield(world, kind);
  } else {
    addEnemy(world, kind, options);
  }
  if (state === "vulnerable") setVulnerable(world.enemies[0], world.time);
  if (state === "buried") setBuried(world.enemies[0], world.time);
  if (state === "jump") setJump(world.enemies[0], world.time);
  if (state === "device") setDevice(world.enemies[0], world.time);
  if (state === "phase2") world.enemies[0].bossPhase = 2;
  return world;
}

const STATE_OPTIONS = {
  seek: {},
  windup: { windup: true },
  recover: { recover: true },
  frozen: { freeze: true },
  slowed: { slow: true },
  arriving: { arriving: true },
  vulnerable: { recover: true },
  buried: {},
  jump: {},
  device: {},
  phase2: { recover: true },
};

for (const stage of [1, 2, 3, 4]) {
  const kinds = STAGE_KINDS[stage];
  for (const kind of kinds) {
    const tier = tierOf(kind);
    const states = ["seek", "windup", "recover", "frozen"];
    if (kind === "sandstalker") states.push("buried");
    if (kind === "vaultlynx" || (kind === "boss" && stage === 4)) states.push("jump");
    if (kind === "thunderanchor" || kind === "gridelectrode") states.push("device");
    if (tier === "elite" || kind === "boss") states.push("vulnerable");
    if (kind === "boss") states.push("phase2");
    for (const state of states) {
      const options = { ...STATE_OPTIONS[state] };
      if (kind === "siegebow") options.pattern = 1;
      if (kind === "thornshield") options.fields = { shieldClock: 0 };
      addCell(`enemies-${STAGE_NAMES[stage]}`, `${kind} · ${state}`, () => {
        const world = enemyCell(stage, kind, state, options);
        const g = drawWorld(world);
        budget.push({
          sheet: `enemies-${STAGE_NAMES[stage]}`,
          label: `${kind} · ${state}`,
          kind,
          tier,
          ops: g.commands.length,
          vertices: g.vertexCount,
          limitOps: LIMITS[tier].ops,
          limitVerts: LIMITS[tier].verts,
        });
        return g;
      }, { stage });
    }
  }
}

/* ---------------- basic spells ---------------- */

const basicSpellCells = [
  ["blade · 飞刀", () => {
    const w = makeWorld(1);
    w.armory.shots = [makeShot("blade", { angle: -0.6, x: 0, y: 0 })];
    return w;
  }],
  ["blade · 猎杀", () => {
    const w = makeWorld(1);
    w.armory.shots = [makeShot("blade", { angle: 0.2, x: 0, y: 0, mods: ["hunt"] })];
    return w;
  }],
  ["blade · 回旋", () => {
    const w = makeWorld(1);
    w.armory.shots = [makeShot("blade", { angle: 2.4, x: 0, y: 0, mods: ["return"], returning: true })];
    return w;
  }],
  ["blade · 碎刃", () => {
    const w = makeWorld(1);
    w.armory.shots = [makeShot("blade", { angle: 1.2, x: -1, y: 0, child: true, mods: ["shards"] })];
    return w;
  }],
  ["fire · 火球", () => {
    const w = makeWorld(1);
    w.armory.shots = [makeShot("fire", { angle: 0.4, x: 0, y: 0 })];
    return w;
  }],
  ["fire · 重火球", () => {
    const w = makeWorld(1);
    w.armory.shots = [makeShot("fire", { angle: -0.3, x: 0, y: 0, mods: ["heavy"], stats: { radius: 1.8 } })];
    return w;
  }],
  ["fire · 余烬", () => {
    const w = makeWorld(1);
    w.armory.shots = [makeShot("fire", { angle: 2.1, x: -1, y: 0, child: true, stats: { radius: 0.6 } })];
    return w;
  }],
  ["fire · 预备重击", () => {
    const w = makeWorld(1);
    w.armory.pending = [makeCast("fire", { mods: ["heavy"], due: 0.2 })];
    return w;
  }],
  ["fire · 火海", () => {
    const w = makeWorld(1);
    w.armory.fields = [makeField("fire", { radius: 1.7, mods: ["flame"] })];
    return w;
  }],
  ["water · 圣水瓶", () => {
    const w = makeWorld(1);
    w.armory.shots = [makeShot("water", { angle: -1.1, x: 0, y: 0 })];
    return w;
  }],
  ["water · 圣泉", () => {
    const w = makeWorld(1);
    w.armory.fields = [makeField("water", { radius: 1.8 })];
    return w;
  }],
  ["water · 奔流", () => {
    const w = makeWorld(1);
    w.armory.fields = [makeField("water", { radius: 1.8, mods: ["wave"] })];
    return w;
  }],
  ["water · 回溯", () => {
    const w = makeWorld(1);
    w.armory.fields = [makeField("water", { radius: 1.8, mods: ["recall"], returning: true, returnTarget: { x: -2, y: -1 } })];
    return w;
  }],
  ["water · 脉冲", () => {
    const w = makeWorld(1);
    w.armory.fields = [makeField("water", { radius: 1.8, mods: ["pulse"] })];
    return w;
  }],
];
for (const [label, world] of basicSpellCells)
  addCell("spells", label, () => drawWorld(world()), { stage: 1 });

/* ---------------- extra spells ---------------- */

const extraCells = [
  ["frost · 脉环", { skill: "frost", mods: [], phase: 0, age: 0.3 }],
  ["frost · 逐浪", { skill: "frost", mods: ["outward"], phase: 0, age: 0.35 }],
  ["frost · 霜扇", { skill: "frost", mods: ["sectors"], phase: 0, age: 0.35 }],
  ["frost · 复震", { skill: "frost", mods: ["aftershock"], phase: 1, age: 0.7 }],
  ["lightning · 链电", { skill: "lightning", mods: [], phase: 0, index: 3 }],
  ["lightning · 雷暴", { skill: "lightning", mods: ["storm"], phase: 0, index: 3, stats: { radius: 1.1 } }],
  ["lightning · 回击", { skill: "lightning", mods: ["echo"], phase: 1, index: 2 }],
  ["lightning · 连桥", { skill: "lightning", mods: ["bridge"], phase: 0, index: 3 }],
  ["ghost · 出巡", { skill: "ghost", mods: [], phase: 0, angle: -0.5 }],
  ["ghost · 盘魂", { skill: "ghost", mods: ["haunt"], phase: 1, angle: 2.1, start: { x: 1, y: 0.5 } }],
  ["ghost · 归途", { skill: "ghost", mods: ["reap"], phase: 2, angle: 1.2, end: { x: -1, y: 0 } }],
  ["bone · 骨矛", { skill: "bone", mods: [], phase: 0, angle: -0.2 }],
  ["bone · 重矛", { skill: "bone", mods: ["lance"], phase: 0, angle: 0.1, stats: { radius: 0.35 } }],
  ["bone · 裂骨", { skill: "bone", mods: ["ridge"], phase: 0, angle: 0 }],
  ["mine · 符雷", { skill: "mine", mods: [], phase: 0, age: 0.8, x: -1, y: 0 }],
  ["mine · 布阵", { skill: "mine", mods: ["scatter"], phase: 0, age: 0.3, x: 0, y: 0 }],
  ["mine · 追爆", { skill: "mine", mods: ["fuse"], phase: 2, age: 0.4, x: 0, y: 0 }],
  ["void · 坍缩", { skill: "void", mods: [], phase: 0, age: 0.8, stats: { radius: 2.2 } }],
  ["void · 迁移", { skill: "void", mods: ["drift"], phase: 0, age: 0.6, stats: { radius: 2.2 } }],
  ["void · 反冲", { skill: "void", mods: ["repel", "collapse"], phase: 1, age: 2.5, until: 2.4, stats: { radius: 2.2 } }],
  ["holy · 落剑", { skill: "holy", mods: [], phase: 0, age: 0.2, next: 0.55 }],
  ["holy · 剑雨", { skill: "holy", mods: ["rain"], phase: 0, age: 0.5, next: 0.73, index: 2 }],
  ["holy · 十字", { skill: "holy", mods: ["cross", "brand"], phase: 1, age: 0.9, next: 0.8 }],
  ["holy · 重落", { skill: "holy", mods: ["execution"], phase: 1, age: 1.2, next: 0.8, stats: { radius: 0.96 } }],
];
for (const [label, options] of extraCells)
  addCell("spells", label, () => {
    const w = makeWorld(1);
    w.time = 2;
    const a = makeExtra(options.skill, { ...options, created: 0 });
    if (options.skill === "holy") {
      a.start = { x: 0, y: 0 };
      a.target = { x: 0, y: 0 };
      a.angle = 0;
    }
    w.armory.extra.attacks = [a];
    return drawWorld(w);
  }, { stage: 1 });

/* ---------------- heroes ---------------- */

for (const character of ["ranger", "alchemist", "necromancer"]) {
  for (const [state, overrides] of [
    ["idle", {}],
    ["move", { move: { x: 1, y: 0 } }],
    ["hurt", { move: { x: -1, y: 0 }, invulnerable: 1 }],
  ]) {
    addCell(`heroes`, `${character} · ${state}`, () => {
      const w = makeWorld(1, { character, ...overrides });
      w.character = character;
      Object.assign(w, overrides);
      return drawWorld(w, true);
    }, { stage: 1 });
  }
}

/* ---------------- hazards ---------------- */

function hazardCell(hazard, time = 0.5, extraWorld) {
  return () => {
    const w = extraWorld ? extraWorld() : makeWorld(1, { time });
    w.time = time;
    w.hazards = [hazard];
    return drawWorld(w);
  };
}

const hazardSpecs = [
  ["circle · 预警", () => makeHazard("circle", { radius: 1.4, due: 1 }), 0.5],
  ["circle · 生效", () => makeHazard("circle", { radius: 1.4, due: 1, fired: true }), 1.2],
  ["sector · 预警", () => makeHazard("sector", { radius: 2.2, width: (Math.PI * 2) / 3, angle: 0, due: 1 }), 0.5],
  ["sector · 生效", () => makeHazard("sector", { radius: 2.2, width: (Math.PI * 2) / 3, angle: 0, due: 1, fired: true }), 1.2],
  ["arrow · 预警", () => makeHazard("arrow", { radius: 5, width: 0.45, angle: 0.2, due: 1, fixedDamage: true, projectileSpeed: 4.5 }), 0.5],
  ["arrow · 飞行", () => makeHazard("arrow", { radius: 5, width: 0.45, angle: 0.2, due: 1, fired: true, fixedDamage: true, projectileSpeed: 4.5 }), 1.4],
  ["bellRing · 预警", () => makeHazard("bellRing", { radius: 2.4, width: 0.8, due: 1 }), 0.5],
  ["bellRing · 生效", () => makeHazard("bellRing", { radius: 2.4, width: 0.8, due: 1, fired: true }), 1.2],
  ["frontierLane · 预警", () => makeFrontierLane({ due: 1 }), 0.5],
  ["frontierLane · 生效", () => makeFrontierLane({ due: 1, fired: true }), 1.2],
  ["siegeCharge · 预警", () => makeSiegeCharge({ due: 1 }), 0.5],
  ["siegeCharge · 冲锋", () => makeSiegeCharge({ due: 1, fired: true }), 1.2],
  ["siegeGround · 预警", () => makeSiegeGround({ due: 1, siegeLaunched: false }), 0.5],
  ["siegeGround · 落点", () => makeSiegeGround({ due: 1, fired: true }), 1.2],
  ["pool · legacy", () => makeHazard("pool", { radius: 1.4, due: 1, fired: true }), 1.2],
  ["flame · legacy", () => makeHazard("flame", { radius: 1.2, due: 1, fired: true }), 1.2],
  ["flameLine · legacy", () => makeHazard("flameLine", { radius: 3, width: 0.5, due: 1, fired: true }), 1.2],
  ["burst · legacy", () => makeHazard("burst", { radius: 0.38, width: 0.38, due: 1, fired: true }), 1.25],
  ["starTrace · legacy", () => makeHazard("starTrace", { radius: 1.2, width: 0.4, due: 1, endX: 3, endY: 1 }), 1.2],
  ["starLeap · legacy", () => makeHazard("starLeap", { radius: 1.2, due: 1, fired: true }), 1.2],
];
for (const [label, factory, time] of hazardSpecs)
  addCell("hazards", label, hazardCell(factory(), time), { stage: 1 });

const moonHazards = [
  ["moonBlade · 预警", "blade", 0.5],
  ["moonBlade · 飞行", "blade", 1.25],
  ["moonLanding · 预警", "landing", 0.5],
  ["moonSweep · 预警", "sweep", 0.5],
  ["moonSweep · 生效", "sweep", 1.25],
  ["moonClaw · 预警", "claw", 0.5],
  ["moonClaw · 生效", "claw", 1.25],
];
for (const [label, shape, time] of moonHazards)
  addCell("hazards", label, () => {
    const w = makeWorld(4, { time });
    const h = makeMoonHazard({
      shape,
      radius: shape === "landing" ? 1.4 : 1.1,
      width: shape === "sweep" || shape === "claw" ? 0.5 : 0.25,
      due: 1,
      out: 0.8,
      launch: undefined,
    });
    if (time >= 1) h.moon.launched = true;
    w.hazards = [h];
    return drawWorld(w);
  }, { stage: 4 });

const thunderHazards = [
  ["thunderWall · 预警", "wall", 0.5],
  ["thunderWall · 推进", "wall", 1.3],
  ["thunderLine · 预警", "line", 0.5],
  ["thunderLine · 生效", "line", 1.2],
  ["thunderSector · 预警", "sector", 0.5],
  ["thunderZone · 预警", "zone", 0.5],
  ["thunderZone · 生效", "zone", 1.2],
];
for (const [label, shape, time] of thunderHazards)
  addCell("hazards", label, () => {
    const w = makeWorld(3, { time });
    const h = makeThunderHazard(shape, {
      radius: shape === "wall" ? 4.8 : shape === "sector" ? 2.6 : 2.2,
      width: shape === "wall" ? 0.8 : shape === "line" ? 0.5 : shape === "sector" ? (Math.PI * 2) / 3 : 0.3,
      due: 1,
      travel: 6,
      speed: 2.8,
      gap: shape === "wall" ? 0.6 : 0,
      order: 1,
    });
    if (time >= 1) h.fired = true;
    w.hazards = [h];
    return drawWorld(w);
  }, { stage: 3 });

/* ---------------- compose ---------------- */

function gridCell(cell, x, y, w, h, stage) {
  const g = new Graphics();
  const world = cell.draw();
  // Some draw callbacks return a Graphics directly; enemy callbacks return a world.
  if (world instanceof Graphics) {
    // already drawn
  } else {
    new BattlePainter(g).draw(world, 1 / 60, [], false);
  }
  // Re-run for callbacks that return worlds (the common case).
  let graphics = g;
  if (world && !(world instanceof Graphics)) {
    // g was filled above
  } else if (world instanceof Graphics) {
    graphics = world;
  }
  const footX = x + w / 2;
  const centered = cell.sheet === "spells" || cell.sheet === "hazards";
  const footY = centered ? y + h / 2 + 8 : y + h - 32;
  const bg = STAGE_BG[stage] ?? STAGE_BG[1];
  const grid =
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg[0]}"/>` +
    `<path d="M${x} ${y + h / 2}H${x + w}M${x + w / 2} ${y}V${y + h}" stroke="${bg[1]}" stroke-width="1" opacity="0.55"/>`;
  const label = `<text x="${x + 8}" y="${y + 15}" fill="#d9e2ea" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="11">${escapeXml(cell.label)}</text>`;
  const stats = `<text x="${x + 8}" y="${y + h - 11}" fill="#8fa0ad" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="9">${graphics.commands.length} ops · ${graphics.vertexCount} v</text>`;
  return (
    grid +
    `<defs><clipPath id="cell-${x}-${y}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs>`+
    `<g clip-path="url(#cell-${x}-${y})"><g transform="translate(${footX},${footY}) scale(1,-1)">${graphics.toSVG()}</g></g>` +
    label +
    stats
  );
}

function escapeXml(value) {
  return String(value).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
}

function writeSheet(name, list, columns, cellW, cellH, scale = 1) {
  const rows = Math.ceil(list.length / columns);
  const width = columns * cellW;
  const height = rows * cellH + 54;
  const header = `<text x="18" y="32" fill="#f0e4c2" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="19">${escapeXml(name)}</text>`;
  let body = "";
  list.forEach((cell, i) => {
    const col = i % columns,
      row = Math.floor(i / columns);
    body += gridCell(cell, col * cellW, 54 + row * cellH, cellW, cellH, cell.stage);
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#10141a"/>${header}${body}</svg>`;
  const svgPath = path.join(OUT, `${name}.svg`);
  fs.writeFileSync(svgPath, svg);
  return sharp(Buffer.from(svg))
    .resize({ width: Math.round(width * scale) })
    .png()
    .toFile(path.join(OUT, `${name}${scale === 1 ? "" : "-50"}.png`))
    .then(() => svgPath);
}

const bySheet = new Map();
for (const cell of cells) {
  if (!bySheet.has(cell.sheet)) bySheet.set(cell.sheet, []);
  bySheet.get(cell.sheet).push(cell);
}

const written = [];
for (const [name, list] of bySheet) {
  const columns = name === "hazards" || name === "spells" ? 4 : 5;
  const cellW = name === "hazards" || name === "spells" ? 280 : 180;
  const cellH = name === "hazards" || name === "spells" ? 260 : 190;
  written.push(await writeSheet(name, list, columns, cellW, cellH));
  if (name.startsWith("enemies")) written.push(await writeSheet(name, list, columns, cellW, cellH, 0.5));
}

const summary = {
  generated: new Date().toISOString(),
  sheets: written,
  budget,
  violations: budget.filter((b) => b.ops > b.limitOps || b.vertices > b.limitVerts),
};
fs.writeFileSync(path.join(OUT, "budget.json"), JSON.stringify(summary, null, 2) + "\n");

console.log(JSON.stringify({
  sheets: written.length,
  cells: cells.length,
  violations: summary.violations.length,
  out: OUT,
}, null, 2));
