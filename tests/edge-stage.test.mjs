import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { ALL_WEAPONS, ENEMIES } from "../temp/tests/battle/SurvivalConfig.mjs";
import { edgeMap, EDGE_BASES } from "../temp/tests/battle/EdgeCourtMap.mjs";
import {
  edgeImpacts,
  edgePosition,
  edgeFlight,
  edgeCut,
  edgeSolid,
  edgeEscape,
} from "../temp/tests/battle/EdgeCourtGeometry.mjs";
import { stageGrowth } from "../temp/tests/battle/StageGrowth.mjs";
import { MODS, weaponStats } from "../temp/tests/battle/ArmoryConfig.mjs";
import {
  ProgressStore,
  PROGRESS_KEY,
} from "../temp/tests/platform/ProgressStore.mjs";
import {
  validGrade,
  nextGrade,
  weaponName,
} from "../temp/tests/battle/WeaponGrade.mjs";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { drawActorLayer } from "../temp/tests/presentation/art/EnemyPainter.mjs";
import { drawEdgeHazard } from "../temp/tests/presentation/art/EdgeCourtHazardArt.mjs";
import { drawWeaponGlyph } from "../temp/tests/presentation/art/WeaponGlyph.mjs";
import {
  drawGroundFields,
  drawProjectiles,
} from "../temp/tests/presentation/art/SpellPainter.mjs";
function world() {
  const w = new SurvivalWorld(41, "ranger", 13);
  w.player = { x: 0, y: 0 };
  w.camera = { x: 0, y: 0 };
  w.enemies = [];
  for (const s of ALL_WEAPONS) w.skills[s] = 0;
  return w;
}
function actor(w, kind = "boss", x = -3, y = 0) {
  const e = w.addEnemy(kind, x, y);
  e.state = "seek";
  e.attack = 0;
  return e;
}
function plans(w, action = "C", phase = 1) {
  const e = actor(w);
  e.bossPhase = phase;
  w.edge.state(e).action = action;
  return { e, items: w.edge.plan(e) };
}
function publish(w, action = "C", phase = 1) {
  const e = actor(w);
  e.bossPhase = phase;
  w.edge.state(e).action = action;
  assert(w.edge.begin(e));
  return { e, items: e.edge.items };
}
const storage = () => {
  const m = new Map();
  return {
    m,
    getItem: (k) => m.get(k) || null,
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
test("stage13 registers independently with formula HP, full elite health and prerequisite12", () => {
  const w = world();
  assert.equal(w.stageStrategy.map, edgeMap);
  assert.equal(new SurvivalWorld(41, "ranger", 13).player.y, -8);
  assert.equal(Math.round(actor(w).maxHp), 60450);
  w.time = 240;
  const e = actor(w, "twinclamp");
  assert.equal(ENEMIES.twinclamp.contact, 24);
  assert.equal(ENEMIES.edgepuppeteer.contact, 26);
  assert(Math.abs(e.maxHp - 30 * 1.8 * 21.6 * stageGrowth(13).elite) < 1e-8);
  const p = new ProgressStore(storage());
  assert(!p.unlockedStage(13));
  p.data.stages = [12];
  assert(p.unlockedStage(13));
});
test("all nine authored Boss variants use actual origins, max two slots and full independent warnings", () => {
  for (const phase of [1, 2, 3])
    for (const action of ["A", "B", "C"]) {
      const w = world(),
        { e, items } = plans(w, action, phase);
      assert(items.length <= 2);
      assert(items.every((h) => w.edge.legal(h)));
      assert(edgeEscape(w, items));
      for (const h of items) {
        assert(h.due - w.time >= 2.2);
        for (const f of h.edge.flights)
          assert(
            Math.hypot(f.to.x - f.from.x, f.to.y - f.from.y) <=
              (h.edge.shape === "body" ? 3.6 : 5.2) + 1e-8,
          );
      }
      const blade = items.find((h) => h.edge.shape === "blade"),
        body = items.find((h) => h.edge.shape === "body");
      if (blade) {
        assert(
          blade.edge.flights[1].due - blade.edge.flights[0].end >= 2 - 1e-9,
        );
        const origin = action === "B" ? body.edge.flights.at(-1).to : e;
        assert(Math.hypot(blade.x - origin.x, blade.y - origin.y) < 1e-8);
      }
      if (phase === 3 && action === "A")
        assert(items.every((h) => h.edge.shape === "blade"));
      if (body && body.edge.flights.length === 2)
        assert(
          body.edge.flights[1].due - body.edge.flights[0].end >= 2.2 - 1e-9,
        );
    }
});
test("blade warnings, parking and harmless link cannot hurt; only finite moving capsules do", () => {
  const w = world(),
    { items } = plans(w, "A"),
    h = items[0],
    f = h.edge.flights[0],
    back = h.edge.flights[1],
    mid = edgePosition(f, (f.due + f.end) / 2);
  assert.deepEqual(edgeImpacts(h, mid, f.due - 0.01, f.due - 0.1), []);
  assert.deepEqual(edgeImpacts(h, mid, (f.due + f.end) / 2), [0]);
  assert.deepEqual(edgeImpacts(h, f.to, back.due - 0.01, f.end), []);
  assert.equal(edgeFlight(h, f.end + 0.1), undefined);
  assert.deepEqual(edgeImpacts(h, { x: 0, y: 0 }, h.until + 0.1, h.until), []);
  const empty = { x: f.from.x, y: f.from.y + 2 };
  assert.deepEqual(edgeImpacts(h, empty, f.end, f.due), []);
});
test("rotated capsule edges, round end caps and large relative sweeps match exact bounds", () => {
  for (const angle of [0, 0.7, 1.3]) {
    const w = world(),
      { e } = plans(w, "A"),
      h = w.edge.plan(e, angle)[0],
      f = h.edge.flights[0],
      t = (f.due + f.end) / 2,
      p = edgePosition(f, t),
      nx = -Math.sin(f.angle),
      ny = Math.cos(f.angle);
    assert.deepEqual(
      edgeImpacts(h, { x: p.x + nx * 0.479, y: p.y + ny * 0.479 }, t),
      [0],
    );
    assert.deepEqual(
      edgeImpacts(h, { x: p.x + nx * 0.481, y: p.y + ny * 0.481 }, t),
      [],
    );
    assert.deepEqual(
      edgeImpacts(h, { x: p.x + nx * 2, y: p.y + ny * 2 }, f.end, f.due, {
        x: p.x - nx * 2,
        y: p.y - ny * 2,
      }),
      [0],
    );
  }
});
test("a blade attempts once per outgoing/return leg; Boss damage is attributed to owner", () => {
  const w = world(),
    { items } = publish(w, "A"),
    h = items[0],
    f = h.edge.flights[0];
  w.hp = w.maxHp = 500;
  w.player = edgePosition(f, (f.due + f.end) / 2);
  w.time = f.end;
  w.edge.sample(w.player, w.player, f.due, f.end);
  assert.equal(w.hp, 474);
  assert.equal(w.challenge.bossHits, 1);
  w.invulnerable = 0;
  w.edge.sample(w.player, w.player, f.due, f.end);
  assert.equal(w.hp, 474);
  const back = h.edge.flights[1];
  w.time = back.end;
  w.edge.sample(w.player, w.player, back.due, back.end);
  assert.equal(w.hp, 448);
});
test("real body follows authored dash positions and receives no duplicate normal contact", () => {
  const w = world(),
    { e, items } = publish(w),
    h = items.find((h) => h.edge.shape === "body"),
    f = h.edge.flights[0];
  w.time = (f.due + f.end) / 2;
  w.edge.stepEnemy(e, 0.05);
  assert(
    Math.hypot(
      e.x - edgePosition(f, w.time).x,
      e.y - edgePosition(f, w.time).y,
    ) < 1e-9,
  );
  const blade = items.find((h) => h.edge.shape === "blade");
  assert.deepEqual(blade.edge.flights[1].to, f.to);
  w.player = { x: e.x, y: e.y };
  const hp = w.hp;
  w.edge.stepEnemy(e, 0.05);
  assert.equal(w.hp, hp);
  assert.equal(e.state, "windup");
});
test("cancel before launch, during flight and parked removes future sources and preserves released blade leg", () => {
  for (const when of ["warning", "flight", "park"]) {
    const w = world(),
      { items } = plans(w, "A"),
      h = items[0],
      f = h.edge.flights[0];
    const time =
      when === "warning"
        ? f.due - 0.1
        : when === "flight"
          ? f.due + 0.2
          : f.end + 0.1;
    edgeCut(h, time);
    assert(h.edge.interrupted);
    assert(h.edge.flights[1].cancelled);
    assert.equal(!!h.edge.cancelled, when === "warning");
    if (when === "flight") {
      assert(!f.cancelled);
      assert.equal(h.until, f.end);
    } else assert(h.until <= time);
  }
});
test("freeze, phase skip and death cancel qualifications; current body finishes only while owner lives", () => {
  for (const mode of ["freeze", "transition", "death"]) {
    const w = world(),
      { e, items } = publish(w),
      body = items.find((h) => h.edge.shape === "body"),
      f = body.edge.flights[0];
    w.time = f.due + 0.1;
    if (mode === "freeze") {
      e.freezeUntil = w.time + 2;
      w.edge.clean();
      w.edge.stepEnemy(e, 0.05);
    } else if (mode === "transition") {
      e.hp = e.maxHp * 0.3;
      const hp = e.hp;
      w.edge.stepEnemy(e, 0.05);
      assert.equal(e.hp, hp);
      assert.equal(e.bossPhase, 3);
    } else {
      e.hp = 0;
      w.edge.onDeath(e);
    }
    assert(items.every((h) => h.edge.interrupted));
    assert.equal(!!f.cancelled, mode === "death");
    assert(!w.challenge.edgePhases.size);
    for (const h of items)
      for (const next of h.edge.flights)
        if (next.due > w.time) assert(next.cancelled);
  }
});
test("full group reserves parked blade capacity; rejecting third plan cannot partially publish", () => {
  const w = world(),
    { items } = publish(w);
  const h = items.find((h) => h.edge.shape === "blade");
  w.time = h.edge.flights[0].end + 0.1;
  assert.equal(w.edge.slots, 1);
  const x = actor(w, "edgepuppeteer");
  w.edge.state(x).action = "mixed";
  const count = w.hazards.length;
  assert(!w.edge.begin(x));
  assert.equal(w.hazards.length, count);
});
test("complete C then close-range real weapon hit qualifies published phase; damage, cancellation and late hits do not", () => {
  for (const mode of [
    "valid",
    "far",
    "late",
    "cancel",
    "damaged",
    "nonweapon",
  ]) {
    const w = world(),
      { e, items } = publish(w),
      until = Math.max(...items.map((h) => h.until));
    if (mode === "cancel") items[0].edge.interrupted = true;
    if (mode === "damaged") items[0].edge.damaged = true;
    w.time = until;
    w.edge.stepEnemy(e, 0.01);
    assert.equal(e.state, "recover");
    w.player = { x: e.x + (mode === "far" ? 3 : 1), y: e.y };
    if (mode === "late") w.time += 10;
    w.hit(e, 10, mode === "nonweapon" ? "enemy" : "water");
    assert.equal(w.challenge.edgePhases.has(1), mode === "valid");
  }
});
test("completed ordinary/elite attacks and Boss A/B cannot fabricate C-group mastery", () => {
  for (const [kind, action] of [
    ["boss", "A"],
    ["boss", "B"],
    ["edgepuppeteer", "mixed"],
    ["twinclamp", "pair"],
  ]) {
    const w = world(),
      e = actor(w, kind);
    w.edge.state(e).action = action;
    assert(w.edge.begin(e));
    w.time = Math.max(...e.edge.items.map((h) => h.until));
    w.edge.stepEnemy(e, 0.01);
    w.player = { x: e.x, y: e.y };
    w.hit(e, 1, "bone");
    assert(!w.challenge.edgePhases.size);
  }
});
test("wall and viewport validation never translates origins away from the actual body", () => {
  const w = world(),
    e = actor(w, "boss", -10, -11);
  w.edge.state(e).action = "C";
  assert(w.edge.plan(e).some(edgeSolid));
  const before = { x: e.x, y: e.y };
  const hs = w.edge.plan(e, Math.PI / 3);
  const blade = hs.find((h) => h.edge.shape === "blade");
  assert.deepEqual(blade.edge.flights[0].from, before);
  assert.deepEqual({ x: e.x, y: e.y }, before);
});
test("menus pause all flight clocks and movement cannot tunnel through any rack face", () => {
  const w = world();
  publish(w);
  w.pauses.add("upgrade");
  w.step(2);
  assert.equal(w.time, 0);
  for (const box of EDGE_BASES)
    for (const side of [-1, 1])
      for (const axis of ["x", "y"]) {
        const q = world();
        q.director.step = () => {};
        q.armory.step = () => {};
        const half = axis === "x" ? box.halfWidth : box.halfHeight;
        q.player = { x: box.x, y: box.y };
        q.player[axis] += side * (half + 0.31);
        q.setMove(axis === "x" ? -side : 0, axis === "y" ? -side : 0);
        q.step(1);
        assert(side * (q.player[axis] - box[axis]) >= half + 0.3 - 1e-8);
      }
});
function qualified(
  p,
  skill,
  pair,
  { phases = [1, 2, 3], hits = 0, stage = 13, state = "won" } = {},
) {
  const w = world();
  w.stageId = stage;
  w.startingWeapon = skill;
  w.skills[skill] = 8;
  w.mods[skill] = pair;
  w.challenge.edgePhases = new Set(phases);
  w.challenge.bossHits = hits;
  w.state = state;
  p.observe(w);
  return w;
}
test("twelve opener double-mod mastery needs 24 qualified wins and survives actual storage reopen", () => {
  const s = storage(),
    p = new ProgressStore(s);
  let last;
  for (const skill of ALL_WEAPONS.slice(0, 12)) {
    last = qualified(p, skill, pairs(skill)[0]);
    qualified(p, skill, pairs(skill)[0].slice().reverse());
    assert(!p.hasAchievement("edge_twelve_paths"));
    last = qualified(p, skill, pairs(skill)[1]);
  }
  assert(p.hasAchievement("edge_twelve_paths"));
  assert(p.hasAchievement("edgecourt_clear"));
  const coins = p.coins;
  p.observe(last);
  assert.equal(p.coins, coins);
  assert.deepEqual(
    new ProgressStore(s).data.edgeQualified,
    p.data.edgeQualified,
  );
  assert(!p.hasAchievement("kiln_ten_paths"));
  assert(!p.hasAchievement("triple_mastery"));
});
test("missed phase, wrong stage, Boss hit, failed run or corrupt pair cannot replace earned qualification", () => {
  const s = storage(),
    p = new ProgressStore(s);
  qualified(p, "water", pairs("water")[0]);
  for (const options of [
    { phases: [1, 2] },
    { hits: 1 },
    { stage: 12 },
    { state: "lost" },
  ])
    qualified(p, "water", pairs("water")[1], options);
  assert.equal(p.data.edgeQualified.water.length, 1);
  const d = JSON.parse(JSON.stringify(p.data));
  d.edgeQualified.water.push("bad+removed");
  s.setItem(PROGRESS_KEY, JSON.stringify(d));
  s.m.delete(PROGRESS_KEY + "-backup");
  const q = new ProgressStore(s);
  assert.equal(q.coins, p.coins);
  assert.deepEqual(q.data.edgeQualified.water, p.data.edgeQualified.water);
});
test("water has two paid evolutions, no epic charge, one pool slot and cold-saved transactions", () => {
  const s = storage(),
    p = new ProgressStore(s);
  p.data.coins = 1080;
  const count = p.availableWeapons.length;
  assert.equal(p.evolveWeapon("water", 1), "evolved");
  assert.equal(p.coins, 720);
  assert.equal(p.evolveWeapon("water", 2), "evolved");
  assert.equal(p.coins, 0);
  assert.equal(p.evolveWeapon("water", 3), "unavailable");
  assert(!validGrade("water", 4));
  assert.equal(nextGrade("water", p.weaponGrades), null);
  assert.equal(p.availableWeapons.length, count);
  assert.equal(new ProgressStore(s).weaponGrades.water, 3);
});
test("all legal water grade/mod snapshots change damage exactly once while preserving field lifecycle", () => {
  for (const pair of pairs("water")) {
    const w = world();
    w.skills.water = 8;
    w.mods.water = pair;
    const base = weaponStats(w, "water");
    for (const [grade, m] of [
      [2, 1.25],
      [3, 1.6],
    ]) {
      w.weaponGrades.water = grade;
      const s = weaponStats(w, "water");
      assert(Math.abs(s.damage / base.damage - m) < 1e-9);
      for (const k of ["radius", "cooldown", "duration", "count", "range"])
        assert.equal(s[k], base[k]);
    }
  }
});
test("edge art and three water forms differ in geometry and draw actual projectile/field states", () => {
  const shapes = [];
  for (const grade of [1, 2, 3]) {
    const g = new Graphics();
    drawWeaponGlyph(g, "water", grade);
    shapes.push(
      JSON.stringify(g.commands.map(({ op, d, width }) => ({ op, d, width }))),
    );
    const w = world();
    w.skills.water = 8;
    w.weaponGrades.water = grade;
    const e = actor(w, "scrapbound", 2, 0);
    e.hp = 1e6;
    w.armory.step(0);
    drawProjectiles(g, w, false);
    for (let i = 0; i < 31; i++) {
      w.time += 1 / 60;
      w.armory.step(1 / 60);
    }
    drawGroundFields(g, w, false);
    assert(g.vertexCount > 0);
  }
  assert.equal(new Set(shapes).size, 3);
  const w = world();
  for (const [i, k] of [
    "scrapbound",
    "edgecaster",
    "stepcutter",
    "reelstalker",
    "twinclamp",
    "edgepuppeteer",
  ].entries())
    actor(w, k, i * 2 - 5, 0);
  const g = new Graphics();
  drawActorLayer(g, w, false);
  const { items } = plans(w);
  for (const h of items)
    for (const t of [0, h.due + 0.2, h.until - 0.1]) drawEdgeHazard(g, h, t);
  assert(g.vertexCount > 0);
});
