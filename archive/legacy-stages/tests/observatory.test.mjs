import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import {
  ObservatoryPath,
  starContains,
} from "../temp/tests/battle/ObservatoryPath.mjs";
import {
  ObservatoryDirector,
  observatoryRest,
  castStarTrace,
  castStarBlade,
  castStarLeap,
  stepObservatoryEnemy,
  stepObservatoryBoss,
  starAirborne,
  starHeight,
} from "../temp/tests/battle/ObservatorySystem.mjs";
import {
  observatoryBlocked,
  observatoryHeading,
  observatorySegment,
  resolveObservatory,
} from "../temp/tests/battle/ObservatoryMap.mjs";
import { stepEnemies, stepHazards } from "../temp/tests/battle/EnemySystem.mjs";
import { stepGarden } from "../temp/tests/battle/GardenMap.mjs";
import { crownAreaHit } from "../temp/tests/battle/CrownSystem.mjs";
import { ProgressStore } from "../temp/tests/platform/ProgressStore.mjs";
import { MAX_ENEMIES } from "../temp/tests/battle/SurvivalConfig.mjs";
const world = () => {
  const w = new SurvivalWorld(19, "ranger", 10);
  w.time = 10;
  w.director.elites = [true, true];
  return w;
};
const enemy = (w, k, x, y = 0) => {
  const e = w.addEnemy(k, x, y);
  e.state = "seek";
  e.attack = 0;
  e.visibleSince = 0;
  return e;
};
const path = (w) => {
  w.starPath.clear();
  w.starPath.sample(w.time - 1, { x: -2, y: 0 });
  w.starPath.sample(w.time - 0.5, { x: 0, y: 0 });
  w.starPath.sample(w.time, { x: 0, y: 2 });
};
test("two long bases preserve three lanes and both end routes, including boss navigation", () => {
  for (const x of [-17, 0, 17])
    for (let y = -26; y <= 26; y += 0.2) assert(!observatoryBlocked({ x, y }));
  for (const y of [-8, 8])
    for (let x = -22; x <= 22; x += 0.2) assert(!observatoryBlocked({ x, y }));
  const w = world(),
    e = enemy(w, "boss", -15),
    target = { x: 0, y: 0 };
  assert(observatorySegment(e, target));
  for (let i = 0; i < 1800 && Math.hypot(e.x, e.y) > 0.2; i++) {
    const a = observatoryHeading(e, target);
    e.x += (Math.cos(a) * 1.7) / 60;
    e.y += (Math.sin(a) * 1.7) / 60;
    resolveObservatory(e, 0.65);
    assert(!observatoryBlocked(e, 0.64));
  }
  assert(Math.hypot(e.x, e.y) < 0.3);
});
test("history remains bounded, prunes gaps and returns independent clipped segments", () => {
  const p = new ObservatoryPath();
  for (let i = 0; i < 1000; i++) p.sample(i / 60, { x: (i % 180) / 30, y: 0 });
  assert(p.points.length <= 4);
  const s = p.segments(2, () => true);
  assert(
    s.length && s.every((s) => Math.hypot(s.a.x - s.b.x, s.a.y - s.b.y) <= 3),
  );
  const x = s[0].a.x;
  p.points[1].x = -20;
  assert.equal(s[0].a.x, x);
  p.sample(100, { x: 0, y: 0 });
  assert.equal(p.points.length, 1);
  assert.equal(p.segments(2, () => true).length, 0);
  p.clear();
  assert.equal(p.points.length, 0);
  const q = new ObservatoryPath();
  q.sample(0, { x: -15, y: 0 });
  q.sample(0.5, { x: -7, y: 0 });
  assert.equal(q.segments(1, () => true).length, 0);
});
test("director teaches patrol before traces then leaps and respects all respite and caps", () => {
  const w = world(),
    d = new ObservatoryDirector();
  w.time = 30;
  d.step(w, 0, () => ({ x: 6, y: 0 }));
  w.enemies = [];
  w.time = 33;
  d.step(w, 3, () => ({ x: 6, y: 0 }));
  assert(w.enemies.some((e) => e.kind === "starpatrol"));
  assert(!w.enemies.some((e) => e.kind === "starweaver"));
  for (const [t, k] of [
    [75, "starweaver"],
    [125, "starpuppet"],
  ]) {
    const w = world();
    w.time = t;
    w.director.step(w, 0);
    assert(w.enemies.some((e) => e.kind === k));
    assert(
      w.enemies.every(
        (e) =>
          e.state === "arriving" &&
          e.timer >= 1 &&
          !observatoryBlocked(e, 0.35),
      ),
    );
  }
  for (const t of [164, 250, 330, 470]) {
    const w = world();
    w.time = t;
    assert(observatoryRest(t));
    w.director.step(w, 0);
    assert.equal(w.enemies.length, 0);
  }
  const q = world();
  q.time = 390;
  for (let i = 0; i < 3; i++)
    enemy(q, i % 2 ? "starpuppet" : "starweaver", 6, i);
  q.director.step(q, 0);
  assert.equal(
    q.enemies.filter((e) => e.kind === "starweaver" || e.kind === "starpuppet")
      .length,
    3,
  );
});
test("patrol locks its side target, freeze extends its window and never teleports", () => {
  const w = world(),
    d = new ObservatoryDirector();
  w.time = 30;
  d.step(w, 0, () => ({ x: 6, y: 0 }));
  w.enemies = [];
  w.time = 33;
  d.step(w, 3, () => ({ x: 6, y: 0 }));
  const e = w.enemies.find((e) => e.kind === "starpatrol");
  assert(e.starTarget);
  const target = { ...e.starTarget };
  e.state = "seek";
  w.player.y = 5;
  stepEnemies(w, 0.1);
  assert.deepEqual(e.starTarget, target);
  const old = { x: e.x, y: e.y },
    until = e.starUntil;
  w.slow(e, true);
  stepEnemies(w, 0.2);
  assert.equal(e.x, old.x);
  assert.equal(e.y, old.y);
  assert.equal(e.starUntil, until + 0.2);
});
test("two trace segments lock endpoints, share one hit and include rounded endpoints", () => {
  const w = world();
  path(w);
  const e = enemy(w, "boss", 5);
  assert.equal(castStarTrace(w, e, 2), "cast");
  assert.equal(w.hazards.length, 2);
  const saved = w.hazards.map((h) => ({ x: h.x, endX: h.endX, endY: h.endY }));
  w.starPath.clear();
  w.starPath.sample(20, { x: 10, y: 10 });
  assert.deepEqual(
    w.hazards.map((h) => ({ x: h.x, endX: h.endX, endY: h.endY })),
    saved,
  );
  const h = w.hazards[1],
    tip = { x: h.x - 0.6, y: h.y };
  assert(starContains(h, tip));
  assert(crownAreaHit(h, tip));
  assert(!starContains(h, { x: h.x - 0.7, y: h.y }));
  w.player = { x: 0, y: 0 };
  w.time = 11.59;
  stepHazards(w);
  assert.equal(w.hp, 100);
  w.time = 11.6;
  stepHazards(w);
  assert.equal(w.hp, 82);
  w.invulnerable = 0;
  stepHazards(w);
  assert.equal(w.hp, 82);
});
test("empty history skips trace, two-slot trace never partially queues, death cancels hazards", () => {
  const w = world(),
    e = enemy(w, "boss", 5);
  assert.equal(castStarTrace(w, e, 2), "empty");
  path(w);
  w.hazards = [{ until: 20 }];
  assert.equal(castStarTrace(w, e, 2), "blocked");
  assert.equal(w.hazards.length, 1);
  w.hazards = [];
  assert.equal(castStarTrace(w, e, 2), "cast");
  e.hp = 0;
  stepHazards(w);
  assert.equal(w.hazards.length, 0);
});
test("actual freeze API delays a weaver warning instead of canceling or firing it", () => {
  const w = world();
  path(w);
  const e = enemy(w, "starweaver", 5);
  assert.equal(castStarTrace(w, e), "cast");
  const h = w.hazards[0],
    due = h.due,
    timer = e.timer;
  w.slow(e, true);
  assert.equal(e.state, "windup");
  stepEnemies(w, 0.2);
  assert.equal(h.due, due + 0.2);
  assert.equal(e.timer, timer);
  w.player = { x: 0, y: 1 };
  w.time = due;
  stepHazards(w);
  assert.equal(w.hp, 100);
  e.freezeUntil = 0;
  e.x = w.player.x + 0.5;
  e.y = w.player.y;
  stepEnemies(w, 0);
  assert.equal(w.hazards.length, 0);
  assert.equal(e.state, "recover");
});
test("star blade uses a finite center-based capsule and full warning", () => {
  const w = world(),
    e = enemy(w, "boss", 4);
  w.player = { x: 0, y: 0 };
  w.lastMove = { x: 1, y: 0 };
  assert(castStarBlade(w, e));
  const h = w.hazards[0];
  assert(Math.abs(h.x) < 1e-9 && Math.abs(h.endX) < 1e-9);
  assert.equal(h.y, -3);
  assert.equal(h.endY, 3);
  assert.equal(h.due, 11.5);
  assert(!starContains(h, { x: 0, y: 4 }));
  assert(starContains(h, { x: 0, y: 3.4 }));
});
test("leap locks landing, has no airborne contact damage, lands once and exposes recovery", () => {
  const w = world(),
    e = enemy(w, "starpuppet", 5);
  assert(castStarLeap(w, e));
  const h = w.hazards[0];
  assert.equal(h.due, 11.65);
  assert.equal(e.leapEnd.x, 0);
  w.time = 11.3;
  stepObservatoryEnemy(w, e, 1.3);
  assert(starAirborne(e));
  w.time = 11.47;
  stepObservatoryEnemy(w, e, 0.17);
  assert(starHeight(e) > 40);
  assert.equal(w.hp, 100);
  w.player.x = 3;
  assert.equal(e.leapEnd.x, 0);
  w.player.x = 0;
  w.time = h.due;
  stepObservatoryEnemy(w, e, 0.18);
  assert.equal(e.x, 0);
  assert.equal(e.state, "recover");
  assert.equal(e.timer, 1.8);
  stepHazards(w);
  assert.equal(w.hp, 90);
  w.invulnerable = 0;
  stepHazards(w);
  assert.equal(w.hp, 90);
});
test("airborne freeze shifts landing time and collision permits crossing but never landing in a base", () => {
  const w = world(),
    e = enemy(w, "starpuppet", -13.4);
  w.player = { x: -8, y: 0 };
  assert(!castStarLeap(w, e));
  w.player = { x: -6.4, y: 0 };
  assert(castStarLeap(w, e));
  const landing = w.hazards[0];
  w.time = landing.due - 0.175;
  stepObservatoryEnemy(w, e, 1.3);
  assert(starAirborne(e));
  assert(observatoryBlocked(e));
  stepGarden(w, 0);
  assert(observatoryBlocked(e));
  w.time = landing.due;
  stepObservatoryEnemy(w, e, 0.175);
  assert(!observatoryBlocked(e, 0.34));
  const q = world(),
    f = enemy(q, "starpuppet", 5);
  assert(castStarLeap(q, f));
  const h = q.hazards[0];
  q.time = 11.3;
  stepObservatoryEnemy(q, f, 1.3);
  q.slow(f, true);
  const due = h.due,
    x = f.x;
  stepEnemies(q, 0.2);
  assert.equal(h.due, due + 0.2);
  assert.equal(f.x, x);
  q.time = due;
  stepHazards(q);
  assert.equal(q.hp, 100);
  f.freezeUntil = 0;
  f.x = 10;
  f.y = 0;
  stepGarden(q, 0);
  assert.equal(f.x, 10);
  f.state = "recover";
  stepGarden(q, 0);
  assert(!observatoryBlocked(f, 0.34));
});
test("boss transition clears old paths and hazards; second phase traces two complete warnings", () => {
  const w = world(),
    e = enemy(w, "boss", 5);
  path(w);
  castStarLeap(w, e);
  e.hp = e.maxHp * 0.49;
  stepObservatoryBoss(w, e, 0);
  assert.equal(e.bossPhase, 2);
  assert.equal(e.timer, 1.5);
  assert.equal(w.hazards.length, 0);
  assert.equal(w.starPath.points.length, 0);
  assert(!e.leapEnd);
  e.state = "seek";
  e.attack = 0;
  path(w);
  stepObservatoryBoss(w, e, 0);
  assert.equal(w.hazards.length, 2);
  assert(w.hazards.every((h) => h.due === 11.6 && h.created === 10));
});
test("boss does not stall on empty history or blocked leap and keeps stationary recovery", () => {
  const w = world(),
    e = enemy(w, "boss", 5);
  stepObservatoryBoss(w, e, 1 / 60);
  assert.equal(e.state, "recover");
  assert.equal(e.timer, 1.5);
  assert.equal(e.pattern, 1);
  const x = e.x;
  stepObservatoryBoss(w, e, 0.5);
  assert.equal(e.x, x);
  e.state = "seek";
  e.attack = 0;
  e.pattern = 2;
  w.player = { x: 22, y: 0 };
  for (let i = 0; i < 180 && e.state === "seek"; i++) {
    w.time += 1 / 60;
    stepObservatoryBoss(w, e, 1 / 60);
  }
  assert.equal(e.state, "recover");
  assert.equal(e.pattern, 3);
});
test("pause keeps history and flight timing frozen; boss entry resets history and special threats", () => {
  const w = world();
  path(w);
  const e = enemy(w, "starpuppet", 5);
  castStarLeap(w, e);
  w.pause("qa", true);
  const t = w.time,
    points = JSON.stringify(w.starPath.points),
    due = w.hazards[0].due;
  w.step(1);
  assert.equal(w.time, t);
  assert.equal(JSON.stringify(w.starPath.points), points);
  assert.equal(w.hazards[0].due, due);
  w.pause("qa", false);
  w.time = 480;
  w.director.step(w, 0);
  assert.equal(w.starPath.points.length, 0);
  assert(w.enemies.some((e) => e.kind === "boss"));
  assert(!w.enemies.some((e) => e.kind === "starpuppet"));
  const q = world();
  q.time = 400;
  for (let i = 0; i < MAX_ENEMIES; i++) enemy(q, "minion", 15, 15);
  q.director.step(q, 0);
  assert.equal(q.enemies.length, MAX_ENEMIES);
});
