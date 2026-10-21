import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { ENEMIES, ALL_WEAPONS } from "../temp/tests/battle/SurvivalConfig.mjs";
import { MODS, weaponStats } from "../temp/tests/battle/ArmoryConfig.mjs";
import { kilnMap, KILN_BASES } from "../temp/tests/battle/KilnMap.mjs";
import {
  kilnImpact,
  kilnSegments,
  kilnCut,
  kilnEscape,
  kilnSolid,
  kilnPoint,
} from "../temp/tests/battle/KilnGeometry.mjs";
import { stageGrowth } from "../temp/tests/battle/StageGrowth.mjs";
import {
  ProgressStore,
  PROGRESS_KEY,
} from "../temp/tests/platform/ProgressStore.mjs";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { drawKilnHazard } from "../temp/tests/presentation/art/KilnHazardArt.mjs";
import { drawActorLayer } from "../temp/tests/presentation/art/EnemyPainter.mjs";
import { drawWeaponGlyph } from "../temp/tests/presentation/art/WeaponGlyph.mjs";
import {
  validGrade,
  weaponName,
  nextGrade,
} from "../temp/tests/battle/WeaponGrade.mjs";
function world() {
  const w = new SurvivalWorld(19, "ranger", 12);
  w.player = { x: 0, y: 0 };
  w.camera = { x: 0, y: 0 };
  w.enemies = [];
  for (const s of ALL_WEAPONS) w.skills[s] = 0;
  return w;
}
function actor(w, kind = "forkmason", x = 3, y = 0) {
  const e = w.addEnemy(kind, x, y);
  e.state = "seek";
  e.attack = 0;
  return e;
}
function line(w, shape = "fork", angle = 0) {
  return w.kiln.thread(actor(w), shape, { x: 0, y: 0 }, angle);
}
const storage = () => {
  const m = new Map();
  return {
    m,
    getItem: (k) => m.get(k) || null,
    setItem: (k, v) => m.set(k, v),
  };
};
test("kiln stage growth, spawn, fixed device health, elite contact and previous-clear prerequisite", () => {
  const w = new SurvivalWorld(19, "ranger", 12);
  assert.equal(w.player.y, -9);
  assert.equal(w.stageStrategy.map, kilnMap);
  w.time = 240;
  const e = actor(w, "splitcrucible");
  assert.equal(ENEMIES.splitcrucible.health, 21);
  assert.equal(ENEMIES.splitcrucible.contact, 24);
  assert(Math.abs(e.maxHp - 30 * 1.8 * 21 * stageGrowth(12).elite) < 1e-8);
  assert.equal(Math.round(actor(w, "boss").maxHp), 59173);
  const p = new ProgressStore(storage());
  assert(!p.unlockedStage(12));
  p.data.stages = [11];
  assert(p.unlockedStage(12));
});
test("finite fire has safe warning, tail passage, dark rejected branch and round cap boundary", () => {
  const w = world(),
    h = line(w),
    d = h.due;
  assert(!kilnImpact(h, { x: -1, y: 0 }, d - 0.01, d - 0.1));
  assert(kilnImpact(h, { x: -1, y: 0 }, d + 0.7, d + 0.6));
  assert(!kilnImpact(h, { x: -1, y: 0.521 }, d + 0.7, d + 0.6));
  assert(kilnImpact(h, { x: -1, y: 0.519 }, d + 0.7, d + 0.6));
  assert(!kilnImpact(h, { x: -1.8, y: 0 }, d + 1.8, d + 1.7));
  const dark = h.kiln.preview[1];
  assert(!kilnImpact(h, dark, h.until, d));
  assert(!kilnImpact(h, { x: 0, y: 0 }, h.until + 0.1, h.until));
  assert.equal(kilnSegments(h, h.until).length, 0);
});
test("low-frame sweeps split at fork and tail nodes rather than cutting across corners", () => {
  for (const angle of [0, Math.PI / 4, -Math.PI / 3]) {
    const w = world(),
      h = line(w, "bend", angle),
      p = kilnPoint(h, 3.2);
    assert(kilnImpact(h, p, h.until, h.due));
    const far = { x: 20, y: 20 };
    assert(!kilnImpact(h, far, h.until, h.due));
  }
  const w = world(),
    h = line(w, "bend");
  assert(!kilnImpact(h, { x: 1, y: -1.2 }, h.until, h.due));
});
test("one plan tries damage only once across bend overlap and retains boss attribution", () => {
  const w = world(),
    boss = actor(w, "boss"),
    h = w.kiln.thread(boss, "fork");
  w.hazards = [h];
  w.hp = w.maxHp = 500;
  w.player = { x: 0, y: 0 };
  w.time = h.due + 1.3;
  w.kiln.sample(w.player, w.player, h.due, w.time);
  assert.equal(w.hp, 474);
  assert.equal(w.challenge.bossHits, 1);
  w.invulnerable = 0;
  w.time += 0.3;
  w.kiln.sample(w.player, w.player, h.due, w.time);
  assert.equal(w.hp, 474);
});
test("prewarning cancel, trunk cutoff and late branch cutoff preserve already released finite fire", () => {
  const w = world();
  let h = line(w);
  kilnCut(h, h.due - 0.1);
  assert(h.kiln.cancelled);
  h = line(w);
  kilnCut(h, h.due + 0.5);
  assert.equal(h.kiln.limit, 2);
  assert.equal(h.until, h.due + 2);
  assert(kilnImpact(h, { x: -0.4, y: 0 }, h.due + 1.4, h.due + 0.5));
  assert(!kilnImpact(h, { x: 1, y: 1 }, h.until, h.due));
  h = line(w);
  const until = h.until;
  kilnCut(h, h.due + 1.3);
  assert.equal(h.until, until);
  assert.equal(h.kiln.limit, 4.4);
});
function publish(w, phase = 1) {
  const e = actor(w, "boss");
  e.bossPhase = phase;
  w.kiln.state(e).action = "B";
  assert(w.kiln.begin(e));
  assert.equal(w.hazards.length, 1);
  return {
    e,
    h: w.hazards[0],
    v: w.enemies.find((e) => e.kind === "kilnvalve" && e.hp > 0),
  };
}
test("valve has fixed unarmored health, optional proximity priority, no kill rewards or old achievement", () => {
  const w = world(),
    { v, h } = publish(w);
  assert.equal(v.hp, 160);
  assert(v.immovable);
  assert.equal(w.target().id, v.id);
  w.slow(v, true);
  assert.equal(v.freezeUntil, 0);
  w.hit(v, 60, "blade");
  assert.equal(v.hp, 100);
  const before = { kills: w.kills, gold: w.gold, gems: w.gems.length };
  w.hit(v, 100, "blade");
  assert.deepEqual(
    { kills: w.kills, gold: w.gold, gems: w.gems.length },
    before,
  );
  assert(h.kiln.cancelled);
  assert.equal(w.challenge.devices.size, 0);
  assert(w.challenge.kilnPhases.has(1));
});
test("challenge uses publication phase and excludes late break, owner death, freeze and natural cleanup", () => {
  for (const mode of ["early", "late", "death", "freeze", "expiry"]) {
    const w = world(),
      { e, h, v } = publish(w, 2);
    e.bossPhase = 3;
    if (mode === "early") w.time = h.due + 0.5;
    else if (mode === "late") w.time = h.due + 1.3;
    else if (mode === "expiry") w.time = h.until;
    if (mode === "early" || mode === "late") w.hit(v, 1000, "bone");
    else if (mode === "death") {
      e.hp = 0;
      w.kiln.onDeath(e);
    } else if (mode === "freeze") {
      e.freezeUntil = 10;
      w.kiln.clean();
    } else w.kiln.clean();
    assert.equal(w.challenge.kilnPhases.has(2), mode === "early");
    assert(!w.challenge.kilnPhases.has(3));
    if (mode === "expiry") assert.equal(v.hp, 0);
  }
});
test("paired plans reserve both slots and devices atomically, including delayed warnings", () => {
  const w = world(),
    e = actor(w, "boss");
  w.kiln.state(e).action = "C";
  assert(w.kiln.begin(e));
  assert.equal(w.kiln.slots, 2);
  assert.equal(w.enemies.filter((e) => e.kind === "kilnvalve").length, 2);
  assert(Math.abs(w.hazards[1].due - w.hazards[0].due - 0.8) < 1e-8);
  assert.equal(w.hazards[1].created, w.time);
  const x = actor(w, "forkmason");
  w.kiln.state(x).action = "fork";
  assert(!w.kiln.begin(x));
  assert.equal(w.hazards.length, 2);
  const full = world(),
    boss = actor(full, "boss");
  for (let i = 0; i < 98; i++) actor(full, "glazeling", 19, 19);
  full.kiln.state(boss).action = "C";
  assert(!full.kiln.begin(boss));
  assert.equal(full.hazards.length, 0);
  assert.equal(full.enemies.filter((e) => e.kind === "kilnvalve").length, 0);
});
test("geometry checks full wall width, visible preview, exact path lengths and no-valve escape", () => {
  const w = world(),
    e = actor(w, "boss");
  w.kiln.state(e).action = "C";
  const p = w.kiln.plan(e);
  assert(p.every((h) => w.kiln.legal(h)));
  assert(kilnEscape(w, p));
  for (const h of p) {
    assert.equal(h.kiln.length, 4.4);
    assert.equal(h.kiln.limit, 4.4);
  }
  const h = w.kiln.thread(e, "straight", { x: -13, y: -12 });
  assert(kilnSolid(h));
});
test("boss can skip phases without healing/locking; old current segment drains before new attacks", () => {
  const w = world(),
    { e, h } = publish(w);
  w.time = h.due + 0.4;
  e.hp = e.maxHp * 0.3;
  const hp = e.hp;
  w.kiln.stepEnemy(e, 0.05);
  assert.equal(e.bossPhase, 3);
  assert.equal(e.hp, hp);
  assert.equal(w.kiln.state(e).action, "transition");
  assert.equal(h.kiln.limit, 2);
  assert(w.kiln.state(e).next >= h.until);
  assert(!w.challenge.kilnPhases.size);
});
function qualify(p, skill, pair, phase = [1, 2, 3], hits = 0, stage = 12) {
  const w = world();
  w.stageId = stage;
  w.startingWeapon = skill;
  w.skills[skill] = 8;
  w.mods[skill] = pair;
  w.challenge.kilnPhases = new Set(phase);
  w.challenge.bossHits = hits;
  w.state = "won";
  p.observe(w);
  return w;
}
function pairs(skill) {
  const m = MODS[skill];
  return m.flatMap((a, i) =>
    m
      .slice(i + 1)
      .filter((b) => a.excludes !== b.id && b.excludes !== a.id)
      .map((b) => [a.id, b.id]),
  );
}
test("ten opener double routes require twenty qualified wins, normalize pairs and deduplicate settlement", () => {
  const s = storage(),
    p = new ProgressStore(s);
  let last;
  for (const skill of ALL_WEAPONS.slice(0, 10)) {
    last = qualify(p, skill, pairs(skill)[0]);
    qualify(p, skill, pairs(skill)[0].slice().reverse());
    assert(!p.hasAchievement("kiln_ten_paths"));
    last = qualify(p, skill, pairs(skill)[1]);
  }
  assert(p.hasAchievement("kiln_ten_paths"));
  assert(p.hasAchievement("glazekiln_clear"));
  assert(!p.hasAchievement("loom_eight_paths"));
  assert(!p.hasAchievement("seal_pathfinder"));
  assert(!p.hasAchievement("triple_mastery"));
  const coins = p.coins;
  p.observe(last);
  assert.equal(p.coins, coins);
  const q = new ProgressStore(s);
  assert.deepEqual(q.data.kilnQualified, p.data.kilnQualified);
});
test("failed criteria retain existing qualification; old account and corrupt optional challenge preserve wallet", () => {
  const s = storage(),
    p = new ProgressStore(s);
  qualify(p, "bone", pairs("bone")[0]);
  for (const [phases, hits, stage] of [
    [[1, 2], 0, 12],
    [[1, 2, 3], 1, 12],
    [[1, 2, 3], 0, 11],
  ])
    qualify(p, "bone", pairs("bone")[1], phases, hits, stage);
  assert.equal(p.data.kilnQualified.bone.length, 1);
  const d = JSON.parse(JSON.stringify(p.data));
  d.kilnQualified = { bone: ["fake+bad", ...d.kilnQualified.bone] };
  s.setItem(PROGRESS_KEY, JSON.stringify(d));
  s.m.delete(PROGRESS_KEY + "-backup");
  const q = new ProgressStore(s);
  assert.equal(q.coins, p.coins);
  assert.deepEqual(q.data.kilnQualified.bone, p.data.kilnQualified.bone);
});
test("bone forms preserve same family, price path, grade multiplier, geometry and ridge proc ceiling", () => {
  const shapes = [];
  for (const grade of [1, 2, 3, 4]) {
    assert(validGrade("bone", grade));
    const w = world();
    w.skills.bone = 8;
    w.weaponGrades.bone = grade;
    w.mods.bone = ["ridge", "marrow"];
    const g = new Graphics();
    drawWeaponGlyph(g, "bone", grade);
    shapes.push(
      JSON.stringify(g.commands.map(({ op, d, width }) => ({ op, d, width }))),
    );
    assert.equal(
      weaponName("bone", w.weaponGrades),
      ["贯阵骨矛", "棘脊骨枪", "釉裂骨矛", "焚髓贯星"][grade - 1],
    );
    assert.equal(
      nextGrade("bone", w.weaponGrades),
      grade === 4 ? null : grade + 1,
    );
  }
  assert.equal(new Set(shapes).size, 4);
});
test("kiln actors, arrows, dark preview and live head draw in Graphics without exceptions", () => {
  const w = world();
  for (const [i, k] of [
    "glazeling",
    "kilnstoker",
    "forkmason",
    "ashsled",
    "splitcrucible",
    "glazejailer",
    "kilnvalve",
    "boss",
  ].entries())
    actor(w, k, (i % 4) * 2 - 3, Math.floor(i / 4) * 3 - 2);
  const g = new Graphics();
  drawActorLayer(g, w, false);
  const before = g.vertexCount,
    h = line(w);
  for (const t of [0, h.due + 0.1, h.due + 1.5, h.until - 0.1])
    drawKilnHazard(g, h, t);
  assert(g.vertexCount > before);
});
test("dead or frozen owner cannot leave a challenge-eligible valve during released trunk", () => {
  for (const mode of ["death", "freeze", "transition"]) {
    const w = world(),
      { e, h, v } = publish(w, 1);
    w.time = h.due + 0.25;
    if (mode === "death") {
      e.hp = 0;
      w.kiln.onDeath(e);
    } else if (mode === "freeze") {
      e.freezeUntil = w.time + 1;
      w.kiln.clean();
    } else {
      e.hp = e.maxHp * 0.3;
      w.kiln.stepEnemy(e, 0.01);
    }
    w.hit(v, 1000, "bone");
    assert(!w.challenge.kilnPhases.size);
    assert.equal(h.kiln.limit, 2);
  }
});
test("paused menus freeze the fire clock and actual movement cannot tunnel across refractory walls", () => {
  const w = world(),
    { h } = publish(w);
  const time = w.time;
  w.pauses.add("upgrade");
  w.step(1);
  assert.equal(w.time, time);
  assert.equal(h.kiln.last, time);
  for (const box of KILN_BASES)
    for (const side of [-1, 1])
      for (const axis of ["x", "y"]) {
        const q = world();
        q.director.step = () => {};
        q.armory.step = () => {};
        const half = axis === "x" ? box.halfWidth : box.halfHeight;
        q.player = { x: box.x, y: box.y };
        q.player[axis] += side * (half + 0.31);
        q.setMove(axis === "x" ? -side : 0, axis === "y" ? -side : 0);
        q.step(1);
        assert(side * (q.player[axis] - box[axis]) >= half + 0.3 - 1e-9);
      }
});
test("swept collision agrees with dense instantaneous geometry along moving player paths", () => {
  const w = world();
  let seed = 7;
  const rand = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 180; i++) {
    w.enemies = [];
    const h = line(w, i % 2 ? "bend" : "fork", rand() * Math.PI * 2),
      from = h.due + rand() * 2.8,
      to = Math.min(h.until, from + 0.1 + rand() * 0.7),
      a = { x: rand() * 7 - 3.5, y: rand() * 7 - 3.5 },
      z = { x: a.x + rand() * 3 - 1.5, y: a.y + rand() * 3 - 1.5 };
    let dense = false;
    for (let j = 0; j <= 500; j++) {
      const f = j / 500,
        t = from + (to - from) * f,
        p = { x: a.x + (z.x - a.x) * f, y: a.y + (z.y - a.y) * f };
      if (kilnImpact(h, p, t, t)) {
        dense = true;
        break;
      }
    }
    const swept = kilnImpact(h, z, to, from, a);
    if (dense) assert(swept, "sweep missed a real intersection");
    // A mathematical tangent can exist between dense samples, so only use sampled positives as an oracle.
  }
});
test("bone evolution trades charge once, retain slot and old wallet through cold load", () => {
  const s = storage(),
    p = new ProgressStore(s);
  p.data.coins = 2520;
  const count = p.availableWeapons.length;
  for (const grade of [1, 2, 3]) {
    assert.equal(p.evolveWeapon("bone", grade), "evolved");
    const coins = p.coins;
    assert.notEqual(p.evolveWeapon("bone", grade), "evolved");
    assert.equal(p.coins, coins);
  }
  assert.equal(p.coins, 0);
  assert.equal(p.availableWeapons.length, count);
  assert.equal(new ProgressStore(s).weaponGrades.bone, 4);
});

test("late ordinary duet uses two actual owners and coordinates an idle partner with full warning", () => {
  const w = world();
  w.time = 270;
  const a = actor(w, "forkmason", 3, 0),
    b = actor(w, "forkmason", -3, 0);
  b.attack = 2;
  w.kiln.state(a).action = "fork";
  assert(w.kiln.begin(a));
  assert.equal(w.hazards.length, 2);
  assert.deepEqual(
    new Set(w.hazards.map((h) => h.source)),
    new Set([a.id, b.id]),
  );
  assert.equal(b.state, "windup");
  for (const h of w.hazards) {
    assert(h.due - w.time >= 2);
    const valve = w.enemies.find((e) => e.id === h.kiln.valveId);
    assert.equal(valve.owner, h.source);
  }
});
