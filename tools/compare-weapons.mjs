import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { WEAPONS, EVOLUTIONS } from "../temp/tests/battle/SurvivalConfig.mjs";
// Synthetic coverage probes, not rankings: motion and enemy position deliberately differ.
for (const scenario of ["near-ring", "far-ring", "moving-trail"])
  for (const skill of WEAPONS) {
    const result = { scenario, skill };
    for (const stage of ["L1", "L4", "evolved"]) {
      const w = new SurvivalWorld(1);
      w.skills.blade = 0;
      w.skills[skill] = stage === "L1" ? 1 : 4;
      if (stage === "evolved") w.evolutions[skill] = EVOLUTIONS[skill][0].id;
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        const e = w.addEnemy(
          "minion",
          Math.cos(a) * (scenario === "far-ring" ? 4 : 2),
          Math.sin(a) * (scenario === "far-ring" ? 4 : 2),
        );
        e.hp = e.maxHp = 1e8;
      }
      for (let i = 0; i < 1200; i++) {
        w.time += 1 / 60;
        w.orbitAngle +=
          (Math.PI * 2) /
          60 /
          (w.evolutions.blade === "ring" ? 1.6 : w.skills.blade >= 4 ? 2 : 2.4);
        if (scenario === "moving-trail") {
          w.player.x = Math.sin(w.time) * 3;
          w.player.y = Math.cos(w.time) * 3;
          w.setMove(Math.cos(w.time), -Math.sin(w.time));
        }
        w.stepWeapons(1 / 60);
        w.drain();
      }
      result[stage] = Math.round((w.damage[skill] || 0) / 20);
    }
    console.log(JSON.stringify(result));
  }
