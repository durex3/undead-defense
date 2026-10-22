/** Stationary-player pressure diagnostic; no weapons, adds or inflated enemy stats. */
import fs from "node:fs";
import { withVerificationLock } from "./verification-lock.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { stepEnemies, stepHazards } from "../temp/tests/battle/EnemySystem.mjs";
import { distance } from "../temp/tests/battle/SurvivalTypes.mjs";
export function stationaryProbe(
  stage,
  point,
  seconds = 45,
  form = 1,
  angle = 0,
  separation = 4.8,
) {
  const w = new SurvivalWorld(31, "ranger", stage);
  w.time = 400;
  w.state = "battle";
  w.enemies = [];
  w.player = { ...point };
  w.stageStrategy.map.resolve(w.player, 0.3);
  w.camera = {
    x: Math.max(-512 / 48, Math.min(512 / 48, w.player.x)),
    y: Math.max(
      -(stage >= 11 ? 1124 : 984) / 48,
      Math.min((stage >= 11 ? 1124 : 984) / 48, w.player.y),
    ),
  };
  w.viewport = { x: (7.5 * 844) / 390, y: 7.5 };
  w.hp = w.maxHp = 1e8;
  const e = w.addEnemy(
    "boss",
    Math.max(-21.3, Math.min(21.3, w.player.x - Math.cos(angle) * separation)),
    Math.max(-25.3, Math.min(25.3, w.player.y - Math.sin(angle) * separation)),
  );
  w.stageStrategy.map.resolve(e, 0.7);
  e.state = "seek";
  e.attack = 0;
  if (stage === 16 && form === 2) {
    e.grave.life = 2;
    e.bossPhase = 2;
    e.hp = e.maxHp = e.grave.total * 0.6;
  }
  if(stage!==16&&form>1){e.bossPhase=form;e.hp=e.maxHp*(form===3?.2:stage>=10?.6:.4);}
  const start = { x: e.x, y: e.y };
  let hits = 0,
    firstHit = null,
    casts = 0,
    lastHazard = 0;
  const hurt = w.hurt.bind(w);
  w.hurt = (...args) => {
    const before = w.hp;
    hurt(...args);
    if (w.hp < before) {
      hits++;
      firstHit ??= w.time - 400;
    }
  };
  for (let frame = 0; frame < seconds * 30; frame++) {
    w.time += 1 / 30;
    w.invulnerable = Math.max(0, w.invulnerable - 1 / 30);
    w.stageStrategy.clean();
    w.stageStrategy.lifecycle?.tick();
    stepEnemies(w, 1 / 30);
    stepHazards(w);
    if (w.hazards.some((h) => h.id > lastHazard)) {
      casts++;
      lastHazard = Math.max(...w.hazards.map((h) => h.id));
    }
    w.drain();
  }
  return {
    stage,
    form,
    point,
    angle,
    separation,
    actual: w.player,
    hits,
    firstHit,
    damage: 1e8 - w.hp,
    casts,
    endDistance: distance(e, w.player),
    moved: distance(e, start),
    rejected: stage === 16 ? w.grave.stats.rejected : undefined,
  };
}
if (process.argv[1]?.endsWith("check-boss-stationary.mjs"))
  await withVerificationLock(async () => {
    const rows = [];
    if (process.argv.includes("--sweep")) {
      for (let stage = 1; stage <= 16; stage++)
        for(const form of (process.argv.includes("--all-states")?(stage>=10&&stage<=15?[1,2,3]:[1,2]):[1]))
        for (const point of [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: -20, y: 0 },
          { x: 0, y: 24 },
          { x: 0, y: -24 },
          { x: 20, y: 24 },
          { x: -20, y: 24 },
          { x: 20, y: -24 },
          { x: -20, y: -24 },
        ])
          for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
            rows.push(stationaryProbe(stage, point, 60, form, angle));
    } else
      for (let stage = 1; stage <= 16; stage++)
        for (const point of [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 24 },
        ])
          rows.push(stationaryProbe(stage, point));
    for (const point of [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 24 },
    ])
      rows.push(stationaryProbe(16, point, 45, 2));
    if (process.argv.includes("--terrain")) {
      for (let stage = 1; stage <= 16; stage++) {
        const map = new SurvivalWorld(31, "ranger", stage).stageStrategy.map;
        const points = [];
        // Reproducible free positions beside solid terrain, spaced apart.
        for (let x = -18; x <= 18 && points.length < 6; x += 1)
          for (let y = -22; y <= 22 && points.length < 6; y += 1) {
            const p = {x,y};
            if (!map.blocked(p, .35) && map.blocked(p, 1.1) && points.every(q => Math.hypot(q.x-x,q.y-y)>6)) points.push(p);
          }
        for (const form of (stage>=10&&stage<=15?[1,2,3]:[1,2]))
          for (const point of [{x:0,y:0}, ...points])
            for (const separation of [1.2,2.8,4.8])
              for (const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5])
                rows.push(stationaryProbe(stage,point,60,form,angle,separation));
      }
    }
    const report = {
      noHit:rows.filter(r=>!r.hits).length,
      scope:
        "45/60 seconds, single boss, fixed real player position, actual collision/AI/camera. Large player HP only records pressure; no auto damage or extra punishment. Does not establish full-stage win rate.",
      rows,
    };
    const file = process.argv[2] || "artifacts/ai-0.40.0/stationary.json";
    fs.mkdirSync(new URL("../artifacts/ai-0.40.0/",import.meta.url),{recursive:true});
    fs.writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({file,cases:rows.length,noHit:report.noHit}));
  });
