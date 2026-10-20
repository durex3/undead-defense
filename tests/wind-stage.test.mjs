import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { WIND_KINDS } from "../temp/tests/battle/WindSystem.mjs";
import { windMap, WIND_BASES } from "../temp/tests/battle/WindMap.mjs";
import {
  windLengths,
  windCurve,
  windPosition,
  windVelocity,
  windMove,
  windHit,
  windEscape,
} from "../temp/tests/battle/WindGeometry.mjs";
import { ENEMIES, isElite } from "../temp/tests/battle/SurvivalConfig.mjs";
import { enemyArt } from "../temp/tests/presentation/art/EnemyCatalog.mjs";
import {
  ProgressStore,
  PROGRESS_KEY,
} from "../temp/tests/platform/ProgressStore.mjs";
function world() {
  const w = new SurvivalWorld(31, "ranger", 9);
  w.player = { x: 0, y: 0 };
  w.camera = { ...w.player };
  w.enemies = [];
  w.hp = w.maxHp = 1e8;
  w.armory.step = () => {};
  w.director.step = () => {};
  return w;
}
function actor(w, kind = "boss", x = -3, y = -0.5) {
  const e = w.addEnemy(kind, x, y);
  e.state = "seek";
  e.attack = 0;
  w.wind.state(e);
  return e;
}
function step(w, seconds) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) {
    w.step(1 / 60);
    w.drain();
  }
}
test("ninth stage registers six independent enemies, its own map, catalog and final elite damage", () => {
  const w = world();
  assert.equal(w.stageStrategy.map, windMap);
  assert.equal(WIND_KINDS.length, 6);
  for (const k of [...WIND_KINDS, "boss"])
    assert.equal(enemyArt(9, k).stage, 9);
  assert.equal(ENEMIES.windarbiter.contact, 20);
  assert.equal(ENEMIES.plumejudge.contact, 22);
  assert.equal(ENEMIES.windarbiter.health, 18);
});
test("adaptive curve has bounded deviation and distance-based traversal gives uniform speed", () => {
  const points = windCurve({ x: 0, y: 0 }, { x: 2, y: 1.4 }, { x: 4, y: 0 });
  assert(points.length > 20);
  const w = world(),
    e = actor(w, "sickleplumer", -4, 0),
    h = w.wind.feather(e);
  for (let t = h.due + 0.1; t < h.until - 0.2; t += 0.1) {
    const a = windPosition(h, t),
      b = windPosition(h, t + 0.01);
    assert(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 0.043) < 0.0001);
  }
  const data = JSON.stringify(h.wind.points);
  w.player = { x: 9, y: 7 };
  e.x = 4;
  assert.equal(JSON.stringify(h.wind.points), data);
});
test("wind is a finite zero-damage strip: base input forward 5, reverse 3.4 and no-input drift 2.08", () => {
  const w = world(),
    e = actor(w, "reedwhistler"),
    h = w.wind.windBand(e);
  w.hazards = [h];
  assert.deepEqual(windVelocity([h], { x: 0, y: 2 }, h.due + 0.1), {
    x: 0,
    y: 0,
  });
  for (const [input, expected] of [
    [4.2, 5],
    [-4.2, -3.4],
    [0, 0.8],
  ]) {
    const p = { x: 0, y: 0 };
    windMove(p, { x: input, y: 0 }, 0.1, 0.3, [h], h.due + 0.1);
    assert(Math.abs(p.x - expected * 0.1) < 1e-8);
  }
  const p = { x: 0, y: 0 };
  windMove(p, { x: 0, y: 0 }, 2.6, 0.3, [h], h.until);
  assert(Math.abs(p.x - 2.08) < 1e-8);
  assert(!windHit(h, p, h.due + 0.1));
  assert.equal(h.damage, 0);
});
test("actual wind pushes player and ground enemies but not rooted sources, shots or drops", () => {
  const w = world(),
    e = actor(w, "reedwhistler", -3, 0);
  e.wind.action = "wind";
  w.wind.begin(e);
  const h = w.hazards[0],
    root = { x: e.x, y: e.y };
  const chaser = actor(w, "fledglingeffigy", 1, 0);
  w.gems = [{ id: 999, x: 9, y: 0, value: 1 }];
  w.time = h.due + 0.1;
  const old = w.player.x;
  w.step(0.1);
  assert(w.player.x > old);
  assert.equal(e.x, root.x);
  assert.equal(e.y, root.y);
  assert(chaser.x < 1);
  assert.equal(w.gems[0].x, 9);
});
test("shared wind integration cannot push through any thin pillar or boundary, even with large dt", () => {
  for (const b of WIND_BASES) {
    for (const side of [-1, 1]) {
      const p = { x: b.x + side * (b.halfWidth + 0.31), y: b.y };
      windMove(p, { x: -side * 4.2, y: 0.4 }, 1, 0.3, [], 1);
      assert(!windMap.blocked(p, 0.299));
      assert(Math.abs(p.x - b.x) >= b.halfWidth + 0.299);
    }
  }
  const p = { x: 21.6, y: 25.6 };
  windMove(p, { x: 5, y: 5 }, 1, 0.3, [], 1);
  assert(p.x <= 21.7 && p.y <= 25.7);
});
test("curved feather only hits its moving head, never its complete warning curve or old tail", () => {
  const w = world(),
    e = actor(w, "sickleplumer", -4, 0),
    h = w.wind.feather(e);
  const end = h.wind.points.at(-1),
    mid = windPosition(h, (h.due + h.until) / 2);
  assert(!windHit(h, end, h.due + 0.01));
  assert(!windHit(h, mid, h.due - 0.1));
  assert(windHit(h, mid, (h.due + h.until) / 2 + 0.1, h.due));
  assert(!windHit(h, { x: -4, y: 0 }, h.until - 0.1, h.until - 0.2));
  assert(!windHit(h, mid, h.until + 0.1, h.until));
});
test("large frame crossing final feather position is processed once rather than removed before sweep", () => {
  const w = world(),
    e = actor(w, "sickleplumer", -3, 0),
    h = w.wind.feather(e);
  w.hazards = [h];
  e.immovable = true;
  e.wind.step = 1;
  e.wind.next = h.until + 1;
  w.time = h.due + 0.1;
  w.wind.stepHazard(h);
  w.player = { ...h.wind.points.at(-1) };
  w.time = h.until - 0.02;
  h.wind.player = { ...w.player };
  h.wind.last = w.time;
  const hp = w.hp;
  w.step(0.05);
  assert(w.hp < hp);
  const after = w.hp;
  w.invulnerable = 0;
  w.wind.stepHazard(h);
  assert.equal(w.hp, after);
});
test("curves and glides through pillars, hidden HUD extents or outside camera are rejected", () => {
  const w = world(),
    e = actor(w, "sickleplumer", -12, 5.5);
  w.player = { x: -6, y: 5.5 };
  w.camera = { x: -9, y: 5.5 };
  assert(!w.wind.legal(w.wind.feather(e)));
  w.player = { x: 0, y: 0 };
  w.camera = { x: 0, y: 0 };
  e.x = -3;
  e.y = 0;
  const h = w.wind.windBand(e);
  w.viewport = { x: 2, y: 2 };
  assert(!w.wind.legal(h));
});
test("glide declares both locked legs with a .35s bend pause and freezes in place", () => {
  const w = world(),
    e = actor(w, "foldedskimmer", -3, 0);
  e.wind.action = "glide";
  assert(w.wind.begin(e));
  const h = w.hazards[0],
    bendTime = h.due + h.wind.lengths[1] / 3.8;
  assert.deepEqual(
    windPosition(h, bendTime + 0.1),
    windPosition(h, bendTime + 0.3),
  );
  w.time = h.due + 0.2;
  w.wind.stepEnemy(e, 0.1);
  const old = { x: e.x, y: e.y };
  e.freezeUntil = w.time + 1;
  w.wind.clean();
  assert(h.wind.cancelled);
  assert.deepEqual({ x: e.x, y: e.y }, old);
  assert.equal(e.state, "recover");
});
test("actual frost can interrupt a rooted caster and the locked glide without moving it", () => {
  for (const action of ["wind", "glide"]) {
    const w = world(),
      e = actor(w, action === "wind" ? "reedwhistler" : "foldedskimmer", -3, 0);
    e.wind.action = action;
    w.wind.begin(e);
    const h = w.hazards[0];
    if (action === "glide") {
      w.time = h.due + 0.1;
      w.wind.stepEnemy(e, 0.1);
    }
    const old = { x: e.x, y: e.y };
    w.armory.extra.freeze(e, { stats: { duration: 1, mods: [] } });
    assert(e.freezeUntil > w.time);
    w.wind.clean();
    assert(h.wind.cancelled);
    assert.deepEqual({ x: e.x, y: e.y }, old);
  }
});
test("unreleased wind cancels on death, released wind and feather finish finite original life", () => {
  for (const action of ["wind", "feather"])
    for (const released of [false, true]) {
      const w = world(),
        e = actor(
          w,
          action === "wind" ? "reedwhistler" : "sickleplumer",
          -3,
          0,
        );
      e.wind.action = action;
      w.wind.begin(e);
      const h = w.hazards[0],
        until = h.until;
      if (released) {
        w.time = h.due + 0.1;
        w.wind.stepHazard(h);
      }
      e.hp = 0;
      w.wind.onDeath(e);
      assert.equal(!!h.wind.cancelled, !released);
      if (released) assert.equal(h.until, until);
    }
});
test("two-slot Boss plans reserve delayed parts; another wind cannot stack or acquire a third slot", () => {
  const w = world(),
    e = actor(w);
  e.wind.action = "C";
  assert(w.wind.begin(e));
  assert.equal(w.hazards.length, 2);
  assert.equal(w.wind.slots, 2);
  const [a, b] = w.hazards;
  assert.equal(a.wind.shape, "wind");
  assert.equal(b.wind.shape, "feather");
  assert(Math.abs(b.created - w.time - 0.8) < 1e-8);
  assert(Math.abs(b.due - b.created - 1.8) < 1e-8);
  const other = actor(w, "reedwhistler", 3, 0);
  other.wind.action = "wind";
  assert(!w.wind.begin(other));
  assert.equal(w.wind.slots, 2);
});
test("paired elites atomically publish both owners with delayed full warning; freezing either cancels pending dependency", () => {
  const w = world(),
    a = actor(w, "windarbiter", -3, 0),
    b = actor(w, "plumejudge", 3, 0);
  w.wind.stepEnemy(a, 0.01);
  assert.equal(w.wind.stats.pairs, 1);
  assert.equal(w.hazards.length, 2);
  const [wind, feather] = w.hazards;
  assert.notEqual(wind.source, feather.source);
  assert.equal(wind.wind.pair, feather.wind.pair);
  assert(Math.abs(feather.due - w.time - 2.5) < 1e-8);
  a.freezeUntil = w.time + 1;
  w.wind.clean();
  assert(wind.wind.cancelled && feather.wind.cancelled);
  assert.equal(w.wind.slots, 0);
});
test("already released paired wind remains finite while freezing judge cancels only unreleased feather", () => {
  const w = world(),
    a = actor(w, "windarbiter", -3, 0),
    b = actor(w, "plumejudge", 3, 0);
  w.wind.stepEnemy(a, 0.01);
  const [band, feather] = w.hazards;
  w.time = band.due + 0.1;
  w.wind.stepHazard(band);
  b.freezeUntil = w.time + 1;
  w.wind.clean();
  assert(!band.wind.cancelled);
  assert(feather.wind.cancelled);
});
test("Boss phase change cancels future plans and glide, preserves released finite wind, never heals", () => {
  const w = world(),
    e = actor(w);
  e.wind.action = "B";
  w.wind.begin(e);
  const [band, glide] = w.hazards;
  w.time = band.due + 0.1;
  w.wind.stepHazard(band);
  e.hp = e.maxHp * 0.5;
  const hp = e.hp;
  w.wind.stepEnemy(e, 0.1);
  assert.equal(e.hp, hp);
  assert.equal(e.bossPhase, 2);
  assert.equal(e.wind.action, "transition");
  assert(!band.wind.cancelled);
  assert(glide.wind.cancelled);
});
test("Boss A has two independently aimed feathers, fresh warning and .6s gap", () => {
  const w = world(),
    e = actor(w);
  e.wind.action = "A";
  w.wind.begin(e);
  const first = w.hazards[0];
  assert.equal(w.wind.slots, 2);
  w.time = first.until + 0.3;
  w.wind.stepEnemy(e, 0.1);
  assert.equal(w.hazards.length, 1);
  w.time = first.until + 0.61;
  w.wind.stepEnemy(e, 0.1);
  const second = w.hazards.find((h) => h.wind.order === 2);
  assert(second);
  assert(second.created >= first.until + 0.6);
  assert(second.due - second.created >= 1.79);
});
test("pause and upgrades stop wind and feather clocks", () => {
  const w = world(),
    e = actor(w);
  e.wind.action = "C";
  w.wind.begin(e);
  const time = w.time,
    snapshot = JSON.stringify(w.hazards);
  w.pause("test", true);
  w.step(2);
  assert.equal(w.time, time);
  assert.equal(JSON.stringify(w.hazards), snapshot);
  w.pause("test", false);
  w.state = "upgrade";
  w.step(2);
  assert.equal(w.time, time);
});
test("all four elite arrivals use 100% normal health, third pair is at least six seconds apart", () => {
  const w = world(),
    seen = [];
  w.director.step = (w, dt) => w.wind.director(dt);
  for (let t = 0; t < 350; t++) {
    w.time = t;
    w.enemies = w.enemies.filter((e) => e.hp > 0 && isElite(e.kind));
    w.wind.director(1);
    for (const e of w.enemies.filter(
      (e) => e.hp > 0 && isElite(e.kind) && !seen.some((s) => s.id === e.id),
    )) {
      seen.push({ id: e.id, kind: e.kind, time: t, hp: e.maxHp });
      if (seen.length <= 2) {
        e.hp = 0;
        w.wind.onDeath(e);
      }
    }
  }
  assert.deepEqual(
    seen.map((s) => s.kind),
    ["windarbiter", "plumejudge", "windarbiter", "plumejudge"],
  );
  assert.deepEqual(
    seen.map((s) => s.time),
    [135, 225, 305, 311],
  );
  for (const s of seen) {
    const baseline = world();
    baseline.time = s.time;
    assert.equal(s.hp, baseline.addEnemy(s.kind).maxHp);
  }
  assert.equal(w.enemies.filter((e) => e.hp > 0 && isElite(e.kind)).length, 2);
});
test("late first returns defer six seconds; no queued elite is emitted past 328/334 or in rest", () => {
  const w = world();
  w.time = 135;
  w.wind.director(1);
  let first = w.enemies.find((e) => isElite(e.kind));
  first.hp = 0;
  w.wind.onDeath(first);
  w.time = 225;
  w.enemies = [];
  w.wind.director(1);
  const second = w.enemies.find((e) => isElite(e.kind));
  w.time = 320;
  second.hp = 0;
  w.wind.onDeath(second);
  w.enemies = [];
  for (const t of [325, 326, 327, 331, 332]) {
    w.time = t;
    w.wind.director(1);
    w.enemies = w.enemies.filter((e) => isElite(e.kind));
  }
  const elites = w.enemies.filter((e) => e.hp > 0 && isElite(e.kind));
  assert.equal(elites.length, 2);
  assert(elites[1].born - elites[0].born >= 6);
  const late = world();
  late.time = 350;
  late.wind.director(1);
  assert(!late.enemies.some((e) => isElite(e.kind)));
});
test("Boss waits for both elites and at least three seconds after final death", () => {
  const w = world(),
    a = actor(w, "windarbiter"),
    b = actor(w, "plumejudge", 3, 0);
  w.time = 360;
  w.wind.director(0);
  const boss = w.enemies.find((e) => e.kind === "boss");
  assert(boss);
  boss.state = "seek";
  boss.attack = 0;
  w.wind.stepEnemy(boss, 0.1);
  assert.equal(w.hazards.length, 0);
  a.hp = 0;
  w.wind.onDeath(a);
  w.time = 362;
  w.wind.stepEnemy(boss, 0.1);
  assert.equal(w.hazards.length, 0);
  b.hp = 0;
  w.wind.onDeath(b);
  w.time = 364.9;
  w.wind.stepEnemy(boss, 0.1);
  assert.equal(w.hazards.length, 0);
});
test("ninth wax armor, fracture and recovery multiplier apply once", () => {
  const w = world(),
    e = actor(w, "sickleplumer", 2, 0);
  e.hp = e.maxHp = 1000;
  w.hit(e, 100, "blade");
  assert.equal(e.hp, 935);
  w.fracture(e);
  w.hit(e, 100, "blade");
  assert.equal(e.hp, 835);
  e.fracture = 0;
  e.fractureUntil = 0;
  e.state = "recover";
  e.wind.vulnerable = true;
  const old = e.hp;
  w.hit(e, 100, "blade");
  assert(Math.abs(old - e.hp - 80) < 1e-6);
});
test("stage nine unlocks from stage eight alone, grants 260 coins once and persists with its clear achievement", () => {
  const map = new Map(),
    storage = {
      getItem: (k) => map.get(k) || null,
      setItem: (k, v) => map.set(k, v),
    };
  const p = new ProgressStore(storage);
  assert(!p.unlockedStage(9));
  p.data.stages = [8];
  assert(p.unlockedStage(9));
  const w = world();
  w.state = "lost";
  p.observe(w);
  assert.equal(p.coins, 0);
  w.state = "won";
  p.observe(w);
  p.observe(w);
  assert.equal(p.coins, 260);
  assert(p.data.stages.includes(9));
  assert(p.hasAchievement("windcloister_clear"));
  const restored = new ProgressStore(storage);
  assert.equal(restored.coins, 260);
  assert(restored.data.stages.includes(9));
});
test("actual Boss loop performs A/B/C in both phases without exceeding two slots or endless windup", () => {
  for (const phase of [1, 2]) {
    const w = world(),
      e = actor(w);
    e.bossPhase = phase;
    for (let i = 0; i < 120 * 60; i++) {
      w.camera = { ...w.player };
      w.step(1 / 60);
      w.drain();
      assert(w.wind.slots <= 2);
    }
    for (const key of ["A", "B", "C"])
      assert(w.wind.stats.patterns[key] > 0, `${key} phase ${phase}`);
    assert(w.hazards.every((h) => Number.isFinite(h.until)));
  }
});
test("dual elite coordinator aligns independently recovering actors and produces real paired cycles", () => {
  const w = world(),
    a = actor(w, "windarbiter", -3, 0),
    b = actor(w, "plumejudge", 3, 0);
  a.attack = 1.3;
  b.attack = 3;
  step(w, 45);
  assert(w.wind.stats.pairs > 0);
  assert(w.wind.slots <= 2);
});
