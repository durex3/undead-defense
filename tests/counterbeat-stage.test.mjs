import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import {
  counterDistance,
  counterImpact,
  counterCut,
} from "../temp/tests/battle/CounterbeatGeometry.mjs";
import { counterbeatMap } from "../temp/tests/battle/CounterbeatMap.mjs";
import { COUNTERBEAT_ROLES } from "../temp/tests/battle/CounterbeatChallenge.mjs";
import { stageReference } from "../temp/tests/battle/StageGrowth.mjs";
import { ProgressStore } from "../temp/tests/platform/ProgressStore.mjs";
import {
  freshProgress,
  decodeProgress,
} from "../temp/tests/platform/ProgressCodec.mjs";
import { TRACE_RECIPES } from "../temp/tests/battle/TraceChallenge.mjs";
import {
  nextGrade,
  gradeMultiplier,
  weaponName,
} from "../temp/tests/battle/WeaponGrade.mjs";
const world = () => {
  const w = new SurvivalWorld(31, "ranger", 18);
  w.time = 400;
  w.state = "battle";
  w.player = { x: 0, y: 0 };
  w.camera = { x: 0, y: 0 };
  w.viewport = { x: 16, y: 7.5 };
  return w;
};
const boss = (w) => {
  const e = w.addEnemy("boss", -3, 0);
  e.state = "seek";
  e.attack = 0;
  return e;
};
const storage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
test("18 unlock follows 17, one life follows formula, final kill supplies and settles once", () => {
  const s = storage(),
    p = new ProgressStore(s);
  assert(!p.unlockedStage(18));
  p.data.stages = [17];
  assert(p.unlockedStage(18));
  const w = world(),
    e = boss(w),
    r = stageReference(18);
  assert(Math.abs(e.hp - r.bossDps * r.bossSeconds) < 1e-8);
  w.hit(e, 1e9, "blade");
  assert.equal(w.state, "won");
  assert.equal(w.potions.length, 3);
  p.observe(w);
  p.observe(w);
  assert.equal(p.coins, 440);
  assert.equal(p.data.stageBest[18].form, 1);
  assert.equal(new ProgressStore(s).coins, 440);
});
test("second lock occurs later, preserves first snapshot, and keeps a full new warning even at low FPS", () => {
  const w = world(),
    e = boss(w);
  assert(w.counter.begin(e, "A"));
  const h = e.counter.item,
    first = structuredClone(h.counter.pulses[0]);
  assert.equal(h.counter.pulses.length, 1);
  w.time = 400.89;
  w.counter.clean();
  assert.equal(h.counter.pulses.length, 1);
  w.player = { x: -1, y: 1 };
  w.time = 401.1;
  w.counter.clean();
  assert.equal(h.counter.pulses.length, 2);
  assert.deepEqual(h.counter.pulses[0], first);
  const second = h.counter.pulses[1];
  assert(Math.abs(second.due - w.time - 2.4) < 1e-8);
  assert.equal(second.x, e.x);
  assert.equal(second.y, e.y);
  const angle = second.angle;
  w.player = { x: 2, y: -2 };
  w.time += 0.5;
  w.counter.clean();
  assert.equal(second.angle, angle);
  assert.equal(w.counter.slots, 1);
});
test("capsule and finite sector use continuous collision, exact edges, and harmless warnings/wakes", () => {
  const w = world(),
    e = boss(w),
    f = w.counter.pulse(e, "B", 1);
  assert.equal(f.shape, "thrust");
  assert(!counterImpact(f, { x: 0, y: 0 }, f.due - 0.001));
  assert(
    counterImpact(f, { x: 0, y: 2 }, f.end + 0.1, f.due - 0.1, { x: 0, y: -2 }),
  );
  assert(!counterImpact(f, { x: 0, y: 0.721 }, f.due));
  assert(counterImpact(f, { x: 0, y: 0.719 }, f.due));
  assert(!counterImpact(f, { x: 0, y: 0 }, f.end, f.end));
  const sweep = w.counter.pulse(e, "A", 1);
  assert.equal(counterDistance(sweep, { x: e.x - 1, y: e.y }), 1);
  assert(!counterImpact(sweep, { x: e.x - 1, y: e.y }, sweep.due));
  assert(counterImpact(sweep, { x: 0, y: 0 }, sweep.due));
});
test("a rejected second lock cancels only its future pulse without altering first geometry", () => {
  const w = world(),
    e = boss(w);
  w.counter.begin(e, "A");
  const h = e.counter.item,
    first = structuredClone(h.counter.pulses[0]);
  w.camera = { x: 100, y: 100 };
  w.time = 401;
  w.counter.clean();
  assert.deepEqual(h.counter.pulses, [first]);
  assert.equal(h.counter.pendingAt, undefined);
  assert(h.counter.interrupted);
  assert.equal(h.until, first.end);
});
test("freeze/death cancel future beats while a released beat completes its original short window", () => {
  const w = world(),
    e = boss(w);
  w.counter.begin(e, "A");
  const h = e.counter.item;
  w.time = 402.45;
  const end = h.counter.pulses[0].end;
  counterCut(h, w.time);
  assert.equal(h.until, end);
  assert.equal(h.counter.pendingAt, undefined);
  assert(counterImpact(h.counter.pulses[0], { x: 0, y: 0 }, w.time));
  assert(!counterImpact(h.counter.pulses[0], { x: 0, y: 0 }, end, end));
  const x = world(),
    b = boss(x);
  x.counter.begin(b, "A");
  x.time += 0.5;
  b.freezeUntil = x.time + 1;
  x.counter.clean();
  assert(b.counter.item.counter.interrupted);
  assert.equal(b.counter.item.until, x.time);
});
test("pause stops locks and movement, while physical warning owners stay stationary", () => {
  const w = world(),
    e = boss(w);
  w.counter.begin(e, "A");
  const p = { x: e.x, y: e.y };
  w.pause("test", true);
  w.step(2);
  w.counter.clean();
  assert.equal(w.time, 400);
  assert.equal(e.counter.item.counter.pulses.length, 1);
  assert.deepEqual({ x: e.x, y: e.y }, p);
});
test("support gives only nearby basic enemies nonstacking armor, respects fracture, and ends immediately", () => {
  const w = world(),
    a = w.addEnemy("chimeshard", 0, 0),
    support = w.addEnemy("resonancebearer", 1, 0),
    special = w.addEnemy("forklancer", 1, 1),
    elite = w.addEnemy("broadcantor", 2, 1);
  const incoming = (e) =>
    w.stageStrategy.combat.incoming(e, 100, w.player, false);
  assert.equal(incoming(a), 65);
  w.addEnemy("resonancebearer", 2, 0);
  assert.equal(incoming(a), 65);
  assert.equal(incoming(special), 65);
  assert.equal(incoming(elite), 50);
  a.fracture = 1;
  a.fractureUntil = w.time + 1;
  assert.equal(incoming(a), 100);
  a.fracture = 0;
  support.hp = 0;
  w.enemies.find((e) => e.kind === "resonancebearer" && e.hp > 0).x = 8;
  assert.equal(incoming(a), 80);
  assert.equal(incoming(support), 65);
});
test("retiring specials finish their active window, then leave without loot or kill credit", () => {
  const w = world(),
    e = w.addEnemy("forklancer", -2, 0);
  w.counter.begin(e, "B");
  const h = e.counter.item;
  w.time = h.due + 0.05;
  const end = h.until;
  w.counter.retireSpecials();
  assert.equal(h.until, end);
  assert(e.hp > 0);
  w.time = end + 0.61;
  w.counter.retireSpecials();
  assert.equal(e.hp, 0);
  assert.equal(w.kills, 0);
  assert.equal(w.gold, 0);
  assert.equal(w.gems.length, 0);
});
test("paired elites use two real owners, later full lock, and cannot admit a third reservation", () => {
  const w = world(),
    a = w.addEnemy("broadcantor", -3, 0),
    b = w.addEnemy("needleconductor", 2, 1);
  assert(w.counter.pair(a, b));
  assert.equal(w.counter.slots, 2);
  assert.equal(b.counter.item.counter.pulses.length, 0);
  const e = boss(w);
  assert(!w.counter.begin(e));
  w.time += 1;
  w.counter.clean();
  assert.equal(b.counter.item.counter.pulses.length, 1);
  assert(Math.abs(b.counter.item.counter.pulses[0].due - w.time - 2.4) < 1e-8);
  assert.equal(b.counter.item.counter.pulses[0].x, b.x);
});
test("real collision while invulnerable disqualifies a group; cancellation and harmless out-of-range casts do not certify", () => {
  const w = world(),
    e = boss(w);
  w.counter.begin(e, "A");
  w.time += 0.9;
  w.counter.clean();
  w.invulnerable = 1;
  w.time = 402.5;
  w.counter.stepHazard(e.counter.item);
  assert.equal(w.hp, 100);
  assert(e.counter.item.counter.collided);
  w.time = 404;
  w.counter.stepEnemy(e, 0.1);
  w.hit(e, 1, "blade");
  assert.equal(w.challenge.counterGroups.A, 0);
  const x = world(),
    b = boss(x);
  x.player = { x: 4, y: 0 };
  x.counter.begin(b, "A");
  x.time += 0.9;
  x.counter.clean();
  x.player = { x: -3, y: 2 };
  x.time = 404;
  x.counter.stepEnemy(b, 0.1);
  x.hit(b, 1, "blade");
  assert.equal(x.challenge.counterGroups.A, 0);
});
test("completed threatening double beats certify exactly once in the real recovery-hit path", () => {
  const w = world(),
    e = boss(w);
  w.counter.begin(e, "A");
  w.time += 0.9;
  w.counter.clean();
  w.player = { x: -3, y: 2 };
  w.time = 404;
  w.counter.stepEnemy(e, 0.1);
  assert.equal(e.state, "recover");
  w.hit(e, 10, "blade");
  w.hit(e, 10, "blade");
  assert.equal(w.challenge.counterGroups.A, 1);
});
test("mastery requires two different launch openers in every role and survives a cold reload", () => {
  const s = storage(),
    p = new ProgressStore(s);
  const certify = (skill) => {
    const w = world();
    w.startingWeapon = skill;
    w.skills[skill] = 8;
    w.mods[skill] = TRACE_RECIPES[skill][0].split("+");
    w.challenge.counterElite = true;
    w.challenge.counterGroups = { A: 2, B: 2, C: 2 };
    w.state = "won";
    p.observe(w);
    return w;
  };
  for (const role of COUNTERBEAT_ROLES) certify(role.skills[0]);
  assert(!p.hasAchievement("counterbeat_mastery"));
  certify("blade");
  assert.equal(p.data.counterbeatMastery.length, 6);
  for (const role of COUNTERBEAT_ROLES) certify(role.skills[1]);
  assert(p.hasAchievement("counterbeat_mastery"));
  assert.equal(p.data.counterbeatMastery.length, 12);
  assert.deepEqual(
    new ProgressStore(s).data.counterbeatMastery,
    p.data.counterbeatMastery,
  );
});
test("failed runs, missing elite/counter groups or boss damage cannot certify", () => {
  for (const reason of ["lost", "elite", "group", "hurt", "mods"]) {
    const p = new ProgressStore(storage()),
      w = world();
    w.startingWeapon = "blade";
    w.skills.blade = 8;
    w.mods.blade = ["hunt", "return"];
    w.challenge.counterElite = true;
    w.challenge.counterGroups = { A: 2, B: 2, C: 2 };
    w.state = "won";
    if (reason === "lost") w.state = "lost";
    if (reason === "elite") w.challenge.counterElite = false;
    if (reason === "group") w.challenge.counterGroups.B = 1;
    if (reason === "hurt") w.challenge.bossHits = 1;
    if (reason === "mods") w.mods.blade = [];
    p.observe(w);
    assert(!p.data.counterbeatMastery?.length, reason);
  }
});
test("malformed and future optional fields retain wallet, old clears, and grades", () => {
  for (const field of [
    { counterbeatMasteryVersion: 2, counterbeatMastery: ["blade"] },
    {
      counterbeatMasteryVersion: 1,
      counterbeatMastery: ["blade", "bogus", "blade"],
    },
    { counterbeatMasteryVersion: 1, counterbeatMastery: { bad: true } },
  ]) {
    const raw = {
        ...freshProgress(),
        coins: 900,
        stages: [1, 17],
        grades: { holy: 3 },
        ...field,
      },
      r = decodeProgress(raw);
    assert(r);
    assert.equal(r.data.coins, 900);
    assert.deepEqual(r.data.stages, [1, 17]);
    assert.equal(r.data.grades.holy, 3);
    assert(!r.data.counterbeatMastery?.includes("bogus"));
    assert((r.data.counterbeatMastery?.length ?? 0) <= 1);
  }
});
test("holy epic replaces its family, costs 1440, raises damage only, and has a fourth distinct glyph", async () => {
  const p = new ProgressStore(storage());
  p.data.coins = 1440;
  p.data.grades = { holy: 3 };
  assert.equal(p.evolveWeapon("holy", 3), "evolved");
  assert.equal(p.coins, 0);
  assert.equal(nextGrade("holy", p.weaponGrades), null);
  assert.equal(gradeMultiplier("holy", p.weaponGrades), 2.05);
  assert.equal(weaponName("holy", p.weaponGrades), "寂律天裁");
  assert.notEqual(p.evolveWeapon("holy", 3), "evolved");
  const { drawWeaponGlyph } =
    await import("../temp/tests/presentation/art/WeaponGlyph.mjs");
  const { Graphics } = await import("../temp/tests/node_modules/cc/index.mjs");
  const sig = [];
  for (const grade of [1, 2, 3, 4]) {
    const g = new Graphics();
    drawWeaponGlyph(g, "holy", grade);
    sig.push(JSON.stringify(g.operations ?? g.paths ?? g));
  }
  assert.equal(new Set(sig).size, 4);
});
test("map keeps both base-radius body routes connected and central arena open", () => {
  for (const r of [0.3, 0.7]) {
    assert(!counterbeatMap.blocked({ x: 0, y: 0 }, r));
    for (const x of [-4, 4])
      assert(!counterbeatMap.segment({ x, y: -8 }, { x, y: 18 }, r));
    assert(counterbeatMap.blocked({ x: -11, y: -10 }, r));
  }
});

