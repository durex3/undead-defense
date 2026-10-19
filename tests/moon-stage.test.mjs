import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { stepEnemies, stepHazards } from "../temp/tests/battle/EnemySystem.mjs";
import { moonMap, MOON_BASES } from "../temp/tests/battle/MoonMap.mjs";
import {
  moonPose,
  moonContains,
  moonSwept,
  moonEscape,
  moonEnd,
} from "../temp/tests/battle/MoonGeometry.mjs";
import { ENEMIES, WEAPONS } from "../temp/tests/battle/SurvivalConfig.mjs";
import {
  ProgressStore,
  PROGRESS_KEY,
} from "../temp/tests/platform/ProgressStore.mjs";
const world = () => {
  const w = new SurvivalWorld(19, "ranger", 4);
  w.time = 160;
  w.level = 64;
  w.player = { x: 0, y: 0 };
  w.camera = { ...w.player };
  w.viewport = { x: 15, y: 12 };
  for (const k of WEAPONS) w.skills[k] = 0;
  return w;
};
const enemy = (w, kind, x = 4, y = 0) => {
  const e = w.addEnemy(kind, x, y);
  e.state = "seek";
  e.attack = 0;
  e.visibleSince = 0;
  return e;
};
const advance = (w, seconds, step = 1 / 60) => {
  for (let i = 0; i < Math.round(seconds / step); i++) {
    w.time += step;
    w.invulnerable = Math.max(0, w.invulnerable - step);
    stepEnemies(w, step);
    stepHazards(w);
  }
};
const motion = (shape = "blade") => ({
  shape,
  start: { x: -2, y: 0 },
  control: { x: 0, y: 2 },
  end: { x: 2, y: 0 },
  home: { x: -2, y: 1.8 },
  returnControl: { x: 0, y: 1 },
  due: 1,
  out: 1,
  hover: 0.95,
  back: 1,
  radius: 0.28,
  width: 0.22,
  angle: 0,
  turn: Math.PI / 2,
});
test("curved blade has actual point collision, silent hover, and immutable separate return", () => {
  const m = motion();
  assert.deepEqual(moonPose(m, 1.5).point, { x: 0, y: 1 });
  assert(moonContains(m, { x: 0, y: 1 }, 1.5));
  assert(!moonContains(m, { x: 2, y: 0 }, 1.5));
  assert(!moonContains(m, { x: 2, y: 0 }, 2.5));
  assert.equal(moonPose(m, 3.45).leg, 2);
  assert(!moonContains(m, m.home, moonEnd(m)));
});
test("sweep hurts only rotating radial blade, not whole preview sector; swept collision survives coarse step", () => {
  const m = motion("sweep");
  m.start = m.end = m.control = { x: 0, y: 0 };
  m.radius = 3.4;
  m.turn = Math.PI / 2;
  const a = Math.PI / 4,
    p = { x: 2 * Math.cos(a), y: 2 * Math.sin(a) };
  assert(!moonContains(m, p, 1.01));
  assert(moonContains(m, p, 1.5));
  assert(moonSwept(m, p, p, 1, 1.99));
  assert(!moonContains(m, { x: -2, y: 0 }, 1.5));
  assert(moonSwept(m, { x: 2, y: -2 }, { x: 2, y: 2 }, 1, 1.1));
});
test("six stumps leave central radius six clear and routes pass for both body sizes", () => {
  assert.equal(MOON_BASES.length, 6);
  assert(!moonMap.blocked({ x: 0, y: 0 }, 6));
  const w = world();
  for (const r of [0.3, 0.65])
    for (const b of MOON_BASES) {
      const e = enemy(w, "thornrunner", b.x - 4, b.y),
        target = { x: b.x + 4, y: b.y };
      for (
        let i = 0;
        i < 2400 && Math.hypot(e.x - target.x, e.y - target.y) > 0.2;
        i++
      ) {
        const a = moonMap.heading(e, target);
        e.x += Math.cos(a) * 0.03;
        e.y += Math.sin(a) * 0.03;
        moonMap.resolve(e, r);
        assert(!moonMap.blocked(e, r - 1e-5));
      }
      assert(Math.hypot(e.x - target.x, e.y - target.y) < 0.2);
    }
});
test("stage four unlock preserves prior records, backs up and retries writes", () => {
  const data = new Map();
  let fail = false;
  const storage = {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => {
      if (fail) throw Error("quota");
      data.set(k, v);
    },
    removeItem: (k) => data.delete(k),
  };
  let p = new ProgressStore(storage);
  assert(!p.unlockedStage(4));
  const w = world();
  w.state = "won";
  for (const id of [1, 2, 3]) {
    w.stageId = id;
    p.observe(w);
  }
  p = new ProgressStore(storage);
  assert(p.unlockedStage(4));
  const before = { ...p.data.stageBest };
  w.stageId = 4;
  p.observe(w);
  data.set(PROGRESS_KEY, "broken");
  p = new ProgressStore(storage);
  assert(p.data.stageBest[4].won);
  for (const id of [1, 2, 3])
    assert.deepEqual(p.data.stageBest[id], before[id]);
  fail = true;
  w.time = 170;
  p.observe(w);
  fail = false;
  p.observe(w);
  p = new ProgressStore(storage);
  assert(p.data.stageBest[4].won);
});
test("elite base multiplier applies once and ordinary growth stays capped", () => {
  assert.equal(ENEMIES.moonreaver.health, 20);
  assert.equal(ENEMIES.hornwarden.health, 24);
  assert.equal(ENEMIES.moonreaver.contact, 20);
  const w = world(),
    a = enemy(w, "thornrunner");
  w.time = 1000;
  assert.equal(enemy(w, "thornrunner").hp, a.hp);
});
test("prefire death cancels; emitted blades survive owner death, hit at most once per leg", () => {
  for (const launched of [false, true]) {
    const w = world(),
      e = enemy(w, "crescentmantis");
    assert(w.moon.start(e, "blades"));
    const h = w.hazards[0];
    if (launched) advance(w, 1.2);
    e.hp = 0;
    w.moon.onDeath(e);
    assert.equal(w.hazards.length, launched ? 1 : 0);
    if (launched) {
      assert.equal(w.moon.slots(), 1);
      const before = JSON.stringify(h.moon.motion);
      e.x = 20;
      e.y = 20;
      advance(w, 4);
      assert.equal(JSON.stringify(h.moon.motion), before);
      assert.equal(w.hazards.length, 0);
      assert.equal(w.moon.slots(), 0);
    }
  }
});
test("freeze delays full prefire warning but does not stop an emitted blade", () => {
  const w = world(),
    e = enemy(w, "crescentmantis");
  assert(w.moon.start(e, "blades"));
  let h = w.hazards[0],
    due = h.due;
  e.freezeUntil = w.time + 0.5;
  advance(w, 0.4);
  assert(h.due > due + 0.35);
  advance(w, 1.3);
  assert(h.moon.launched);
  const at = moonPose(h.moon.motion, w.time).point;
  e.freezeUntil = w.time + 1;
  advance(w, 0.2);
  assert.notDeepEqual(moonPose(h.moon.motion, w.time).point, at);
});
test("all seven attack sequences end in full recovery with at most two slots", () => {
  for (const [kind, action] of [
    ["crescentmantis", "blades"],
    ["vaultlynx", "leaps"],
    ["antlerprowler", "sweeps"],
    ["moonreaver", "blades"],
    ["hornwarden", "sweeps"],
    ["boss", "blades"],
    ["boss", "leaps"],
    ["boss", "sweeps"],
  ]) {
    const w = world(),
      e = enemy(w, kind);
    assert(w.moon.start(e, action), kind + action);
    let recovered = false,
      lastDanger = 0;
    for (let i = 0; i < 900; i++) {
      w.player = { x: -2, y: 2 };
      advance(w, 1 / 60);
      assert(w.moon.slots() <= 2);
      assert(w.hazards.length <= 2);
      lastDanger = Math.max(lastDanger, ...w.hazards.map((h) => h.until));
      if (e.state === "recover") {
        recovered = true;
        assert(e.timer >= e.moon.recovery - 1 / 60);
        assert(w.time >= lastDanger - 1 / 60);
        break;
      }
    }
    assert(recovered, kind + action + " stuck");
    assert(e.moon.vulnerable);
    assert.equal(w.moon.slots(), 0);
  }
});
test("jump stays targetable, locks landing, has no body contact and stops on death", () => {
  const w = world(),
    e = enemy(w, "vaultlynx");
  assert(w.moon.start(e, "leaps"));
  const p = { ...e.moon.jumpEnd };
  w.player = { x: 2, y: 2 };
  advance(w, 1.4);
  assert.equal(e.state, "charge");
  assert.deepEqual(e.moon.jumpEnd, p);
  const before = e.hp;
  w.hit(e, 10, "blade");
  assert(e.hp < before);
  assert.equal(w.hp, 100);
  e.hp = 0;
  w.moon.onDeath(e);
  assert.equal(w.hazards.length, 0);
  const z = world(),
    v = enemy(z, "vaultlynx", -15, -13);
  z.player = { x: -7, y: -13 };
  assert(!z.moon.start(v, "leaps"));
});
test("killing melee owner removes rotating blade; phase change keeps only emitted boomerangs", () => {
  const w = world(),
    e = enemy(w, "hornwarden");
  assert(w.moon.start(e, "sweeps"));
  advance(w, 1.5);
  e.hp = 0;
  w.moon.onDeath(e);
  assert.equal(w.hazards.length, 0);
  const z = world(),
    b = enemy(z, "boss");
  assert(z.moon.start(b, "blades"));
  advance(z, 1.4);
  b.hp = b.maxHp * 0.5;
  advance(z, 1 / 60);
  assert.equal(b.bossPhase, 2);
  assert.equal(b.moon.action, "transition");
  assert.equal(z.hazards.length, 1);
  assert(z.hazards[0].moon.launched);
  advance(z, 1.6);
  assert.equal(b.moon.action, "transition");
});
test("ordinary special starts are separated, teaching suppresses surviving prior type", () => {
  const w = world();
  w.time = 80;
  const old = enemy(w, "crescentmantis"),
    newer = enemy(w, "vaultlynx", -4, 0);
  advance(w, 1 / 60);
  assert.equal(old.state, "seek");
  assert.equal(newer.state, "windup");
  const next = enemy(w, "vaultlynx", 0, 4);
  advance(w, 0.5);
  assert.equal(next.state, "seek");
});
test("danger budget rejects third emitter even when the first owner died", () => {
  const w = world(),
    e = enemy(w, "moonreaver");
  assert(w.moon.start(e, "blades"));
  assert.equal(w.moon.slots(), 2);
  assert(!w.moon.start(enemy(w, "crescentmantis", -4, 0), "blades"));
  advance(w, 1.4);
  e.hp = 0;
  w.moon.onDeath(e);
  assert.equal(w.moon.slots(), 1);
});
test("pause and upgrade stop clocks; fixed simulation substeps keep same collision timing", () => {
  const w = world(),
    e = enemy(w, "crescentmantis");
  assert(w.moon.start(e, "blades"));
  const snapshot = JSON.stringify(w.hazards);
  w.pause("test", true);
  w.step(1);
  assert.equal(JSON.stringify(w.hazards), snapshot);
  w.pause("test", false);
  w.state = "upgrade";
  w.step(1);
  assert.equal(JSON.stringify(w.hazards), snapshot);
  const results = [];
  for (const batch of [1, 3]) {
    const z = world(),
      e = enemy(z, "crescentmantis");
    z.moon.start(e, "blades");
    for (let f = 0; f < 180 / batch; f++)
      for (let i = 0; i < batch; i++) advance(z, 1 / 60);
    results.push([z.hp, z.losses, JSON.stringify(z.hazards)]);
  }
  assert.deepEqual(results[0], results[1]);
});
test("offscreen sequence cancels before publication and escape sampler rejects a covered arena", () => {
  const w = world(),
    e = enemy(w, "boss");
  w.viewport = { x: 2, y: 2 };
  assert(!w.moon.start(e, "blades"));
  assert.equal(w.hazards.length, 0);
  assert.equal(e.state, "seek");
  const m = motion("landing");
  m.end = { x: 0, y: 0 };
  m.radius = 100;
  m.due = w.time + 0.5;
  m.out = 2;
  assert(!moonEscape(w, [m]));
});

