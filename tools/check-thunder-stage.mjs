import fs from "node:fs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import {
  WEAPONS,
  ENEMIES,
  isElite,
} from "../temp/tests/battle/SurvivalConfig.mjs";
import { MODS, modReason } from "../temp/tests/battle/ArmoryConfig.mjs";
import { thunderContains } from "../temp/tests/battle/ThunderGeometry.mjs";
import { thunderMap } from "../temp/tests/battle/ThunderMap.mjs";
const builds = [
  {
    name: "拆阵追猎",
    skills: ["blade", "ghost", "lightning", "bone", "fire", "holy"],
    pair: [0, 2],
  },
  {
    name: "拆阵往返",
    skills: ["blade", "ghost", "lightning", "bone", "water", "mine"],
    pair: [1, 3],
  },
  {
    name: "路线经营",
    skills: ["water", "fire", "mine", "void", "ghost", "holy"],
    pair: [0, 2],
  },
  {
    name: "路线爆破",
    skills: ["water", "fire", "mine", "void", "blade", "lightning"],
    pair: [1, 3],
  },
  {
    name: "移动清群",
    skills: ["water", "bone", "holy", "frost", "lightning", "ghost"],
    pair: [0, 2],
  },
  {
    name: "移动换道",
    skills: ["water", "bone", "holy", "frost", "fire", "blade"],
    pair: [1, 3],
  },
];
const points = [
    { x: 0, y: 0 },
    { x: -15, y: 8 },
    { x: 16, y: -17 },
  ],
  seeds = [19, 73, 217];
function equip(w, b) {
  for (const s of WEAPONS) {
    w.skills[s] = 0;
    w.mods[s] = [];
  }
  for (const s of b.skills) {
    w.skills[s] = 8;
    for (const i of b.pair) {
      const id = MODS[s][i].id;
      if (modReason(w, s, id)) throw Error(`illegal ${s}/${id}`);
      w.mods[s].push(id);
    }
  }
  for (const p of ["power", "hourglass", "area", "boots"]) w.passives[p] = 4;
}
function steer(w) {
  const boss = w.enemies.find((e) => e.kind === "boss" && e.hp > 0),
    center = boss || { x: 0, y: 0 };
  let best = -Infinity,
    move = { x: 0, y: 0 };
  for (let i = 0; i <= 24; i++) {
    const a = (i * Math.PI) / 12,
      v = i === 24 ? { x: 0, y: 0 } : { x: Math.cos(a), y: Math.sin(a) };
    let score = 0;
    for (const t of [0.25, 0.5, 0.85, 1.2, 1.6]) {
      const p = {
        x: w.player.x + v.x * w.speed * t,
        y: w.player.y + v.y * w.speed * t,
      };
      if (
        Math.abs(p.x) > 21 ||
        Math.abs(p.y) > 25 ||
        thunderMap.blocked(p, 0.35)
      ) {
        score -= 200;
        continue;
      }
      for (const h of w.hazards)
        if (thunderContains(h, p, w.time + t)) score -= 500;
      for (const e of w.enemies)
        if (e.hp > 0 && ENEMIES[e.kind].contact > 0 && e.state === "seek") {
          const dx = w.player.x - e.x,
            dy = w.player.y - e.y,
            d = Math.hypot(dx, dy) || 1,
            speed = e.kind === "boss" ? 1.65 : ENEMIES[e.kind].speed,
            m = Math.min(d, speed * t),
            ex = e.x + (dx / d) * m,
            ey = e.y + (dy / d) * m;
          if (Math.hypot(ex - p.x, ey - p.y) < (e.kind === "boss" ? 1.6 : 1))
            score -= 500;
        }
      score -= Math.abs(Math.hypot(p.x - center.x, p.y - center.y) - 3.5) * 0.3;
    }
    if (score > best) {
      best = score;
      move = v;
    }
  }
  w.setMove(move.x, move.y);
}
const report = {
  generated: new Date().toISOString(),
  scope:
    "Deterministic Node simulations, six legal full builds × three positions × three seeds × stationary/moving; simple predictive controller, no human difficulty or phone thermal claims.",
  boss: [],
  growth: [],
  stationaryIssues: [],
  perf: [],
};
const started = performance.now();
for (const b of builds)
  for (let position = 0; position < points.length; position++)
    for (const seed of seeds)
      for (const moving of [false, true]) {
        const w = new SurvivalWorld(seed, "ranger", 16);
        w.time = 480;
        w.level = 64;
        w.player = { ...points[position] };
        w.camera = { ...w.player };
        equip(w, b);
        let peak = 0,
          danger = 0,
          threat = 0,
          devices = 0;
        const seen = new Set(),
          actions = new Set();
        for (let frame = 0; frame < 180 * 60 && w.state === "battle"; frame++) {
          if (moving && frame % 8 === 0) steer(w);
          w.camera = { ...w.player };
          w.step(1 / 60);
          w.drain();
          peak = Math.max(peak, w.enemies.length);
          danger = Math.max(danger, w.hazards.length);
          threat = Math.max(
            threat,
            w.enemies.reduce(
              (s, e) => s + (e.hp > 0 ? ENEMIES[e.kind].threat : 0),
              0,
            ),
          );
          devices = Math.max(
            devices,
            w.enemies.filter(
              (e) =>
                e.hp > 0 && ["thunderanchor", "gridelectrode"].includes(e.kind),
            ).length,
          );
          for (const h of w.hazards) seen.add(h.id);
          for (const e of w.enemies)
            if (e.kind === "boss" && e.thunder) actions.add(e.thunder.action);
        }
        const boss = w.enemies.find((e) => e.kind === "boss");
        report.boss.push({
          build: b.name,
          position,
          seed,
          moving,
          state: w.state,
          seconds: +(w.time - 480).toFixed(2),
          hp: +w.hp.toFixed(1),
          bossRemaining: boss ? +((boss.hp / boss.maxHp) * 100).toFixed(1) : 0,
          losses: w.losses,
          healing: w.healing,
          peakEnemies: peak,
          peakHazards: danger,
          peakThreat: threat,
          peakDevices: devices,
          publishedHazards: seen.size,
          actions: [...actions],
        });
      }
