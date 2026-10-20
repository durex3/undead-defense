import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import {
  tideMap,
  TIDE_BASES,
  TIDE_ROUTES,
  tideStop,
} from "../temp/tests/battle/TideMap.mjs";
import {
  tideStrips,
  tideHit,
  tideHead,
  tideEscape,
} from "../temp/tests/battle/TideGeometry.mjs";
import { TIDE_KINDS } from "../temp/tests/battle/TideSystem.mjs";
import { enemyArt } from "../temp/tests/presentation/art/EnemyCatalog.mjs";
import {
  ALL_WEAPONS,
  WEAPONS,
  ENEMIES,
} from "../temp/tests/battle/SurvivalConfig.mjs";
import {
  ProgressStore,
  PROGRESS_KEY,
} from "../temp/tests/platform/ProgressStore.mjs";
function world() {
  const w = new SurvivalWorld(31, "ranger", 6);
  w.enemies = [];
  w.player = { x: 0, y: 0 };
  w.camera = { ...w.player };
  w.armory.step = () => {};
  w.director.step = () => {};
  w.hp = w.maxHp = 1e8;
  return w;
}
function wave(w = world(), e = w.addEnemy("sluiceray", -3, 0)) {
  return w.tide.waveHazard(e, 0, 1);
}
function actor(w, kind = "boss", x = -3, y = 0) {
  const e = w.addEnemy(kind, x, y);
  e.state = "seek";
  e.attack = 0;
  w.tide.state(e);
  return e;
}
function step(w, n) {
  for (let i = 0; i < n * 60; i++) {
    w.camera = { ...w.player };
    w.step(1 / 60);
  }
}
test("sixth strategy, unique six actor kinds and wreck boss are registered", () => {
  const w = world();
  assert.equal(w.stageStrategy.map, tideMap);
  assert.equal(TIDE_KINDS.length, 6);
  for (const k of [...TIDE_KINDS, "boss"])
    assert.equal(enemyArt(6, k).stage, 6);
  assert.equal(ALL_WEAPONS.length, 14);
});
test("all crates block the player with large dt and all advertised routes are open", () => {
  const w = world();
  for (const p of TIDE_ROUTES) assert(!tideMap.blocked(p, 0.3));
  for (const b of TIDE_BASES) {
    w.player = { x: b.x - b.halfWidth - 0.6, y: b.y };
    w.move = { x: 1, y: 0 };
    w.step(2);
    assert(w.player.x <= b.x - b.halfWidth - 0.299);
  }
});
test("finite wave has no central safe gap, rear water and lateral exits are harmless", () => {
  const h = wave();
  assert(tideHit(h, { x: 0, y: 0 }, h.due + 3 / 2.2));
  assert(!tideHit(h, { x: -2, y: 0 }, h.due + 3 / 2.2));
  assert(!tideHit(h, { x: 0, y: 3.2 }, h.due + 3 / 2.2));
  assert(!tideHit(h, { x: 0, y: 0 }, h.due - 0.1));
});
test("moving circle sweeps correctly through thin live wave, including body radius", () => {
  const h = wave(),
    t = h.due + 1;
  assert(tideHit(h, { x: 1, y: 0 }, t, t - 0.05, 0.3, { x: -2, y: 0 }));
  assert(tideHit(h, { x: -0.9, y: 2.95 }, t, t - 0.01));
  assert(!tideHit(h, { x: -0.9, y: 3.11 }, t, t - 0.01));
});
test("warning movement is interpolated only after activation and cannot retroactively hit", () => {
  const h = wave();
  assert(
    !tideHit(h, { x: 1, y: 0 }, h.due + 0.01, h.due - 1, 0.3, { x: -5, y: 0 }),
  );
});
test("strips stop permanently at first crate, never reappear behind it", () => {
  const h = wave();
  h.x = 4;
  h.y = -9;
  h.radius = 14;
  h.until = h.due + 14 / 2.2;
  h.tide.from = { x: 4, y: -9 };
  h.tide.to = { x: 18, y: -9 };
  h.tide.stops = tideStrips(h.tide.from, 0, 2.8, 14);
  assert(h.tide.stops.every((x) => x <= 4.2 + 1e-6));
  assert(!tideHit(h, { x: 14, y: -9 }, h.due + 10 / 2.2, h.due + 9 / 2.2));
  assert(tideHit(h, { x: 7, y: -9 }, h.due + 3 / 2.2));
});
test("diagonal strip cross sections conservatively clip crates and world edge", () => {
  assert.equal(tideStop({ x: 8.2, y: -9 }, 0, 8), 0);
  assert(Math.abs(tideStop({ x: 20, y: 0 }, 0, 8) - 2.3) < 1e-6);
  const d = tideStop({ x: 7, y: -13 }, Math.PI / 4, 10, 0.5);
  assert(d < 10);
});
test("physical anchor clips crates but harpoon flies through and rope is harmless", () => {
  const w = world(),
    e = actor(w, "winchbeast");
  e.tide.points = [
    { x: 5, y: -9 },
    { x: 14, y: -9 },
    { x: 14, y: -6 },
  ];
  const hook = w.tide.hookHazard(e, 1);
  assert(hook.tide.stopped);
  assert(hook.tide.to.x <= 7.701);
  assert(!tideHit(hook, { x: 1, y: -5 }, hook.due + 0.5));
  w.player = { x: 14, y: -9 };
  e.x = 5;
  e.y = -9;
  const fork = w.tide.forkHazard(e, 1);
  assert.equal(fork.radius, 7);
  assert(fork.tide.to.x > 11.7);
  assert(tideHit(fork, { x: 10, y: -9 }, fork.due + 5 / 6));
});
test("two-slot reservation includes sequential attacks, excludes third danger", () => {
  const w = world(),
    e = actor(w),
    o = actor(w, "sluiceray", 2, 0);
  assert(w.tide.reserve(e, 2));
  assert(!w.tide.reserve(o, 1));
  assert.equal(w.tide.slots, 2);
});
test("freeze pauses physical hook, not emitted waves; death cancels pending and hook only", () => {
  const w = world(),
    e = actor(w, "winchbeast");
  e.tide.points = [
    { x: -2, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: -2 },
  ];
  const h = w.tide.hookHazard(e, 1),
    f = wave(w, e),
    p = wave(w, e);
  h.fired = f.fired = true;
  w.hazards = [h, f, p];
  e.freezeUntil = 10;
  const hd = h.due,
    fd = f.due;
  w.tide.stepEnemy(e, 0.5);
  assert.equal(h.due, hd + 0.5);
  assert.equal(f.due, fd);
  e.hp = 0;
  w.tide.onDeath(e);
  assert.equal(h.until, w.time);
  assert.equal(p.until, w.time);
  assert(f.until > w.time);
  assert.equal(w.tide.slots, 1);
});
test("sequential forks relock after the first finishes and retain warning time", () => {
  const w = world(),
    e = actor(w, "sailharpooner");
  e.tide.action = "fork";
  w.tide.begin(e);
  assert.equal(w.hazards.length, 1);
  const h = w.hazards[0];
  w.player.y = 3;
  w.time = e.tide.next;
  w.hazards = [];
  w.tide.advance(e);
  const second = w.hazards[0];
  assert(second);
  assert.equal(second.tide.order, 2);
  assert(Math.abs(second.due - w.time - 1.2) < 1e-6);
  assert(second.angle > h.angle);
});
test("blocked first anchor cancels turn; clear second leg has its own full warning", () => {
  const w = world(),
    e = actor(w, "winchbeast");
  e.tide.action = "hook";
  e.tide.step = 1;
  e.tide.blocked = true;
  w.tide.advance(e);
  assert.equal(w.hazards.length, 0);
  assert.equal(e.state, "recover");
  e.tide.blocked = false;
  e.tide.step = 1;
  e.tide.points = [
    { x: -2, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: -2 },
  ];
  w.tide.advance(e);
  assert.equal(w.hazards.length, 1);
  assert(Math.abs(w.hazards[0].due - w.time - 1.1) < 1e-6);
});
test("sixth wax armor exposes in elite recovery with the damage bonus applied once", () => {
  for (const k of ["twinlockwarden", "severedcrane"]) {
    const w = world(),
      e = actor(w, k);
    const hp = e.hp;
    w.hit(e, 100, "blade");
    assert.equal(hp - e.hp, 50);
    e.state = "recover";
    e.tide.vulnerable = true;
    const hp2 = e.hp;
    w.hit(e, 100, "fire");
    assert.equal(hp2 - e.hp, 100);
  }
});
test("boss patterns cycle under two dangers and phase change never heals", () => {
  const w = world(),
    e = actor(w);
  step(w, 100);
  assert(w.tide.stats.boss >= 3, JSON.stringify(w.tide.stats));
  assert(w.tide.stats.waves > 0);
  assert(w.tide.stats.forks > 0);
  assert(w.tide.stats.hooks > 0);
  assert(w.tide.slots <= 2);
  e.hp = e.maxHp * 0.5;
  const hp = e.hp;
  w.step(1 / 60);
  assert.equal(e.bossPhase, 2);
  assert.equal(e.hp, hp);
  assert.equal(e.tide.action, "transition");
  assert.equal(e.tide.preview, undefined);
});
test("ultimate fixes both wave origins before launch; phase two berth uses real movement", () => {
  const w = world(),
    e = actor(w);
  e.bossPhase = 2;
  e.tide.action = "C";
  w.tide.begin(e);
  assert(e.tide.preview);
  const second = e.tide.preview,
    from = { x: second.x, y: second.y },
    a = second.angle,
    at = { x: e.x, y: e.y };
  assert(e.tide.berth);
  w.time = w.hazards[0].due + 0.1;
  w.tide.stepEnemy(e, 1 / 60);
  const d = Math.hypot(e.x - at.x, e.y - at.y);
  assert(d > 0 && d <= 2 / 60 + 0.001);
  w.player = { x: 1, y: 1 };
  assert.deepEqual({ x: second.x, y: second.y }, from);
  assert.equal(second.angle, a);
});
test("invalid berth cancels relocation and second wave; no teleport or hidden retarget", () => {
  const w = world(),
    e = actor(w, "boss", -10, 4);
  w.player = { x: -6, y: 4 };
  w.camera = { ...w.player };
  e.bossPhase = 2;
  e.tide.action = "C";
  w.tide.begin(e);
  assert(e.tide.cancelSecond || e.state === "recover");
  if (e.tide.cancelSecond) {
    assert.equal(e.tide.preview, undefined);
    assert.equal(e.tide.berth, undefined);
  }
});
test("director teaches one type at a time and preserves live elite at boss arrival", () => {
  const w = new SurvivalWorld(73, "ranger", 6);
  w.enemies = [];
  w.time = 30;
  w.tide.director(1);
  assert(w.enemies.some((e) => e.kind === "sluiceray"));
  assert(!w.enemies.some((e) => e.kind === "sailharpooner"));
  w.time = 70;
  w.tide.director(10);
  assert(!w.enemies.some((e) => e.kind === "sailharpooner"));
  w.enemies = [];
  w.time = 359;
  const elite = actor(w, "severedcrane");
  w.time = 360;
  w.tide.director(0.05);
  assert(w.enemies.some((e) => e.kind === "boss"));
  const boss = w.enemies.find((e) => e.kind === "boss");
  boss.state = "seek";
  boss.attack = 0;
  w.tide.stepEnemy(boss, 0.05);
  assert.equal(w.tide.stats.boss, 0);
  elite.hp = 0;
  w.tide.onDeath(elite);
  w.time = 362.9;
  w.tide.director(0.05);
  w.tide.stepEnemy(boss, 0.05);
  assert.equal(w.tide.stats.boss, 0);
  w.time = 363.1;
  w.tide.director(0.05);
  assert(w.enemies.some((e) => e.kind === "boss"));
});
test("director entity cap 100 and special threat cap 6 hold without killing enemies", () => {
  const w = world();
  for (let i = 0; i < 7200; i++) {
    w.time = i * 0.05;
    w.tide.director(0.05);
    assert(w.enemies.length <= 100);
    assert(w.enemies.reduce((n, e) => n + ENEMIES[e.kind].threat, 0) <= 6);
  }
});
test("stage six opens by stage-five clear alone; 200 coins and completion are persisted once", () => {
  const m = new Map(),
    storage = {
      getItem: (k) => m.get(k) || null,
      setItem: (k, v) => m.set(k, v),
      removeItem: (k) => m.delete(k),
    },
    p = new ProgressStore(storage);
  p.data.stages = [1, 2, 3, 4, 5];
  assert(p.unlockedStage(6));
  assert(!p.unlockedWeapon("wheel"));
  assert(!p.unlockedWeapon("hammer"));
  const w = world();
  w.state = "won";
  w.time = 480;
  p.observe(w);
  assert.equal(p.coins, 200);
  assert(p.hasAchievement("tideworks_clear"));
  p.observe(w);
  assert.equal(p.coins, 200);
  const q = new ProgressStore(storage);
  assert(q.hasAchievement("tideworks_clear"));
  assert.deepEqual(q.data.stages, [1, 2, 3, 4, 5, 6]);
  assert.equal(q.availableWeapons.length, WEAPONS.length);
});

