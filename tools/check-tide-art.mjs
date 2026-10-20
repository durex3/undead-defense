import fs from "node:fs";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { BattlePainter } from "../temp/tests/presentation/BattlePainter.mjs";
import { enemyArt } from "../temp/tests/presentation/art/EnemyCatalog.mjs";
import { drawTideBody } from "../temp/tests/presentation/art/enemies/TideArt.mjs";
import {
  createPose,
  updatePose,
} from "../temp/tests/presentation/art/Actor.mjs";
import sharp from "sharp";
fs.mkdirSync("artifacts/tide-stage", { recursive: true });
const w = new SurvivalWorld(19, "ranger", 6);
w.time = 300;
w.level = 64;
w.player = { x: 0, y: 0 };
w.camera = { ...w.player };
w.viewport = { x: 100, y: 100 };
w.enemies = [];
const g = new Graphics(),
  p = createPose(),
  actors = [];
for (const kind of [
  "brineporter",
  "sluiceray",
  "sailharpooner",
  "winchbeast",
  "twinlockwarden",
  "severedcrane",
  "boss",
]) {
  const e = w.addEnemy(kind);
  e.state = "seek";
  const a = enemyArt(6, kind);
  updatePose(p, w, e, a, false);
  p.x = 0;
  p.y = 0;
  p.scale = 1;
  g.clear();
  drawTideBody(g, w, e, a, p);
  const limit =
    kind === "boss"
      ? [38, 950]
      : ["twinlockwarden", "severedcrane"].includes(kind)
        ? [27, 540]
        : kind === "brineporter"
          ? [15, 240]
          : [22, 360];
  const record = {
    kind,
    commands: g.commands.length,
    vertices: g.vertexCount,
    limit,
    over: g.commands.length > limit[0] || g.vertexCount > limit[1],
  };
  actors.push(record);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="230" height="250"><rect width="230" height="250" fill="#25383c"/><g transform="translate(115 225) scale(1.5 -1.5)">${g.toSVG()}</g></svg>`;
  await sharp(Buffer.from(svg))
    .png()
    .toFile(`artifacts/tide-stage/${kind}.png`);
  for (const [name, layers, exposed] of [
    ["fracture-one", 1, false],
    ["fracture-two", 2, false],
    ["exposed", 0, true],
  ]) {
    e.fracture = layers;
    e.fractureUntil = w.time + 3;
    e.state = exposed ? "recover" : "seek";
    w.tide.state(e).vulnerable = exposed;
    g.clear();
    drawTideBody(g, w, e, a, p);
    record.commands = Math.max(record.commands, g.commands.length);
    record.vertices = Math.max(record.vertices, g.vertexCount);
    record.over = record.commands > limit[0] || record.vertices > limit[1];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="230" height="250"><rect width="230" height="250" fill="#25383c"/><g transform="translate(115 225) scale(1.5 -1.5)">${g.toSVG()}</g></svg>`;
    await sharp(Buffer.from(svg))
      .png()
      .toFile(`artifacts/tide-stage/${kind}-${name}.png`);
  }
}
w.enemies = [];
for (let i = 0; i < 100; i++) {
  const e = w.addEnemy(
    i === 0 ? "boss" : i === 1 ? "twinlockwarden" : "brineporter",
    ((i % 10) - 5) * 1.5,
    (Math.floor(i / 10) - 5) * 1.2,
  );
  e.state = "seek";
  e.hp = e.maxHp = 1e8;
}
for (const [s, mods] of Object.entries({
  hammer: ["sweep", "rift"],
  wheel: ["grind", "curve"],
  fire: ["salvo", "flame"],
  holy: ["rain", "brand"],
})) {
  w.skills[s] = 8;
  w.mods[s] = mods;
}
w.skills.blade = 0;
w.passives.amount = 2;
w.passives.hourglass = 4;
const painter = new BattlePainter(g);
const boss = w.enemies.find((e) => e.kind === "boss");
const one = w.tide.waveHazard(boss, 0, 1);
const two = w.tide.forkHazard(boss, 2);
w.hazards = [one, two];
let peak = 0,
  commands = 0;
for (let i = 0; i < 360; i++) {
  w.time += 1 / 60;
  w.armory.step(1 / 60);
  if (i % 6 === 0) {
    painter.draw(w, 0.1, w.drain(), false);
    peak = Math.max(peak, g.vertexCount);
    commands = Math.max(commands, g.commands.length);
  }
}
const report = {
  scope:
    "Offline runtime body and painter command budgets; not GPU frame time or mobile heat.",
  actors,
  stress: {
    enemies: 100,
    weapons: 4,
    frames: 360,
    vertices: peak,
    commands,
    over: peak > 45000,
  },
};
fs.writeFileSync(
  "artifacts/tide-stage/art-budget.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (actors.some((a) => a.over) || report.stress.over) process.exitCode = 1;
