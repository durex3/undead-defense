import fs from "node:fs";
import sharp from "sharp";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { WIND_KINDS } from "../temp/tests/battle/WindSystem.mjs";
import { enemyArt } from "../temp/tests/presentation/art/EnemyCatalog.mjs";
import { drawWindBody } from "../temp/tests/presentation/art/enemies/WindArt.mjs";
import { drawWindHazard } from "../temp/tests/presentation/art/WindHazardArt.mjs";
import { drawInkMap } from "../temp/tests/presentation/art/MapArt.mjs";
import {
  createPose,
  updatePose,
} from "../temp/tests/presentation/art/Actor.mjs";
import { BattlePainter } from "../temp/tests/presentation/BattlePainter.mjs";
const out = "artifacts/wind-stage";
fs.mkdirSync(out, { recursive: true });
const w = new SurvivalWorld(19, "ranger", 9);
w.time = 312;
w.player = { x: 0, y: 0 };
w.camera = { ...w.player };
w.viewport = { x: 16, y: 7.5 };
w.enemies = [];
const g = new Graphics(),
  pose = createPose(),
  actors = [];
for (const kind of [...WIND_KINDS, "boss"]) {
  const e = w.addEnemy(kind, 0, 0),
    a = enemyArt(9, kind);
  e.state = "seek";
  const limits =
    kind === "boss"
      ? [38, 950]
      : ["windarbiter", "plumejudge"].includes(kind)
        ? [27, 540]
        : kind === "fledglingeffigy"
          ? [15, 240]
          : [22, 360];
  const record = { kind, commands: 0, vertices: 0, limits, over: false };
  for (const state of ["seek", "windup", "recover", "frozen"]) {
    e.state = state === "frozen" ? "seek" : state;
    e.freezeUntil = state === "frozen" ? w.time + 3 : 0;
    w.wind.state(e).vulnerable = state === "recover";
    updatePose(pose, w, e, a, false);
    pose.x = 0;
    pose.y = 0;
    pose.scale = 1;
    g.clear();
    drawWindBody(g, w, e, a, pose);
    record.commands = Math.max(record.commands, g.commands.length);
    record.vertices = Math.max(record.vertices, g.vertexCount);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="250"><rect width="240" height="250" fill="#293740"/><g transform="translate(120 215) scale(1.45 -1.45)">${g.toSVG()}</g><text x="120" y="240" text-anchor="middle" font-size="12" fill="#e8dfc9">${kind}</text></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(`${out}/${kind}-${state}.png`);
  }
  record.over = record.commands > limits[0] || record.vertices > limits[1];
  actors.push(record);
}
await sharp({
  create: { width: 960, height: 500, channels: 4, background: "#293740" },
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
  ["windarbiter", -4, -1],
  ["plumejudge", 4, -0.5],
  ["reedwhistler", -5, 2],
  ["sickleplumer", 4, 2],
  ["foldedskimmer", 2, -3],
  ["fledglingeffigy", -2, 2],
]) {
  const e = w.addEnemy(k, x, y);
  e.state = "seek";
  w.wind.state(e);
}
const a = w.enemies[0],
  b = w.enemies[1];
w.hazards = [w.wind.windBand(a), w.wind.feather(b, 2, w.time + 0.8)];
const painter = new BattlePainter(g),
  map = new Graphics();
drawInkMap(map, 9);
for (const [name, delay] of [
  ["warning", 0.4],
  ["active", 2.7],
]) {
  const time = w.time;
  w.time += delay;
  painter.draw(w, 0.1, [], false);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="844" height="390"><rect width="844" height="390" fill="#101a22"/><g transform="translate(422 200) scale(.54 -.54)">${map.toSVG()}${g.toSVG()}</g><rect x="0" y="0" width="844" height="42" fill="#15232c" fill-opacity=".92"/><text x="20" y="26" font-size="16" fill="#ede1c7">断羽风廊 · 05:12 · 双精英</text><rect x="18" y="350" width="140" height="22" rx="5" fill="#15232c"/><text x="28" y="366" font-size="12" fill="#abcdd8">移动区域</text><rect x="734" y="345" width="92" height="30" rx="5" fill="#15232c"/><text x="748" y="365" font-size="13" fill="#e8dfc9">拾魂</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${out}/landscape-${name}.png`);
  w.time = time;
}
// Hundred actors, two elites, four weapons and both hazards. Body budget includes all states above.
w.enemies = [];
for (let i = 0; i < 100; i++) {
  const e = w.addEnemy(
    i === 0 ? "windarbiter" : i === 1 ? "plumejudge" : "fledglingeffigy",
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
    h.due = w.time - 0.5;
    h.until = w.time + 2;
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
    "Offline art and draw budgets; 844x390 HUD footprints are illustrative. Real Cocos UI checked separately; no phone GPU or heat claim.",
  actors,
  stress: {
    enemies: 100,
    elites: 2,
    weapons: 4,
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
