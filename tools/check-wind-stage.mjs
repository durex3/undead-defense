import fs from "node:fs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import {
  ALL_WEAPONS,
  WEAPONS,
  isElite,
} from "../temp/tests/battle/SurvivalConfig.mjs";
import { MODS, modReason } from "../temp/tests/battle/ArmoryConfig.mjs";
import { windHit, windMove } from "../temp/tests/battle/WindGeometry.mjs";
import { rootHit } from "../temp/tests/battle/RootGeometry.mjs";
const out = "artifacts/wind-stage";
fs.mkdirSync(out, { recursive: true });
const builds = {
  base: {
    blade: ["hunt", "return"],
    fire: ["heavy", "embers"],
    lightning: ["relay", "echo"],
    holy: ["execution", "brand"],
  },
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
  unlocked: {
    hammer: ["heavy", "return"],
    wheel: ["heavy", "grind"],
    water: ["spring", "pulse"],
    lightning: ["relay", "echo"],
  },
};
const camera = (w) =>
  (w.camera = {
    x: Math.max(-10.6, Math.min(10.6, w.player.x)),
    y: Math.max(-19.5, Math.min(19.5, w.player.y)),
  });
const samples = [];
for (const stage of [8, 9])
  for (const [build, skills] of Object.entries(builds))
    for (const moving of [false, true]) {
      const w = new SurvivalWorld(19, "ranger", stage);
      w.time = 360;
      w.level = 64;
      w.player = { x: 0, y: 0 };
      w.viewport = { x: 16, y: 7.5 };
      camera(w);
      w.hp = w.maxHp = 1e9;
      for (const s of ALL_WEAPONS) {
        w.skills[s] = skills[s] ? 8 : 0;
        w.mods[s] = skills[s] || [];
      }
      for (const p of ["power", "hourglass", "area"]) w.passives[p] = 4;
      w.passives.amount = 2;
      let peak = 0,
        slots = 0;
      for (let i = 0; i < 240 * 30 && w.state !== "won"; i++) {
        const boss = w.enemies.find((e) => e.kind === "boss" && e.hp > 0);
        if (moving && boss) {
          const a = w.time * 0.35,
            target = {
              x: boss.x + Math.cos(a) * 2.8,
              y: boss.y + Math.sin(a) * 2.8,
            },
            h = w.stageStrategy.map.heading({ ...w.player }, target);
          w.setMove(Math.cos(h), Math.sin(h));
        }
        camera(w);
        w.step(1 / 30);
        w.drain();
        peak = Math.max(peak, w.enemies.length);
        slots = Math.max(slots, stage === 9 ? w.wind.slots : w.root.slots);
        if (peak > 100 || slots > 2) throw Error("capacity");
      }
      const boss = w.enemies.find((e) => e.kind === "boss" && e.hp > 0);
      samples.push({
        stage,
        build,
        moving,
        state: w.state,
        time: +(w.time - 360).toFixed(1),
        remaining: boss ? +((boss.hp / boss.maxHp) * 100).toFixed(1) : 0,
        peak,
        slots,
        damageTaken: 1e9 - w.hp,
        stats: stage === 9 ? w.wind.stats : w.root.stats,
      });
    }
