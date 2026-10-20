import fs from "node:fs";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { BattlePainter } from "../temp/tests/presentation/BattlePainter.mjs";
import { enemyArt } from "../temp/tests/presentation/art/EnemyCatalog.mjs";
import { drawRootBody } from "../temp/tests/presentation/art/enemies/RootArt.mjs";
import {
  createPose,
  updatePose,
} from "../temp/tests/presentation/art/Actor.mjs";
import sharp from "sharp";
fs.mkdirSync("artifacts/root-stage", { recursive: true });
const w = new SurvivalWorld(19, "ranger", 8);
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
  "rootshuffler",
  "vinecantor",
  "wreathpod",
  "bulbmaw",
  "biforktangler",
  "pairedcalyx",
  "migratorycorolla",
  "boss",
]) {
  const e = w.addEnemy(kind);
  e.state = "seek";
  const a = enemyArt(8, kind);
  updatePose(p, w, e, a, false);
  p.x = 0;
  p.y = 0;
  p.scale = 1;
  g.clear();
  drawRootBody(g, w, e, a, p);
  const limit =
    kind === "boss"
      ? [38, 950]
      : ["biforktangler", "pairedcalyx", "migratorycorolla"].includes(kind)
        ? [27, 540]
        : kind === "rootshuffler"
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="230" height="250"><rect width="230" height="250" fill="#25383c"/><g transform="translate(115 ${["prismmirror", "prismcore"].includes(kind) ? 175 : 225}) scale(1.5 -1.5)">${g.toSVG()}</g></svg>`;
  await sharp(Buffer.from(svg))
    .png()
    .toFile(`artifacts/root-stage/${kind}.png`);
  for (const [name, layers, exposed] of [
    ["fracture-one", 1, false],
    ["fracture-two", 2, false],
    ["exposed", 0, true],
    ["windup", 0, false],
    ["frozen", 0, false],
  ]) {
    e.fracture = layers;
    e.fractureUntil = w.time + 3;
    e.state = exposed ? "recover" : name==="windup"?"windup":"seek";
    e.timer=1;e.freezeUntil=name==="frozen"?w.time+3:0;
    w.root.state(e).vulnerable = exposed;
    updatePose(p,w,e,a,false);p.x=0;p.y=0;p.scale=1;
    g.clear();
    drawRootBody(g, w, e, a, p);
    record.commands = Math.max(record.commands, g.commands.length);
    record.vertices = Math.max(record.vertices, g.vertexCount);
    record.over = record.commands > limit[0] || record.vertices > limit[1];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="230" height="250"><rect width="230" height="250" fill="#25383c"/><g transform="translate(115 ${["prismmirror", "prismcore"].includes(kind) ? 175 : 225}) scale(1.5 -1.5)">${g.toSVG()}</g></svg>`;
    await sharp(Buffer.from(svg))
      .png()
      .toFile(`artifacts/root-stage/${kind}-${name}.png`);
  }
}
w.enemies = [];
for (let i = 0; i < 100; i++) {
  const e = w.addEnemy(
    i === 0 ? "boss" : i === 1 ? "biforktangler" : "rootshuffler",
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
boss.x = -3;
boss.y = 0;
w.player = { x: 0, y: 0 };
const one = w.root.arm(boss),
  two = w.root.flower(boss, "ring", 2, { x: 0, y: 0 });
w.hazards = [one, two];
let peak = 0,
  commands = 0;
for (let i = 0; i < 360; i++) {
  w.time += 1 / 60;
  one.due = w.time - 1.5;
  one.until = one.due + 3.2;
  two.due = w.time - 0.1;
  two.until = two.due + 0.6;
  w.armory.step(1 / 60);
  if (i % 6 === 0) {
    painter.draw(w, 0.1, w.drain(), false);
    peak = Math.max(peak, g.vertexCount);
    commands = Math.max(commands, g.commands.length);
  }
}
await sharp({
  create: { width: 920, height: 500, channels: 4, background: "#25383c" },
})
  .composite(
    await Promise.all(
      actors.map(async (a, i) => ({
        input: await sharp(`artifacts/root-stage/${a.kind}.png`)
          .composite([
            {
              input: Buffer.from(
                `<svg width="230" height="250"><text x="115" y="245" text-anchor="middle" font-size="13" fill="#eee0c5">${a.kind}</text></svg>`,
              ),
            },
          ])
          .toBuffer(),
        left: (i % 4) * 230,
        top: Math.floor(i / 4) * 250,
      })),
    ),
  )
  .png()
  .toFile("artifacts/root-stage/actors.png");
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
  "artifacts/root-stage/art-budget.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (actors.some((a) => a.over) || report.stress.over) process.exitCode = 1;
