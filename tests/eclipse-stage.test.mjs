import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { ALL_WEAPONS, ENEMIES } from "../temp/tests/battle/SurvivalConfig.mjs";
import { STAGE_IDS } from "../temp/tests/battle/ProgressionConfig.mjs";
import { stageGrowth } from "../temp/tests/battle/StageGrowth.mjs";
import { eclipseMap } from "../temp/tests/battle/EclipseMap.mjs";
import {
  eclipseDistance,
  eclipseImpact,
  eclipseLength,
  eclipseCut,
  eclipseEscape,
  eclipseShadow,
} from "../temp/tests/battle/EclipseGeometry.mjs";
import { MODS, weaponStats } from "../temp/tests/battle/ArmoryConfig.mjs";
import {
  ProgressStore,
  PROGRESS_KEY,
} from "../temp/tests/platform/ProgressStore.mjs";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { drawWeaponGlyph } from "../temp/tests/presentation/art/WeaponGlyph.mjs";
import { drawWaterFieldForm } from "../temp/tests/presentation/art/WeaponFormArt.mjs";
function world() {
  const w = new SurvivalWorld(41, "ranger", 14);
  w.enemies = [];
  w.player = { x: 0, y: 0 };
  w.camera = { x: 0, y: 0 };
  for (const s of ALL_WEAPONS) w.skills[s] = 0;
  return w;
}
function actor(w, kind = "boss", x = -3, y = 0) {
  const e = w.addEnemy(kind, x, y);
  e.state = "seek";
  e.attack = 0;
  return e;
}
const sweep = (props = {}) => ({
  pivot: { x: 0, y: 0 },
  angle: -Math.PI / 4,
  sign: 1,
  due: 2.4,
  end: 4.8,
  index: 0,
  hit: false,
  ...props,
});
const store = () => {
  const m = new Map();
  return {
    m,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v),
  };
};
const pairs = (skill) =>
  MODS[skill].flatMap((a, i) =>
    MODS[skill]
      .slice(i + 1)
      .filter((b) => a.excludes !== b.id && b.excludes !== a.id)
      .map((b) => [a.id, b.id]),
  );
