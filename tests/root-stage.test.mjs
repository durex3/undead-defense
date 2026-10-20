import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { ROOT_KINDS } from "../temp/tests/battle/RootSystem.mjs";
import { rootMap, ROOT_ROUTES } from "../temp/tests/battle/RootMap.mjs";
import {
  rootArm,
  rootHit,
  rootEscape,
} from "../temp/tests/battle/RootGeometry.mjs";
import { ENEMIES, ALL_WEAPONS } from "../temp/tests/battle/SurvivalConfig.mjs";
import { enemyArt } from "../temp/tests/presentation/art/EnemyCatalog.mjs";
import { ProgressStore } from "../temp/tests/platform/ProgressStore.mjs";
function world() {
  const w = new SurvivalWorld(31, "ranger", 8);
  w.player = { x: 0, y: 0 };
  w.camera = { ...w.player };
  w.enemies = [];
  w.armory.step = () => {};
  w.director.step = () => {};
  w.hp = w.maxHp = 1e8;
  return w;
}
function actor(w, kind = "boss", x = -3, y = -0.8) {
  const e = w.addEnemy(kind, x, y);
  e.state = "seek";
  e.attack = 0;
  w.root.state(e);
  return e;
}
function step(w, seconds) {
  for (let i = 0; i < seconds * 60; i++) {
    w.step(1 / 60);
    w.drain();
  }
}
function arm() {
  const w = world(),
    e = actor(w, "vinecantor", 0, 0);
  w.player = { x: 3, y: 0 };
  w.camera = { x: 0, y: 0 };
  return { w, e, h: w.root.arm(e) };
}
test("eighth strategy registers seven unique actors, fixed obstacles, final elite stats and matching art", () => {
  const w = world();
  assert.equal(w.stageStrategy.map, rootMap);
  assert.equal(ROOT_KINDS.length, 7);
  for (const k of [...ROOT_KINDS, "boss"])
    assert.equal(enemyArt(8, k).stage, 8);
  for (const p of ROOT_ROUTES) assert(!rootMap.blocked(p, 0.7));
  assert.equal(ENEMIES.biforktangler.health, 20);
  assert.equal(ENEMIES.biforktangler.contact, 20);
  assert.equal(ENEMIES.pairedcalyx.contact, 22);
});
test("arm moves along a fixed one-way arc and does not damage its entire sector or return", () => {
  const { h } = arm(),
    p = { x: 3, y: 0 };
  assert(!rootHit(h, p, h.due));
  assert(rootHit(h, p, h.due + 1.3));
  assert(!rootHit(h, p, h.until + 0.1, h.until));
  const [a, z] = rootArm(h, h.due + 1.3);
  assert(Math.abs(a.y) < 1e-9);
  assert(Math.abs(z.y) < 1e-9);
  assert(!rootHit(h, { x: 0.8, y: 0 }, h.due + 1.3));
});
test("rotating sweep catches between-frame crossings and respects the real hollow hub", () => {
  const { h } = arm();
  assert(rootHit(h, { x: 3, y: 0 }, h.until, h.due));
  assert(!rootHit(h, { x: 0, y: 0 }, h.until, h.due));
  assert(!rootHit(h, { x: 6, y: 0 }, h.until, h.due));
  assert(rootHit(h, { x: 3, y: -2 }, h.due + 1.4, h.due + 1.2, { x: 3, y: 2 }));
});
test("annulus excludes its center and sweeps moving players across both boundaries", () => {
  const w = world(),
    e = actor(w, "wreathpod"),
    h = w.root.flower(e, "ring", 1, { x: 0, y: 0 });
  assert(!rootHit(h, { x: 0, y: 0 }, h.due + 0.2));
  assert(!rootHit(h, { x: 1.89, y: 0 }, h.due + 0.2));
  assert(rootHit(h, { x: 1.91, y: 0 }, h.due + 0.2));
  assert(rootHit(h, { x: 3.79, y: 0 }, h.due + 0.2));
  assert(!rootHit(h, { x: 3.81, y: 0 }, h.due + 0.2));
  assert(rootHit(h, { x: 5, y: 0 }, h.due + 0.3, h.due + 0.1, { x: 0, y: 0 }));
});
test("disk center is harmful, late entry and expired petals are harmless", () => {
  const w = world(),
    e = actor(w),
    h = w.root.flower(e, "disk", 1, { x: 0, y: 0 });
  assert(rootHit(h, { x: 0, y: 0 }, h.due + 0.1));
  assert(!rootHit(h, { x: 2.71, y: 0 }, h.due + 0.1));
  assert(!rootHit(h, { x: 0, y: 0 }, h.due - 0.01));
  assert(!rootHit(h, { x: 0, y: 0 }, h.until + 0.01, h.until));
});
test("an emitted arm hurts at most once, while warning and dark trail never hurt", () => {
  const { w, e, h } = arm();
  w.hazards = [h];
  e.state = "windup";
  e.immovable = true;
  const hp = w.hp;
  w.time = h.due;
  w.root.stepHazard(h);
  assert.equal(w.hp, hp);
  w.time = h.due + 1.3;
  w.root.stepHazard(h);
  assert.equal(w.hp, hp - 22);
  w.invulnerable = 0;
  w.root.stepHazard(h);
  assert.equal(w.hp, hp - 22);
});
test("the last partial active frame is swept before a flower is retired", () => {
  const w = world(),
    e = actor(w, "bulbmaw"),
    h = w.root.flower(e, "disk", 1, { x: 0, y: 0 });
  w.hazards = [h];
  w.time = h.until - 0.005;
  h.fired = true;
  e.attack = 100;
  h.root.last = w.time;
  h.root.player = { ...w.player };
  const hp = w.hp;
  w.step(0.02);
  assert.equal(w.hp, hp - 24);
  w.step(0.02);
  assert.equal(w.hazards.length, 0);
});
test("death cancels pending flowers and active arms but preserves a finite active flower", () => {
  const { w, e, h } = arm();
  w.hazards = [h];
  h.fired = true;
  e.hp = 0;
  w.root.onDeath(e);
  assert(h.root.cancelled);
  assert(!rootHit(h, w.player, w.time));
  const owner = actor(w, "wreathpod"),
    ring = w.root.flower(owner, "ring", 1, { x: 0, y: 0 });
  ring.fired = true;
  w.hazards = [ring];
  owner.hp = 0;
  w.root.onDeath(owner);
  assert(!ring.root.cancelled);
  assert(ring.until > w.time);
});
test("unfired flowers are withdrawn with their owner and cannot leave invisible damage", () => {
  const w = world(),
    e = actor(w, "bulbmaw"),
    h = w.root.flower(e, "disk");
  w.hazards = [h];
  e.hp = 0;
  w.root.clean();
  assert(h.root.cancelled);
  assert.equal(h.until, w.time);
});
test("actual frost preserves a complete pending warning and shifts all planned phases", () => {
  const { w, e } = arm();
  w.root.begin(e);
  assert.equal(w.hazards.length, 1);
  const h = w.hazards[0],
    due = h.due;
  w.slow(e, true);
  step(w, 0.3);
  assert.equal(e.state, "windup");
  assert(h.due >= due + 0.29);
  assert(!h.fired);
});
test("freezing an active arm cancels the whole sequence and restores movement only after recovery", () => {
  const w = world(),
    e = actor(w, "biforktangler");
  w.root.begin(e);
  const h = w.hazards[0];
  w.time = h.due + 0.2;
  h.fired = true;
  w.slow(e, true);
  w.root.clean();
  assert(h.root.cancelled);
  assert.equal(w.root.slots, 0);
  assert.equal(e.state, "recover");
  assert(!e.root.follow);
});
test("windup root is a real immovable source, recovery leaves it attackable and exposed", () => {
  const { w, e } = arm();
  w.root.begin(e);
  assert(e.immovable);
  const [x, y] = [e.x, e.y];
  step(w, 1);
  assert.equal(e.x, x);
  assert.equal(e.y, y);
  const hp = e.hp;
  w.hit(e, 10, "fire");
  assert(e.hp < hp);
  step(w, 4);
  assert(!e.immovable);
  assert.equal(e.state, "recover");
});
test("two occupied slots reject a third actor and all sequential reservations count", () => {
  const w = world(),
    e = actor(w, "biforktangler");
  assert(w.root.begin(e));
  assert.equal(w.root.slots, 2);
  const other = actor(w, "bulbmaw", 3, 0);
  assert(!w.root.begin(other));
  assert.equal(w.root.slots, 2);
});
test("two-bed sequence locks one center with a complete fresh warning after ring ends", () => {
  const w = world(),
    e = actor(w, "pairedcalyx");
  e.root.action = "beds";
  w.root.begin(e);
  assert.equal(w.hazards.length, 2);
  const [a, b] = w.hazards;
  assert.equal(a.root.shape, "ring");
  assert.equal(b.root.shape, "disk");
  assert.equal(a.x, b.x);
  assert.equal(a.y, b.y);
  assert.equal(b.created, a.until);
  assert(b.due - a.until >= 1.79);
  assert.equal(w.root.slots, 2);
});
test("ultimate publishes a fixed combined plan and phase two uses a disk at the terminal side", () => {
  for (const phase of [1, 2]) {
    const w = world(),
      e = actor(w, "boss", -3, phase === 2 ? -2 : -0.8);
    e.bossPhase = phase;
    e.root.action = "C";
    w.root.begin(e);
    assert.equal(w.hazards.length, 2);
    const [a, b] = w.hazards;
    assert.equal(a.root.shape, "arm");
    assert.equal(b.root.shape, phase === 1 ? "ring" : "disk");
    assert.equal(b.created, w.time + 1.6);
    assert(Math.abs(b.due - w.time - 3.4) < 1e-8);
    assert(b.due < a.until);
    if (phase === 2)
      assert(Math.abs(Math.hypot(b.x - e.x, b.y - e.y) - 3.6) < 1e-8);
  }
});
test("phase transition never heals and keeps only already active ground beds", () => {
  const w = world(),
    e = actor(w);
  e.root.action = "B";
  w.root.begin(e);
  w.hazards[0].fired = true;
  e.hp = e.maxHp * 0.5;
  const hp = e.hp;
  w.root.stepEnemy(e, 0.01);
  assert.equal(e.hp, hp);
  assert.equal(e.bossPhase, 2);
  assert.equal(e.root.action, "transition");
  assert(!w.hazards[0].root.cancelled);
  assert(w.hazards[1].root.cancelled);
});
test("illegal terrain or offscreen sectors recover, release slots and advance instead of stalling", () => {
  const w = world(),
    e = actor(w, "boss", -9, 7);
  e.root.action = "C";
  assert(w.root.begin(e));
  assert.equal(e.state, "recover");
  assert.equal(w.root.slots, 0);
  assert(e.root.relocate);
  assert.equal(w.hazards.length, 0);
});
test("no safe combined exit causes cancellation, not a fallback untelegraphed attack", () => {
  const w = world(),
    e = actor(w);
  w.player = { x: 21.9, y: 0 };
  w.camera = { ...w.player };
  e.root.action = "C";
  w.root.begin(e);
  assert.equal(w.hazards.length, 0);
  assert.equal(w.root.slots, 0);
});
test("pause and upgrade halt all root and reservation clocks", () => {
  const { w, e } = arm();
  w.root.begin(e);
  const h = w.hazards[0],
    due = h.due,
    t = w.time;
  w.pause("menu", true);
  step(w, 2);
  assert.equal(w.time, t);
  assert.equal(h.due, due);
  assert.equal(w.root.slots, 1);
  w.pause("menu", false);
  w.state = "upgrade";
  step(w, 2);
  assert.equal(w.time, t);
});
test("resin fracture and natural recovery use the shared armor multiplier exactly once", () => {
  const w = world(),
    e = actor(w, "biforktangler");
  e.hp = e.maxHp = 10000;
  w.hit(e, 100, "fire");
  assert.equal(e.hp, 9950);
  e.state = "recover";
  e.root.vulnerable = true;
  w.hit(e, 100, "fire");
  assert.equal(e.hp, 9850);
  e.fracture = 2;
  e.fractureUntil = w.time + 3;
  w.hit(e, 100, "fire");
  assert.equal(e.hp, 9725);
});
test("stage eight unlocks only after seven, grants 240 once, preserves old progress and adds its clear achievement", () => {
  const m = new Map(),
    storage = {
      getItem: (k) => m.get(k) || null,
      setItem: (k, v) => m.set(k, v),
      removeItem: (k) => m.delete(k),
    },
    p = new ProgressStore(storage);
  assert(!p.unlockedStage(8));
  const prev = new SurvivalWorld(31, "ranger", 7);
  prev.state = "won";
  prev.time = 400;
  p.observe(prev);
  assert(p.unlockedStage(8));
  const before = p.data.coins,
    w = world();
  w.state = "won";
  w.time = 450;
  p.observe(w);
  p.observe(w);
  assert.equal(p.data.coins, before + 240);
  assert(p.hasAchievement("rootglass_clear"));
  assert.equal(p.data.achievements.length, 2);
  const q = new ProgressStore(storage);
  assert.deepEqual(q.data, p.data);
  assert(q.data.stages.includes(8));
});
test("real director stays within 100 actors, two hazards, six threat and one elite", () => {
  const w = world();
  let maxActors = 0;
  for (let i = 0; i < 370; i++) {
    w.time = i;
    w.root.director(1);
    for (const e of w.enemies) {
      if (e.state === "arriving") e.state = "seek";
    }
    maxActors = Math.max(maxActors, w.enemies.length);
    assert(w.enemies.length <= 100);
    assert(
      w.enemies.reduce(
        (n, e) => n + (e.hp > 0 ? ENEMIES[e.kind].threat : 0),
        0,
      ) <= 6,
    );
    assert(
      w.enemies.filter((e) => e.hp > 0 && ENEMIES[e.kind].elite).length <= 1,
    );
  }
  assert(maxActors > 20);
});
test("boss actually completes all three patterns over time and never exceeds two slots", () => {
  for (const phase of [1, 2]) {
    const w = world(),
      e = actor(w);
    e.bossPhase = phase;
    w.time = 360;
    w.hp = w.maxHp = 1e9;
    for (let i = 0; i < 180 * 60; i++) {
      w.step(1 / 60);
      w.drain();
      assert(w.root.slots <= 2);
    }
    assert(w.root.stats.patterns.A > 0, "A in phase " + phase);
    assert(w.root.stats.patterns.B > 0, "B in phase " + phase);
    assert(w.root.stats.patterns.C > 0, "C in phase " + phase);
  }
});

