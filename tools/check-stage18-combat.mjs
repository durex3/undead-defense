import fs from "node:fs";
import { withVerificationLock } from "./verification-lock.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
await withVerificationLock(async () => {
  const rows = [];
  for (const kind of ["boss", "pair"])
    for (const scene of [
      "center",
      "edge",
      "corner",
      "plinth",
      "close",
      "circle",
      "weave",
    ])
      for (const dt of [1 / 30, 0.2]) {
        const w = new SurvivalWorld(31, "ranger", 18);
        w.time = 400;
        w.hp = w.maxHp = 1e8;
        w.player = {
          x: ["edge", "corner"].includes(scene)
            ? 20
            : scene === "plinth"
              ? -7
              : 0,
          y: scene === "corner" ? 24 : scene === "plinth" ? -10 : 0,
        };
        w.camera = { ...w.player };
        w.viewport = { x: (7.5 * 844) / 390, y: 7.5 };
        w.director.step = () => {};
        w.armory.step = () => {};
        const actors = (
          kind === "boss" ? ["boss"] : ["broadcantor", "needleconductor"]
        ).map((k, i) => {
          const e = w.addEnemy(
            k,
            w.player.x + (scene === "close" ? -1 : i ? 2 : -3),
            w.player.y + (i ? 1 : 0),
          );
        // Match the director's legal body-radius spawn bounds before measuring movement.
        e.x = Math.max(-21.3, Math.min(21.3,e.x));
        e.y = Math.max(-25.3, Math.min(25.3,e.y));
        w.stageStrategy.map.resolve(e, 0.7);
          e.state = "seek";
          e.attack = 0;
          return e;
        });
        let maxSlots = 0,
          walls = 0,
          maxBodyStep = 0;
        const old = actors.map((e) => ({ x: e.x, y: e.y }));
        for (let t = 0; t < 120; t += dt) {
          if (["circle", "weave"].includes(scene)) {
            const target =
              scene === "circle"
                ? { x: Math.cos(t * 0.5) * 3, y: Math.sin(t * 0.5) * 3 }
                : { x: Math.sin(t * 0.5) * 5, y: Math.sin(t * 0.27) * 2 };
            const d = Math.hypot(target.x - w.player.x, target.y - w.player.y);
            w.setMove(
              d
                ? ((target.x - w.player.x) / d) * Math.min(1, d / dt / w.speed)
                : 0,
              d
                ? ((target.y - w.player.y) / d) * Math.min(1, d / dt / w.speed)
                : 0,
            );
          }
          w.camera = {
            x: Math.max(-512 / 48, Math.min(512 / 48, w.player.x)),
            y: Math.max(-1124 / 48, Math.min(1124 / 48, w.player.y)),
          };
          w.step(dt);
          maxSlots = Math.max(maxSlots, w.counter.slots);
          actors.forEach((e, i) => {
            if (w.stageStrategy.map.blocked(e, 0.699)) walls++;
            maxBodyStep = Math.max(
              maxBodyStep,
              Math.hypot(e.x - old[i].x, e.y - old[i].y),
            );
            old[i] = { x: e.x, y: e.y };
          });
          w.drain();
        }
        rows.push({
          kind,
          scene,
          dt,
          damage: 1e8 - w.hp,
          maxSlots,
          wallViolations: walls,
          maxBodyStep,
          patterns: { ...w.counter.stats.patterns },
          eliteCasts: { ...w.counter.stats.eliteCasts },
          pairs: w.counter.stats.pairs,
          secondLocks: w.counter.stats.secondLocks,
          rejected: w.counter.stats.rejected,
        });
      }
  const issues = rows.filter(
    (r) =>
      r.maxSlots > 2 ||
      r.wallViolations ||
      r.maxBodyStep > 5 * r.dt + 1e-5 ||
      (!["circle", "weave"].includes(r.scene) && r.damage === 0) ||
      (r.kind === "pair" && Object.values(r.eliteCasts).some((n) => !n)) ||
      (r.kind === "boss" && Object.values(r.patterns).some((n) => !n)),
  );
  fs.mkdirSync("artifacts/stage18-implementation", { recursive: true });
  fs.writeFileSync(
    "artifacts/stage18-implementation/combat.json",
    JSON.stringify(
      {
        scope:
          "Real world, single boss or paired elites, no weapons/director, 120s, stationary and moving,30/5fps. Not a win-rate test.",
        rows,
        issues,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ cases: rows.length, issues }, null, 2));
  if (issues.length) throw Error("Stage18 combat diagnostic failed");
});
