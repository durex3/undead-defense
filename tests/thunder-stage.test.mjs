import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { stepEnemies, stepHazards } from "../temp/tests/battle/EnemySystem.mjs";
import { thunderMap, THUNDER_BASES } from "../temp/tests/battle/ThunderMap.mjs";
import {
  thunderContains,
  thunderEscape,
} from "../temp/tests/battle/ThunderGeometry.mjs";
import { thunderDevice } from "../temp/tests/battle/ThunderSystem.mjs";
import { ENEMIES, WEAPONS } from "../temp/tests/battle/SurvivalConfig.mjs";
import {
  ProgressStore,
  PROGRESS_KEY,
} from "../temp/tests/platform/ProgressStore.mjs";
const world = () => {
  const w = new SurvivalWorld(19, "ranger", 3);
  w.time = 160;
  w.player = { x: 0, y: 0 };
  w.camera = { ...w.player };
  for (const s of WEAPONS) w.skills[s] = 0;
  return w;
};
const enemy = (w, k, x = 4, y = 0) => {
  const e = w.addEnemy(k, x, y);
  e.visibleSince = 0;
  e.state = "seek";
  e.attack = 0;
  return e;
};
const advance = (w, seconds) => {
  for (let i = 0; i < Math.round(seconds * 100); i++) {
    w.time += 0.01;
    w.invulnerable = Math.max(0, w.invulnerable - 0.01);
    stepEnemies(w, 0.01);
    stepHazards(w);
  }
};
const start = (w, e, a) => {
  assert(w.thunder.start(e, a), `${a} must start`);
  return e.thunder;
};
test("stage three preserves two-stage saves and unlocks only after stage two, including backup", () => {
  const m = new Map(),
    storage = {
      getItem: (k) => m.get(k) || null,
      setItem: (k, v) => m.set(k, v),
      removeItem: (k) => m.delete(k),
    };
  let p = new ProgressStore(storage);
  assert(!p.unlockedStage(3));
  const w = world();
  w.stageId = 1;
  w.state = "won";
  p.observe(w);
  assert(!p.unlockedStage(3));
  w.stageId = 2;
  p.observe(w);
  const prior = JSON.parse(m.get(PROGRESS_KEY));
  p = new ProgressStore(storage);
  assert(p.unlockedStage(3));
  assert.deepEqual(p.data.stages, [1, 2]);
  assert.deepEqual(p.data.stageBest, prior.stageBest);
  w.stageId = 3;
  p.observe(w);
  m.set(PROGRESS_KEY, "broken");
  const q = new ProgressStore(storage);
  assert(q.data.stageBest[3].won);
  assert.deepEqual(q.data.stages, [1, 2, 3]);
  assert.equal(ENEMIES.gridwarden.health, 20);
  assert.equal(ENEMIES.railreaper.contact, 22);
});
test("four bases leave clear center and navigable routes for player and boss radii", () => {
  assert.equal(THUNDER_BASES.length, 4);
  assert(!thunderMap.blocked({ x: 0, y: 0 }, 6));
  const w = world();
  for (const radius of [0.3, 0.65])
    for (const base of THUNDER_BASES) {
      const e = enemy(w, "rivetwalker", base.x - 4, base.y),
        target = { x: base.x + 4, y: base.y };
      for (
        let i = 0;
        i < 2400 && Math.hypot(e.x - target.x, e.y - target.y) > 0.2;
        i++
      ) {
        const a = thunderMap.heading(e, target);
        e.x += Math.cos(a) * 0.03;
        e.y += Math.sin(a) * 0.03;
        thunderMap.resolve(e, radius);
      }
      assert(Math.hypot(e.x - target.x, e.y - target.y) < 0.25);
    }
});
test("anchor has 1.6s full warning, no landing explosion, break cancels and gives no rewards", () => {
  const w = world(),
    e = enemy(w, "anchorweaver"),
    s = start(w, e, "anchor"),
    h = w.hazards[0],
    d = w.enemies.find((o) => o.id === s.devices[0]);
  assert(Math.abs(h.due - h.created - 1.6) < 1e-8);
  assert(Math.abs(d.maxHp - 30 * 1.3 * 1.1 * 1.82 * 0.6) < 1e-8);
  advance(w, 1.59);
  assert.equal(w.hp, 100);
  assert.equal(d.state, "seek");
  w.hit(d, 1e6, "blade");
  assert.equal(w.kills, 0);
  assert.equal(w.gold, 0);
  assert.equal(w.gems.length, 0);
  assert.equal(w.potions.length, 0);
  assert.equal(w.hazards.length, 0);
  advance(w, 0.1);
  assert.equal(w.hp, 100);
});
test("owner death before throw cancels anchor, but after throw preserves finite field", () => {
  for (const delay of [0.1, 0.3]) {
    const w = world(),
      e = enemy(w, "anchorweaver");
    start(w, e, "anchor");
    advance(w, delay);
    w.hit(e, 1e6, "blade");
    assert.equal(w.hazards.length, delay < 0.2 ? 0 : 1);
    advance(w, 4);
    assert.equal(w.hazards.length, 0);
    assert(
      w.enemies.filter((o) => thunderDevice(o.kind) && o.hp > 0).length === 0,
    );
  }
});
test("arc stays fixed; owner kill before firing cancels, emitted arc survives owner and breaks with node", () => {
  for (const fired of [false, true]) {
    const w = world(),
      e = enemy(w, "arclantern"),
      s = start(w, e, "arc"),
      h = w.hazards[0],
      pos = { x: h.x, y: h.y };
    w.player = { x: 0, y: 2 };
    advance(w, fired ? 1.3 : 0.2);
    assert.equal(h.x, pos.x);
    assert.equal(h.y, pos.y);
    w.hit(e, 1e6, "bone");
    assert.equal(w.hazards.length, fired ? 1 : 0);
    if (fired) {
      const d = w.enemies.find((o) => o.id === s.devices[0]);
      w.hit(d, 1e6, "water");
      assert.equal(w.hazards.length, 0);
    }
  }
});
test("freeze postpones unfired saw warning and movement without pausing already-fired attacks", () => {
  const w = world(),
    e = enemy(w, "railsaw", -2, -3);
  start(w, e, "saw");
  advance(w, 0.92);
  const h = w.hazards[0];
  assert(h);
  const due = h.due;
  e.freezeUntil = w.time + 0.4;
  advance(w, 0.3);
  assert(h.due > due + 0.28);
  assert(!h.fired);
  e.freezeUntil = 0;
  advance(w, 1);
  assert(h.fired);
  assert(h.due - h.created >= 0.899);
  w.hit(e, 1e6, "fire");
  assert(
    w.hazards.every((o) => o.fired || w.time >= (o.thunder.launch ?? o.due)),
  );
  advance(w, 1);
  assert.equal(w.hazards.length, 0);
});
test("reservation prevents third physical danger; owner death releases reservation", () => {
  const w = world(),
    e = enemy(w, "boss", 0, 3);
  start(w, e, "court");
  assert.equal(w.hazards.length, 2);
  assert.equal(w.thunder.slots(), 2);
  const other = enemy(w, "anchorweaver", 4, -2);
  assert(!w.thunder.start(other, "anchor"));
  w.hit(e, 1e9, "holy");
  assert.equal(w.hazards.length, 0);
  assert.equal(w.thunder.slots(), 0);
});
test("court has exactly two edges and breaking a corner cuts only its edges", () => {
  const w = world(),
    e = enemy(w, "boss", 0, 3),
    s = start(w, e, "court");
  assert.equal(s.devices.length, 3);
  assert.equal(w.hazards.length, 2);
  const d = w.enemies.find((o) => o.id === s.devices[0]);
  w.hit(d, 1e5, "lightning");
  assert.equal(w.hazards.length, 1);
  assert(!w.hazards[0].thunder.devices.includes(d.id));
});
test("three-beat boss warnings remain full, residue never creates a third danger", () => {
  const w = world(),
    e = enemy(w, "boss", 0, 3);
  start(w, e, "beats");
  const seen = new Map();
  for (let i = 0; i < 700; i++) {
    w.player = { x: 0, y: 2 };
    advance(w, 0.01);
    for (const h of w.hazards)
      seen.set(h.id, { order: h.thunder.order, delay: h.due - h.created });
    assert(w.hazards.length <= 2);
    assert(w.thunder.slots() <= 2);
  }
  assert([...seen.values()].some((h) => h.order === 3));
  for (const h of seen.values()) assert(h.delay >= 1.149);
});
test("wall collision shares exact fixed gap, finite ends and time-dependent movement; same wall hits once", () => {
  const w = world(),
    e = enemy(w, "railreaper", 0, 4),
    h = w.thunder.wall(e, Math.PI / 2, 1.8, 10, 5, 1.3);
  assert(thunderEscape(w, [h]));
  const t = h.due + 3.5 / 2.8;
  assert(!thunderContains(h, { x: -1.8, y: 0 }, t));
  assert(thunderContains(h, { x: 1, y: 0 }, t));
  assert(!thunderContains(h, { x: 6, y: 0 }, t));
  w.hazards.push(h);
  w.time = t;
  w.thunder.stepHazard(h);
  assert.equal(w.hp, 74);
  w.invulnerable = 0;
  w.thunder.stepHazard(h);
  assert.equal(w.hp, 74);
  assert.equal(h.thunder.gap, 1.8);
});
test("boss double wall previews both locked gaps and starts second full warning 1.6s after first launch", () => {
  const w = world(),
    e = enemy(w, "boss", 0, 3),
    s = start(w, e, "walls"),
    first = w.hazards[0];
  assert.equal(s.step, 0);
  assert(s.points.length === 2);
  const point = { ...s.points[0] };
  w.player = { x: 1, y: 1 };
  advance(w, 2.97);
  const second = w.hazards.find((h) => h.thunder.order === 2);
  assert(second);
  assert.equal(second.x, point.x);
  assert.equal(second.y, point.y);
  assert(second.due - second.created >= 1.349);
  assert(second.created - first.due >= 1.599);
  assert(Math.abs(second.thunder.gap - first.thunder.gap) <= 2.4 + 1e-8);
});
test("phase transition at 55% keeps HP and emitted attacks and never heals", () => {
  const w = world(),
    e = enemy(w, "boss", 0, 3);
  start(w, e, "beats");
  advance(w, 1.2);
  e.hp = e.maxHp * 0.54;
  const hp = e.hp;
  w.thunder.stepEnemy(e, 0);
  assert.equal(e.bossPhase, 2);
  assert.equal(e.hp, hp);
  assert.equal(e.thunder.action, "transition");
  assert(w.hazards.some((h) => h.fired));
  advance(w, 1);
  assert.equal(e.hp, hp);
  assert.equal(e.thunder.action, "transition");
});
test("all ten weapons can hit devices, frost/black-hole never shift their visible endpoints", () => {
  for (const skill of WEAPONS) {
    const w = world(),
      owner = enemy(w, "anchorweaver"),
      d = w.thunder.device(owner, { x: 1, y: 0 }, 100);
    owner.hp = owner.maxHp = 1e9;
    w.skills[skill] = 8;
    w.cooldowns[skill] = 0;
    const x = d.x,
      y = d.y,
      hp = d.hp;
    for (let i = 0; i < 800; i++) {
      w.time += 0.01;
      w.armory.step(0.01);
    }
    assert(d.hp < hp, skill);
    assert.equal(d.x, x);
    assert.equal(d.y, y);
    assert.equal(w.kills, 0, skill);
  }
});
test("boss arrival preserves surviving elite and waits for kill plus rest, without stacked elite backlog", () => {
  const w = world();
  w.time = 479;
  const elite = enemy(w, "railreaper", 4, 0);
  w.thunder.director(0.01);
  w.time = 480;
  w.thunder.director(0.01);
  const b = w.enemies.find((e) => e.kind === "boss");
  assert(b);
  assert(elite.hp > 0);
  b.state = "seek";
  b.visibleSince = 0;
  b.attack = 0;
  w.thunder.stepEnemy(b, 0);
  assert.equal(b.thunder, undefined);
  w.hit(elite, 1e6, "blade");
  w.thunder.stepEnemy(b, 0);
  assert.equal(b.thunder, undefined);
  w.time += 6.1;
  advance(w, 3);
  assert(b.thunder);
});
test("director keeps 100 entity cap, threat six, devices four and pause halts every timer", () => {
  const w = world();
  for (let i = 0; i < 105; i++) w.addEnemy("rivetwalker", 6, 6);
  assert.equal(w.enemies.length, 100);
  w.thunder.director(1);
  assert.equal(w.enemies.length, 100);
  w.enemies = [];
  const e = enemy(w, "arclantern");
  start(w, e, "arc");
  const before = JSON.stringify({ time: w.time, h: w.hazards, e: w.enemies });
  w.pause("qa", true);
  w.step(3);
  assert.equal(
    JSON.stringify({ time: w.time, h: w.hazards, e: w.enemies }),
    before,
  );
});
test("an unsafe later beat cancels into recovery instead of locking the boss in a permanent windup", () => {
  const w = world(),
    e = enemy(w, "boss", 0, 3);
  start(w, e, "beats");
  const s = e.thunder;
  w.time = s.next;
  for (let i = 0; i < 40; i++) {
    const a = (i * Math.PI * 2) / 40;
    enemy(w, "rivetwalker", Math.cos(a) * 0.4, Math.sin(a) * 0.4);
  }
  w.thunder.advance(e, 0);
  assert.equal(e.state, "recover");
  assert(e.timer >= 2.8);
});
test("unobstructed boss cycles through all three actions, with finite device lifetime and two danger slots", () => {
  const w = world(),
    e = enemy(w, "boss", 0, 3);
  w.hp = 1e6;
  const actions = new Set();
  for (let i = 0; i < 9000; i++) {
    advance(w, 0.01);
    if (e.thunder) actions.add(e.thunder.action);
    assert(w.hazards.length <= 2);
    assert(
      w.enemies.filter((o) => o.hp > 0 && thunderDevice(o.kind)).length <= 4,
    );
  }
  assert(actions.has("beats"));
  assert(actions.has("walls"));
  assert(actions.has("court"));
});
test('precision knife and hunter ghost recognize new mechanical casters and devices as priority targets',()=>{
  for(const skill of ['blade','ghost']){
    const w=world();enemy(w,'rivetwalker',1,0);const caster=enemy(w,'arclantern',4,0);w.skills[skill]=8;w.mods[skill]=skill==='ghost'?['execution']:['hunt'];
    const config={range:8,mods:w.mods[skill]};const picked=skill==='blade'?w.armory.target(skill,config):w.armory.extra.target(skill,config);assert.equal(picked.id,caster.id);
  }
});
