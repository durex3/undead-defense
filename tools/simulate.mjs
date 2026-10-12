import { BattleWorld } from "../temp/tests/battle/BattleWorld.mjs";
for (let stage = 1; stage <= 3; stage++)
  for (const build of [
    ["fire", "ice", "ballista"],
    ["lightning", "fire", "ice"],
    ["ballista", "ice", "fire"],
  ]) {
    const w = new BattleWorld(stage, 0, 0, 123);
    let frames = 0;
    while (!["won", "lost"].includes(w.state) && frames++ < 30 * 900) {
      if (w.state === "upgrade") {
        const owned = build.find((s) => w.skills[s] > 0 && w.cards.includes(s));
        const chosen =
          owned || build.find((s) => w.cards.includes(s)) || w.cards[0];
        w.choose(chosen);
      } else {
        w.step(1 / 30);
        if (w.enemies.length > 8 || w.enemies.some((e) => e.y < 3))
          w.useUltimate();
      }
      w.drain();
    }
    console.log(
      JSON.stringify({
        stage,
        build,
        state: w.state,
        time: Math.round(w.time),
        hp: Math.round(w.hp),
        wave: w.wave,
        level: w.level,
        skills: w.skills,
        kills: w.kills,
      }),
    );
  }