test("stage14 registration, formula health, elite coefficients and prerequisite remain independent", () => {
  const w = world();
  assert.equal(STAGE_IDS.at(-1), 14);
  assert.equal(w.stageStrategy.map, eclipseMap);
  assert.equal(new SurvivalWorld(41, "ranger", 14).player.y, -8);
  assert(Math.abs(actor(w).maxHp - 61527.522077422276) < 1e-8);
  w.time = 240;
  const e = actor(w, "twindial");
  assert(Math.abs(e.maxHp - 30 * 1.8 * 22 * stageGrowth(14).elite) < 1e-8);
  assert.equal(ENEMIES.twindial.contact, 24);
  assert.equal(ENEMIES.eclipsewarden.contact, 26);
  const p = new ProgressStore(store());
  assert(!p.unlockedStage(14));
  p.data.stages = [13];
  assert(p.unlockedStage(14));
});
test("nine Boss plans lock real pivots, full warnings, 90-degree sweeps and jointly escapable max-two slots", () => {
  for (const phase of [1, 2, 3])
    for (const action of ["A", "B", "C"]) {
      const w = world(),
        e = actor(w);
      e.bossPhase = phase;
      w.eclipse.state(e).action = action;
      assert(w.eclipse.begin(e), phase + action);
      const hs = e.eclipse.items;
      assert(hs.length <= 2);
      assert(hs.every((h) => w.eclipse.legal(h)));
      assert(eclipseEscape(w, hs));
      for (const h of hs)
        for (const f of h.eclipse.sweeps) {
          assert(f.due >= w.time + 2.4 - 1e-9);
          assert(Math.abs(f.end - f.due - 2.4) < 1e-8);
          assert(Math.hypot(f.pivot.x - e.x, f.pivot.y - e.y) <= 1.2 + 1e-9);
        }
      if (phase === 3 && action === "B") {
        const [a, b] = hs[0].eclipse.sweeps;
        assert(Math.abs(b.due - a.end - 2.4) < 1e-9);
        assert.equal(a.sign, -b.sign);
      }
      const snapshot = JSON.stringify(hs);
      w.player.x = 12;
      e.x = 7;
      assert.equal(JSON.stringify(hs), snapshot);
    }
});
test("only current finite capsule hurts: warning, inner pocket, far end and swept fan are safe", () => {
  const f = sweep();
  assert(!eclipseImpact(f, { x: 4, y: 0 }, 2));
  assert(!eclipseImpact(f, { x: 0, y: 0 }, 3.6));
  assert(!eclipseImpact(f, { x: 6.701, y: 0 }, 3.6));
  assert(eclipseImpact(f, { x: 6.7, y: 0 }, 3.6));
  assert(eclipseImpact(f, { x: 4, y: 0.5 }, 3.6));
  assert(!eclipseImpact(f, { x: 4, y: 0.5001 }, 3.6));
  assert(!eclipseImpact(f, { x: 4, y: 0 }, 2.4));
  assert(eclipseImpact(f, { x: 4, y: 0 }, 4.7, 2.4));
});
test("expanded pillars clip caps with no light beyond stone, or phantom near cap", () => {
  const f = sweep({ pivot: { x: 3, y: 8 }, angle: 0 });
  assert(Math.abs(eclipseLength(f.pivot, 0) - 2.8) < 1e-9);
  assert(eclipseShadow(f, { x: 8.6, y: 8 }, 2.4));
  assert(!eclipseImpact(f, { x: 8.6, y: 8 }, 2.4));
  assert.equal(eclipseLength({ x: 5.9, y: 8 }, 0), 0);
  assert.equal(
    eclipseDistance(
      sweep({ pivot: { x: 5.9, y: 8 }, angle: 0 }),
      { x: 7.3, y: 8 },
      2.4,
    ),
    Infinity,
  );
});
test("continuous moving-player sweep agrees with high-frequency real clipped geometry, including occlusion corners", () => {
  let seed = 97;
  const rand = () =>
    ((seed = Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 90; i++) {
    const f = sweep({
      pivot: i % 2 ? { x: 3, y: 8 } : { x: 0, y: 0 },
      angle: -1 + rand(),
      sign: i % 3 ? -1 : 1,
    });
    const a = { x: f.pivot.x + rand() * 8 - 2, y: f.pivot.y + rand() * 8 - 4 },
      z = { x: a.x + rand() * 4 - 2, y: a.y + rand() * 4 - 2 };
    const lo = 2.4,
      hi = 4.8;
    let min = Infinity;
    for (let j = 0; j <= 6000; j++) {
      const k = j / 6000;
      min = Math.min(
        min,
        eclipseDistance(
          f,
          { x: a.x + (z.x - a.x) * k, y: a.y + (z.y - a.y) * k },
          lo + (hi - lo) * k,
        ),
      );
    }
    const hit = eclipseImpact(f, z, hi, lo, a);
    if (min < 0.4998) assert(hit, "missed true sweep " + i);
    if (min > 0.5002) assert(!hit, "false fan/chord hit " + i);
  }
});
test("freeze/death cuts future beams and reverse repeats, active released sweep keeps its original clock", () => {
  const w = world(),
    e = actor(w);
  e.bossPhase = 3;
  w.eclipse.state(e).action = "B";
  assert(w.eclipse.begin(e));
  const h = e.eclipse.items[0],
    f = h.eclipse.sweeps[0],
    until = f.end;
  w.time = f.due + 0.1;
  e.freezeUntil = w.time + 10;
  w.eclipse.clean();
  assert(!f.cancelled);
  assert(h.eclipse.sweeps[1].cancelled);
  assert.equal(h.until, until);
  w.time = until + 0.1;
  w.eclipse.stepEnemy(e, 0.1);
  assert.equal(e.state, "recover");
  const q = world(),
    o = actor(q);
  q.eclipse.state(o).action = "C";
  assert(q.eclipse.begin(o));
  const hs = o.eclipse.items;
  q.time = hs[0].due + 0.1;
  o.hp = 0;
  q.eclipse.onDeath(o);
  assert(!hs[0].eclipse.sweeps[0].cancelled);
  assert(hs[1].eclipse.sweeps[0].cancelled);
});
test("phase skip has no heal or lock, recovery follows all released sweeps, reservations reject atomically", () => {
  const w = world(),
    e = actor(w);
  e.bossPhase = 1;
  w.eclipse.state(e).action = "C";
  assert(w.eclipse.begin(e));
  assert.equal(w.eclipse.slots, 2);
  const o = actor(w, "twindial", 2, 0);
  w.eclipse.state(o).action = "pair";
  assert(!w.eclipse.begin(o));
  assert.equal(w.hazards.length, 2);
  w.time = 2.5;
  e.hp = e.maxHp * 0.3;
  const hp = e.hp;
  w.eclipse.stepEnemy(e, 0.1);
  assert.equal(e.bossPhase, 3);
  assert.equal(e.hp, hp);
  assert(e.eclipse.next >= e.eclipse.items[0].until);
  assert(e.eclipse.next >= w.time + 1.5);
});
function shadowGroup(phase = 1, breakAt = -1, interrupt = false, action = "C") {
  const w = world(),
    e = actor(w, "boss", 3, 8);
  e.bossPhase = phase;
  w.player = { x: 8.6, y: 8 };
  w.camera = { x: 5, y: 8 };
  w.eclipse.state(e).action = action;
  const hs = w.eclipse.plan(e); // Use the authored group, oriented to sweep a real pillar shadow.
  const f = hs[0].eclipse.sweeps[0];
  f.pivot = { x: 3, y: 8 };
  f.angle = -Math.PI / 4;
  f.sign = 1;
  w.hazards = hs;
  e.eclipse.items = hs;
  e.eclipse.step = 1;
  e.state = "windup";
  const start = f.due + 0.8,
    end = start + 0.82,
    at = (t) => ({
      x: 3 + Math.cos(-Math.PI / 4 + ((t - f.due) * Math.PI) / 4.8) * 5.6,
      y: 8 + Math.sin(-Math.PI / 4 + ((t - f.due) * Math.PI) / 4.8) * 5.6,
    });
  // Isolate the qualifying beam. A second C beam remains released and completes, but misses this arc.
  for (const h of hs.slice(1))
    for (const v of h.eclipse.sweeps) {
      v.angle = Math.PI;
      v.pivot = { x: 3, y: 8 };
    }
  let old = at(start);
  for (let t = start + 0.005; t <= end + 1e-8; t += 0.005) {
    let p = at(t);
    if (Math.abs(t - (start + 0.4)) < 0.003 && breakAt >= 0) p = { x: 3, y: 8 };
    w.time = t;
    w.player = p;
    w.eclipse.sample(old, p, t - 0.005, t);
    old = p;
  }
  if (interrupt) e.freezeUntil = w.time + 1;
  if (interrupt) w.eclipse.clean();
  w.time = Math.max(...hs.map((h) => h.until)) + 0.001;
  w.eclipse.stepEnemy(e, 0.01);
  return w;
}
test("continuous real pillar shadow grants phase only after complete valid source group", () => {
  for (const phase of [1, 2, 3])
    assert(shadowGroup(phase).challenge.eclipsePhases.has(phase));
  assert(!shadowGroup(1, 0).challenge.eclipsePhases.has(1));
  assert(!shadowGroup(1, -1, true).challenge.eclipsePhases.has(1));
  assert(!shadowGroup(3, -1, false, "A").challenge.eclipsePhases.has(3));
});
test("twelve openers each need three distinct legal pairs; repeated wins and settlement do not inflate progress", () => {
  const st = store(),
    p = new ProgressStore(st);
  let i = 0;
  for (const skill of ALL_WEAPONS.slice(0, 12))
    for (const pair of pairs(skill).slice(0, 3)) {
      const w = world();
      w.startingWeapon = skill;
      w.skills[skill] = 8;
      w.mods[skill] = pair;
      w.challenge.eclipsePhases = new Set([1, 2, 3]);
      w.state = "won";
      w.runId = "eclipse-" + i++;
      p.observe(w);
      const coins = p.coins;
      p.observe(w);
      assert.equal(p.coins, coins);
      if (i < 36) assert(!p.hasAchievement("eclipse_twelve_paths"));
    }
  assert(p.hasAchievement("eclipse_twelve_paths"));
  assert.equal(p.coins, 36 * 360);
  const q = new ProgressStore(st);
  assert(q.hasAchievement("eclipse_twelve_paths"));
  assert.equal(
    Object.values(q.data.eclipseQualified).filter((v) => v.length === 3).length,
    12,
  );
  const d = JSON.parse(st.getItem(PROGRESS_KEY));
  d.eclipseQualified.water.push("invalid+unknown");
  st.setItem(PROGRESS_KEY, JSON.stringify(d));
  st.m.delete(PROGRESS_KEY + "-backup");
  const r = new ProgressStore(st);
  assert(!r.data.eclipseQualified.water.includes("invalid+unknown"));
  assert.equal(r.coins, p.coins);
});
test("epic water changes glyph and field geometry; damage multiplier 2.05 exactly once, unchanged lifecycle", () => {
  const glyph = [],
    field = [];
  for (const grade of [1, 2, 3, 4]) {
    const g = new Graphics();
    drawWeaponGlyph(g, "water", grade);
    glyph.push(
      JSON.stringify(g.commands.map(({ op, d, width }) => ({ op, d, width }))),
    );
    const f = new Graphics();
    drawWaterFieldForm(f, 0, 0, 100, grade);
    field.push(
      JSON.stringify(f.commands.map(({ op, d, width }) => ({ op, d, width }))),
    );
  }
  assert.equal(new Set(glyph).size, 4);
  assert.notEqual(field[2], field[3]);
  for (const pair of pairs("water")) {
    const w = world();
    w.skills.water = 8;
    w.mods.water = pair;
    const base = weaponStats(w, "water");
    w.weaponGrades.water = 4;
    const s = weaponStats(w, "water");
    assert(Math.abs(s.damage / base.damage - 2.05) < 1e-9);
    for (const k of ["count", "radius", "duration", "cooldown", "range"])
      assert.equal(s[k], base[k]);
  }
});

test("pillar challenge ignores warning/floor/outer range and does not accept arena boundary as a pillar", () => {
  const f = sweep({ pivot: { x: 3, y: 8 }, angle: 0 });
  assert(!eclipseShadow(f, { x: 8.6, y: 8 }, 2));
  assert(!eclipseShadow(f, { x: 10, y: 8 }, 2.4));
  assert(!eclipseShadow(f, { x: 3.5, y: 8 }, 2.4));
  const wall = sweep({ pivot: { x: 20, y: 20 }, angle: 0 });
  assert(!eclipseShadow(wall, { x: 21.7, y: 20.49 }, 2.4));
});
test("failed/wrong-stage/missing-phase/damaged wins never add eclipse paths; manual save keeps epic grade and valid paths", () => {
  const st = store(),
    p = new ProgressStore(st);
  p.data.coins = 2520;
  for (const grade of [1, 2, 3])
    assert.equal(p.evolveWeapon("water", grade), "evolved");
  for (const mode of ["lost", "missing", "hit", "wrong"]) {
    const w = world();
    w.skills.water = 8;
    w.startingWeapon = "water";
    w.mods.water = pairs("water")[0];
    w.challenge.eclipsePhases = new Set(
      mode === "missing" ? [1, 3] : [1, 2, 3],
    );
    if (mode === "wrong") w.stageId = 13;
    if (mode === "hit") w.challenge.bossHits = 1;
    w.state = mode === "lost" ? "lost" : "won";
    p.observe(w);
  }
  assert.equal(Object.keys(p.data.eclipseQualified ?? {}).length, 0);
  p.data.eclipseQualified = { water: [pairs("water")[0].sort().join("+")] };
  for (const slot of [1, 2, 3]) {
    const entry = p.manualSaves[slot - 1];
    assert.equal(p.saveManual(slot, entry.token, p.data.revision), "saved");
  }
  const q = new ProgressStore(st);
  assert.equal(q.manualSaves.length, 3);
  const entry = q.manualSaves[1];
  assert.equal(q.loadManual(2, entry.token, q.data.revision), "loaded");
  assert.equal(q.weaponGrades.water, 4);
  assert.deepEqual(q.data.eclipseQualified, p.data.eclipseQualified);
});
