import fs from "node:fs";
import sharp from "sharp";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { LIBRARY_KINDS } from "../temp/tests/battle/LibrarySystem.mjs";
import { enemyArt } from "../temp/tests/presentation/art/EnemyCatalog.mjs";
import { drawLibraryBody } from "../temp/tests/presentation/art/enemies/LibraryArt.mjs";
import { drawInkMap } from "../temp/tests/presentation/art/MapArt.mjs";
import {
  createPose,
  updatePose,
} from "../temp/tests/presentation/art/Actor.mjs";
import { BattlePainter } from "../temp/tests/presentation/BattlePainter.mjs";
const out = "artifacts/library-stage";
fs.mkdirSync(out, { recursive: true });
const w = new SurvivalWorld(19, "ranger", 10);
w.time = 312;
w.player = { x: 0, y: 0 };
w.camera = { ...w.player };
w.viewport = { x: 16, y: 7.5 };
w.enemies = [];
const g = new Graphics(),
  pose = createPose(),
  actors = [];
for (const kind of [...LIBRARY_KINDS, "boss"]) {
  const e = w.addEnemy(kind, 0, 0),
    a = enemyArt(10, kind);
  e.state = "seek";
  const limits =
    kind === "boss"
      ? [38, 950]
      : ["sealprovost", "claspjailer"].includes(kind)
        ? [27, 540]
        : kind === "paperbonegrub"
          ? [15, 240]
          : [22, 360];
  const record = { kind, commands: 0, vertices: 0, limits, over: false };
  for (const state of [
    "seek",
    "windup",
    "recover",
    "frozen",
    ...(kind === "boss" ? ["phase-two", "phase-three"] : []),
  ]) {
    e.state = ["frozen", "phase-two", "phase-three"].includes(state)
      ? "seek"
      : state;
    e.bossPhase = state === "phase-three" ? 3 : state === "phase-two" ? 2 : 1;
    e.freezeUntil = state === "frozen" ? w.time + 3 : 0;
    w.library.state(e).vulnerable = state === "recover";
    updatePose(pose, w, e, a, false);
    pose.x = 0;
    pose.y = 0;
    pose.scale = 1;
    g.clear();
    drawLibraryBody(g, w, e, a, pose);
    record.commands = Math.max(record.commands, g.commands.length);
    record.vertices = Math.max(record.vertices, g.vertexCount);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="250"><rect width="240" height="250" fill="#30343d"/><g transform="translate(120 215) scale(1.45 -1.45)">${g.toSVG()}</g><text x="120" y="240" text-anchor="middle" font-size="12" fill="#f1e5c7">${kind} ${state}</text></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(`${out}/${kind}-${state}.png`);
  }
  record.over = record.commands > limits[0] || record.vertices > limits[1];
  actors.push(record);
}
await sharp({
  create: { width: 960, height: 500, channels: 4, background: "#30343d" },
})
  .composite(
    await Promise.all(
      actors.map(async (a, i) => ({
        input: await fs.promises.readFile(`${out}/${a.kind}-seek.png`),
        left: (i % 4) * 240,
        top: Math.floor(i / 4) * 250,
      })),
    ),
  )
  .png()
  .toFile(`${out}/actors.png`);
w.enemies = [];
for (const [k, x, y] of [
  ["sealprovost", -4, 0],
  ["claspjailer", 4, 0],
  ["paperbonegrub", -4, -2],
  ["folioray", 5, 2],
  ["sealclerk", -5, 2],
  ["spineclasp", 3, -2],
]) {
  const e = w.addEnemy(k, x, y);
  e.state = "seek";
  e.attack = 0;
  w.library.state(e);
}
w.library.state(w.enemies[0]).action = "pair";
w.library.begin(w.enemies[0]);
const painter = new BattlePainter(g),
  map = new Graphics();
drawInkMap(map, 10);
for (const [name, delay] of [
  ["warning", 0.4],
  ["active", 2.7],
]) {
  const time = w.time;
  w.time += delay;
  painter.draw(w, 0.1, [], false);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="844" height="390"><rect width="844" height="390" fill="#171923"/><g transform="translate(422 200) scale(.54 -.54)">${map.toSVG()}${g.toSVG()}</g><rect width="844" height="42" fill="#1d1b25" fill-opacity=".93"/><text x="20" y="26" font-size="16" fill="#f1e5c7">缄页禁库 · 05:12 · 踩签撤招</text><rect x="18" y="350" width="140" height="22" rx="5" fill="#1d1b25"/><text x="28" y="366" font-size="12" fill="#c9c7d5">移动区域</text><rect x="734" y="345" width="92" height="30" rx="5" fill="#1d1b25"/><text x="748" y="365" font-size="13" fill="#f1e5c7">拾魂</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${out}/landscape-${name}.png`);
  w.time = time;
}
w.enemies = [];
for (let i = 0; i < 100; i++) {
  const e = w.addEnemy(
    i === 0 ? "sealprovost" : i === 1 ? "claspjailer" : "paperbonegrub",
    ((i % 10) - 5) * 1.5,
    (Math.floor(i / 10) - 5) * 1.1,
  );
  e.state = "seek";
  e.hp = e.maxHp = 1e8;
}
for (const [s, mods] of Object.entries({
  blade: ["hunt", "return"],
  fire: ["salvo", "flame"],
  lightning: ["relay", "echo"],
  holy: ["rain", "brand"],
})) {
  w.skills[s] = 8;
  w.mods[s] = mods;
}
w.passives.amount = 2;
w.passives.hourglass = 4;
let peak = 0,
  commands = 0;
for (let i = 0; i < 120; i++) {
  w.time += 1 / 60;
  for (const h of w.hazards) {
    h.due = w.time + 0.5;
    h.until = w.time + 3;
  }
  w.armory.step(1 / 60);
  if (i % 6 === 0) {
    painter.draw(w, 0.1, w.drain(), false);
    peak = Math.max(peak, g.vertexCount);
    commands = Math.max(commands, g.commands.length);
  }
}
const report = {
  scope:
    "Offline body/state draw budgets; 844x390 mock HUD footprints are illustrative, actual Cocos UI tested separately. No GPU or phone heat claim.",
  actors,
  stress: {
    enemies: 100,
    elites: 2,
    weapons: 4,
    signs: w.hazards.length,
    vertices: peak,
    commands,
    over: peak > 45000,
  },
};
fs.writeFileSync(
  `${out}/art-budget.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (actors.some((a) => a.over) || report.stress.over) process.exitCode = 1;
