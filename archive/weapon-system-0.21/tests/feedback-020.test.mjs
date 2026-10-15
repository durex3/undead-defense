import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { WEAPONS, EVOLUTIONS } from "../temp/tests/battle/SurvivalConfig.mjs";
import {
  CHARACTERS,
  characterDamage,
  characterCooldown,
} from "../temp/tests/battle/ProgressionConfig.mjs";
import { nextPlaySpeed } from "../temp/tests/battle/PlaySpeed.mjs";
import {
  compactSynergy,
  weaponDetails,
} from "../temp/tests/battle/WeaponStatus.mjs";
function world(character = "ranger") {
  const w = new SurvivalWorld(19, character, 1, 6);
  for (const k of WEAPONS) w.skills[k] = 0;
  return w;
}
function crowd(w, n = 12) {
  for (let i = 0; i < n; i++) {
    const e = w.addEnemy("minion", 2 + i * 0.2, 0);
    e.hp = e.maxHp = 100000;
  }
}
test("soul and fire chains double affected targets at every rank and halve base cooldown", () => {
  for (const skill of ["chain", "soul"])
    for (let level = 1; level <= 10; level++) {
      const w = world();
      w.skills[skill] = level;
      crowd(w);
      w.arsenal.step(0);
      const links = w.arsenal.links.filter(
          (p) => p.active && p.skill === skill,
        ),
        ids = new Set(links.flatMap((p) => [p.a, p.b]));
      assert.equal(
        ids.size,
        2 *
          ((skill === "chain" ? (level >= 2 ? 3 : 2) : level >= 2 ? 2 : 1) + 1),
      );
      assert.equal(w.cooldowns[skill], skill === "chain" ? 2 : 2.25);
    }
});
test("focused branches hit two different enemies and soul can tether a lone enemy without synthesis", () => {
  for (const [skill, form] of [
    ["chain", "brand"],
    ["soul", "torment"],
  ]) {
    const w = world();
    w.skills[skill] = 10;
    w.evolutions[skill] = form;
    crowd(w);
    w.arsenal.cast(skill);
    const links = w.arsenal.links.filter((p) => p.active);
    assert.equal(links.length, 2);
    assert.equal(new Set(links.map((p) => p.a)).size, 2);
    assert(links.every((p) => p.a === p.b));
  }
  const w = world();
  w.skills.soul = 1;
  crowd(w, 1);
  assert(w.arsenal.cast("soul"));
  w.cooldowns.soul = 10;
  w.arsenal.step(0);
  assert(w.enemies[0].hp < 100000);
});
test("pillar doubles base and focused radii; meteor always scatters four overlapping-capable fragments", () => {
  for (const [level, form, radius] of [
    [1, undefined, 3],
    [3, undefined, 3.75],
    [10, "sunlance", 2.1],
  ]) {
    const w = world();
    w.skills.pillar = level;
    w.evolutions.pillar = form;
    crowd(w, 1);
    w.arsenal.cast("pillar");
    assert.equal(w.arsenal.markers.find((p) => p.active).radius, radius);
  }
  const w = world();
  w.skills.meteor = 10;
  w.evolutions.meteor = "impact";
  crowd(w, 1);
  w.arsenal.cast("meteor");
  const markers = w.arsenal.markers.filter((p) => p.active);
  assert.equal(markers.length, 5);
  assert.equal(markers[0].radius, 5.4);
  assert(
    markers
      .slice(1)
      .every(
        (p) =>
          p.radius === 2.8 &&
          Math.hypot(p.x - markers[0].x, p.y - markers[0].y) <= 6,
      ),
  );
  assert(
    markers
      .slice(1)
      .some(
        (p) => Math.hypot(p.x - markers[0].x, p.y - markers[0].y) < 5.4 + 2.8,
      ),
  );
  assert.equal(new Set(markers.slice(1).map((p) => p.x + ":" + p.y)).size, 4);
});
test("black hole cooldown is halved with hourglass stacking multiplicatively", () => {
  for (const [level, base] of [
    [1, 3],
    [4, 2.4],
    [10, 2.4],
  ]) {
    const w = world();
    w.skills.void = level;
    crowd(w);
    w.passives.hourglass = 2;
    w.expansion.step(0);
    assert(Math.abs(w.cooldowns.void - base * 0.82) < 1e-9);
  }
});
test("existing characters have real passive bonuses and ranger copy matches actual damage", () => {
  assert.deepEqual(Object.keys(CHARACTERS), ["ranger", "alchemist", "necromancer"]);
  for (const character of Object.keys(CHARACTERS))
    for (const skill of WEAPONS) {
      const w = world(character);
      crowd(w, 1);
      const e = w.enemies[0];
      w.hit(e, 100, skill);
      assert(
        Math.abs(100000 - e.hp - 100 * characterDamage(character, skill)) <
          1e-8,
      );
      assert.equal(
        w.cooldownFactor(skill),
        characterCooldown(character, skill),
      );
    }
  assert.match(CHARACTERS.ranger.description, /飞刀、镰刀、战斧伤害 \+15%/);
  assert.match(weaponDetails(world(), "blade"), /角色加成：伤害 \+15%/);
});
test("speed cycle includes return to normal; fire labels and recipe hint cannot imply premature fire damage", () => {
  let speed = 1;
  const values = [];
  for (let i = 0; i < 4; i++) {
    speed = nextPlaySpeed(speed);
    values.push(speed);
  }
  assert.deepEqual(values, [1.5, 2, 3, 1]);
  assert.equal(EVOLUTIONS.fire[0].name, "豪火球术");
  const w = world();
  w.skills.blade = w.skills.fire = 5;
  assert.match(compactSynergy(w, "blade"), /未激活/);
  assert(!w.combinations.ready("fire"));
  w.skills.blade = w.skills.fire = 10;
  w.evolutions.fire = "meteor";
  assert.match(compactSynergy(w, "blade"), /已激活/);
});
