import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import {
  prismMap,
  PRISM_BASES,
  PRISM_ROUTES,
  prismTrace,
  prismAim,
} from "../temp/tests/battle/PrismMap.mjs";
import {
  prismHead,
  prismHit,
  prismEscape,
} from "../temp/tests/battle/PrismGeometry.mjs";
import { PRISM_MAIN, PRISM_KINDS } from "../temp/tests/battle/PrismSystem.mjs";
import {
  ALL_WEAPONS,
  WEAPONS,
  ENEMIES,
} from "../temp/tests/battle/SurvivalConfig.mjs";
import { ProgressStore } from "../temp/tests/platform/ProgressStore.mjs";
import { enemyArt } from "../temp/tests/presentation/art/EnemyCatalog.mjs";
function world() {
  const w = new SurvivalWorld(31, "ranger", 7);
  w.player = { x: 0, y: 0 };
  w.camera = { ...w.player };
  w.enemies = [];
  w.armory.step = () => {};
  w.director.step = () => {};
  w.hp = w.maxHp = 1e8;
  return w;
}
function actor(w, kind = "boss", x = -3, y = 0) {
  const e = w.addEnemy(kind, x, y);
  e.state = "seek";
  e.attack = 0;
  w.prism.state(e);
  return e;
}
function step(w, t) {
  for (let i = 0; i < t * 60; i++) {
    w.step(1 / 60);
    w.drain();
  }
}
function reflected() {
  const w = world();
  w.player = { x: -4, y: 8 };
  w.camera = { ...w.player };
  const e = actor(w, "facetgastropod", -4, 3.5),
    h = w.prism.bolt(e, 1);
  assert(h);
  return { w, e, h };
}
function mirrorRoute() {
  const w = world();
  w.player = { x: -2, y: 2 };
  w.camera = { ...w.player };
  const owner = actor(w, "prismmason", -4, -3),
    node = actor(w, "prismmirror", 0, 0);
  node.owner = owner.id;
  node.immovable = true;
  node.prism.axis = "x";
  node.prism.activeAt = 0;
  node.prism.expires = 8;
  const e = actor(w, "facetgastropod", -2, -2),
    h = w.prism.bolt(e, 1);
  assert(h);
  assert.equal(h.prism.path.mirror, node.id);
  return { w, e, node, h };
}
test("seventh strategy registers six main bodies, two devices and an independent boss", () => {
  const w = world();
  assert.equal(w.stageStrategy.map, prismMap);
  assert.equal(PRISM_MAIN.length, 6);
  assert.equal(PRISM_KINDS.length, 8);
  for (const k of [...PRISM_KINDS, "boss"])
    assert.equal(enemyArt(7, k).stage, 7);
  for (const p of PRISM_ROUTES) assert(!prismMap.blocked(p, 0.7));
});
test("expanded-circle reflection follows the actual first face and preserves incident angle", () => {
  const p = prismAim({ x: -4, y: 3.5 }, { x: -4, y: 8 }, 0.22, 12);
  assert.equal(p.points.length, 3);
  assert(Math.abs(p.points[1].x + 8.18) < 1e-6);
  assert(Math.abs(p.points[1].y - 5.75) < 1e-6);
  assert(Math.abs(p.total - 12) < 1e-6);
  const [a, b, c] = p.points;
  assert(
    Math.abs((b.y - a.y) / (b.x - a.x) + (c.y - b.y) / (c.x - b.x)) < 1e-6,
  );
});
test("second solid contact and world edge terminate a bolt, corners never create a guessed bounce", () => {
  const p = prismTrace({ x: -4, y: 10 }, Math.PI, 30, 0.22);
  assert.equal(p.points.length, 3);
  assert(Math.abs(p.points[2].x - 13.28) < 1e-6);
  assert(p.total < 30);
  const edge = prismTrace({ x: 20, y: 0 }, 0, 12, 0.22);
  assert.equal(edge.points.length, 2);
  assert(Math.abs(edge.points[1].x - 22.08) < 1e-6);
  assert.equal(
    prismTrace({ x: -6, y: 1.6 }, Math.PI * 0.75, 12, 0.22),
    undefined,
  );
});
test("sweeps split at the reflection rather than shortcutting across the turn", () => {
  const { h } = reflected(),
    b = h.prism.path.points[1],
    len = h.prism.path.lengths[0],
    from = h.due + (len - 1.9) / h.prism.speed,
    to = h.due + (len + 1.9) / h.prism.speed;
  assert(prismHit(h, b, to, from));
  assert(!prismHit(h, { x: b.x + 1.7, y: b.y }, to, from));
  assert(!prismHit(h, b, h.due - 0.01));
});
test("warning movement is never retroactive and hit is shared across both reflected legs", () => {
  const { w, h } = reflected();
  w.hazards = [h];
  const end = h.due;
  w.player = { x: -1, y: 0 };
  w.time = end - 0.05;
  w.prism.stepHazard(h);
  w.time = end + 0.01;
  const before = w.hp;
  w.prism.stepHazard(h);
  assert.equal(w.hp, before);
  w.player = { ...h.prism.path.points[1] };
  w.time = h.due + h.prism.path.lengths[0] / h.prism.speed;
  w.prism.stepHazard(h);
  assert(w.hp < before);
  const hp = w.hp;
  w.invulnerable = 0;
  w.time += 0.01;
  w.prism.stepHazard(h);
  assert.equal(w.hp, hp);
});
test("destroying a mirror before emission cancels, before reflection clips, after reflection preserves flight", () => {
  for (const mode of ["pending", "before", "after"]) {
    const { w, node, h } = mirrorRoute();
    w.hazards = [h];
    if (mode !== "pending") {
      h.fired = true;
      w.time =
        h.due +
        (mode === "before"
          ? 0.1
          : h.prism.path.lengths[0] / h.prism.speed + 0.05);
    }
    node.hp = 0;
    w.prism.clean();
    if (mode === "pending") assert.equal(h.until, w.time);
    else if (mode === "before") {
      assert.equal(h.prism.cut, h.prism.path.lengths[0]);
      assert(Math.abs(h.until - h.due - h.prism.cut / h.prism.speed) < 1e-6);
    } else {
      assert.equal(h.prism.cut, undefined);
      assert(h.until > w.time);
    }
  }
});
test("mirror expiry and owner death remove the reflector without rewards or hidden straight continuation", () => {
  const { w, node, h } = mirrorRoute();
  w.hazards = [h];
  const owner = w.enemies.find((e) => e.id === node.owner);
  owner.hp = 0;
  w.prism.clean();
  assert.equal(node.hp, 0);
  assert.equal(h.until, w.time);
  const x = actor(w, "prismmirror", 1, 1);
  const kills = w.kills,
    gold = w.gold;
  w.hit(x, 1e8, "fire");
  assert.equal(w.kills, kills);
  assert.equal(w.gold, gold);
  assert.equal(w.gems.length, 0);
});
test("core publication creates a capped, immovable, unarmored entity and all weapons can break it", () => {
  for (const skill of ALL_WEAPONS) {
    const w = world(),
      e = actor(w, "corebrood"),
      h = w.prism.core(e, 1);
    assert(w.prism.reserve(e, 1));
    assert(w.prism.publish(e, [h]));
    const core = w.enemies.find((e) => e.id === h.prism.entity);
    assert.equal(core.hp, 60);
    assert(core.immovable);
    w.time = h.due + 0.01;
    w.prism.stepHazard(h);
    assert.equal(core.state, "seek");
    const kills = w.kills,
      gold = w.gold;
    w.hit(core, 60, skill);
    assert.equal(core.hp, 0);
    assert.equal(h.until, w.time);
    assert.equal(w.kills, kills);
    assert.equal(w.gold, gold);
    assert.equal(w.gems.length, 0);
  }
});
test("cores stop at crystals with no reflection or damage from their quiet tail", () => {
  const w = world();
  w.player = { x: 14, y: -7 };
  w.camera = { ...w.player };
  const e = actor(w, "corebrood", 5, -7),
    h = w.prism.core(e, 1);
  assert.equal(h.prism.path.points.length, 2);
  assert(h.prism.path.points[1].x <= 7.751);
  assert(!prismHit(h, { x: 6, y: -10 }, h.due + 0.5));
});
test("core freeze is bounded, pauses the actual moving center and never changes its planned path", () => {
  const w = world(),
    e = actor(w, "corebrood"),
    h = w.prism.core(e, 1);
  w.prism.publish(e, [h]);
  w.time = h.due + 0.1;
  w.prism.stepHazard(h);
  const core = w.enemies.find((e) => e.id === h.prism.entity),
    at = { x: core.x, y: core.y },
    end = structuredClone(h.prism.path);
  w.slow(core, true);
  assert.equal(core.freezeUntil, w.time + 0.35);
  const until = core.freezeUntil;
  w.slow(core, true);
  assert.equal(core.freezeUntil, until);
  w.time += 0.1;
  w.prism.stepHazard(h);
  assert.deepEqual({ x: core.x, y: core.y }, at);
  assert.deepEqual(h.prism.path, end);
});
test("unfired attacks cancel on source death; emitted cores and bolts keep finite lifetimes", () => {
  const w = world(),
    e = actor(w, "corebrood"),
    h = w.prism.core(e, 1);
  w.prism.publish(e, [h]);
  w.time = h.due + 0.1;
  w.prism.stepHazard(h);
  e.hp = 0;
  w.prism.onDeath(e);
  assert(h.until > w.time);
  assert(w.enemies.find((x) => x.id === h.prism.entity).hp > 0);
  const { w: v, e: source, h: pending } = reflected();
  v.hazards = [pending];
  source.hp = 0;
  v.prism.onDeath(source);
  assert.equal(pending.until, v.time);
});
test("two-slot reservation includes whole sequences and simultaneous cores are counted separately", () => {
  const w = world(),
    e = actor(w),
    other = actor(w, "corebrood", 3, 0);
  assert(w.prism.reserve(e, 2));
  assert(!w.prism.reserve(other, 1));
  assert.equal(w.prism.slots, 2);
  w.prism.reservations.clear();
  e.prism.action = "B";
  w.prism.begin(e);
  assert.equal(w.hazards.length, 2);
  assert.equal(w.prism.slots, 2);
  assert.equal(w.enemies.filter((e) => e.kind === "prismcore").length, 2);
});
test("mirror placement waits while a bolt is warned or flying, and never places inside solid crystals", () => {
  const { w, e, h } = reflected();
  const mason = actor(w, "prismmason", -3, 6);
  w.hazards = [h];
  assert.equal(w.prism.mirrorSite(mason), undefined);
  w.hazards = [];
  w.player = { x: 0, y: 0 };
  w.camera = { ...w.player };
  mason.x = -3;
  mason.y = 0;
  const site = w.prism.mirrorSite(mason);
  assert(site);
  assert(!prismMap.blocked(site, 1.2));
  assert(Math.hypot(site.x, site.y) >= 2.5);
});
test("actual freeze preserves the full warning for prism and tide sources instead of cancelling their state", () => {
  for (const stage of [6, 7]) {
    const w = new SurvivalWorld(19, "ranger", stage);
    w.enemies = [];
    w.player = { x: 0, y: 0 };
    w.camera = { ...w.player };
    const system = stage === 7 ? w.prism : w.tide,
      e = w.addEnemy(stage === 7 ? "corebrood" : "sluiceray", -3, 0);
    e.state = "seek";
    system.state(e).action = stage === 7 ? "core" : "wave";
    system.begin(e);
    const h = w.hazards[0],
      due = h.due;
    w.slow(e, true);
    assert.equal(w.hazards.length, 1);
    assert.equal(e.state, "windup");
    w.time = 0.25;
    system.stepEnemy(e, 0.25);
    assert.equal(h.due, due + 0.25);
  }
});
test("boss performs all patterns with physical reflector setup and phase transition never heals", () => {
  const w = world(),
    e = actor(w);
  let peak = 0;
  for (let i = 0; i < 120 * 60; i++) {
    w.step(1 / 60);
    w.drain();
    peak = Math.max(peak, w.prism.slots);
    assert(w.enemies.length <= 100);
  }
  assert.equal(peak, 2);
  assert(w.prism.stats.boss >= 3);
  assert(w.prism.stats.reflections > 0);
  assert(w.prism.stats.cores > 0);
  assert(w.prism.stats.mirrors > 0);
  e.hp = e.maxHp * 0.5;
  const hp = e.hp;
  w.step(1 / 60);
  assert.equal(e.bossPhase, 2);
  assert.equal(e.hp, hp);
  assert.equal(e.prism.action, "transition");
  assert.equal(e.prism.preview, undefined);
});
test("ultimate fixes second path before first launch; destroying its dependency visibly withdraws it", () => {
  const w = world(),
    e = actor(w);
  e.prism.action = "C";
  w.prism.begin(e);
  assert(e.prism.preparing);
  assert.equal(w.prism.slots, 2);
  assert.equal(e.prism.sites.length, 2);
  assert.equal(w.enemies.filter((e) => e.kind === "prismmirror").length, 0);
  w.time = e.prism.next;
  w.prism.advance(e);
  assert(e.prism.preview);
  const path = structuredClone(e.prism.preview.prism.path);
  w.player = { x: 1, y: 1 };
  assert.deepEqual(e.prism.preview.prism.path, path);
  const preview = e.prism.preview;
  const mirror = w.enemies.find((x) => x.id === preview.prism.path.mirror);
  assert(mirror);
  mirror.hp = 0;
  w.prism.clean();
  assert.equal(e.prism.preview, undefined);
});
test("phase-two ultimate announces a core as its second segment without spawning it early", () => {
  const w = world(),
    e = actor(w);
  e.bossPhase = 2;
  e.prism.action = "C";
  w.prism.begin(e);
  if (e.prism.preparing) {
    w.time = e.prism.next;
    w.prism.advance(e);
  }
  assert.equal(e.prism.preview.prism.shape, "core");
  assert.equal(w.enemies.filter((e) => e.kind === "prismcore").length, 0);
  const preview = e.prism.preview;
  w.time = e.prism.next;
  w.hazards = [];
  w.prism.advance(e);
  assert.equal(w.hazards[0], preview);
  assert(w.hazards[0].due - w.time >= 1.69);
  assert.equal(w.enemies.filter((e) => e.kind === "prismcore").length, 1);
});
test("illegal ultimate setup cancels into recovery and cannot consume an endless windup", () => {
  const w = world(),
    e = actor(w);
  e.prism.action = "C";
  w.prism.setupSites = () => undefined;
  w.prism.begin(e);
  assert.equal(e.state, "recover");
  assert.equal(w.prism.slots, 0);
});
test("boss arrival preserves a live elite and waits at least three seconds after its death", () => {
  const w = new SurvivalWorld(19, "ranger", 7);
  w.player = { x: 0, y: 0 };
  w.enemies = [];
  w.time = 359;
  const elite = actor(w, "bifacetregent", 5, 0);
  w.time = 360;
  w.prism.director(0.05);
  const boss = w.enemies.find((e) => e.kind === "boss");
  assert(boss);
  assert(w.enemies.includes(elite));
  boss.state = "seek";
  boss.attack = 0;
  w.prism.stepEnemy(boss, 0.05);
  assert.equal(w.prism.stats.boss, 0);
  elite.hp = 0;
  w.prism.onDeath(elite);
  w.time = 362.9;
  w.prism.stepEnemy(boss, 0.05);
  assert.equal(w.prism.stats.boss, 0);
});
test("director respects global entity and threat limits without killing old enemies", () => {
  const w = world();
  for (let i = 0; i < 7200; i++) {
    w.time = i * 0.05;
    w.prism.director(0.05);
    assert(w.enemies.length <= 100);
    assert(
      w.enemies.reduce(
        (n, e) => n + (e.hp > 0 ? ENEMIES[e.kind].threat : 0),
        0,
      ) <= 6,
    );
  }
});
test("wax armor and recovery work once while mirror/core devices have no armor", () => {
  const w = world(),
    boss = actor(w),
    elite = actor(w, "bifacetregent");
  let hp = boss.hp;
  w.hit(boss, 100, "blade");
  assert.equal(hp - boss.hp, 45);
  boss.state = "recover";
  boss.prism.vulnerable = true;
  hp = boss.hp;
  w.hit(boss, 100, "fire");
  assert.equal(hp - boss.hp, 106.25);
  elite.state = "recover";
  elite.prism.vulnerable = true;
  hp = elite.hp;
  w.hit(elite, 100, "holy");
  assert.equal(hp - elite.hp, 100);
  for (const k of ["prismmirror", "prismcore"]) {
    const e = actor(w, k);
    e.hp = e.maxHp = 1000;
    w.fracture(e, 2);
    hp = e.hp;
    w.hit(e, 100, "blade");
    assert.equal(hp - e.hp, 100);
  }
});
test("stage seven opens by clearing six alone and grants 220 coins/completion exactly once", () => {
  const m = new Map(),
    s = {
      getItem: (k) => m.get(k) || null,
      setItem: (k, v) => m.set(k, v),
      removeItem: (k) => m.delete(k),
    },
    p = new ProgressStore(s);
  p.data.stages = [1, 2, 3, 4, 5, 6];
  assert(p.unlockedStage(7));
  assert(!p.unlockedWeapon("hammer"));
  assert(!p.unlockedWeapon("wheel"));
  const w = world();
  w.state = "won";
  w.time = 520;
  p.observe(w);
  p.observe(w);
  assert.equal(p.coins, 220);
  assert(p.hasAchievement("prismvault_clear"));
  const q = new ProgressStore(s);
  assert(q.hasAchievement("prismvault_clear"));
  assert.deepEqual(q.data.stages, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(q.availableWeapons.length, WEAPONS.length);
});
test("dangerous cores are valid precision/ghost targets and cannot be dragged off their warning by black holes", () => {
  for (const skill of ["blade", "ghost"]) {
    const w = world();
    actor(w, "shardhermit", 1, 0);
    const core = actor(w, "prismcore", 4, 0);
    core.immovable = true;
    w.skills[skill] = 8;
    w.mods[skill] = skill === "ghost" ? ["execution"] : ["hunt"];
    const cfg = { range: 8, mods: w.mods[skill] },
      target =
        skill === "blade"
          ? w.armory.target(skill, cfg)
          : w.armory.extra.target(skill, cfg);
    assert.equal(target.id, core.id);
  }
});

test("black-hole displacement leaves published core and mirror coordinates unchanged", () => {
  const w = world(),
    core = actor(w, "prismcore", 1, 0),
    mirror = actor(w, "prismmirror", 2, 0);
  core.immovable = mirror.immovable = true;
  core.hp = mirror.hp = 1e6;
  w.skills.blade = 0;
  w.skills.void = 8;
  w.mods.void = ["drift", "repel"];
  for (let i = 0; i < 180; i++) {
    w.time += 1 / 60;
    w.armory.extra.step(1 / 60);
  }
  assert.deepEqual({ x: core.x, y: core.y }, { x: 1, y: 0 });
  assert.deepEqual({ x: mirror.x, y: mirror.y }, { x: 2, y: 0 });
});
test("pause and upgrade preserve warning times, device lifetime and sequence reservations", () => {
  const w = world(),
    e = actor(w);
  e.prism.action = "C";
  w.prism.begin(e);
  const snapshot = { time: w.time, next: e.prism.next, slots: w.prism.slots };
  for (const state of ["paused", "upgrade", "modification"]) {
    w.state = state;
    w.step(3);
    assert.equal(w.time, snapshot.time);
    assert.equal(e.prism.next, snapshot.next);
    assert.equal(w.prism.slots, snapshot.slots);
  }
});