test("cancelled illegal boss beat advances the cycle; world-edge strips cannot respawn outside bounds", () => {
  const w = world(),
    e = actor(w);
  e.pattern = 1;
  w.tide.hookPlan = () => false;
  w.tide.stepEnemy(e, 1 / 60);
  assert.equal(e.state, "recover");
  assert.equal(e.pattern, 2);
  assert.equal(tideStop({ x: 23, y: 0 }, Math.PI / 2, 8), 0);
});
test("safe search rejects an entirely occupied escape area", () => {
  const w = world(),
    h = wave(w);
  for (let x = -3; x <= 3; x += 0.5)
    for (let y = -3; y <= 3; y += 0.5) {
      if (w.enemies.length >= 100) break;
      const e = w.addEnemy("brineporter", x, y);
      e.state = "seek";
    }
  assert(!tideEscape(w, [h]));
});

test("precision knife and execution ghost prioritize sixth-stage casters over nearby fodder", () => {
  for (const skill of ["blade", "ghost"])
    for (const kind of ["sluiceray", "sailharpooner", "winchbeast"]) {
      const w = world();
      actor(w, "brineporter", 1, 0);
      const e = actor(w, kind, 4, 0);
      w.skills[skill] = 8;
      w.mods[skill] = skill === "ghost" ? ["execution"] : ["hunt"];
      const s = { range: 8, mods: w.mods[skill] };
      assert.equal(
        (skill === "blade"
          ? w.armory.target(skill, s)
          : w.armory.extra.target(skill, s)
        ).id,
        e.id,
      );
    }
});
test("all twelve weapons can damage all sixth-stage bodies without an immunity or required unlock", () => {
  for (const k of [...TIDE_KINDS, "boss"])
    for (const skill of ALL_WEAPONS) {
      const w = world(),
        e = actor(w, k);
      const hp = e.hp;
      w.hit(e, 10, skill);
      const armor =
        k === "boss"
          ? 0.55
          : ["twinlockwarden", "severedcrane"].includes(k)
            ? 0.5
            : k === "brineporter"
              ? 0.2
              : 0.35;
      assert(Math.abs(hp - e.hp - 10 * (1 - armor)) < 1e-6, `${k}/${skill}`);
    }
});

