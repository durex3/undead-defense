import fs from "node:fs";
import { withVerificationLock } from "./verification-lock.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
await withVerificationLock(async () => {
  const w = new SurvivalWorld(31, "ranger", 16);
  w.time = 400;
  w.state = "battle";
  w.hp = w.maxHp = 1e8;
  w.player = { x: 0, y: 8 };
  w.camera = { x: 0, y: 8 };
  w.viewport = { x: 16, y: 7.5 };
  w.armory.step = () => {};
  w.director.step = () => {};
  for (let i = 0; i < 100; i++) {
    const e = w.addEnemy("gravegrub", 0, 0);
    e.state = "seek";
  }
  let walls = 0,
    maxStep = 0;
  for (let n = 0; n < 300; n++) {
    const before = w.enemies.map((e) => ({ x: e.x, y: e.y }));
    w.step(1 / 30);
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i];
      maxStep = Math.max(
        maxStep,
        Math.hypot(e.x - before[i].x, e.y - before[i].y),
      );
      if (w.stageStrategy.map.blocked(e, 0.349)) walls++;
    }
    w.drain();
  }
  const r = {
    actors: 100,
    seconds: 10,
    wallViolations: walls,
    maxFrameDisplacement: maxStep,
    allowedFrameDisplacement: (1.86 + 1.2) / 30,
    uniquePositions: new Set(
      w.enemies.map((e) => e.x.toFixed(3) + "," + e.y.toFixed(3)),
    ).size,
  };
  fs.mkdirSync("artifacts/ai-0.40.1", { recursive: true });
  fs.writeFileSync(
    "artifacts/ai-0.40.1/crowd.json",
    JSON.stringify(r, null, 2) + "\n",
  );
  console.log(r);
  if (walls || maxStep > (1.86 + 1.2) / 30 + 1e-6 || r.uniquePositions < 95)
    throw Error("Dense crowd regression");
});
