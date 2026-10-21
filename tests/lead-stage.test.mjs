import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { ALL_WEAPONS, ENEMIES } from "../temp/tests/battle/SurvivalConfig.mjs";
import { leadMap } from "../temp/tests/battle/LeadFoundryMap.mjs";
import {
  leadPosition,
  leadImpact,
  leadCross,
  leadCut,
  leadEscape,
} from "../temp/tests/battle/LeadFoundryGeometry.mjs";
import { stageGrowth } from "../temp/tests/battle/StageGrowth.mjs";
import { MODS, weaponStats } from "../temp/tests/battle/ArmoryConfig.mjs";
import {
  ProgressStore,
  PROGRESS_KEY,
} from "../temp/tests/platform/ProgressStore.mjs";
import { validGrade, nextGrade } from "../temp/tests/battle/WeaponGrade.mjs";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { drawWeaponGlyph } from "../temp/tests/presentation/art/WeaponGlyph.mjs";
import { drawFireFieldForm } from "../temp/tests/presentation/art/WeaponFormArt.mjs";
import { drawActorLayer } from "../temp/tests/presentation/art/EnemyPainter.mjs";
import { drawLeadHazard } from "../temp/tests/presentation/art/LeadFoundryHazardArt.mjs";
function world() {
  const w = new SurvivalWorld(41, "ranger", 15);
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
function leg(props = {}) {
  return {
    from: { x: -1.2, y: 0 },
    to: { x: 1.2, y: 0 },
    launch: 1,
    due: 1.8,
    end: 1.96,
    mount: 0,
    index: 0,
    hit: false,
    ...props,
  };
}
const storage = () => {
  const m = new Map();
  return {
    m,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v),
  };
};
const pairs = (s) =>
  MODS[s].flatMap((a, i) =>
    MODS[s]
      .slice(i + 1)
      .filter((b) => a.excludes !== b.id && b.excludes !== a.id)
      .map((b) => [a.id, b.id]),
  );
