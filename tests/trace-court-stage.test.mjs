import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import {
  traceLegs,
  traceImpacts,
  tracePosition,
  traceCut,
} from "../temp/tests/battle/TraceCourtGeometry.mjs";
import { TraceHistory } from "../temp/tests/battle/TraceHistory.mjs";
import { traceMap } from "../temp/tests/battle/TraceCourtMap.mjs";
import { TRACE_RECIPES } from "../temp/tests/battle/TraceChallenge.mjs";
import { ProgressStore } from "../temp/tests/platform/ProgressStore.mjs";
import { ALL_WEAPONS } from "../temp/tests/battle/SurvivalConfig.mjs";
import {
  initialGrades,
  nextGrade,
  gradeMultiplier,
  weaponName,
} from "../temp/tests/battle/WeaponGrade.mjs";
import { stageReference } from "../temp/tests/battle/StageGrowth.mjs";
const world = () => {
  const w = new SurvivalWorld(31, "ranger", 17);
  w.time = 400;
  w.state = "battle";
  w.player = { x: 0, y: 0 };
  w.camera = { x: 0, y: 0 };
  w.viewport = { x: 16, y: 7.5 };
  return w;
};
const hazard = () => ({
  x: -2,
  y: 0,
  due: 2.4,
  until: 4.4,
  trace: {
    legs: traceLegs(
      [
        { x: -2, y: 0 },
        { x: 2, y: 0 },
      ],
      2.4,
      2,
    ),
    radius: 0.55,
    last: 0,
    player: { x: 0, y: 0 },
    hitPasses: [],
    route: [],
    action: "A",
    life: 1,
    genuine: false,
  },
});
function history(w, reverse = false) {
  w.trace.history.clear();
  const ps = reverse
    ? [
        { x: -1, y: 0 },
        { x: -1, y: -2 },
        { x: -4, y: -2 },
      ]
    : [
        { x: -4, y: -2 },
        { x: -1, y: -2 },
        { x: -1, y: 0 },
      ];
  ps.forEach((p, i) => w.trace.history.record(p, w.time - 2 + i));
  return ps;
}
test("17 unlock follows 16 and both lives share the formula budget", () => {
  const p = new ProgressStore({ getItem: () => null, setItem: () => {} });
  assert(!p.unlockedStage(17));
  p.data.stages = [16];
  assert(p.unlockedStage(17));
  const w = world(),
    e = w.addEnemy("boss", -4, 0),
    r = stageReference(17);
  assert(Math.abs(e.trace.total - r.bossDps * r.bossSeconds) < 1e-8);
  assert(Math.abs(e.hp / e.trace.total - 0.35) < 1e-9);
});
test("continuous charge collision follows current body, with safe warnings and safe wake", () => {
  const h = hazard();
  assert.deepEqual(traceImpacts(h, { x: 0, y: 0 }, 2.39, 0), []);
  assert(traceImpacts(h, { x: 0, y: 0 }, 4.4, 2.4).includes(1));
  assert.deepEqual(traceImpacts(h, { x: 0, y: 0.851 }, 4.4, 2.4), []);
  assert.deepEqual(traceImpacts(h, { x: -2, y: 0 }, 4.4, 4), []);
  assert(Math.abs(tracePosition(h, 3.4).x) < 1e-8);
  assert(traceImpacts(h, { x: 0, y: -2 }, 4.4, 2.4, { x: 0, y: 2 }).length);
});
test("a bend cannot be replaced by a chord or an entire warning envelope", () => {
  const h = hazard();
  h.trace.legs = traceLegs(
    [
      { x: -2, y: -2 },
      { x: -2, y: 2 },
      { x: 2, y: 2 },
    ],
    2.4,
    2,
  );
  h.until = 6.4;
  assert.deepEqual(traceImpacts(h, { x: 0, y: 0 }, 6.4, 2.4), []);
  assert(traceImpacts(h, { x: -2, y: 0 }, 6.4, 2.4).length);
});
test("history is bounded and a genuine trace has a stable historical turn excluding the connector", () => {
  const w = world();
  history(w);
  const r = w.trace.history.route({ x: -4, y: -3 }, w.time);
  assert(r?.genuine);
  assert.equal(r.direction, "left");
  const copy = JSON.stringify(r);
  w.player = { x: 10, y: 10 };
  w.trace.history.record(w.player, w.time + 0.1);
  assert.equal(JSON.stringify(r), copy);
  for (let i = 0; i < 1200; i++)
    w.trace.history.record({ x: 0, y: 0 }, 401 + i * 0.01);
  assert(w.trace.history.samples.length <= 1024);
  assert(
    w.trace.history.samples.every(
      (p) => p.time >= w.trace.history.samples.at(-1).time - 3,
    ),
  );
});
test("first lethal stops at zero, revives exactly once and never pays first-life rewards", () => {
  const w = world(),
    e = w.addEnemy("boss", -3, 0),
    total = e.trace.total;
  e.state = "seek";
  w.hit(e, 1e9, "blade");
  assert.equal(e.hp, 0);
  assert.equal(w.state, "battle");
  assert.equal(w.kills, 0);
  assert(w.trace.keep(e));
  e.state = "seek";
  w.hit(e, 1e9, "blade");
  w.time = e.trace.deadUntil - 0.001;
  w.trace.tick();
  assert.equal(e.hp, 0);
  w.time += 0.001;
  w.trace.tick();
  assert.equal(e.trace.life, 2);
  assert(Math.abs(e.hp - total * 0.65) < 1e-8);
  w.trace.tick();
  assert.equal(w.trace.stats.revivals, 1);
  e.state = "seek";
  w.hit(e, 1e9, "blade");
  assert.equal(w.state, "won");
  assert.equal(w.kills, 1);
  assert.equal(w.potions.length, 3);
});
test("pause prevents revival and new life clears target buffs while retaining player loadout/cooldowns", () => {
  const w = world(),
    e = w.addEnemy("boss", -3, 0);
  w.skills.fire = 4;
  e.burn = 8;
  e.fracture = 2;
  e.state = "seek";
  w.hit(e, 1e9, "blade");
  w.time = e.trace.deadUntil;
  w.pause("test", true);
  w.trace.tick();
  assert.equal(e.hp, 0);
  w.pause("test", false);
  w.trace.tick();
  assert.equal(e.burn, 0);
  assert.equal(e.fracture, 0);
  assert.equal(w.skills.fire, 4);
  assert.equal(e.trace.life, 2);
});
test("frozen charge stops at actual body position and cannot resume or hit its remaining route", () => {
  const w = world(),
    e = w.addEnemy("fettersprinter", -3, 0);
  e.state = "seek";
  assert(w.trace.begin(e));
  const h = e.trace.item;
  w.time = h.due + 0.2;
  w.trace.stepEnemy(e, 0.1);
  w.trace.stepHazard(h);
  const p = { x: e.x, y: e.y };
  e.freezeUntil = w.time + 2;
  w.time += 0.2;
  w.trace.clean();
  assert.deepEqual({ x: e.x, y: e.y }, p);
  assert(h.trace.cancelled);
  assert(!h.trace.pending);
  w.time = e.freezeUntil + 0.1;
  w.trace.stepEnemy(e, 0.1);
  assert.deepEqual({ x: e.x, y: e.y }, p);
});
test("return announces a full new warning from the real endpoint and respects the two slots", () => {
  const w = world(),
    e = w.addEnemy("turnwarden", -3, 0);
  e.state = "seek";
  w.trace.state(e).action = "B";
  assert(w.trace.begin(e));
  const h = e.trace.item,
    firstEnd = h.trace.legs.at(-1).end;
  w.time = firstEnd + 0.1;
  w.trace.stepEnemy(e, 0.1);
  const back = h.trace.legs.find((f) => f.pass === 2);
  assert(back);
  assert(back.due - w.time >= 2.2 - 1e-8);
  assert.deepEqual(back.from, { x: e.x, y: e.y });
  const a = w.addEnemy("fettersprinter", -3, 2);
  a.state = "seek";
  assert(w.trace.begin(a));
  const b = w.addEnemy("fettersprinter", -3, -2);
  b.state = "seek";
  assert(!w.trace.begin(b));
  assert.equal(w.trace.slots, 2);
});
test("C locks its sweep only after actual arrival and gives a fresh 2.4 second warning", () => {
  const w = world(),
    e = w.addEnemy("boss", -4, -3);
  e.trace.life = 2;
  e.bossPhase = 2;
  history(w, true);
  e.state = "seek";
  e.trace.action = "C";
  assert(w.trace.begin(e));
  const h = e.trace.item;
  assert(!h.trace.sweep);
  w.time = h.trace.legs.at(-1).end + 0.1;
  w.trace.stepEnemy(e, 0.1);
  assert(h.trace.sweep);
  assert(h.trace.sweep.due - w.time >= 2.4 - 1e-8);
  assert.equal(h.trace.sweep.x, e.x);
  assert.equal(h.trace.sweep.y, e.y);
});
test("420 coins settle only once, signed recipe progress survives cold reload and malformed fields preserve the wallet", () => {
  const data = new Map(),
    storage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
    },
    p = new ProgressStore(storage),
    w = world();
  w.startingWeapon = "blade";
  w.skills.blade = 8;
  w.mods.blade = ["hunt", "return"];
  w.challenge.traceDirection = "left";
  ["1B", "2A", "2B", "2C"].forEach((k) => w.challenge.traceGroups.add(k));
  w.state = "won";
  p.observe(w);
  p.observe(w);
  assert.equal(p.coins, 420);
  assert.deepEqual(p.data.traceQualified.blade, ["hunt+return|left"]);
  const cold = new ProgressStore(storage);
  assert.equal(cold.coins, 420);
  assert.deepEqual(cold.data.traceQualified, p.data.traceQualified);
});
test("120 distinct directional recipes across 12 openers are required, not failures or duplicate runs", () => {
  const p = new ProgressStore({ getItem: () => null, setItem: () => {} });
  for (const skill of ALL_WEAPONS.slice(0, 12))
    for (const pair of TRACE_RECIPES[skill])
      for (const dir of ["left", "right"]) {
        const w = world();
        w.startingWeapon = skill;
        w.skills[skill] = 8;
        w.mods[skill] = pair.split("+");
        w.challenge.traceDirection = dir;
        ["1B", "2A", "2B", "2C"].forEach((k) => w.challenge.traceGroups.add(k));
        w.state = "won";
        p.observe(w);
      }
  assert(p.hasAchievement("trace_twelve_paths"));
  assert.equal(p.coins, 50400);
});
test("holy evolution replaces the existing family, costs 360 then 720 before the later epic step", () => {
  const p = new ProgressStore({ getItem: () => null, setItem: () => {} });
  p.data.coins = 1080;
  assert.equal(p.evolveWeapon("holy", 1), "evolved");
  assert.equal(p.coins, 720);
  assert.equal(p.evolveWeapon("holy", 2), "evolved");
  assert.equal(p.coins, 0);
  assert.equal(nextGrade("holy", p.weaponGrades), 4);
  assert.equal(gradeMultiplier("holy", p.weaponGrades), 1.6);
  assert.equal(weaponName("holy", p.weaponGrades), "断律圣裁");
  assert.equal(gradeMultiplier("holy", initialGrades()), 1);
});
test("malformed and future challenge data cannot erase existing coins or earlier stages", async () => {
  const { decodeProgress, freshProgress } =
    await import("../temp/tests/platform/ProgressCodec.mjs");
  const raw = {
    ...freshProgress(),
    coins: 777,
    stages: [1, 16],
    traceQualifiedVersion: 2,
    traceQualified: { blade: ["hunt+return|left"] },
  };
  const result = decodeProgress(JSON.stringify(raw));
  assert.equal(result.data.coins, 777);
  assert.deepEqual(result.data.stages, [1, 16]);
  assert.equal(result.data.traceQualified, undefined);
  const repaired = decodeProgress({
    ...raw,
    traceQualifiedVersion: 1,
    traceQualified: {
      blade: ["hunt+return|left", "wrong|left", "hunt+return|left"],
    },
  });
  assert.deepEqual(repaired.data.traceQualified.blade, ["hunt+return|left"]);
});
test("boss-damage, missing reverse completion and failed runs cannot earn a directional recipe", () => {
  for (const mode of ["hurt", "missing", "failed"]) {
    const p = new ProgressStore({ getItem: () => null, setItem: () => {} }),
      w = world();
    w.startingWeapon = "blade";
    w.skills.blade = 8;
    w.mods.blade = ["hunt", "return"];
    w.challenge.traceDirection = "right";
    ["1B", "2A", "2B", "2C"].forEach((k) => w.challenge.traceGroups.add(k));
    if (mode === "hurt") w.challenge.bossHits = 1;
    if (mode === "missing") w.challenge.traceGroups.delete("2B");
    w.state = mode === "failed" ? "lost" : "won";
    p.observe(w);
    assert(!p.data.traceQualified);
  }
});
test("holy forms have different real glyph and attack geometry", async () => {
  const { Graphics } = await import("../temp/tests/node_modules/cc/index.mjs");
  const { drawWeaponGlyph } =
    await import("../temp/tests/presentation/art/WeaponGlyph.mjs");
  const { drawExtraSpell } =
    await import("../temp/tests/presentation/art/spells/ExtraSpellArt.mjs");
  const glyphs = [],
    attacks = [];
  for (const grade of [1, 2, 3]) {
    const g = new Graphics();
    drawWeaponGlyph(g, "holy", grade);
    glyphs.push(JSON.stringify(g.commands));
    const w = world();
    w.enemies = [];
    w.weaponGrades.holy = grade;
    w.skills.holy = 8;
    w.addEnemy("minion", 1, 0).state = "seek";
    w.armory.step(0.1);
    const a = new Graphics();
    drawExtraSpell(a, w, true, false);
    drawExtraSpell(a, w, false, false);
    attacks.push(JSON.stringify(a.commands));
  }
  assert.equal(new Set(glyphs).size, 3);
  assert.equal(new Set(attacks).size, 3);
});

