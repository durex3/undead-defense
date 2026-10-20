import fs from "node:fs";
import { STAGES } from "../temp/tests/battle/StageRules.mjs";
import { rootHit } from "../temp/tests/battle/RootGeometry.mjs";
import { prismHit } from "../temp/tests/battle/PrismGeometry.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { WEAPONS, ALL_WEAPONS } from "../temp/tests/battle/SurvivalConfig.mjs";
import { MODS, modReason } from "../temp/tests/battle/ArmoryConfig.mjs";
import { rootMap } from "../temp/tests/battle/RootMap.mjs";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { BattlePainter } from "../temp/tests/presentation/BattlePainter.mjs";
import { drawInkMap } from "../temp/tests/presentation/art/MapArt.mjs";
import sharp from "sharp";
const out = "artifacts/root-stage";
fs.mkdirSync(out, { recursive: true });
function dodgeAngle(w, target) {
  let best = Infinity,
    result = 0;
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    let cost = 0,
      last = { ...w.player };
    for (const t of [0.3, 0.6, 0.9]) {
      const p = {
        x: w.player.x + Math.cos(a) * w.speed * t,
        y: w.player.y + Math.sin(a) * w.speed * t,
      };
      if (
        Math.abs(p.x) > 21.7 ||
        Math.abs(p.y) > 25.7 ||
        rootMap.blocked(p, 0.3) ||
        rootMap.segment(last, p, 0.3)
      )
        cost += 1000;
      for (const e of w.enemies) {
        if (e.hp <= 0) continue;
        const dx = w.player.x - e.x,
          dy = w.player.y - e.y,
          d = Math.hypot(dx, dy) || 1,
          advance = e.state === "seek" ? Math.min(d, 1.7 * t) : 0;
        const gap = Math.hypot(
          p.x - e.x - (dx / d) * advance,
          p.y - e.y - (dy / d) * advance,
        );
        if (gap < 1.1) cost += 100;
        else if (gap < 2) cost += (2 - gap) * 3;
      }
      for (const h of w.hazards)
        if (
          h.prism
            ? prismHit(h, p, w.time + t, w.time + t - 0.3, last)
            : h.root && rootHit(h, p, w.time + t, w.time + t - 0.3, last)
        )
          cost += 100;
      last = p;
    }
    cost += Math.hypot(last.x - target.x, last.y - target.y) * 0.7;
    if (cost < best) {
      best = cost;
      result = a;
    }
  }
  return result;
}
const result = [];
const builds = {
  ground: {
    water: ["spring", "pulse"],
    mine: ["burrow", "fuse"],
    void: ["collapse", "binary"],
    holy: ["execution", "brand"],
  },
  swarm: {
    frost: ["outward", "brittle"],
    ghost: ["swarm", "haunt"],
    bone: ["fan", "marrow"],
    fire: ["salvo", "flame"],
  },
  orbit: {
    blade: ["orbit", "return"],
    water: ["wave", "recall"],
    frost: ["sectors", "aftershock"],
    lightning: ["relay", "bridge"],
  },
  pierce: {
    bone: ["lance", "ridge"],
    lightning: ["storm", "echo"],
    ghost: ["execution", "reap"],
    holy: ["rain", "cross"],
  },
  furnace: {
    fire: ["heavy", "flame"],
    water: ["spring", "pulse"],
    mine: ["trip", "scatter"],
    void: ["drift", "repel"],
  },
  control: {
    frost: ["outward", "aftershock"],
    void: ["collapse", "binary"],
    holy: ["execution", "cross"],
    fire: ["heavy", "embers"],
  },
  hammerGround: {
    hammer: ["sweep", "rift"],
    water: ["wave", "pulse"],
    mine: ["burrow", "fuse"],
    holy: ["rain", "brand"],
  },
  wheelLane: {
    wheel: ["twin", "curve"],
    bone: ["lance", "marrow"],
    frost: ["sectors", "brittle"],
    ghost: ["execution", "haunt"],
  },
  both: {
    hammer: ["heavy", "return"],
    wheel: ["heavy", "grind"],
    water: ["spring", "pulse"],
    lightning: ["relay", "echo"],
  },
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
for (const [name, build] of Object.entries(builds))
  for (const [skill, mods] of Object.entries(build)) {
    if (
      mods.some((id) => !MODS[skill].some((m) => m.id === id)) ||
      mods.some((id) =>
        mods.includes(MODS[skill].find((m) => m.id === id).excludes),
      )
    )
      throw Error("illegal build " + name + "/" + skill);
  }
for (const stage of [7, 8])
  for (const [build, mods] of Object.entries(builds))
    for (const seed of [19, 73, 131])
      for (const moving of [false, true]) {
        const w = new SurvivalWorld(seed, "ranger", stage);
        const system = stage === 8 ? w.root : w.prism,
          map = w.stageStrategy.map;
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
              target = {
                x: b.x + Math.cos(a) * 2.8,
                y: b.y + Math.sin(a) * 2.8,
              };
            map.resolve(target, 0.3);
            const h = map.heading({ ...w.player }, target);
            w.setMove(Math.cos(h), Math.sin(h));
          }
          w.camera = {
            x: Math.max(-10.6, Math.min(10.6, w.player.x)),
            y: Math.max(-19.5, Math.min(19.5, w.player.y)),
          };
          w.step(1 / 30);
          w.drain();
          slots = Math.max(slots, system.slots);
          peak = Math.max(peak, w.enemies.length);
          if (slots > 2 || peak > 100) throw Error("capacity violation");
        }
        const b = w.enemies.find((e) => e.kind === "boss" && e.hp > 0);
        result.push({
          stage,
          build,
          seed,
          moving,
          state: w.state,
          seconds: +(w.time - 360).toFixed(1),
          bossRemaining: b ? +((b.hp / b.maxHp) * 100).toFixed(1) : 0,
          damageTaken: 1e9 - w.hp,
          peak,
          slots,
          attacks: system.stats,
        });
      }