test("stage15 formula HP, full elite health and prerequisite14", () => {
  const w = world();
  assert.equal(w.stageStrategy.map, leadMap);
  assert(Math.abs(actor(w).maxHp - 62435.02511512752) < 1e-8);
  assert.equal(new SurvivalWorld(1, "ranger", 15).player.y, -8);
  w.time = 240;
  assert(
    Math.abs(
      actor(w, "twinpitch").maxHp - 30 * 1.8 * 22.8 * stageGrowth(15).elite,
    ) < 1e-8,
  );
  assert.equal(ENEMIES.twinpitch.contact, 24);
  assert.equal(ENEMIES.presswarden.contact, 26);
  const p = new ProgressStore(storage());
  assert(!p.unlockedStage(15));
  p.data.stages = [14];
  assert(p.unlockedStage(15));
});
test("all nine Boss plans reserve max two chains with full warnings, real sources, legal whole-disk landings and base-speed escape", () => {
  for (const phase of [1, 2, 3])
    for (const action of ["A", "B", "C"]) {
      const w = world(),
        e = actor(w);
      e.bossPhase = phase;
      w.lead.state(e).action = action;
      assert(w.lead.begin(e), phase + action);
      const hs = e.lead.items;
      assert(hs.length <= 2);
      assert(hs.every((h) => w.lead.legal(h)));
      assert(leadEscape(w, hs));
      for (const h of hs) {
        assert(Math.hypot(h.x - e.x, h.y - e.y) <= 1.1 + 1e-9);
        for (const f of h.lead.legs) {
          assert(f.due >= 2.4 - 1e-9);
          assert(Math.abs(f.due - f.launch - 0.8) < 1e-9);
          assert(Math.abs(f.end - f.due - 0.16) < 1e-9);
          assert(!leadMap.blocked(f.to, 0.8));
        }
        assert.deepEqual(h.lead.legs[0].from, h.lead.origin);
      }
      const json = JSON.stringify(hs);
      e.x = 12;
      w.player.y = 9;
      assert.equal(JSON.stringify(hs), json);
    }
});
test("airborne actual ball, projection and future landing are harmless; only exact landing disk hurts", () => {
  const f = leg();
  assert(!leadImpact(f, f.to, 1.79));
  assert(!leadImpact(f, { x: 0, y: 0 }, 1.4));
  assert(leadImpact(f, { x: 2.3, y: 0 }, 1.8));
  assert(!leadImpact(f, { x: 2.3001, y: 0 }, 1.8));
  assert(!leadImpact(f, f.to, 1.96));
  assert(leadPosition(f, 1.4).z > 1.39);
});
test("continuous collision catches a low-frame landing without sweeping the airborne path into damage", () => {
  const f = leg();
  assert(leadImpact(f, f.to, 2.2, 1.2, f.to));
  assert(!leadImpact(f, { x: 0, y: 0 }, 1.7, 1.1, { x: 0, y: 0 }));
  assert(!leadImpact(f, { x: 5, y: 0 }, 1.8, 1.0, { x: -5, y: 0 }));
  assert(leadImpact(f, { x: 4, y: 0 }, 1.95, 1.81, { x: -2, y: 0 }));
});
test("near-body folded landing covers a stationary hugger, with normal full warning", () => {
  const w = world(),
    e = actor(w);
  w.lead.state(e).action = "B";
  const h = w.lead.plan(e)[0],
    f = h.lead.legs[0];
  assert(Math.hypot(f.to.x - e.x, f.to.y - e.y) < 1.1);
  assert(leadImpact(f, e, f.due));
  assert(!leadImpact(f, e, f.due - 0.001));
});
test("freeze/death before launch cancels all; airborne leg completes its original landing and cancels later jumps", () => {
  for (const where of ["preview", "air", "ground"]) {
    const w = world(),
      e = actor(w);
    w.lead.state(e).action = "B";
    assert(w.lead.begin(e));
    const h = e.lead.items[0],
      f = h.lead.legs[0];
    w.time =
      where === "preview"
        ? f.launch - 0.01
        : where === "air"
          ? f.launch + 0.1
          : f.due + 0.01;
    e.freezeUntil = w.time + 10;
    w.lead.clean();
    assert(h.lead.interrupted);
    assert(h.lead.legs.slice(1).every((f) => f.cancelled));
    if (where === "preview") assert(h.lead.cancelled);
    else {
      assert(!f.cancelled);
      assert.equal(h.until, f.end);
      w.time = f.end + 0.01;
      w.lead.stepEnemy(e, 0.01);
      assert.equal(e.state, "recover");
    }
  }
});
test("held ball is harmless and reverse flight receives its own 2.4 warning while retaining one slot", () => {
  const w = world(),
    e = actor(w);
  e.bossPhase = 2;
  w.lead.state(e).action = "A";
  assert(w.lead.begin(e));
  const h = e.lead.items[0],
    [a, b, c] = h.lead.legs;
  assert.equal(w.lead.slots, 1);
  assert(Math.abs(c.due - b.end - 2.4) < 1e-9);
  assert.deepEqual(c.from, b.to);
  assert(!leadImpact(c, b.to, b.end + 0.5));
  leadCut(h, b.end + 0.5);
  assert(c.cancelled);
  assert.equal(h.until, b.end + 0.5);
});
test("reservations are atomic; phase skipping does not heal and transition waits released landing", () => {
  const w = world(),
    e = actor(w);
  w.lead.state(e).action = "C";
  assert(w.lead.begin(e));
  const o = actor(w, "twinpitch", 1, 0);
  w.lead.state(o).action = "pair";
  assert(!w.lead.begin(o));
  assert.equal(w.hazards.length, 2);
  const f = e.lead.items[0].lead.legs[0];
  w.time = f.launch + 0.1;
  e.hp = e.maxHp * 0.3;
  const hp = e.hp;
  w.lead.stepEnemy(e, 0.05);
  assert.equal(e.bossPhase, 3);
  assert.equal(e.hp, hp);
  assert(e.lead.next >= f.end);
  assert(e.lead.next >= w.time + 1.5);
});
test("crossing requires an actual continuous change of side in one airborne height window, not standing nearby or cross-leg stitching", () => {
  const f = leg();
  let old = { x: 0, y: -0.462 };
  for (let t = 1.295; t <= 1.51 + 1e-8; t += 0.005) {
    const p = { x: 0, y: 4.2 * (t - 1.4) };
    leadCross(f, old, p, t - 0.005, t);
    old = p;
  }
  assert(f.crossed);
  const q = leg();
  leadCross(q, { x: 0, y: 0 }, { x: 0, y: 0 }, 1.25, 1.55);
  assert(!q.crossed);
  const r = leg();
  leadCross(r, { x: 5, y: -0.5 }, { x: 5, y: 0.5 }, 1.25, 1.55);
  assert(!r.crossed);
  const v = leg();
  leadCross(v, { x: 0, y: -0.5 }, { x: 0, y: 0.5 }, 1.01, 1.1);
  assert(!v.crossed);
  const z = leg();
  leadCross(z, { x: 0, y: -0.6 }, { x: 0, y: -0.46 }, 1.25, 1.28);
  leadCross(z, { x: 0, y: 0.46 }, { x: 0, y: 0.6 }, 1.5, 1.53);
  assert(!z.crossed);
});
function qualify(phase = 1, cancel = false, action = "C") {
  const w = world(),
    e = actor(w);
  e.bossPhase = phase;
  w.lead.state(e).action = action;
  assert(w.lead.begin(e));
  const h = e.lead.items[0],
    f = h.lead.legs[1],
    dx = f.to.x - f.from.x,
    dy = f.to.y - f.from.y,
    d = Math.hypot(dx, dy),
    n = { x: -dy / d, y: dx / d },
    mid = { x: (f.to.x + f.from.x) / 2, y: (f.to.y + f.from.y) / 2 };
  const start = f.launch + 0.29,
    stop = f.launch + 0.51,
    at = (t) => ({
      x: mid.x + n.x * 4.2 * (t - (f.launch + 0.4)),
      y: mid.y + n.y * 4.2 * (t - (f.launch + 0.4)),
    });
  let old = at(start);
  for (let t = start + 0.005; t <= stop + 1e-8; t += 0.005) {
    w.time = t;
    w.player = at(t);
    w.lead.sample(old, w.player, t - 0.005, t);
    old = { ...w.player };
  }
  assert(e.lead.earned);
  if (cancel) {
    e.freezeUntil = w.time + 1;
    w.lead.clean();
  }
  w.player = { x: 18, y: 20 };
  const end = Math.max(...e.lead.items.map((h) => h.until));
  while (w.time < end) {
    const old = w.time;
    w.time = Math.min(end, w.time + 0.02);
    w.lead.sample(w.player, w.player, old, w.time);
    w.lead.stepEnemy(e, w.time - old);
  }
  return w;
}
test("authored flight crossings commit only after full live group, with III restricted to C", () => {
  for (const phase of [1, 2, 3])
    assert(qualify(phase).challenge.leadPhases.has(phase));
  assert(!qualify(1, true).challenge.leadPhases.has(1));
  assert(!qualify(3, false, "A").challenge.leadPhases.has(3));
});
test("48 distinct legal opener/pair wins required, duplicate settlement and failure preserve correct progress and old records", () => {
  const s = storage(),
    p = new ProgressStore(s);
  let count = 0;
  for (const skill of ALL_WEAPONS.slice(0, 12))
    for (const pair of pairs(skill).slice(0, 4)) {
      const w = world();
      w.runId = "lead" + count++;
      w.state = "won";
      w.startingWeapon = skill;
      w.skills[skill] = 8;
      w.mods[skill] = pair;
      w.challenge.leadPhases = new Set([1, 2, 3]);
      p.observe(w);
      const coins = p.coins;
      p.observe(w);
      assert.equal(p.coins, coins);
      if (count < 48) assert(!p.hasAchievement("lead_twelve_paths"));
    }
  assert(p.hasAchievement("lead_twelve_paths"));
  assert.equal(p.coins, 48 * 380);
  const q = new ProgressStore(s);
  assert.equal(
    Object.values(q.data.leadQualified).filter((v) => v.length === 4).length,
    12,
  );
  const d = JSON.parse(s.getItem(PROGRESS_KEY));
  d.leadQualified.water.push("obsolete+unknown");
  s.setItem(PROGRESS_KEY, JSON.stringify(d));
  s.m.delete(PROGRESS_KEY + "-backup");
  const r = new ProgressStore(s);
  assert.equal(r.coins, p.coins);
  assert(!r.data.leadQualified.water.includes("obsolete+unknown"));
});
test("fire two paid grades, max rare/no epic charge, unchanged pool and atomic failed writes", () => {
  const s = storage(),
    p = new ProgressStore(s);
  p.data.coins = 1080;
  const n = p.availableWeapons.length;
  assert.equal(p.evolveWeapon("fire", 1), "evolved");
  assert.equal(p.evolveWeapon("fire", 2), "evolved");
  assert.equal(p.coins, 0);
  assert.equal(p.evolveWeapon("fire", 3), "unavailable");
  assert(!validGrade("fire", 4));
  assert.equal(nextGrade("fire", p.weaponGrades), null);
  assert.equal(p.availableWeapons.length, n);
  assert.equal(new ProgressStore(s).weaponGrades.fire, 3);
  const q = new ProgressStore({
    getItem: () => null,
    setItem: () => {
      throw Error("full");
    },
  });
  q.data.coins = 1080;
  assert.equal(q.evolveWeapon("fire", 1), "save-failed");
  assert.equal(q.coins, 1080);
});
test("all fire mods inherit damage exactly once and preserve cooldown/count/range/radius/duration", () => {
  for (const pair of pairs("fire")) {
    const w = world();
    w.skills.fire = 8;
    w.mods.fire = pair;
    const base = weaponStats(w, "fire");
    for (const [grade, m] of [
      [2, 1.25],
      [3, 1.6],
    ]) {
      w.weaponGrades.fire = grade;
      const s = weaponStats(w, "fire");
      assert(Math.abs(s.damage / base.damage - m) < 1e-9);
      for (const k of ["count", "radius", "range", "duration", "cooldown"])
        assert.equal(s[k], base[k]);
    }
  }
});
test("fire glyph and field shapes change geometrically; the faction and real ball state draw", () => {
  const glyph = [],
    field = [];
  for (const grade of [1, 2, 3]) {
    const g = new Graphics();
    drawWeaponGlyph(g, "fire", grade);
    glyph.push(
      JSON.stringify(g.commands.map(({ op, d, width }) => ({ op, d, width }))),
    );
    const f = new Graphics();
    drawFireFieldForm(f, 0, 0, 100, grade);
    field.push(JSON.stringify(f.commands));
  }
  assert.equal(new Set(glyph).size, 3);
  assert.notEqual(field[1], field[2]);
  const w = world(),
    e = actor(w);
  w.lead.state(e).action = "B";
  assert(w.lead.begin(e));
  const g = new Graphics();
  for (const t of [0, 1.9, 2.45, 2.9])
    for (const h of w.hazards) drawLeadHazard(g, h, t);
  for (const [i, k] of [
    "leadgrub",
    "pitchframe",
    "kneehopper",
    "offsetcart",
    "twinpitch",
    "presswarden",
  ].entries())
    actor(w, k, i * 2 - 6, 0);
  drawActorLayer(g, w, false);
  assert(g.vertexCount > 0);
});
test("each landing attempts damage once even when the previous iframe is removed", () => {
  const w = world(),
    e = actor(w);
  w.lead.state(e).action = "A";
  assert(w.lead.begin(e));
  const h = e.lead.items[0],
    f = h.lead.legs[0];
  w.player = { ...f.to };
  w.time = f.due;
  const before = w.hp;
  w.lead.sample(w.player, w.player, f.due, f.due);
  assert.equal(before - w.hp, 26);
  w.invulnerable = 0;
  w.time = f.due + 0.1;
  w.lead.sample(w.player, w.player, f.due, w.time);
  assert.equal(before - w.hp, 26);
  const next = h.lead.legs[1];
  w.player = { ...next.to };
  w.invulnerable = 0;
  w.time = next.due;
  w.lead.sample(w.player, w.player, next.due, next.due);
  assert.equal(before - w.hp, 52);
});
test("failed and incomplete wins do not add lead paths; all three manual slots retain the new grade and challenge field", () => {
  const st = storage(),
    p = new ProgressStore(st);
  p.data.coins = 1080;
  for (const g of [1, 2]) assert.equal(p.evolveWeapon("fire", g), "evolved");
  for (const mode of ["lost", "missing", "hit", "low-level", "bad-pair"]) {
    const w = world();
    w.skills.fire = mode === "low-level" ? 7 : 8;
    w.startingWeapon = "fire";
    w.mods.fire = mode === "bad-pair" ? ["heavy", "salvo"] : pairs("fire")[0];
    w.challenge.leadPhases = new Set(mode === "missing" ? [1, 3] : [1, 2, 3]);
    w.challenge.bossHits = mode === "hit" ? 1 : 0;
    w.state = mode === "lost" ? "lost" : "won";
    p.observe(w);
  }
  assert.deepEqual(p.data.leadQualified ?? {}, {});
  p.data.leadQualified = { fire: [pairs("fire")[0].sort().join("+")] };
  for (const slot of [1, 2, 3])
    assert.equal(
      p.saveManual(slot, p.manualSaves[slot - 1].token, p.data.revision),
      "saved",
    );
  const q = new ProgressStore(st),
    entry = q.manualSaves[1];
  assert.equal(q.loadManual(2, entry.token, q.data.revision), "loaded");
  assert.equal(q.weaponGrades.fire, 3);
  assert.deepEqual(q.data.leadQualified, p.data.leadQualified);
});
