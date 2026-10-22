import fs from "node:fs";
import { withVerificationLock } from "./verification-lock.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { ENEMIES } from "../temp/tests/battle/SurvivalConfig.mjs";
import { CATALOG_STAGE_KINDS } from "../temp/tests/presentation/art/EnemyCatalog.mjs";
import { distance } from "../temp/tests/battle/SurvivalTypes.mjs";
await withVerificationLock(async () => {
  const rows = [];
  for (const [key, kinds] of Object.entries(CATALOG_STAGE_KINDS))
    for (const kind of kinds.filter((k) => ENEMIES[k].tacticalRange))
      for (const scenario of ["circle", "approach", "cover"]) {
        const stage = Number(key),
          w = new SurvivalWorld(31, "ranger", stage),
          map = w.stageStrategy.map;
        w.time = 400;
        w.state = "battle";
        w.hp = w.maxHp = 1e8;
        w.director.step = () => {};
        w.armory.step = () => {};
        let origin = { x: 0, y: 0 },
          spawn = { x: -5, y: 0 };
        if (scenario === "cover") {
          search: for (let x = -15; x <= 15; x += 2)
            for (let y = -19; y <= 19; y += 2) {
              const a = { x, y },
                b = { x: x + 8, y };
              if (
                !map.blocked(a, 0.5) &&
                !map.blocked(b, 0.5) &&
                map.segment(a, b, 0.25)
              ) {
                origin = a;
                spawn = b;
                break search;
              }
            }
        }
        w.player = { ...origin };
        const e = w.addEnemy(kind, spawn.x, spawn.y);
        map.resolve(e, 0.35);
        e.state = "seek";
        e.attack = 0;
        const ids = new Set();
        let wallViolations = 0,
          slots = 0,
          moved = 0,
          old = { x: e.x, y: e.y },
          readyFrames = 0;
        for (let i = 0; i < 1800; i++) {
          const t = i / 30,
            target =
              scenario === "circle"
                ? {
                    x: origin.x + Math.cos(t * 0.6) * 3,
                    y: origin.y + Math.sin(t * 0.6) * 3,
                  }
                : scenario === "approach"
                  ? {
                      x: origin.x + (Math.floor(t / 3) % 2 ? -4 : 1),
                      y: origin.y,
                    }
                  : { x: origin.x, y: origin.y + Math.sin(t * 0.4) * 4 };
          map.resolve(target, 0.3);
          const a = map.heading(w.player, target);
          const speed = Math.min(
            1,
            (distance(w.player, target) * 30) / w.speed,
          );
          w.move = { x: Math.cos(a) * speed, y: Math.sin(a) * speed };
          w.camera = {
            x: Math.max(-512 / 48, Math.min(512 / 48, w.player.x)),
            y: Math.max(
              -(stage >= 11 ? 1124 : 984) / 48,
              Math.min((stage >= 11 ? 1124 : 984) / 48, w.player.y),
            ),
          };
          w.viewport = { x: (7.5 * 844) / 390, y: 7.5 };
          w.step(1 / 30);
          for (const h of w.hazards) ids.add(h.id);
          slots = Math.max(
            slots,
            w.hazards.filter((h) => h.until > w.time).length,
          );
          if (e.state === "seek" && map.blocked(e, 0.349)) wallViolations++;
          if (e.state === "seek" && e.attack <= 0) readyFrames++;
          moved += distance(e, old);
          old = { x: e.x, y: e.y };
          w.drain();
        }
        rows.push({
          stage,
          kind,
          scenario,
          casts: ids.size,
          moved: +moved.toFixed(2),
          wallViolations,
          maxSlots: slots,
          readyFrames,
          spacing: w.enemyTactics.ranged.stats,
        });
      }
  const report = {
    scope:
      "18 configured ranged kinds, 60-second real world movement: circle, approach and cover. No weapons or reinforcements. Not a win-rate test.",
    rows,
  };
  fs.mkdirSync("artifacts/ai-0.40.1", { recursive: true });
  fs.writeFileSync(
    "artifacts/ai-0.40.1/movement.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        cases: rows.length,
        noCasts: rows.filter((r) => !r.casts),
        wallViolations: rows.filter((r) => r.wallViolations),
        budgetViolations: rows.filter((r) => r.maxSlots > 2),
      },
      null,
      2,
    ),
  );
  if (rows.some((r) => r.wallViolations || r.maxSlots > 2 || !r.casts))
    throw Error("Movement diagnostic failed");
});
