/** Isolated Armory coverage/output comparison; no AI, contact or player win-rate. */
import fs from "node:fs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { ALL_WEAPONS } from "../temp/tests/battle/SurvivalConfig.mjs";
import { MODS, weaponStats } from "../temp/tests/battle/ArmoryConfig.mjs";
const rows = [];
const variants = (skill) => [
  [],
  ...MODS[skill].flatMap((a, i) =>
    MODS[skill]
      .slice(i + 1)
      .filter((b) => a.excludes !== b.id && b.excludes !== a.id)
      .map((b) => [a.id, b.id]),
  ),
];
for (const skill of ["water"])
  for (const grade of [1, 2, 3, 4])
    for (const level of [1, 8])
      for (const mods of variants(skill))
        for (const scene of ["single", "spread"])
          for (const setup of [
            "base",
            "area",
            "amount",
            "both",
            "duration",
            "hourglass",
            "all",
          ]) {
            const w = new SurvivalWorld(31, "ranger", 1);
            w.time = 360;
            w.player = { x: 0, y: 0 };
            w.enemies = [];
            for (const s of ALL_WEAPONS) w.skills[s] = 0;
            w.skills[skill] = level;
            w.weaponGrades.water = grade;
            w.mods[skill] = mods;
            w.passives.duration = ["duration", "all"].includes(setup) ? 4 : 0;
            w.passives.hourglass = ["hourglass", "all"].includes(setup) ? 4 : 0;
            w.passives.area = ["area", "both", "all"].includes(setup) ? 4 : 0;
            w.passives.amount = ["amount", "both", "all"].includes(setup)
              ? 2
              : 0;
            const hit = new Set();
            for (let i = 0; i < (scene === "single" ? 1 : 64); i++) {
              const p =
                scene === "single"
                  ? { x: 2.4, y: 0 }
                  : {
                      x: ((i % 8) - 3.5) * 1.8,
                      y: (Math.floor(i / 8) - 3.5) * 1.8,
                    };
              const e = w.addEnemy("minion", p.x, p.y);
              e.hp = e.maxHp = 1e8;
              e.state = "seek";
            }
            let controlled = 0;
            for (let i = 0; i < 1200; i++) {
              w.time += 1 / 60;
              w.armory.step(1 / 60);
              controlled +=
                w.enemies.filter((e) => e.freezeUntil > w.time).length / 60;
              for (const e of w.drain())
                if (e.type === "hit" && e.id) hit.add(e.id);
            }
            const s = weaponStats(w, skill);
            rows.push({
              skill,
              grade,
              level,
              mods,
              scene,
              setup,
              damage: w.damage[skill] || 0,
              hitTargets: hit.size,
              controlledSeconds: controlled,
              radius: s.radius,
              count: s.count,
            });
          }
const file = process.argv[2] || "artifacts/eclipse-stage/water-passives.json";
fs.mkdirSync(file.slice(0, file.lastIndexOf("/")), { recursive: true });
fs.writeFileSync(
  file,
  JSON.stringify(
    {
      scope:
        "20s high-HP targets, fixed ranger, no other passives, unmodified and legal dual mods, single or 8×8 spread, actual Armory/hit. Not normal survival play.",
      rows,
    },
    null,
    2,
  ) + "\n",
);
console.log(`${rows.length} passive probes written to ${file}`);