test("moving sweep body and blade share a clock and reverse direction stays fixed across skill index increment", () => {
  const w = world(),
    e = enemy(w, "boss");
  assert(w.moon.start(e, "sweeps"));
  const first = w.hazards[0];
  e.pattern++;
  advance(w, 2);
  const pose = moonPose(first.moon.motion, w.time);
  assert(Math.hypot(e.x - pose.point.x, e.y - pose.point.y) < 1e-6);
  const turn = first.moon.motion.turn;
  advance(w, 2.5);
  const second = w.hazards.find((h) => h.source === e.id);
  assert(second);
  assert.equal(Math.sign(second.moon.motion.turn), -Math.sign(turn));
});
test("director preserves a surviving elite at boss arrival and waits through death rest", () => {
  const w = world();
  w.time = 479.99;
  const elite = enemy(w, "moonreaver", 7, 0);
  w.hp = w.maxHp = 1e9;
  w.step(0.02);
  const b = w.enemies.find((e) => e.kind === "boss");
  assert(b);
  assert(w.enemies.includes(elite));
  advance(w, 4);
  assert.equal(b.moon, undefined);
  elite.hp = 0;
  w.moon.onDeath(elite);
  advance(w, 5);
  assert.equal(b.moon, undefined);
  advance(w, 2);
  assert(b.moon);
});
test("director respects enemy, threat and elite caps without replaying skipped waves", () => {
  const w = world();
  w.hp = w.maxHp = 1e9;
  for (const time of [
    0, 35, 75, 115, 150, 175, 185, 235, 290, 300, 345, 355, 405, 460, 472, 480,
    520,
  ]) {
    w.time = time;
    w.moon.director(1 / 60);
    assert(w.enemies.length <= 100);
    assert(
      w.enemies.reduce(
        (s, e) => s + (e.hp > 0 ? ENEMIES[e.kind].threat : 0),
        0,
      ) <= 6,
    );
    assert(
      w.enemies.filter((e) => e.hp > 0 && ENEMIES[e.kind].elite).length <= 1,
    );
    assert(w.moon.slots() <= 2);
  }
});
test("boss reinforcements give half experience, no gold or potion; elite recovery exposes once", () => {
  const w = world(),
    e = enemy(w, "thornrunner");
  e.summoned = true;
  e.bossReinforcement = true;
  w.hit(e, 1e9, "blade");
  assert.equal(w.gold, 0);
  assert.equal(w.potions.length, 0);
  assert.equal(w.gems[0].value, ENEMIES.thornrunner.xp * 0.85 * 0.5);
  const z = world(),
    v = enemy(z, "moonreaver");
  v.state = "recover";
  v.moon = {
    action: "blades",
    step: 0,
    next: 0,
    recovery: 3,
    cooldown: 3,
    vulnerable: true,
  };
  const before = v.hp;
  z.hit(v, 100, "blade");
  assert.equal(before - v.hp, 125);
});
test("precision knife and hunter ghost prioritize the new ranged moon caster", () => {
  for (const skill of ["blade", "ghost"]) {
    const w = world();
    enemy(w, "thornrunner", 1, 0);
    const caster = enemy(w, "crescentmantis", 4, 0);
    w.skills[skill] = 8;
    w.mods[skill] = skill === "ghost" ? ["execution"] : ["hunt"];
    const stats = { range: 8, mods: w.mods[skill] };
    const picked =
      skill === "blade"
        ? w.armory.target(skill, stats)
        : w.armory.extra.target(skill, stats);
    assert.equal(picked.id, caster.id);
  }
});