test("second arm uses a fresh full warning and reverses its declared start side",()=>{
 const w=world(),e=actor(w,"biforktangler");e.root.action="doubleArm";w.root.begin(e);const first=w.hazards[0];e.pattern++;step(w,first.until-w.time+.85);const second=w.hazards.find(h=>h.root?.order===2);assert(second);assert(first.root.turn*second.root.turn<0);assert(second.due-second.created>=1.79);assert.equal(w.root.slots,2);
});
test("real frost controller can freeze a rooted caster without displacing its locked pivot",()=>{
 const {w,e}=arm();w.root.begin(e);const h=w.hazards[0];w.time=h.due+.1;h.fired=true;const origin={x:e.x,y:e.y};w.armory.extra.freeze(e,{stats:{duration:1,mods:[]}});assert(e.freezeUntil>w.time);w.root.clean();assert(h.root.cancelled);assert.deepEqual({x:e.x,y:e.y},origin);
});
test("all twelve damage sources retain access to every eighth-stage body",()=>{
 for(const kind of [...ROOT_KINDS,"boss"])for(const skill of ALL_WEAPONS){const w=world(),e=actor(w,kind);const hp=e.hp;w.hit(e,10,skill);assert(e.hp<hp,kind+"/"+skill);}
});
test("precision knife and execution ghost prioritize eighth-stage casters over fodder",()=>{
 for(const skill of ["blade","ghost"])for(const kind of ["vinecantor","wreathpod","bulbmaw"]){const w=world();actor(w,"rootshuffler",1,0);const e=actor(w,kind,4,0);w.skills[skill]=8;w.mods[skill]=skill==="ghost"?["execution"]:["hunt"];const s={range:8,mods:w.mods[skill]};assert.equal((skill==="blade"?w.armory.target(skill,s):w.armory.extra.target(skill,s)).id,e.id);}
});
