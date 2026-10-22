import fs from "node:fs";
import { withVerificationLock } from "./verification-lock.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
await withVerificationLock(async () => {
  const pairs = {
    9: ["windarbiter", "plumejudge"],
    10: ["sealprovost", "claspjailer"],
    11: ["twinweftwarden", "shuttlejailer"],
    12: ["splitcrucible", "glazejailer"],
    13: ["twinclamp", "edgepuppeteer"],
    14: ["twindial", "eclipsewarden"],
    15: ["twinpitch", "presswarden"],
    16: ["coffinregent", "scarprelate"],
  };
  const rows = [];
  for (const [key, kinds] of Object.entries(pairs))
    for (const scene of ["center", "moving", "edge"]) {
      const stage = Number(key),
        w = new SurvivalWorld(31, "ranger", stage);
      w.time = 265;
      w.state = "battle";
      w.hp = w.maxHp = 1e8;
      w.player = { x: scene === "edge" ? 20 : 0, y: 0 };
      w.viewport = { x: (7.5 * 844) / 390, y: 7.5 };
      w.director.step = () => {};
      w.armory.step = () => {};
      const actors = kinds.map((kind, i) => {
        const e = w.addEnemy(kind, w.player.x + (i ? -4.6 : 1), i ? 0 : 4.2);
        w.stageStrategy.map.resolve(e, 0.7);
        e.state = "seek";
        e.attack = 0;
        return e;
      });
      const ids = new Set(),
        casts = Object.fromEntries(actors.map((e) => [e.kind, 0]));
      let maxSlots = 0,
        walls = 0;
      for (let i = 0; i < 2700; i++) {
        const target =
          scene === "moving"
            ? {
                x: Math.cos((i / 30) * 0.4) * 3,
                y: Math.sin((i / 30) * 0.4) * 3,
              }
            : scene === "edge"
              ? { x: 20, y: Math.sin((i / 30) * 0.3) * 3 }
              : { x: 0, y: 0 };
        w.stageStrategy.map.resolve(target, 0.3);
        const d = Math.hypot(target.x - w.player.x, target.y - w.player.y);
        w.move = {
          x: d
            ? ((target.x - w.player.x) / d) * Math.min(1, (d * 30) / w.speed)
            : 0,
          y: d
            ? ((target.y - w.player.y) / d) * Math.min(1, (d * 30) / w.speed)
            : 0,
        };
        w.camera = {
          x: Math.max(-512 / 48, Math.min(512 / 48, w.player.x)),
          y: Math.max(-1124 / 48, Math.min(1124 / 48, w.player.y)),
        };
        w.step(1 / 30);
        for (const h of w.hazards)
          if (!ids.has(h.id)) {
            ids.add(h.id);
            const e = actors.find((e) => e.id === h.source);
            if (e) casts[e.kind]++;
          }
        maxSlots = Math.max(
          maxSlots,
          w.hazards.filter((h) => h.until > w.time).length,
        );
        for (const e of actors)
          if (e.state === "seek" && w.stageStrategy.map.blocked(e, 0.349))
            walls++;
        w.drain();
      }
      rows.push({
        stage,
        scene,
        casts,
        maxSlots,
        wallViolations: walls,
        positioning: w.enemyTactics.elites.stats,
      });
    }
  fs.mkdirSync("artifacts/ai-0.40.2", { recursive: true });
  fs.writeFileSync(
    "artifacts/ai-0.40.2/elites.json",
    JSON.stringify(
      {
        scope:
          "Stages 9-16 existing elite pairs,90 seconds,center,moving and edge scenarios,no weapons or director",
        rows,
      },
      null,
      2,
    ) + "\n",
  );
  const issues = rows.filter(
    (r) =>
      r.maxSlots > 2 ||
      r.wallViolations ||
      Object.values(r.casts).some((v) => v === 0),
  );
  console.log(JSON.stringify({ cases: rows.length, issues }, null, 2));
  if (issues.length) throw Error("Elite coordination diagnostic failed");
});
