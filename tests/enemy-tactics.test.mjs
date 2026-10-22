import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { distance } from "../temp/tests/battle/SurvivalTypes.mjs";
import { stationaryProbe } from "../tools/check-boss-stationary.mjs";
const world = (stage = 16) => {
  const w = new SurvivalWorld(31, "ranger", stage);
  w.time = 400;
  w.enemies = [];
  w.player = { x: 0, y: 0 };
  return w;
};
test("some melee fodder take a bounded side approach while specialists retain their attack controller", () => {
  const w = world();
  let flank;
  for (let i = 0; i < 8; i++) {
    const e = w.addEnemy("gravegrub", -7, 0);
    if (w.enemyTactics.role(e) === "flank") flank = e;
  }
  assert(w.enemyTactics.step(flank, 0.1));
  assert(Math.abs(flank.y) > 0.001);
  assert(distance(flank, { x: -7, y: 0 }) < 0.3);
  w.time += 3;
  assert(!w.enemyTactics.step(flank, 0.1));
  const caster = w.addEnemy("ribwarden", -6, 0);
  assert.equal(w.enemyTactics.role(caster), "specialist");
  assert(!w.enemyTactics.step(caster, 0.1));
  flank.freezeUntil = w.time + 2;
  const before = { x: flank.x, y: flank.y };
  assert(!w.enemyTactics.step(flank, 0.1));
  assert.deepEqual({ x: flank.x, y: flank.y }, before);
});
test("a waiting elite changes flank only while both danger slots are occupied and adds no attack", () => {
  const w = world(),
    a = w.addEnemy("coffinregent", 4, 0),
    b = w.addEnemy("scarprelate", -5, 0);
  a.state = b.state = "seek";
  assert(!w.enemyTactics.step(b, 0.1));
  w.hazards = [
    { source: a.id, until: 500 },
    { source: a.id, until: 501 },
  ];
  assert(w.enemyTactics.step(b, 0.1));
  assert.equal(w.hazards.length, 2);
  assert(b.x > -5);
  b.state = "windup";
  const before = { x: b.x, y: b.y };
  assert(!w.enemyTactics.step(b, 0.1));
  assert.deepEqual({ x: b.x, y: b.y }, before);
});
test("boss positioning never moves a windup, frozen body or an actor with live warning chains", () => {
  const w = world(),
    e = w.addEnemy("boss", -4.8, 0);
  e.state = "seek";
  w.bossTactics.approach(e, 0.1);
  w.time += 11;
  for (const guard of ["windup", "freeze", "hazard"]) {
    e.state = guard === "windup" ? "windup" : "seek";
    e.freezeUntil = guard === "freeze" ? w.time + 1 : 0;
    w.hazards = guard === "hazard" ? [{ source: e.id, until: w.time + 3 }] : [];
    const before = { x: e.x, y: e.y };
    assert(!w.bossTactics.approach(e, 0.1));
    assert.deepEqual({ x: e.x, y: e.y }, before);
  }
});
test("grave boss selects a usable old-scar attack, yet still visits all three actions within its bag", () => {
  const w = world(),
    e = w.addEnemy("boss", -4, 0);
  e.state = "seek";
  e.attack = 0;
  e.grave.life = 2;
  e.bossPhase = 2;
  e.grave.scar = {
    x: -1,
    y: 0,
    angle: 0,
    radius: 4.2,
    half: 1,
    due: 390,
    end: 391,
    old: false,
    hit: false,
  };
  e.grave.scarUntil = 500;
  const actions = [];
  w.grave.begin = () => {
    actions.push(e.grave.action);
    return true;
  };
  for (let i = 0; i < 3; i++) {
    w.time += 0.1;
    w.grave.stepEnemy(e, 0.1);
  }
  assert.equal(actions[0], "B");
  assert.deepEqual([...actions].sort(), ["A", "B", "C"]);
});
for (const [stage, point, form] of [
  [4, { x: 20, y: 0 }, 2],
  [11, { x: -13, y: 12 }, 3],
  [12, { x: 20, y: 0 }, 3],
  [5, { x: 20, y: 0 }, 1],
  [6, { x: 20, y: 0 }, 1],
  [9, { x: 0, y: -24 }, 1],
  [13, { x: 20, y: 0 }, 1],
  [13, { x: 20, y: 0 }, 2],
  [13, { x: 20, y: 0 }, 3],
  [15, { x: 20, y: 0 }, 1],
  [16, { x: 0, y: 0 }, 1],
  [16, { x: 20, y: 24 }, 1],
  [16, { x: 20, y: 0 }, 2],
])
  test(`stationary pressure ${stage} form${form} at ${point.x},${point.y} requires an actual collision`, () => {
    const result = stationaryProbe(stage, point, 60, form);
    assert(result.hits > 0, JSON.stringify(result));
  });

test("completed edge dash snapshots cannot pin a seeking boss back to an old location", () => {
  const w=world(13),e=w.addEnemy("boss",4,0);
  const h={edge:{shape:"body",flights:[]}};
  e.edge={items:[h],origin:{x:-4,y:0}};
  e.state="seek";
  w.edge.syncBody(e);
  assert.equal(e.x,4);
});
