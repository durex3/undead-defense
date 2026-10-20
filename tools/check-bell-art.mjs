import fs from "node:fs";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { BattlePainter } from "../temp/tests/presentation/BattlePainter.mjs";
import { enemyArt } from "../temp/tests/presentation/art/EnemyCatalog.mjs";
import { drawBellBody } from "../temp/tests/presentation/art/enemies/BellArt.mjs";
import {
  createPose,
  updatePose,
} from "../temp/tests/presentation/art/Actor.mjs";
import sharp from "sharp";
const w = new SurvivalWorld(19, "ranger", 5);
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
  "waxbearer",
  "bellacolyte",
  "waxscribe",
  "waxcrawler",
  "twinbell",
  "waxporter",
  "boss",
]) {
  const e = w.addEnemy(kind);
  e.state = "seek";
  const a = enemyArt(5, kind);
  updatePose(p, w, e, a, false);
  g.clear();
  drawBellBody(g, w, e, a, p);
  const limit =
    kind === "boss"
      ? [38, 950]
      : ["twinbell", "waxporter"].includes(kind)
        ? [27, 540]
        : kind === "waxbearer"
          ? [15, 240]
          : [22, 360];
  actors.push({
    kind,
    commands: g.commands.length,
    vertices: g.vertexCount,
    limit,
    over: g.commands.length > limit[0] || g.vertexCount > limit[1],
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="230" height="250"><rect width="230" height="250" fill="#34303b"/><g transform="translate(115 225) scale(1.5 -1.5)">${g.toSVG()}</g></svg>`;
  await sharp(Buffer.from(svg))
    .png()
    .toFile(`artifacts/bell-stage/${kind}.png`);
}
w.enemies = [];
for (let i = 0; i < 100; i++) {
  const e = w.addEnemy(
    i === 0 ? "boss" : i === 1 ? "twinbell" : "waxbearer",
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
  "artifacts/bell-stage/art-budget.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (actors.some((a) => a.over) || report.stress.over) process.exitCode = 1;