test("a genuine two-owner completed pair allows recovery certification, any damage during it prevents certification", () => {
  for (const damaged of [false, true]) {
    const w = world(),
      a = w.addEnemy("broadcantor", -3, 0),
      b = w.addEnemy("needleconductor", 2, 1);
    assert(w.counter.pair(a, b));
    w.time += 0.9;
    w.counter.clean();
    if (damaged) w.hurt(1, "chimeshard", false);
    w.player = { x: -3, y: 2 };
    w.time = 404;
    w.counter.stepEnemy(a, 0.1);
    w.counter.stepEnemy(b, 0.1);
    w.hit(a, 10, "blade");
    assert.equal(w.challenge.counterElite, !damaged);
  }
});
test("three elite rounds use full health, the returning pair shares the arena, and boss waits for handover", () => {
  const w = world();
  for (const [t, kind] of [
    [135, "broadcantor"],
    [225, "needleconductor"],
    [305, "broadcantor"],
  ]) {
    w.enemies = [];
    w.hazards = [];
    w.time = t;
    w.counter.director(1);
    const e = w.enemies.find((e) => e.kind === kind);
    assert(e);
    assert.equal(e.hp, e.maxHp);
  }
  w.time = 311;
  w.counter.director(1);
  const actors = w.enemies.filter((e) =>
    ["broadcantor", "needleconductor"].includes(e.kind),
  );
  assert.equal(actors.length, 2);
  assert(actors.every((e) => e.hp === e.maxHp));
  w.time = 360;
  w.counter.director(1);
  assert(!w.enemies.some((e) => e.kind === "boss"));
  for (const e of actors) {
    e.state = "seek";
    w.hit(e, 1e9, "blade");
  }
  w.time = 362.9;
  w.counter.director(0.1);
  assert(!w.enemies.some((e) => e.kind === "boss"));
  w.time = 363;
  w.counter.director(0.1);
  assert(w.enemies.some((e) => e.kind === "boss"));
});
test("normal specialties are introduced separately before combined role pressure", () => {
  const w = world();
  for (const [t, kind] of [
    [30, "forklancer"],
    [65, "pipereader"],
    [95, "resonancebearer"],
  ]) {
    w.enemies = [];
    w.time = t;
    w.counter.director(20);
    const special = w.enemies.filter((e) => e.kind !== "chimeshard");
    assert.equal(special.length, 1);
    assert.equal(special[0].kind, kind);
  }
});

