import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { ENEMIES, isElite } from "../temp/tests/battle/SurvivalConfig.mjs";
import { stepBoss } from "../temp/tests/battle/BossSystem.mjs";
import {
  ELITE_TIMES,
  eliteQuiet,
} from "../temp/tests/battle/EncounterPacing.mjs";
const kinds = {
  1: ["siegeflag", "siegerider", "siegeflag"],
  2: ["broodelite", "breakerelite", "broodelite"],
  3: ["gridwarden", "railreaper", "gridwarden"],
  4: ["moonreaver", "hornwarden", "moonreaver"],
  5: ["twinbell", "waxporter", "twinbell"],
  6: ["twinlockwarden", "severedcrane", "twinlockwarden"],
  7: ["bifacetregent", "strataflinger", "bifacetregent"],
  8: ["biforktangler", "migratorycorolla", "pairedcalyx"],
};
for (const stage of [1, 2, 3, 4, 5, 6, 7, 8]) {
  test(`stage ${stage}: three rounds use intended local kinds, never overlap and give ten seconds of preparation`, () => {
    const w = new SurvivalWorld(19, "ranger", stage);
    w.player = { x: 0, y: 0 };
    w.camera = { ...w.player };
    const seen = [];
    for (let t = 0; t <= 359; t++) {
      w.time = t;
      w.enemies = w.enemies.filter((e) => e.hp > 0 && isElite(e.kind));
      w.hazards = [];
      w.director.step(w, 1);
      const live = w.enemies.filter((e) => e.hp > 0 && isElite(e.kind));
      assert(live.length <= 1);
      if (live.length) {
        const e = live[0];
        seen.push({ kind: e.kind, t, hp: e.maxHp });
        e.hp = 0;
        w.stageStrategy.onDeath(e);
      }
    }
    assert.deepEqual(
      seen.map((e) => e.kind),
      kinds[stage],
    );
    for (let i = 0; i < 3; i++) {
      assert(seen[i].t >= ELITE_TIMES[i] && seen[i].t < ELITE_TIMES[i] + 10);
      assert(eliteQuiet(ELITE_TIMES[i] - 5));
    }
    for (const sample of seen) {
      const baseline = new SurvivalWorld(31, "ranger", stage);
      baseline.time = sample.t;
      const e = baseline.addEnemy(sample.kind);
      assert.equal(sample.hp, e.maxHp, "every round uses 100% normal health");
    }
  });
  test(`stage ${stage}: late living elite survives boss arrival, suppresses first boss attack and cannot queue another elite after deadline`, () => {
    const w = new SurvivalWorld(73, "ranger", stage);
    w.player = { x: 0, y: 0 };
    w.camera = { ...w.player };
    const e = w.addEnemy(kinds[stage][0], -4, 0);
    e.state = "seek";
    for (const t of [225, 305, 339, 350, 360]) {
      w.time = t;
      w.director.step(w, 1);
      assert.equal(
        w.enemies.filter((e) => e.hp > 0 && isElite(e.kind)).length,
        1,
      );
    }
    const b = w.enemies.find((e) => e.kind === "boss");
    assert(b);
    assert(w.enemies.includes(e));
    const before = { x: b.x, y: b.y, state: b.state, pattern: b.pattern };
    stepBoss(w, b, 0.1);
    assert.deepEqual(
      { x: b.x, y: b.y, state: b.state, pattern: b.pattern },
      before,
    );
    assert(w.bossEliteRestUntil >= 363);
    e.hp = 0;
    w.stageStrategy.onDeath(e);
    w.time = 361;
    stepBoss(w, b, 0.1);
    assert.deepEqual(
      { x: b.x, y: b.y, state: b.state, pattern: b.pattern },
      before,
    );
  });
}
test("new eighth-stage elite declares two separated ring centers and a full fresh second warning", () => {
  const w = new SurvivalWorld(31, "ranger", 8);
  w.player = { x: 0, y: 0 };
  w.camera = { ...w.player };
  const e = w.addEnemy("migratorycorolla", -3, 0);
  e.state = "seek";
  w.root.state(e).action = "offsetBeds";
  assert(w.root.begin(e));
  assert.equal(w.hazards.length, 2);
  const [a, b] = w.hazards;
  assert.equal(a.root.shape, "ring");
  assert.equal(b.root.shape, "ring");
  assert(Math.hypot(a.x - b.x, a.y - b.y) > 5);
  assert(b.created >= a.until + 0.59);
  assert(b.due - b.created >= 1.79);
  assert.equal(w.root.slots, 2);
  assert.equal(ENEMIES.migratorycorolla.health, 16);
});