for (const b of builds)
  for (let position = 0; position < 3; position++) {
    const wins = report.boss.filter(
      (r) =>
        r.build === b.name &&
        r.position === position &&
        !r.moving &&
        r.state === "won",
    );
    if (wins.length >= 2)
      report.stationaryIssues.push({
        build: b.name,
        position,
        wins: wins.length,
      });
  }
// Early idle growth and late formed idle samples, retain failure and timeout outcomes.
for (const seed of seeds)
  for (const formed of [false, true]) {
    const w = new SurvivalWorld(seed, "ranger", 16);
    if (formed) {
      w.time = 300;
      w.level = 64;
      equip(w, builds[seed % builds.length]);
    }
    let peak = 0;
    for (
      let i = 0;
      i < 180 * 60 && w.state !== "lost" && w.state !== "won";
      i++
    ) {
      if (w.state === "modification") {
        const m = w
          .modOptions()
          .find((m) => !modReason(w, w.pendingModification, m.id));
        w.chooseMod(m.id);
      } else if (w.state === "upgrade") {
        const card = w.cards.find((c) => WEAPONS.includes(c)) || w.cards[0];
        w.choose(card);
      }
      w.camera = { ...w.player };
      w.step(1 / 60);
      w.drain();
      peak = Math.max(peak, w.enemies.length);
    }
    report.growth.push({
      seed,
      formed,
      state: w.state,
      time: +w.time.toFixed(2),
      level: w.level,
      hp: w.hp,
      losses: w.losses,
      peakEnemies: peak,
    });
  }
// CPU profile includes enemy AI and all weapons; static immortal targets retain worst-case population.
for (const multiplier of [1, 3]) {
  const w = new SurvivalWorld(217, "ranger", 16);
  w.time = 410;
  w.level = 64;
  w.player = { x: 0, y: 0 };
  w.camera = { ...w.player };
  equip(w, builds[0]);
  for (let i = 0; i < 96; i++) {
    const a = (i * Math.PI * 2) / 96,
      e = w.addEnemy(
        "rivetwalker",
        Math.cos(a) * (3 + (i % 5)),
        Math.sin(a) * (3 + (i % 5)),
      );
    e.hp = 1e9;
  }
  w.hp = w.maxHp = 1e9;
  const times = [];
  for (let i = 0; i < 600; i++) {
    const t = performance.now();
    for (let j = 0; j < multiplier; j++) {
      w.step(1 / 60);
      w.drain();
    }
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  report.perf.push({
    multiplier,
    frames: 600,
    medianMs: times[300],
    p95Ms: times[570],
    peakEntities: w.enemies.length,
  });
}
report.elapsedMs = Math.round(performance.now() - started);
fs.mkdirSync("artifacts/thunder-stage", { recursive: true });
fs.writeFileSync(
  "artifacts/thunder-stage/simulation.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      runs: report.boss.length,
      stationaryWins: report.boss.filter((r) => !r.moving && r.state === "won")
        .length,
      movingWins: report.boss.filter((r) => r.moving && r.state === "won")
        .length,
      stationaryIssues: report.stationaryIssues,
      growth: report.growth,
      perf: report.perf,
      elapsedMs: report.elapsedMs,
    },
    null,
    2,
  ),
);