function dodge(w, target) {
  let best = -Infinity,
    chosen = 0;
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8,
      p = { ...w.player },
      v = { x: Math.cos(a) * w.speed, y: Math.sin(a) * w.speed };
    let safe = true;
    for (let j = 0; j < 6; j++) {
      const old = { ...p },
        t = w.time + (j + 1) * 0.1;
      windMove(p, v, 0.1, 0.3, w.hazards, t);
      if (w.hazards.some((h) => h.wind && windHit(h, p, t, t - 0.1, old))) {
        safe = false;
        break;
      }
    }
    const gap = Math.min(
      4,
      ...w.enemies
        .filter((e) => e.hp > 0 && e.state === "seek")
        .map((e) => Math.hypot(p.x - e.x, p.y - e.y)),
    );
    const score =
      (safe ? 0 : -100) +
      gap * 2 -
      Math.hypot(p.x - target.x, p.y - target.y) * 0.3;
    if (score > best) {
      best = score;
      chosen = a;
    }
  }
  return chosen;
}
const growth = [];
for (const highHP of [true, false])
  for (const unlocked of [[], ["hammer", "wheel"]])
    for (const seed of [19, 73, 131]) {
      const w = new SurvivalWorld(seed, "ranger", 9);
      w.viewport = { x: 16, y: 7.5 };
      w.availableWeapons = [...WEAPONS, ...unlocked];
      w.offerStartingWeapons();
      w.chooseStartingWeapon(w.startingWeapons[0]);
      if (highHP) w.hp = w.maxHp = 1e9;
      let peak = 0,
        slots = 0,
        first8 = null,
        choices = 0;
      const seen = new Map();
      let angle = 0;
      for (
        let i = 0;
        i < 600 * 30 && w.time < 600 && w.state !== "won" && w.state !== "lost";
        i++
      ) {
        while (["upgrade", "modification"].includes(w.state)) {
          if (++choices > 160) throw Error("upgrade loop");
          if (w.state === "modification")
            w.chooseMod(
              w
                .modOptions()
                .find((m) => !modReason(w, w.pendingModification, m.id)).id,
            );
          else
            w.choose(
              w.buildWeapons
                .sort((a, b) => w.skills[b] - w.skills[a])
                .find((s) => w.cards.includes(s)) ||
                w.cards.find((c) => ALL_WEAPONS.includes(c)) ||
                w.cards[0],
            );
        }
        if (first8 === null && Object.values(w.skills).some((l) => l === 8))
          first8 = +w.time.toFixed(1);
        const target = w.gems
          .slice()
          .sort(
            (a, b) =>
              Math.hypot(a.x - w.player.x, a.y - w.player.y) -
              Math.hypot(b.x - w.player.x, b.y - w.player.y),
          )[0] || {
          x: Math.cos(w.time * 0.06) * 6,
          y: Math.sin(w.time * 0.06) * 6,
        };
        if (highHP)
          angle = w.stageStrategy.map.heading({ ...w.player }, target);
        else if (i % 3 === 0) angle = dodge(w, target);
        w.setMove(Math.cos(angle), Math.sin(angle));
        camera(w);
        if (w.gems.length > 8) w.useUltimate();
        w.step(1 / 30);
        w.drain();
        peak = Math.max(peak, w.enemies.length);
        slots = Math.max(slots, w.wind.slots);
        for (const e of w.enemies)
          if (isElite(e.kind) && !seen.has(e.id))
            seen.set(e.id, {
              kind: e.kind,
              at: +e.born.toFixed(1),
              hp: e.maxHp,
            });
        if (peak > 100 || slots > 2) throw Error("capacity");
      }
      growth.push({
        highHP,
        unlocked,
        seed,
        state: w.state,
        time: +w.time.toFixed(1),
        level: w.level,
        first8,
        peak,
        slots,
        elites: [...seen.values()],
        eliteKills: w.eliteKills,
        bossPresent: w.enemies.some((e) => e.kind === "boss"),
        bossRemaining: w.enemies.find((e) => e.kind === "boss")?.hp,
        stats: w.wind.stats,
        damageTaken: Object.values(w.losses).reduce((a, b) => a + b, 0),
        skills: w.buildWeapons.map((s) => [s, w.skills[s]]),
      });
    }
const report = {
  scope:
    "16 level-64 output-window comparisons at 844x390: 4 builds x standing/moving x stage 8/9, seed 19, 240-second Boss cap. Twelve random-offer runs (3 seeds x base/unlocked pools x huge/real HP), 600-second cap, greedy bot with .6s finite lookahead. Huge HP isolates pacing; neither scripted builds nor bots establish human difficulty.",
  samples,
  growth,
};
fs.writeFileSync(
  `${out}/simulation.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      boss: samples.map(({ stats, ...s }) => s),
      growth: growth.map(({ stats, elites, ...s }) => ({
        ...s,
        rounds: elites.length,
      })),
    },
    null,
    2,
  ),
);
