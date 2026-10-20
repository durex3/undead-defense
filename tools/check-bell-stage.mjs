import fs from "node:fs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { WEAPONS, ALL_WEAPONS } from "../temp/tests/battle/SurvivalConfig.mjs";
import { MODS, modReason } from "../temp/tests/battle/ArmoryConfig.mjs";
import { bellMap } from "../temp/tests/battle/BellMap.mjs";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { BattlePainter } from "../temp/tests/presentation/BattlePainter.mjs";
import { drawInkMap } from "../temp/tests/presentation/art/MapArt.mjs";
import sharp from "sharp";
const out = "artifacts/bell-stage";
fs.mkdirSync(out, { recursive: true });
const result = [];
const builds = {
  base: {
    blade: ["hunt", "return"],
    fire: ["heavy", "embers"],
    lightning: ["relay", "echo"],
    holy: ["execution", "brand"],
  },
  hammer: {
    hammer: ["heavy", "return"],
    fire: ["heavy", "embers"],
    lightning: ["relay", "echo"],
    holy: ["execution", "brand"],
  },
  wheel: {
    wheel: ["heavy", "grind"],
    fire: ["heavy", "embers"],
    lightning: ["relay", "echo"],
    holy: ["execution", "brand"],
  },
};
for (const [build, mods] of Object.entries(builds))
  for (const seed of [19, 73, 131])
    for (const moving of [false, true]) {
      const w = new SurvivalWorld(seed, "ranger", 5);
      w.player = { x: 0, y: 0 };
      w.camera = { ...w.player };
      w.time = 360;
      w.level = 64;
      for (const s of ALL_WEAPONS) {
        w.skills[s] = mods[s] ? 8 : 0;
        w.mods[s] = mods[s] || [];
      }
      for (const p of ["power", "hourglass", "area"]) w.passives[p] = 4;
      w.passives.amount = 2;
      // Output-window comparison is invulnerable; record damage taken separately without changing enemy attacks.
      w.hp = w.maxHp = 1e9;
      w.director.step(w, 0);
      let slots = 0,
        peak = 0;
      for (let i = 0; i < 180 * 30 && w.state === "battle"; i++) {
        const b = w.enemies.find((e) => e.kind === "boss");
        if (!b) throw Error("missing boss");
        if (moving) {
          const a = w.time * 0.35,
            target = { x: b.x + Math.cos(a) * 2.8, y: b.y + Math.sin(a) * 2.8 };
          bellMap.resolve(target, 0.3);
          const h = bellMap.heading({ ...w.player }, target);
          w.setMove(Math.cos(h), Math.sin(h));
        }
        w.camera = {
          x: Math.max(-10.6, Math.min(10.6, w.player.x)),
          y: Math.max(-19.5, Math.min(19.5, w.player.y)),
        };
        w.step(1 / 30);
        w.drain();
        slots = Math.max(slots, w.bell.slots);
        peak = Math.max(peak, w.enemies.length);
        if (slots > 2 || peak > 100) throw Error("capacity violation");
      }
      const b = w.enemies.find((e) => e.kind === "boss" && e.hp > 0);
      result.push({
        build,
        seed,
        moving,
        state: w.state,
        seconds: +(w.time - 360).toFixed(1),
        bossRemaining: b ? +((b.hp / b.maxHp) * 100).toFixed(1) : 0,
        damageTaken: 1e9 - w.hp,
        peak,
        slots,
        attacks: w.bell.stats,
      });
    }
