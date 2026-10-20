import fs from "node:fs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import {
  ALL_WEAPONS,
  WEAPONS,
  isElite,
} from "../temp/tests/battle/SurvivalConfig.mjs";
import { modReason } from "../temp/tests/battle/ArmoryConfig.mjs";
import {
  libraryMove,
  libraryImpact,
  librarySealTime,
} from "../temp/tests/battle/LibraryGeometry.mjs";
import { windHit, windMove } from "../temp/tests/battle/WindGeometry.mjs";
const out = "artifacts/library-stage";
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
const system = (w) => (w.stageId === 10 ? w.library : w.wind);
const bossSamples = [];
for (const stage of [9, 10])
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
      const phaseSeconds = [0, 0, 0];
      for (let i = 0; i < 300 * 30 && w.state !== "won"; i++) {
        const boss = w.enemies.find((e) => e.kind === "boss" && e.hp > 0);
        if (boss) phaseSeconds[boss.bossPhase - 1] += 1 / 30;
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
        slots = Math.max(slots, system(w).slots);
        if (peak > 100 || slots > 2) throw Error("capacity");
      }
      const boss = w.enemies.find((e) => e.kind === "boss" && e.hp > 0);
      bossSamples.push({
        stage,
        build,
        moving,
        state: w.state,
        time: +(w.time - 360).toFixed(1),
        remaining: boss ? +((boss.hp / boss.maxHp) * 100).toFixed(1) : 0,
        phaseSeconds: phaseSeconds.map((x) => +x.toFixed(1)),
        peak,
        slots,
        damageTaken: 1e9 - w.hp,
        stats: system(w).stats,
      });
    }
function dodge(w, target) {
  let best = -Infinity,
    chosen = 0;
  const angles = Array.from({ length: 16 }, (_, i) => (i * Math.PI) / 8);
  if (w.stageId === 10)
    for (const h of w.hazards)
      if (h.library && !h.fired && !h.library.cancelled)
        angles.push(
          Math.atan2(
            h.library.seal.y - w.player.y,
            h.library.seal.x - w.player.x,
          ),
        );
  for (const a of angles) {
    const p = { ...w.player },
      v = { x: Math.cos(a) * w.speed, y: Math.sin(a) * w.speed },
      cancelled = new Set();
    let safe = true;
    for (let j = 0; j < 6 && safe; j++) {
      const t = w.time + (j + 1) * 0.1,
        old = { ...p };
      if (w.stageId === 10)
        libraryMove(p, v, 0.1, 0.3, t, (from, to, t0, t1) => {
          if (!safe) return;
          for (const h of w.hazards)
            if (
              h.library &&
              !cancelled.has(h.id) &&
              librarySealTime(h, from, to, t0, t1) !== null
            )
              cancelled.add(h.id);
          if (
            w.hazards.some(
              (h) =>
                h.library &&
                !cancelled.has(h.id) &&
                libraryImpact(h, to, t1, t0, from) !== null,
            )
          )
            safe = false;
        });
      else {
        windMove(p, v, 0.1, 0.3, w.hazards, t);
        if (w.hazards.some((h) => h.wind && windHit(h, p, t, t - 0.1, old)))
          safe = false;
      }
    }
    const gap = Math.min(
        4,
        ...w.enemies
          .filter((e) => e.hp > 0 && e.state === "seek")
          .map((e) => Math.hypot(p.x - e.x, p.y - e.y)),
      ),
      score =
        (safe ? 0 : -100) +
        gap * 2 -
        Math.hypot(p.x - target.x, p.y - target.y) * 0.3 +
        cancelled.size * 0.8;
    if (score > best) {
      best = score;
      chosen = a;
    }
  }
  return chosen;
}
const growth = [];
for (const stage of [9, 10])
  for (const unlocked of [[], ["hammer"], ["wheel"], ["hammer", "wheel"]])
    for (const seed of [19, 73, 131]) {
      const w = new SurvivalWorld(seed, "ranger", stage);
      w.viewport = { x: 16, y: 7.5 };
      w.availableWeapons = [...WEAPONS, ...unlocked];
      w.offerStartingWeapons();
      w.chooseStartingWeapon(w.startingWeapons[0]);
      let peak = 0,
        slots = 0,
        first8 = null,
        choices = 0,
        angle = 0,
        snapshot600 = null;
      const seen = new Map(),
        phaseSeconds = [0, 0, 0];
      for (
        let i = 0;
        i < 930 * 30 && w.time < 900 && w.state !== "won" && w.state !== "lost";
        i++
      ) {
        while (["upgrade", "modification"].includes(w.state)) {
          if (++choices > 180) throw Error("upgrade loop");
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
        if (i % 3 === 0) angle = dodge(w, target);
        w.setMove(Math.cos(angle), Math.sin(angle));
        camera(w);
        if (w.gems.length > 8) w.useUltimate();
        const boss = w.enemies.find((e) => e.kind === "boss" && e.hp > 0);
        if (boss) phaseSeconds[boss.bossPhase - 1] += 1 / 30;
        w.step(1 / 30);
        w.drain();
        peak = Math.max(peak, w.enemies.length);
        slots = Math.max(slots, system(w).slots);
        for (const e of w.enemies)
          if (isElite(e.kind) && !seen.has(e.id))
            seen.set(e.id, {
              kind: e.kind,
              at: +e.born.toFixed(1),
              hp: e.maxHp,
            });
        if (w.time >= 600 && !snapshot600)
          snapshot600 = {
            time: +w.time.toFixed(1),
            state: w.state,
            phase: boss?.bossPhase ?? 0,
            remaining: boss ? +((boss.hp / boss.maxHp) * 100).toFixed(1) : 0,
          };
        if (peak > 100 || slots > 2) throw Error("capacity");
      }
      growth.push({
        stage,
        unlocked,
        seed,
        state: w.state,
        time: +w.time.toFixed(1),
        hp: +w.hp.toFixed(1),
        level: w.level,
        first8,
        peak,
        slots,
        elites: [...seen.values()],
        eliteKills: w.eliteKills,
        snapshot600,
        phaseSeconds: phaseSeconds.map((x) => +x.toFixed(1)),
        bossRemaining: w.enemies.find((e) => e.kind === "boss")?.hp,
        stats: system(w).stats,
        damageTaken: Object.values(w.losses).reduce((a, b) => a + b, 0),
        skills: w.buildWeapons.map((s) => [s, w.skills[s]]),
        passives: w.passives,
      });
    }
const report = {
  scope:
    "Sixteen huge-HP full-level output-window comparisons (4 builds x stand/move x stage 9/10), 300s Boss cap, seed 19. Twenty-four real-HP random-offer runs (stages 9/10 x base/hammer/wheel/both pools x 3 seeds), 900s real-time cap and 600s snapshot. Greedy .6s lookahead sign-aware dodge/nearest-gem bot; not human difficulty or win-rate evidence.",
  boss: bossSamples,
  growth,
};
fs.writeFileSync(
  `${out}/simulation.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      boss: bossSamples.map(({ stats, ...x }) => x),
      growth: growth.map(({ stats, elites, passives, ...x }) => ({
        ...x,
        rounds: elites.length,
        stepped: stats.stepped ?? 0,
      })),
    },
    null,
    2,
  ),
);