test("sixth boss wax armor fractures before hits, expires and naturally exposes without a required weapon", () => {
  const w = world(),
    e = actor(w);
  const hit = (skill) => {
    const hp = e.hp;
    w.hit(e, 100, skill);
    return hp - e.hp;
  };
  assert.equal(hit("blade"), 45);
  w.fracture(e);
  assert.equal(hit("fire"), 80);
  w.fracture(e);
  assert.equal(hit("lightning"), 100);
  w.time = 3.01;
  assert.equal(hit("holy"), 45);
  e.state = "recover";
  e.tide.vulnerable = true;
  assert.equal(hit("blade"), 106.25);
  w.fracture(e);
  assert.equal(hit("water"), 106.25);
  w.fracture(e);
  assert.equal(hit("bone"), 125);
});
test("wax armor is identical for direct, ongoing, secondary and projectile damage on sixth stage", () => {
  const w = world(),
    e = actor(w, "sluiceray");
  for (const direct of [true, false])
    for (const ongoing of [true, false])
      for (const projectile of [true, false]) {
        const hp = e.hp;
        w.hit(
          e,
          10,
          "fire",
          false,
          w.player,
          direct,
          undefined,
          1,
          projectile,
          ongoing,
        );
        assert(Math.abs(hp - e.hp - 6.5) < 1e-6);
      }
});

test("hammer and wheel apply their first fracture before the same sixth-stage hit is armored", () => {
  for (const skill of ["hammer", "wheel"]) {
    const w = world(),
      e = actor(w),
      attack = { skill, x: 0, y: 0 };
    let hp = e.hp;
    w.armory.unlocked.hit(e, attack, 100, 1);
    assert.equal(hp - e.hp, 80);
    hp = e.hp;
    w.armory.unlocked.hit(e, attack, 100, 1);
    assert.equal(hp - e.hp, 100);
    assert.equal(e.fracture, 2);
  }
});
