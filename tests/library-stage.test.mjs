import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { LIBRARY_KINDS } from "../temp/tests/battle/LibrarySystem.mjs";
import { libraryMap, LIBRARY_BASES } from "../temp/tests/battle/LibraryMap.mjs";
import {
  libraryPosition,
  libraryCorners,
  libraryImpact,
  librarySealTime,
  librarySealGap,
  libraryRoundedEnter,
  libraryMove,
  libraryEscape,
  librarySolid,
} from "../temp/tests/battle/LibraryGeometry.mjs";
import {
  ENEMIES,
  ALL_WEAPONS,
  isElite,
} from "../temp/tests/battle/SurvivalConfig.mjs";
import { enemyArt } from "../temp/tests/presentation/art/EnemyCatalog.mjs";
import { battleHud } from "../temp/tests/presentation/BattleHud.mjs";
import {
  ProgressStore,
  PROGRESS_KEY,
} from "../temp/tests/platform/ProgressStore.mjs";
const world = () => {
  const w = new SurvivalWorld(31, "ranger", 10);
  w.player = { x: 0, y: 0 };
  w.camera = { ...w.player };
  w.hp = w.maxHp = 1e8;
  w.enemies = [];
  w.armory.step = () => {};
  w.director.step = () => {};
  return w;
};
const actor = (w, kind = "boss", x = -3, y = 0) => {
  const e = w.addEnemy(kind, x, y);
  e.state = "seek";
  e.attack = 0;
  w.library.state(e);
  return e;
};
const advance = (w, seconds) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) {
    w.step(1 / 60);
    w.drain();
  }
};
const cast = (kind = "sealclerk", action = "imprint", phase = 1) => {
  const w = world(),
    e = actor(w, kind);
  e.bossPhase = phase;
  e.library.action = action;
  assert(w.library.begin(e));
  assert(w.hazards.length > 0);
  return { w, e, h: w.hazards[0] };
};
test("tenth strategy registers six actors, shared obstacle data, independent book art and 100% elite base config", () => {
  const w = world();
  assert.equal(w.stageStrategy.map, libraryMap);
  assert.equal(LIBRARY_KINDS.length, 6);
  for (const k of [...LIBRARY_KINDS, "boss"])
    assert.equal(enemyArt(10, k).stage, 10);
  assert.equal(ENEMIES.sealprovost.health, 19);
  assert.equal(ENEMIES.claspjailer.health, 20);
  assert.equal(ENEMIES.sealprovost.contact, 20);
  assert.equal(ENEMIES.claspjailer.contact, 22);
});
test("circle against a rectangle uses round expanded corners, not phantom expanded-square corner hits", () => {
  const half = { x: 1, y: 1 };
  assert.equal(
    libraryRoundedEnter({ x: 1.29, y: 1.29 }, { x: 1.29, y: 1.29 }, half),
    null,
  );
  assert.equal(
    libraryRoundedEnter({ x: 1.2, y: 1.2 }, { x: 1.2, y: 1.2 }, half),
    0,
  );
  assert(libraryRoundedEnter({ x: -3, y: 0 }, { x: 3, y: 0 }, half) > 0);
});
test("imprint only hurts during its .25s rectangle, with continuous entry and exact rotated corners", () => {
  const { w, e, h } = cast();
  assert.equal(h.damage, 22);
  assert.equal(h.due, 1.9);
  assert(!libraryImpact(h, { x: 0, y: 0 }, h.due - 0.01));
  assert(libraryImpact(h, { x: 0, y: 0 }, h.due + 0.1) !== null);
  assert(
    libraryImpact(h, { x: 4, y: 0 }, h.due + 0.2, h.due, { x: -4, y: 0 }) !==
      null,
  );
  assert.equal(libraryImpact(h, { x: 0, y: 0 }, h.until + 0.1, h.until), null);
  h.angle = Math.PI / 4;
  const p = { x: 2.8 * Math.cos(h.angle), y: 2.8 * Math.sin(h.angle) };
  assert(libraryImpact(h, p, h.due + 0.1) !== null);
  const out = { x: 2.81 * Math.cos(h.angle), y: 2.81 * Math.sin(h.angle) };
  assert.equal(libraryImpact(h, out, h.due + 0.1), null);
});
test("single page keeps a fixed rectangular body, velocity and finite endpoint; old track has no damage", () => {
  const { w, e, h } = cast("folioray", "page");
  assert.equal(h.library.half.x, 0.25);
  assert.equal(h.library.half.y, 0.9);
  assert.equal(h.until - h.due, 6 / 3.6);
  const middle = libraryPosition(h, h.due + 0.5);
  assert(Math.abs(middle.x + 1.2) < 1e-8);
  assert.equal(libraryImpact(h, { x: -3, y: 0 }, h.due + 1, h.due + 0.9), null);
  assert(libraryImpact(h, { x: 0, y: 0 }, h.until, h.due) !== null);
  const locked = JSON.stringify(h);
  w.player = { x: 9, y: 8 };
  e.y = 5;
  assert.equal(JSON.stringify(h), locked);
});
test("two clamp entities independently reserve both slots, preserve true 1.3-wide end gap and support a stationary middle", () => {
  const { w, e, h } = cast("spineclasp", "clamp");
  assert.equal(w.library.slots, 2);
  const [a, b] = w.hazards,
    p = libraryPosition(a, a.until),
    q = libraryPosition(b, b.until);
  assert(Math.abs(Math.hypot(p.x - q.x, p.y - q.y) - 0.5 - 1.3) < 1e-8);
  for (const h of [a, b])
    assert.equal(libraryImpact(h, { x: 0, y: 0 }, h.until, h.due), null);
  const other = actor(w, "sealclerk", 3, 0);
  other.library.action = "imprint";
  assert(!w.library.begin(other));
  assert.equal(w.library.slots, 2);
});
test("full rotated sweep, not its center, is checked against bookshelves, world boundary and HUD", () => {
  const w = world(),
    e = actor(w, "folioray", -16, -10);
  w.player = { x: -9, y: -10 };
  w.camera = { x: -12, y: -10 };
  const h = w.library.page(e);
  assert(librarySolid(h));
  assert(!w.library.legal(h));
  w.player = { x: 0, y: 0 };
  w.camera = { x: 0, y: 0 };
  const imprint = w.library.imprint(e);
  imprint.y = 4;
  assert(!w.library.legal(imprint));
});
test("every published seal is in range, clear of its complete future sweep, visible and reachable with a pure dodge alternative", () => {
  for (const [kind, action] of [
    ["sealclerk", "imprint"],
    ["folioray", "page"],
    ["spineclasp", "clamp"],
    ["sealprovost", "pair"],
  ]) {
    const { w } = cast(kind, action);
    const hazards = w.hazards;
    for (const h of hazards) {
      const d = Math.hypot(h.library.seal.x, h.library.seal.y);
      assert(d >= 1.2 && d <= 3.2 + 1e-8);
      assert(librarySealGap(h, h.library.seal) >= 0.4 - 1e-8);
      assert(!libraryMap.blocked(h.library.seal, 0.5));
    }
    w.hazards = [];
    assert(libraryEscape(w, hazards));
    assert(libraryEscape(w, hazards, true));
  }
});
test("real player movement sweeps a seal even when a large frame crosses entirely through it", () => {
  const { w, e, h } = cast();
  const seal = { ...h.library.seal };
  w.time = 1;
  w.player = { x: seal.x, y: seal.y - 1 };
  w.setMove(0, 1);
  w.step(0.5);
  assert(h.library.cancelled && h.library.countered);
  assert.equal(w.library.stats.stepped, 1);
  assert.equal(w.library.slots, 0);
  assert.equal(e.state, "recover");
  assert.equal(w.hp, w.maxHp);
  w.step(0.1);
  assert.equal(w.library.stats.stepped, 1);
  assert.equal(w.xp, 0);
  assert.equal(w.gold, 0);
});
test("seal/release exact tie favors counter and a late footstep never cancels an emitted page", () => {
  const { w, h } = cast();
  const seal = h.library.seal;
  const a = { x: seal.x, y: seal.y - 2 },
    z = { x: seal.x, y: seal.y - 0.5 };
  const t = librarySealTime(h, a, z, h.due - 1, h.due);
  assert(Math.abs(t - h.due) < 1e-8);
  w.time = h.due;
  w.library.sample(a, z, h.due - 1, h.due);
  assert(h.library.countered);
  const { w: v, h: page } = cast("folioray", "page");
  v.time = page.due + 0.1;
  const p = page.library.seal;
  v.library.sample(p, p, page.due + 0.01, page.due + 0.1);
  assert(!page.library.cancelled);
  assert(page.fired);
  assert(!v.library.counter(page));
});
test("one sign cancels only its own pending entity and never retargets its sibling", () => {
  const { w, e } = cast("sealprovost", "pair"),
    [a, b] = w.hazards,
    snapshot = JSON.stringify({
      x: b.x,
      y: b.y,
      angle: b.angle,
      due: b.due,
      velocity: b.library.velocity,
    });
  w.library.counter(a);
  assert(a.library.cancelled);
  assert(!b.library.cancelled);
  assert.equal(w.library.slots, 1);
  assert.equal(
    snapshot,
    JSON.stringify({
      x: b.x,
      y: b.y,
      angle: b.angle,
      due: b.due,
      velocity: b.library.velocity,
    }),
  );
  assert.equal(e.state, "windup");
});
test("Boss counter adds at most .6 recovery seconds only after all remaining hazards have ended", () => {
  const { w, e } = cast("boss", "C");
  w.library.counter(w.hazards[0]);
  w.library.counter(w.hazards[1]);
  w.library.stepEnemy(e, 0);
  assert.equal(e.state, "recover");
  assert(Math.abs(e.timer - (3.8 * Math.pow(.9,6) + .6)) < 1e-8);
});
test("unfired plans and seals cancel on death or actual frost; emitted page remains finite", () => {
  for (const released of [false, true])
    for (const reason of ["death", "frost"]) {
      const { w, e, h } = cast("folioray", "page"),
        until = h.until;
      if (released) {
        w.time = h.due + 0.1;
        w.library.stepHazard(h);
      }
      if (reason === "death") {
        e.hp = 0;
        w.library.onDeath(e);
      } else {
        w.armory.extra.freeze(e, { stats: { duration: 1, mods: [] } });
        assert(e.freezeUntil > w.time);
        w.library.clean();
      }
      assert.equal(!!h.library.cancelled, !released);
      if (released) assert.equal(h.until, until);
    }
});
test("dead owner after page release never erases its last frame or permits repeat damage", () => {
  const { w, e, h } = cast("folioray", "page");
  w.time = h.due + 0.1;
  w.library.stepHazard(h);
  e.hp = 0;
  w.library.onDeath(e);
  w.player = libraryPosition(h, h.until);
  w.camera = { ...w.player };
  h.library.player = { ...w.player };
  w.time = h.until - 0.01;
  h.library.last = w.time;
  const hp = w.hp;
  w.step(0.05);
  assert(w.hp < hp);
  const after = w.hp;
  w.invulnerable = 0;
  w.library.stepHazard(h);
  assert.equal(w.hp, after);
});
test("same collision integrator samples a sliding path and cannot tunnel through any L-shaped bookcase", () => {
  for (const box of LIBRARY_BASES)
    for (const sign of [-1, 1]) {
      const p = { x: box.x + sign * (box.halfWidth + 0.31), y: box.y };
      if (libraryMap.blocked(p, 0.3)) continue;
      const path = [];
      libraryMove(p, { x: -sign * 4.2, y: 0.1 }, 1, 0.3, 1, (a, z) =>
        path.push([a, z]),
      );
      assert(!libraryMap.blocked(p, 0.299));
      assert(path.length > 20);
    }
  const edge = { x: 21.6, y: 25.6 };
  libraryMove(edge, { x: 5, y: 5 }, 1, 0.3, 1);
  assert(edge.x <= 21.7 && edge.y <= 25.7);
});
test("Boss changes phase at 70/35 without healing or health locks, and a big hit enters phase three once", () => {
  for (const ratio of [0.7, 0.35, 0.1]) {
    const w = world(),
      e = actor(w);
    e.hp = e.maxHp * ratio;
    const hp = e.hp;
    w.library.stepEnemy(e, 0.01);
    assert.equal(e.bossPhase, ratio > 0.35 ? 2 : 3);
    assert.equal(e.hp, hp);
    assert.equal(e.library.action, "transition");
    const next = e.library.next;
    w.library.stepEnemy(e, 0.1);
    assert.equal(e.library.next, next);
    w.hit(e, 100, "blade");
    assert(e.hp < hp);
  }
});
test("crossing second threshold during a transition upgrades target without starting a second transition clock", () => {
  const w = world(),
    e = actor(w);
  e.hp = e.maxHp * 0.69;
  w.library.stepEnemy(e, 0.01);
  const next = e.library.next;
  w.time += 0.5;
  e.hp = e.maxHp * 0.3;
  w.library.stepEnemy(e, 0.01);
  assert.equal(e.bossPhase, 3);
  assert.equal(e.library.next, next);
});
test("phase transition cancels pending second segment but waits for an already emitted page to finish", () => {
  const { w, e } = cast("boss", "B", 2);
  const [imprint, page] = w.hazards;
  w.time = page.due + 0.01;
  w.library.stepHazard(page);
  assert(page.fired);
  e.hp = e.maxHp * 0.3;
  const hp = e.hp;
  w.library.stepEnemy(e, 0.01);
  assert.equal(e.hp, hp);
  assert(!page.library.cancelled);
  assert(e.library.next >= page.until);
  const { w: v, e: b } = cast("boss", "B", 2);
  b.hp = b.maxHp * 0.3;
  v.library.stepEnemy(b, 0.01);
  assert(v.hazards.every((h) => h.library.cancelled));
});
test("all nine Boss phase/pattern combinations publish bounded locked plans with full warnings and exact phase-three timing", () => {
  for (const phase of [1, 2, 3])
    for (const action of ["A", "B", "C"]) {
      const { w, e } = cast("boss", action, phase);
      assert(w.library.slots <= 2);
      for (const h of w.hazards) {
        assert(h.due - h.created >= 1.9);
        assert(h.library.published === 0);
        assert(h.library.order >= 1);
      }
      if (phase === 3 && action === "B")
        assert(Math.abs(w.hazards[1].due - 2.3) < 1e-8);
      if (phase === 3 && action === "C") {
        assert(w.hazards.every((h) => h.damage === 28));
        const centers = w.hazards.map((h) => libraryPosition(h, h.until)),
          center = {
            x: (centers[0].x + centers[1].x) / 2,
            y: (centers[0].y + centers[1].y) / 2,
          };
        assert(Math.abs(Math.hypot(center.x, center.y) - 0.6) < 1e-8);
      }
    }
});
test("phase-three invalid timing and offset use only the declared safe fallback or cancel into recovery", () => {
  for (const action of ["B", "C"]) {
    const w = world(),
      e = actor(w);
    e.bossPhase = 3;
    e.library.action = action;
    const normal = w.library.validPlan.bind(w.library);
    let calls = 0;
    w.library.validPlan = (items) => (++calls === 1 ? false : normal(items));
    w.library.begin(e);
    assert.equal(w.library.stats.fallback, 1);
    assert(w.hazards.length === 2);
    if (action === "B") assert(Math.abs(w.hazards[1].due - 2.7) < 1e-8);
    else {
      const centers = w.hazards.map((h) => libraryPosition(h, h.until));
      assert(
        Math.hypot(centers[0].x + centers[1].x, centers[0].y + centers[1].y) <
          1e-8,
      );
    }
  }
});
test("actual Boss cycles perform all three actions in each phase and never leak a third slot", () => {
  for (const phase of [1, 2, 3]) {
    const w = world(),
      e = actor(w);
    e.bossPhase = phase;
    for (let i = 0; i < 100 * 60; i++) {
      w.camera = { ...w.player };
      w.step(1 / 60);
      w.drain();
      assert(w.library.slots <= 2);
    }
    for (const a of ["A", "B", "C"])
      assert(w.library.stats.patterns[a] > 0, `${a} phase ${phase}`);
  }
});
test("pause, upgrade and modification stop every sign, hazard and transition clock", () => {
  const { w } = cast("boss", "B", 2);
  const time = w.time,
    snapshot = JSON.stringify(w.hazards);
  for (const state of ["upgrade", "modification"]) {
    w.state = state;
    w.step(2);
    assert.equal(w.time, time);
  }
  w.state = "battle";
  w.pause("menu", true);
  w.step(2);
  assert.equal(w.time, time);
  assert.equal(JSON.stringify(w.hazards), snapshot);
});
test("director emits four full-health elites in three batches and preserves six-second return separation", () => {
  const w = world(),
    seen = [];
  for (let t = 0; t < 350; t++) {
    w.time = t;
    w.enemies = w.enemies.filter((e) => e.hp > 0 && isElite(e.kind));
    w.library.director(1);
    for (const e of w.enemies.filter(
      (e) => e.hp > 0 && isElite(e.kind) && !seen.some((s) => s.id === e.id),
    )) {
      seen.push({ id: e.id, kind: e.kind, t, hp: e.maxHp });
      if (seen.length <= 2) {
        e.hp = 0;
        w.library.onDeath(e);
      }
    }
  }
  assert.deepEqual(
    seen.map((e) => e.kind),
    ["sealprovost", "claspjailer", "sealprovost", "claspjailer"],
  );
  assert.deepEqual(
    seen.map((e) => e.t),
    [135, 225, 305, 311],
  );
  for (const s of seen) {
    const b = world();
    b.time = s.t;
    assert.equal(s.hp, b.addEnemy(s.kind).maxHp);
  }
  assert.equal(w.enemies.filter((e) => e.hp > 0 && isElite(e.kind)).length, 2);
});
test("late full-health returns defer without shortening spacing or emitting beyond deadline", () => {
  const w = world();
  w.time = 135;
  w.library.director(1);
  let a = w.enemies.find((e) => isElite(e.kind));
  a.hp = 0;
  w.library.onDeath(a);
  w.time = 225;
  w.enemies = [];
  w.library.director(1);
  a = w.enemies.find((e) => isElite(e.kind));
  w.time = 320;
  a.hp = 0;
  w.library.onDeath(a);
  w.enemies = [];
  for (const t of [325, 326, 327, 332]) {
    w.time = t;
    w.library.director(1);
    w.enemies = w.enemies.filter((e) => isElite(e.kind));
  }
  assert.equal(w.enemies.length, 2);
  assert(w.enemies[1].born - w.enemies[0].born >= 6);
  const v = world();
  v.time = 350;
  v.library.director(1);
  assert(!v.enemies.some((e) => isElite(e.kind)));
});
test("both elites get bounded turns without deleting either, sharing more than two slots or overlapping two double attacks", () => {
  const w = world();
  actor(w, "sealprovost");
  actor(w, "claspjailer", 3, 0);
  advance(w, 80);
  assert(w.library.stats.eliteCasts.sealprovost > 0);
  assert(w.library.stats.eliteCasts.claspjailer > 0);
  assert.equal(w.enemies.length, 2);
  assert(w.library.slots <= 2);
});
test("Boss arrival preserves both living elites and waits at least three seconds after final death", () => {
  const w = world(),
    a = actor(w, "sealprovost"),
    b = actor(w, "claspjailer", 3, 0);
  w.time = 360;
  w.library.director(0);
  const boss = w.enemies.find((e) => e.kind === "boss");
  assert(boss);
  boss.state = "seek";
  boss.attack = 0;
  w.library.stepEnemy(boss, 0.1);
  assert.equal(w.hazards.length, 0);
  a.hp = 0;
  w.library.onDeath(a);
  w.time = 362;
  w.library.stepEnemy(boss, 0.1);
  assert.equal(w.hazards.length, 0);
  b.hp = 0;
  w.library.onDeath(b);
  w.time = 364.9;
  w.library.stepEnemy(boss, 0.1);
  assert.equal(w.hazards.length, 0);
});
test("armor, fracture and recovery multipliers apply once for all twelve weapon damage sources", () => {
  for (const source of ALL_WEAPONS) {
    const w = world(),
      e = actor(w, "sealprovost");
    e.hp = e.maxHp = 1e5;
    w.hit(e, 100, source);
    assert.equal(e.hp, 99950);
    w.fracture(e, 2);
    w.hit(e, 100, source);
    assert.equal(e.hp, 99850);
    e.fractureUntil = 0;
    e.state = "recover";
    e.library.vulnerable = true;
    w.hit(e, 100, source);
    assert.equal(e.hp, 99750);
  }
});
test("third phase is named explicitly in the real HUD rather than falling back to a generic rage state", () => {
  const w = world(),
    e = actor(w);
  e.bossPhase = 3;
  const hud = battleHud(w, false, []);
  assert(hud.bossHealth.label.includes("第三阶段 III"));
});
test("stage ten opens from stage nine alone, retains old records and grants 280 once with its clear achievement", () => {
  const data = new Map(),
    storage = {
      getItem: (k) => data.get(k) || null,
      setItem: (k, v) => data.set(k, v),
    };
  const p = new ProgressStore(storage);
  assert(!p.unlockedStage(10));
  p.data.stages = [9];
  assert(p.unlockedStage(10));
  const w = world();
  w.state = "lost";
  p.observe(w);
  assert.equal(p.coins, 0);
  w.state = "won";
  p.observe(w);
  p.observe(w);
  assert.equal(p.coins, 280);
  assert(p.data.stages.includes(10));
  assert(p.hasAchievement("library_clear"));
  const restored = new ProgressStore(storage);
  assert.equal(restored.coins, 280);
  assert(restored.data.stages.includes(9) && restored.data.stages.includes(10));
});