// Real random offers and ordinary levels, with high HP strictly to isolate upgrade/encounter pacing.
const growth = [];
for (const unlocked of [[], ["hammer"], ["wheel"], ["hammer", "wheel"]])
  for (const seed of [19, 73, 131]) {
    const w = new SurvivalWorld(seed, "ranger", 5);
    w.availableWeapons = [...WEAPONS, ...unlocked];
    w.offerStartingWeapons();
    w.chooseStartingWeapon(w.startingWeapons[0]);
    w.hp = w.maxHp = 1e9;
    let firstNew = null,
      firstEight = null,
      peak = 0,
      choices = 0;
    for (
      let i = 0;
      i < 370 * 30 && w.time < 360 && w.state !== "won" && w.state !== "lost";
      i++
    ) {
      while (["upgrade", "modification"].includes(w.state)) {
        if (++choices > 160) throw Error("choice loop");
        if (w.state === "modification")
          w.chooseMod(
            w
              .modOptions()
              .find((m) => !modReason(w, w.pendingModification, m.id)).id,
          );
        else {
          const card =
            w.cards.find((c) => unlocked.includes(c)) ||
            w.buildWeapons
              .sort((a, b) => w.skills[b] - w.skills[a])
              .find((s) => w.cards.includes(s)) ||
            w.cards.find((c) => ALL_WEAPONS.includes(c)) ||
            w.cards[0];
          w.choose(card);
        }
      }
      if (firstNew === null && unlocked.some((s) => w.skills[s]))
        firstNew = +w.time.toFixed(1);
      if (firstEight === null && Object.values(w.skills).some((l) => l === 8))
        firstEight = +w.time.toFixed(1);
      const gem = w.gems
          .slice()
          .sort(
            (a, b) =>
              Math.hypot(a.x - w.player.x, a.y - w.player.y) -
              Math.hypot(b.x - w.player.x, b.y - w.player.y),
          )[0],
        target = gem || {
          x: Math.cos(w.time * 0.06) * 6,
          y: Math.sin(w.time * 0.06) * 6,
        },
        angle = bellMap.heading({ ...w.player }, target);
      w.setMove(Math.cos(angle), Math.sin(angle));
      w.camera = {
        x: Math.max(-10.6, Math.min(10.6, w.player.x)),
        y: Math.max(-19.5, Math.min(19.5, w.player.y)),
      };
      if (w.gems.length > 8) w.useUltimate();
      w.step(1 / 30);
      w.drain();
      peak = Math.max(peak, w.enemies.length);
    }
    growth.push({
      unlocked,
      seed,
      firstNew,
      firstEight,
      level: w.level,
      skills: w.buildWeapons.map((s) => [s, w.skills[s]]),
      peak,
      eliteKills: w.eliteKills,
      attacks: w.bell.stats,
      bossPresent: w.enemies.some((e) => e.kind === "boss"),
    });
  }
const w = new SurvivalWorld(19, "ranger", 5);
w.time = 300;
w.level = 64;
w.viewport = { x: 16, y: 7.5 };
w.player = { x: 0, y: -8 };
w.camera = { ...w.player };
w.enemies = [];
for (const s of ALL_WEAPONS) {
  w.skills[s] = ["hammer", "wheel", "holy", "fire"].includes(s) ? 8 : 0;
  w.mods[s] =
    s === "hammer"
      ? ["sweep", "rift"]
      : s === "wheel"
        ? ["grind", "curve"]
        : s === "holy"
          ? ["cross", "brand"]
          : s === "fire"
            ? ["heavy", "flame"]
            : [];
}
for (const [kind, x, y] of [
  ["waxbearer", -3, -6],
  ["bellacolyte", 3, -5],
  ["waxscribe", -3, -11],
  ["waxcrawler", 4, -10],
  ["twinbell", -5, -4],
  ["waxporter", 5, -12],
  ["boss", 0, -2],
]) {
  const e = w.addEnemy(kind, x, y);
  e.state = "seek";
  e.hp = e.maxHp = 1e8;
}
let maxVertices = 0;
const g = new Graphics(),
  painter = new BattlePainter(g);
for (let i = 0; i < 120; i++) {
  w.time += 1 / 60;
  w.armory.step(1 / 60);
  if (i % 30) continue;
  painter.draw(w, 0.5, w.drain(), false);
  maxVertices = Math.max(maxVertices, g.vertexCount);
  const map = new Graphics();
  drawInkMap(map, 5);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="844" height="390"><g transform="translate(422 195) scale(.54 -.54) translate(0 384)">${map.toSVG()}${g.toSVG()}</g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${out}/combat-${i}.png`);
}
const report = {
  scope:
    "18 full-level boss output-window diagnostics with huge HP, 12 random-growth huge-HP collectors, 4 offline painter samples. No human win rate or phone GPU/temperature claim.",
  boss: result,
  growth,
  maxVertices,
};
fs.writeFileSync(
  `${out}/simulation.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      boss: result.map((r) => ({
        build: r.build,
        moving: r.moving,
        state: r.state,
        seconds: r.seconds,
        remaining: r.bossRemaining,
      })),
      growth: growth.map((r) => ({
        unlocked: r.unlocked,
        seed: r.seed,
        firstNew: r.firstNew,
        firstEight: r.firstEight,
        level: r.level,
        elites: r.eliteKills,
        boss: r.bossPresent,
      })),
      maxVertices,
    },
    null,
    2,
  ),
);
