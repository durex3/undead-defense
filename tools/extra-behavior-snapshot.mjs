/** Characterization of complete attacks, hit events and target state before lifecycle extraction. */
import { createHash } from "node:crypto";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { ALL_WEAPONS } from "../temp/tests/battle/SurvivalConfig.mjs";
import { EXTRA_WEAPONS } from "../temp/tests/battle/ExtraArmoryConfig.mjs";
import { MODS, isLegalModPair } from "../temp/tests/battle/ArmoryConfig.mjs";
export function captureExtraBehaviors(ExtraClass) {
  const rows = [];
  for (const skill of EXTRA_WEAPONS) {
    const pairs = MODS[skill].flatMap((a, i) =>
      MODS[skill]
        .slice(i + 1)
        .filter((b) => isLegalModPair(skill, [a.id, b.id]))
        .map((b) => [a.id, b.id]),
    );
    for (const mods of [[], ...MODS[skill].map((m) => [m.id]), ...pairs])
      for (const scene of ["stationary", "moving-retarget"]) {
        const w = new SurvivalWorld(22, "ranger", 1);
        w.player = { x: 0, y: 0 };
        w.enemies = [];
        w.time = 0.13;
        for (const s of ALL_WEAPONS) w.skills[s] = 0;
        if (ExtraClass) w.armory.extra = new ExtraClass(w);
        w.skills[skill] = 8;
        w.mods[skill] = mods;
        w.passives.amount = 4;
        w.passives.area = 4;
        for (let i = 0; i < 16; i++) {
          const angle = (i * Math.PI) / 8,
            e = w.addEnemy(
              i === 0 ? "siegeflag" : "siegebone",
              Math.cos(angle) * 2.8,
              Math.sin(angle) * 2.8,
            );
          e.state = "seek";
          e.hp = e.maxHp = 1e7;
        }
        w.armory.step(0);
        for (const s of ALL_WEAPONS) w.cooldowns[s] = 100;
        const hash = createHash("sha256");
        const snapshot = () =>
          hash.update(
            JSON.stringify(
              {
                attacks: w.armory.extra.attacks,
                ghostCount: w.armory.extra.ghostCount,
                enemies: w.enemies,
                damage: w.damage,
                events: w.drain(),
              },
              (_, v) => (v instanceof Set ? Array.from(v) : v),
            ),
          );
        snapshot();
        // Put targets on armed mine sites so both ordinary and wire-triggered lifecycles run.
        if (skill === "mine")
          for (const a of w.armory.extra.attacks) {
            const e = w.addEnemy("siegebone", a.x, a.y);
            e.state = "seek";
            e.hp = e.maxHp = 1e7;
          }
        for (let frame = 0; frame < 240; frame++) {
          w.time += 1 / 30;
          if (scene === "moving-retarget") {
            if (frame === 3) w.enemies[0].hp = 0;
            w.player.x = Math.sin(frame / 30) * 0.5;
            w.player.y = Math.cos(frame / 30) * 0.5;
            for (const [i, e] of w.enemies.entries())
              if (e.hp > 0) {
                e.x += Math.sin(frame / 20 + i) * 0.015;
                e.y += Math.cos(frame / 20 + i) * 0.015;
              }
          }
          w.armory.step(1 / 30);
          snapshot();
        }
        rows.push({
          skill,
          mods,
          scene,
          digest: hash.digest("hex"),
          damage: w.damage[skill] ?? 0,
          active: w.armory.extra.attacks.filter((a) => a.active).length,
        });
      }
  }
  return rows;
}