test('stage17 elite rounds keep full health, return together, and hand over after three seconds', () => {
  const w = world();
  const clear = () => { w.enemies = []; w.hazards = []; };
  for (const [time, kind] of [[135, 'trailmarshal'], [225, 'reversejailer'], [305, 'trailmarshal']]) {
    clear(); w.time = time; w.trace.director(1);
    const e = w.enemies.find(e => e.kind === kind);
    assert(e, `${time}: ${kind}`); assert.equal(e.hp, e.maxHp);
  }
  w.time = 311; w.trace.director(1);
  const elites = w.enemies.filter(e => ['trailmarshal', 'reversejailer'].includes(e.kind));
  assert.equal(elites.length, 2);
  assert(elites.every(e => e.hp === e.maxHp));
  w.time = 360; w.trace.director(1);
  assert(!w.enemies.some(e => e.kind === 'boss'));
  for (const e of elites) { e.state = 'seek'; w.hit(e, 1e9, 'blade'); }
  w.time = 362.9; w.trace.director(.1);
  assert(!w.enemies.some(e => e.kind === 'boss'));
  w.time = 363; w.trace.director(.1);
  assert(w.enemies.some(e => e.kind === 'boss'));
});

test('stage17 both elites get real casts without exceeding two reservations', () => {
  for (const moving of [false, true]) {
    const w = world(); w.hp = w.maxHp = 1e8;
    w.director.step = () => {}; w.armory.step = () => {};
    for (const [kind, x, y] of [['trailmarshal', -4, 0], ['reversejailer', 3, 2]]) {
      const e = w.addEnemy(kind, x, y); e.state = 'seek'; e.attack = 0;
    }
    let maxSlots = 0;
    for (let frame = 0; frame < 2700; frame++) {
      if (moving) { const dy = Math.sin(frame / 100) * 2 - w.player.y; w.move = { x: 0, y: Math.sign(dy) * Math.min(1, Math.abs(dy) * 30 / w.speed) }; }
      w.camera = { ...w.player }; w.step(1 / 30); w.drain();
      maxSlots = Math.max(maxSlots, w.trace.slots);
    }
    assert(maxSlots <= 2);
    assert(w.trace.stats.eliteCasts.trailmarshal > 0);
    assert(w.trace.stats.eliteCasts.reversejailer > 0);
  }
});
