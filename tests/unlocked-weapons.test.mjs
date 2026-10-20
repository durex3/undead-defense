import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { weaponStats, MODS } from "../temp/tests/battle/ArmoryConfig.mjs";
import { UNLOCK_ATTACK_LIMIT } from "../temp/tests/battle/UnlockedArmory.mjs";
import { BattlePainter } from "../temp/tests/presentation/BattlePainter.mjs";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { drawInkMap } from "../temp/tests/presentation/art/MapArt.mjs";
function world(skill, mods = []) {
  const w = new SurvivalWorld(19, "ranger", 5);
  for (const s of Object.keys(w.skills)) w.skills[s] = 0;
  w.skills[skill] = 8;
  w.mods[skill] = mods;
  w.player = { x: 0, y: 0 };
  w.enemies = [];
  w.viewport = { x: 100, y: 100 };
  return w;
}
function enemy(w, x = 2, y = 0) {
  const e = w.addEnemy("waxbearer", x, y);
  e.state = "seek";
  e.hp = e.maxHp = 1e6;
  return e;
}
function run(w, t, dt = 1 / 60) {
  for (let age = 0; age < t - 1e-8; age += dt) {
    w.time += dt;
    w.armory.unlocked.step(dt);
  }
}
for (const skill of ["hammer", "wheel"]) {
  test(`${skill}: all five double mods commute and have finite damage and visible runtime art`, () => {
    const g = new Graphics(),
      records = [];
    const list = MODS[skill];
    const configurations = [
      [],
      ...list.map((m) => [m.id]),
      ...list.flatMap((a, i) =>
        list
          .slice(i + 1)
          .filter((b) => a.excludes !== b.id)
          .map((b) => [a.id, b.id]),
      ),
    ];
    assert.equal(configurations.length, 10);
    for (const mods of configurations) {
      const w = world(skill, mods);
      enemy(w, 2, 0);
      enemy(w, 4, 0.5);
      enemy(w, 5, 0);
      const a = weaponStats(w, skill);
      w.mods[skill] = [...mods].reverse();
      assert.deepEqual(weaponStats(w, skill), {
        ...a,
        mods: [...a.mods].reverse(),
      });
      let visible = 0;
      for (let i = 0; i < 360; i++) {
        w.time += 1 / 60;
        w.armory.unlocked.step(1 / 60);
        if (i % 12 === 0) {
          new BattlePainter(g).draw(w, 0.2, w.drain(), false);
          if (
            w.armory.unlocked.attacks.some(
              (a) => a.active && a.created <= w.time,
            )
          )
            visible++;
          assert(g.vertexCount < 45000);
        }
      }
      assert(visible > 0);
      assert(w.damage[skill] > 0);
      assert(Number.isFinite(w.damage[skill]));
      assert(w.armory.unlocked.attacks.length <= UNLOCK_ATTACK_LIMIT);
      records.push(w.damage[skill]);
    }
    assert(new Set(records).size >= 6);
  });
}
test("hammer windup deals no early damage, primary hits fracture before damage, rebound remains finite", () => {
  const w = world("hammer", ["heavy", "return"]),
    e = enemy(w),
    s = weaponStats(w, "hammer");
  w.armory.unlocked.step(0);
  run(w, 0.3);
  assert.equal(e.hp, e.maxHp);
  run(w, 0.1);
  assert(e.hp < e.maxHp);
  assert.equal(e.fracture, 2);
  assert(Math.abs(w.damage.hammer - s.damage) < 1e-5);
  run(w, 15);
  assert(w.armory.unlocked.attacks.length <= UNLOCK_ATTACK_LIMIT);
});
test("wheel uses fixed origin and finite out/hold/curved return without homing after player relocation", () => {
  const w = world("wheel", ["grind", "curve"]);
  enemy(w, 3);
  w.armory.unlocked.step(0);
  const a = w.armory.unlocked.attacks[0],
    origin = { ...a.start };
  w.player = { x: 18, y: 20 };
  run(w, 4);
  assert.deepEqual(a.start, origin);
  assert(!a.active);
  assert(w.damage.wheel > 0);
});
test("stage-five map and all wax enemies draw with finite coordinates and independent outlines", () => {
  const w = world("hammer"),
    g = new Graphics();
  drawInkMap(g, 5);
  assert(g.commands.length > 0);
  for (const kind of [
    "waxbearer",
    "bellacolyte",
    "waxscribe",
    "waxcrawler",
    "twinbell",
    "waxporter",
    "boss",
  ]) {
    const e = w.addEnemy(kind, 0, 0);
    e.state = "seek";
  }
  new BattlePainter(g).draw(w, 1 / 60, [], false);
  assert(g.vertexCount > 0 && g.vertexCount < 45000);
});
test("all eight new single modifications change geometry over time without relying on color", async () => {
  const { drawUnlockedSpells } =
    await import("../temp/tests/presentation/art/UnlockedSpellArt.mjs");
  for (const skill of ["hammer", "wheel"]) {
    const signatures = [];
    for (const mods of [[], ...MODS[skill].map((m) => [m.id])]) {
      const w = world(skill, mods);
      enemy(w, 2);
      enemy(w, 5);
      const g = new Graphics(),
        frames = [];
      for (let i = 0; i < 210; i++) {
        w.time += 1 / 60;
        w.armory.unlocked.step(1 / 60);
        if (i % 10 === 0) {
          g.clear();
          drawUnlockedSpells(g, w);
          frames.push(
            JSON.stringify(
              g.commands.map(({ op, d, width }) => ({ op, d, width })),
            ),
          );
        }
      }
      signatures.push(frames.join("|"));
    }
    for (let i = 1; i < 5; i++)
      assert.notEqual(
        signatures[i],
        signatures[0],
        `${skill} mod ${i} unchanged`,
      );
  }
});