test("claw impact covers its announced cone while antler sweep remains a thin moving blade", () => {
  const m = motion("claw");
  m.start = m.end = m.control = { x: 0, y: 0 };
  m.angle = -Math.PI / 4;
  m.turn = Math.PI / 2;
  m.radius = 2.3;
  assert(moonContains(m, { x: 2, y: 0 }, 1.01));
  assert(moonContains(m, { x: 1.4, y: 1.4 }, 1.01));
  assert(!moonContains(m, { x: -2, y: 0 }, 1.01));
  assert(!moonContains(m, { x: 2, y: 0 }, 0.9));
});
test("lynx keeps a legal jump distance while waiting for another special start", () => {
  const w = world(),
    first = enemy(w, "crescentmantis");
  assert(w.moon.start(first, "blades"));
  const lynx = enemy(w, "vaultlynx", -3.6, 0);
  advance(w, 3.5);
  assert(
    lynx.moon?.action === "leaps" ||
      Math.hypot(lynx.x - w.player.x, lynx.y - w.player.y) >= 3,
  );
});

test("arena edge does not become permanent immunity: warned return blades and landing still reach edge player", () => {
  for (const action of ["blades", "leaps"]) {
    const w = world();
    w.player = { x: 22, y: 0 };
    w.camera = { x: 10.67, y: 0 };
    w.viewport = { x: 16.23, y: 7.5 };
    const b = enemy(w, "boss", 18, 0);
    assert(w.moon.start(b, action), action + " edge start");
    const before = w.hp;
    for (let i = 0; i < 180; i++) advance(w, 1 / 60);
    assert(w.hp < before, action + " must threaten edge");
  }
});
