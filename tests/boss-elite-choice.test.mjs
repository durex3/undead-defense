import test from "node:test";
import assert from "node:assert/strict";
import { BossPlanChoice } from "../temp/tests/battle/BossPlanChoice.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
const world = (stage = 16) => {
  const w = new SurvivalWorld(31, "ranger", stage);
  w.time = 400;
  w.player = { x: 0, y: 0 };
  w.camera = { x: 0, y: 0 };
  w.viewport = { x: 16, y: 7.5 };
  return w;
};
test("boss selection excludes illegal plans, prefers coverage and preserves unused legal moves", () => {
  const c = new BossPlanChoice(),
    e = { bossPhase: 1 };
  const plan = (a) => [{ action: a, cover: a === "B" }];
  let p = c.choose(
    e,
    "A",
    plan,
    (items) => items[0].action !== "C",
    (items) => items[0].cover,
  );
  assert.equal(p.action, "B");
  c.commit(e, p.action);
  p = c.choose(
    e,
    "B",
    plan,
    (items) => items[0].action !== "C",
    (items) => items[0].cover,
  );
  assert.equal(p.action, "A");
  // Previews do not consume action history until a plan is actually published.
  assert.equal(
    c.choose(
      e,
      "B",
      plan,
      () => true,
      (items) => items[0].cover,
    ).action,
    "A",
  );
  c.commit(e, "A");
  p = c.choose(
    e,
    "A",
    plan,
    () => true,
    (items) => items[0].cover,
  );
  assert.equal(p.action, "C");
  e.bossPhase = 2;
  assert.equal(
    c.choose(
      e,
      "A",
      plan,
      () => true,
      (items) => items[0].cover,
    ).action,
    "B",
  );
});
test("no safe boss proposal leaves publication and fallback to the stage", () => {
  const c = new BossPlanChoice();
  assert.equal(
    c.choose(
      { bossPhase: 1 },
      "A",
      () => [{}],
      () => false,
      () => true,
    ),
    undefined,
  );
});
for (const [stage, system, field] of [
  [14, "eclipse", "eclipse"],
  [15, "lead", "lead"],
])
  test(`stage ${stage} proposal uses real legal geometry without mutating the actor or publishing warnings`, () => {
    const w = world(stage),
      e = w.addEnemy("boss", -3.8, 0);
    e.state = "seek";
    const s = w[system].state(e);
    s.action = "A";
    const before = JSON.stringify(e),
      p = w[system].selectBossPlan(e, "A");
    assert(p);
    assert.equal(JSON.stringify(e), before);
    assert.equal(w.hazards.length, 0);
    assert(p.items.every((h) => w[system].legal(h)));
    s.action = p.action;
    assert(w[system].begin(e, p.items));
    assert(w.hazards.length <= 2);
    assert(w.hazards.every((h) => h.due - w.time >= 2.4 - 1e-8));
  });
test("waiting elite uses the remaining slot only through its original attack controller", () => {
  const w = world(),
    a = w.addEnemy("coffinregent", 4, 0),
    b = w.addEnemy("scarprelate", -5, 0);
  a.state = b.state = "seek";
  w.hazards = [{ source: a.id, until: 410 }];
  b.attack = 0;
  assert(!w.enemyTactics.step(b, 0.1));
  b.attack = 1;
  assert(w.enemyTactics.step(b, 0.1));
  assert.equal(w.hazards.length, 1);
  w.time += 1.6;
  assert(!w.enemyTactics.step(b, 0.1));
  assert(w.enemyTactics.elites.stats.yields > 0);
});
test("waiting elite searches another side when the opposite point is blocked", () => {
  const w = world(12);
  w.player = { x: 19.5, y: -1 };
  const a = w.addEnemy("splitcrucible", 21, -1),
    b = w.addEnemy("glazejailer", 12, 4);
  a.state = b.state = "seek";
  w.hazards = [
    { source: a.id, until: 410 },
    { source: a.id, until: 410 },
  ];
  const p = w.enemyTactics.elites.goal(b);
  assert(p);
  assert(!w.stageStrategy.map.blocked(p, 0.7));
  assert(!w.stageStrategy.map.segment(p, w.player, 0.3));
});
test("library elites retain full attacks and reachable seals at the outer edge", () => {
  for (const [kind, action, position] of [
    ["sealprovost", "pair", { x: 21, y: 3 }],
    ["claspjailer", "clamp", { x: 16, y: 0 }],
  ]) {
    const w = world(10);
    w.player = { x: 20, y: 0 };
    w.camera = { x: 512 / 48, y: 0 };
    const e = w.addEnemy(kind, position.x, position.y);
    e.state = "seek";
    e.pattern = 2;
    w.library.state(e).action = action;
    assert(w.library.begin(e));
    assert.equal(w.hazards.length, 2);
    assert(w.hazards.every((h) => w.library.legal(h)));
    assert(
      w.hazards.every(
        (h) =>
          Math.hypot(h.library.seal.x - 20, h.library.seal.y) <= 3.2 + 1e-8,
      ),
    );
    assert(w.library.stats.fallback > 0);
  }
});
