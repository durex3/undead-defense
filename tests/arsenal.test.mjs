import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import {
  arsenalAura,
  arsenalRest,
  stepArsenalBoss,
} from "../temp/tests/battle/ArsenalSystem.mjs";
import {
  arsenalBlocked,
  arsenalSegment,
  arsenalHeading,
  resolveArsenal,
} from "../temp/tests/battle/ArsenalMap.mjs";
import { stepEnemies, stepHazards } from "../temp/tests/battle/EnemySystem.mjs";
import { ProgressStore } from "../temp/tests/platform/ProgressStore.mjs";
import { MAX_ENEMIES } from "../temp/tests/battle/SurvivalConfig.mjs";
const world = () => {
  const w = new SurvivalWorld(19, "ranger", 9);
  w.director.elites = [true, true];
  return w;
};
const enemy = (w, k, x, y = 0) => {
  const e = w.addEnemy(k, x, y);
  e.state = "seek";
  e.visibleSince = 0;
  e.attack = 0;
  return e;
};
test("arsenal sequential unlock and ninth best survive old-save reload", () => {
  const m = new Map(),
    storage = {
      getItem: (k) => m.get(k) || null,
      setItem: (k, v) => m.set(k, v),
    },
    p = new ProgressStore(storage);
  assert(!p.unlockedStage(9));
  const w = new SurvivalWorld(1, "ranger", 8);
  w.state = "won";
  p.observe(w);
  assert(p.unlockedStage(9));
  w.stageId = 9;
  p.observe(w);
  const q = new ProgressStore(storage);
  assert(q.data.stages.includes(9));
  assert(q.data.stageBest[9].won);
});
test("short racks preserve central and side lanes and guide enemies around ends", () => {
  for (const x of [-16, 0, 16])
    for (let y = -26; y < 26; y += 0.2) assert(!arsenalBlocked({ x, y }));
  assert(arsenalBlocked({ x: 9, y: 7 }));
  assert(!arsenalBlocked({ x: 9, y: 9 }));
  const w = world(),
    e = enemy(w, "boneguard", -14, -7),
    target = { x: 0, y: -7 };
  assert(arsenalSegment(e, target));
  for (
    let i = 0;
    i < 1500 && Math.hypot(e.x - target.x, e.y - target.y) > 0.2;
    i++
  ) {
    const a = arsenalHeading(e, target);
    e.x += (Math.cos(a) * 1.35) / 60;
    e.y += (Math.sin(a) * 1.35) / 60;
    resolveArsenal(e, 0.35);
    assert(!arsenalBlocked(e, 0.34));
  }
  assert(Math.hypot(e.x, e.y + 7) < 0.3);
});
test("arsenal teaches one new role at a time and respects rest and threat limits", () => {
  for (const [t, k] of [
    [30, "boneguard"],
    [60, "standardbearer"],
    [120, "crossbowman"],
  ]) {
    const w = world();
    w.time = t;
    w.director.step(w, 0);
    assert(w.enemies.some((e) => e.kind === k));
    assert(
      w.enemies.every(
        (e) =>
          e.state === "arriving" && e.timer >= 1 && !arsenalBlocked(e, 0.35),
      ),
    );
    for (const e of w.enemies.filter((e) =>
      ["standardbearer", "crossbowman"].includes(e.kind),
    ))
      assert(w.visible(e, 0.6) && Math.hypot(e.x, e.y) >= 6);
    if (t < 120) assert(!w.enemies.some((e) => e.kind === "crossbowman"));
  }
  for (const t of [164, 250, 330, 470]) {
    const w = world();
    w.time = t;
    assert(arsenalRest(t));
    w.director.step(w, 0);
    assert.equal(w.enemies.length, 0);
  }
  const w = world();
  w.time = 390;
  for (let i = 0; i < 3; i++)
    enemy(w, i % 2 ? "crossbowman" : "standardbearer", 7, i);
  w.director.step(w, 0);
  assert.equal(
    w.enemies.filter((e) => ["crossbowman", "standardbearer"].includes(e.kind))
      .length,
    3,
  );
});
test("flag aura never compounds, excludes elites, ends immediately on death or freeze", () => {
  const w = world();
  w.time = 10;
  const a = enemy(w, "standardbearer", 2),
    b = enemy(w, "standardbearer", -2),
    m = enemy(w, "minion", 0),
    elite = enemy(w, "charger", 0);
  a.state = b.state = "windup";
  a.timer = b.timer = 4;
  assert.equal(arsenalAura(w, m), 1.15);
  assert.equal(arsenalAura(w, elite), 1);
  assert.equal(arsenalAura(w, a), 1);
  a.hp = 0;
  b.freezeUntil = 11;
  assert.equal(arsenalAura(w, m), 1);
  b.freezeUntil = 0;
  m.x = 10;
  assert.equal(arsenalAura(w, m), 1);
});
test("standard cycles four-second support and moving regroup; approach cancels support", () => {
  const w = world();
  w.time = 10;
  const e = enemy(w, "standardbearer", 5);
  stepEnemies(w, 0);
  assert.equal(e.state, "windup");
  assert.equal(e.timer, 4);
  for (let i = 0; i < 241; i++) stepEnemies(w, 1 / 60);
  assert.equal(e.state, "recover");
  assert(e.timer > 1.9);
  const old = e.x;
  stepEnemies(w, 0.1);
  assert(e.x < old);
  e.state = "windup";
  e.timer = 3;
  e.x = 1;
  stepEnemies(w, 0);
  assert.equal(e.state, "recover");
  assert.equal(e.timer, 1.2);
});
test("crossbow locks its line, fixed damage hits once, fired projectile survives source death", () => {
  const w = world();
  w.time = 10;
  const e = enemy(w, "crossbowman", 5);
  stepEnemies(w, 0);
  const h = w.hazards[0];
  assert(h);
  assert.equal(h.due, 11.35);
  assert.equal(h.angle, Math.PI);
  assert.equal(h.damage, 10);
  w.player.y = 2;
  stepEnemies(w, 0.1);
  assert.equal(h.angle, Math.PI);
  w.player.y = 0;
  w.time = h.due + 0.1;
  stepHazards(w);
  assert(h.fired);
  e.hp = 0;
  w.time = h.due + 1.12;
  stepHazards(w);
  assert.equal(w.hp, 90);
  w.invulnerable = 0;
  stepHazards(w);
  assert.equal(w.hp, 90);
});
test("crossbow cancellation, full freeze delay and pause retain fair warning", () => {
  const w = world();
  w.time = 10;
  const e = enemy(w, "crossbowman", 5);
  stepEnemies(w, 0);
  const h = w.hazards[0];
  e.freezeUntil = 12;
  const due = h.due,
    timer = e.timer;
  stepEnemies(w, 0.5);
  assert.equal(h.due, due + 0.5);
  assert.equal(e.timer, timer);
  e.freezeUntil = 0;
  e.x = 1;
  stepEnemies(w, 0);
  assert.equal(w.hazards.length, 0);
  assert.equal(e.state, "recover");
  w.pause("qa", true);
  const time = w.time;
  w.step(1);
  assert.equal(w.time, time);
  const q = world();
  q.time = 10;
  const f = enemy(q, "crossbowman", 5);
  stepEnemies(q, 0);
  q.camera.x = -20;
  stepEnemies(q, 0.1);
  assert.equal(q.hazards.length, 0);
});
test("captain sweep locks direction, has fixed one-hit damage and 2.6s stationary recovery", () => {
  const w = world();
  w.time = 10;
  const b = enemy(w, "boss", 2);
  stepArsenalBoss(w, b, 0);
  const h = w.hazards[0];
  assert.equal(h.kind, "sector");
  assert.equal(h.due, 11.3);
  assert.equal(h.width, (Math.PI * 100) / 180);
  w.time = h.due;
  stepHazards(w);
  assert.equal(w.hp, 82);
  w.invulnerable = 0;
  stepHazards(w);
  assert.equal(w.hp, 82);
  stepArsenalBoss(w, b, 1.5);
  assert.equal(b.state, "recover");
  assert.equal(b.timer, 2.6);
  const x = b.x;
  stepArsenalBoss(w, b, 0.5);
  assert.equal(b.x, x);
});
test("captain phase transition clears flags, then second bolt relocks with full warning", () => {
  const w = world();
  w.time = 10;
  const b = enemy(w, "boss", 5);
  b.hp = b.maxHp * 0.49;
  const f = enemy(w, "warflag", 3);
  f.expires = 20;
  stepArsenalBoss(w, b, 0);
  assert.equal(b.bossPhase, 2);
  assert.equal(b.timer, 1.5);
  assert.equal(f.hp, 0);
  assert.equal(w.hazards.length, 0);
  b.state = "seek";
  b.attack = 0;
  b.pattern = 1;
  stepArsenalBoss(w, b, 0);
  const first = w.hazards[0];
  assert.equal(first.due, 11.4);
  w.time = first.until + 0.01;
  stepHazards(w);
  w.player.y = 2;
  stepArsenalBoss(w, b, 3.41);
  const second = w.hazards[0];
  assert(second);
  assert.equal(second.due, w.time + 1.4);
  assert.notEqual(second.angle, first.angle);
  assert.equal(b.combo, 1);
});
test("boss flag is capped, expires, affects only fodder and never grants kills or resources", () => {
  const w = world();
  w.time = 500;
  const b = enemy(w, "boss", 3);
  b.pattern = 2;
  stepArsenalBoss(w, b, 0);
  assert.equal(b.bossAction, "arsenalFlag");
  stepArsenalBoss(w, b, 1.2);
  const f = w.enemies.find((e) => e.kind === "warflag");
  assert(f && f.expires === 506);
  assert.equal(b.timer, 3);
  const m = enemy(w, "minion", 3, 1);
  assert.equal(arsenalAura(w, m), 1.15);
  assert.equal(arsenalAura(w, b), 1);
  const before = {
    kills: w.kills,
    gold: w.gold,
    gems: w.gems.length,
    potions: w.potions.length,
  };
  w.hit(f, 1e9, "ultimate", false);
  assert.equal(f.hp <= 0, true);
  assert.deepEqual(
    {
      kills: w.kills,
      gold: w.gold,
      gems: w.gems.length,
      potions: w.potions.length,
    },
    before,
  );
  const g = enemy(w, "warflag", 4);
  g.expires = 501;
  g.freezeUntil = 1000;
  w.time = 502;
  stepEnemies(w, 0);
  assert.equal(g.hp, 0);
});
test("boss flag skips safely at entity cap, attack waits at danger cap, boss entry removes old supports", () => {
  const w = world();
  w.time = 10;
  const b = enemy(w, "boss", 3);
  b.pattern = 2;
  stepArsenalBoss(w, b, 0);
  while (w.enemies.length < MAX_ENEMIES) enemy(w, "minion", 12, 12);
  stepArsenalBoss(w, b, 1.2);
  assert(!w.enemies.some((e) => e.kind === "warflag"));
  assert.equal(b.state, "recover");
  b.state = "seek";
  b.attack = 0;
  b.pattern = 1;
  w.hazards = [{ until: 20 }, { until: 20 }];
  stepArsenalBoss(w, b, 0);
  assert.equal(w.hazards.length, 2);
  assert.equal(b.state, "seek");
  const q = world();
  q.time = 470;
  enemy(q, "standardbearer", 4);
  enemy(q, "crossbowman", 5);
  q.time = 480;
  q.director.step(q, 0);
  assert.equal(q.enemies.filter((e) => e.kind === "boss").length, 1);
  assert(
    !q.enemies.some((e) =>
      ["standardbearer", "crossbowman", "warflag", "boneguard"].includes(
        e.kind,
      ),
    ),
  );
});