test("paired elite leadership actually alternates across successive coordinated casts", () => {
  const w = world();
  w.hp = w.maxHp = 1e8;
  w.director.step = () => {};
  w.armory.step = () => {};
  for (const [k, x, y] of [
    ["broadcantor", -3, 0],
    ["needleconductor", 2, 1],
  ]) {
    const e = w.addEnemy(k, x, y);
    e.attack = 0;
  }
  const leaders = [],
    publish = w.counter.pair.bind(w.counter);
  w.counter.pair = (a, b) => {
    const ok = publish(a, b);
    if (ok) leaders.push(a.kind);
    return ok;
  };
  for (let i = 0; i < 1800; i++) {
    w.step(1 / 30);
    w.drain();
  }
  assert(leaders.length >= 4);
  assert.equal(new Set(leaders).size, 2);
  for (let i = 1; i < leaders.length; i++)
    assert.notEqual(leaders[i], leaders[i - 1]);
});

test("a weapon freeze before impact cancels before the next actual frame sweeps across the due time", () => {
  const w = world(),
    e = boss(w);
  w.director.step = () => {};
  w.armory.step = () => {};
  assert(w.counter.begin(e, "A"));
  w.time = e.counter.item.due - 0.05;
  w.slow(e, true);
  w.step(0.1);
  assert.equal(w.hp, 100);
  assert(e.counter.item.counter.interrupted);
  assert(e.counter.item.counter.pulses[0].cancelled);
});