// Real random offers and ordinary levels, with high HP strictly to isolate upgrade/encounter pacing.
const growth = [];
for (const highHP of [true, false])
  for (const unlocked of [[], ["hammer"], ["wheel"], ["hammer", "wheel"]])
    for (const seed of [19, 73, 131]) {
      const w = new SurvivalWorld(seed, "ranger", 8);
      w.availableWeapons = [...WEAPONS, ...unlocked];
      w.offerStartingWeapons();
      w.chooseStartingWeapon(w.startingWeapons[0]);
      if (highHP) w.hp = w.maxHp = 1e9;
      let firstNew = null,
        firstEight = null,
        peak = 0,
        choices = 0;
      for (
        let i = 0;
        i < 600 * 30 &&
        w.time < (highHP ? 360 : 600) &&
        w.state !== "won" &&
        w.state !== "lost";
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
          angle = highHP
            ? rootMap.heading({ ...w.player }, target)
            : dodgeAngle(w, target);
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
        highHP,
        state: w.state,
        time: +w.time.toFixed(1),
        hp: w.hp,
        damageTaken: Object.values(w.losses).reduce((n, x) => n + x, 0),
        unlocked,
        seed,
        firstNew,
        firstEight,
        level: w.level,
        skills: w.buildWeapons.map((s) => [s, w.skills[s]]),
        peak,
        eliteKills: w.eliteKills,
        attacks: w.root.stats,
        bossPresent: w.enemies.some((e) => e.kind === "boss"),
      });
    }
const w = new SurvivalWorld(19, "ranger", 8);
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
  ["rootshuffler", -3, -6],
  ["vinecantor", 3, -5],
  ["wreathpod", -3, -11],
  ["bulbmaw", 4, -10],
  ["biforktangler", -5, -4],
  ["pairedcalyx", 5, -12],
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
  drawInkMap(map, 8);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="844" height="390"><g transform="translate(422 195) scale(.54 -.54) translate(0 384)">${map.toSVG()}${g.toSVG()}</g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${out}/combat-${i}.png`);
}
const report = {
  parameters: { seventh: STAGES[7], eighth: STAGES[8] },
  scope:
    "144 full-level boss output-window diagnostics (12 legal builds × 3 seeds × 2 movement policies × stages 7/8) with huge HP, 12 random-growth huge-HP collectors and 12 real-HP greedy dodge/nearest-gem bots (finite 0.9s lookahead, not human play), 4 offline painter samples. No human win rate or phone GPU/temperature claim.",
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
        stage: r.stage,
        build: r.build,
        moving: r.moving,
        state: r.state,
        seconds: r.seconds,
        remaining: r.bossRemaining,
      })),
      growth: growth.map((r) => ({
        highHP: r.highHP,
        state: r.state,
        time: r.time,
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
