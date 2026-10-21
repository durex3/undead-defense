import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { ALL_WEAPONS, ENEMIES } from "../temp/tests/battle/SurvivalConfig.mjs";
import {
  graveDistance,
  graveImpact,
  graveEscape,
} from "../temp/tests/battle/EchoGraveGeometry.mjs";
import { battleHud } from "../temp/tests/presentation/BattleHud.mjs";
import { battleReport } from "../temp/tests/battle/BattleReport.mjs";
import {
  ProgressStore,
  PROGRESS_KEY,
} from "../temp/tests/platform/ProgressStore.mjs";
import { MODS, weaponStats } from "../temp/tests/battle/ArmoryConfig.mjs";
import { nextGrade, validGrade } from "../temp/tests/battle/WeaponGrade.mjs";
const storage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
function world() {
  const w = new SurvivalWorld(41, "ranger", 16);
  w.enemies = [];
  w.player = { x: 0, y: 0 };
  w.camera = { x: 0, y: 0 };
  for (const s of ALL_WEAPONS) w.skills[s] = 0;
  return w;
}
function boss(w) {
  const e = w.addEnemy("boss", -3, 0);
  e.state = "seek";
  e.attack = 0;
  return e;
}
const pulse = (props = {}) => ({
  x: 0,
  y: 0,
  angle: 0,
  radius: 4.2,
  half: Math.PI / 4,
  due: 2.4,
  end: 2.58,
  old: false,
  hit: false,
  ...props,
});
const lethal = (w, e) => w.hit(e, 1e9, "blade");
function revive(w, e) {
  lethal(w, e);
  w.time = e.grave.deadUntil;
  w.grave.tick();
}
test("16 uses total formula budget split40/60 and same-time elite HP100%", () => {
  const w = world(),
    e = boss(w);
  assert(Math.abs(e.grave.total - 63198.69855006663) < 1e-7);
  assert.equal(e.maxHp, e.grave.total * 0.4);
  assert.equal(ENEMIES.coffinregent.health, 23.2);
  assert.equal(ENEMIES.scarprelate.contact, 26);
  assert.equal(nextGrade("fire", { fire: 3 }), 4);
  assert(validGrade("fire", 4));
  const p = new ProgressStore(storage());
  assert(!p.unlockedStage(16));
  p.data.stages = [15];
  assert(p.unlockedStage(16));
});
test("filled sector exact arc, radial edges, no false back-circle and half-open pulse", () => {
  const f = pulse();
  assert.equal(graveDistance(f, { x: 0, y: 0 }), 0);
  assert(graveImpact(f, { x: 4.5, y: 0 }, 2.4));
  assert(!graveImpact(f, { x: 4.501, y: 0 }, 2.4));
  assert(!graveImpact(f, { x: -1, y: 0 }, 2.4));
  assert(!graveImpact(f, { x: 1, y: 0 }, 2.399));
  assert(!graveImpact(f, { x: 1, y: 0 }, 2.58));
  assert(graveImpact(f, { x: 1, y: 1.3 }, 2.4));
});
test("low FPS clips movement to active pulse; crosses sector continuously and excludes earlier crossing", () => {
  const f = pulse();
  assert(graveImpact(f, { x: 2, y: 5 }, 2.56, 2.41, { x: 2, y: -5 }));
  assert(!graveImpact(f, { x: 2, y: 8 }, 2.6, 2, { x: 2, y: -3 }));
  assert(graveImpact(f, { x: 1, y: 0 }, 3, 1, { x: 1, y: 0 }));
});
test("all six form patterns have exact warning, <=2 reserved chains, base-speed joint escape", () => {
  for (const life of [1, 2])
    for (const action of ["A", "B", "C"]) {
      const w = world(),
        e = boss(w),
        s = e.grave;
      s.life = life;
      s.action = action;
      s.scar = pulse({ x: -3, y: 2, angle: 0 });
      s.scarUntil = 12;
      assert(w.grave.begin(e), life + action);
      assert(s.items.length <= 2);
      assert(graveEscape(w, s.items));
      for (const h of s.items)
        for (const f of h.grave.pulses) assert(f.due >= 2.4 - 1e-8);
    }
});
test("echo retains original geometry and full2.4 warning from initial end; snapshots do not follow actors", () => {
  const w = world(),
    e = boss(w);
  e.grave.action = "B";
  const hs = w.grave.plan(e),
    [a, b] = hs[0].grave.pulses;
  for (const k of ["x", "y", "angle", "radius", "half"])
    assert.equal(a[k], b[k]);
  assert(Math.abs(b.due - a.end - 2.4) < 1e-8);
  const snapshot = JSON.stringify(hs);
  e.x = 10;
  w.player.x = 9;
  assert.equal(JSON.stringify(hs), snapshot);
});
test("expired or prior-life cache is cleared on resurrection; secondB degrades to body only", () => {
  const w = world(),
    e = boss(w);
  e.grave.scar = pulse();
  e.grave.scarUntil = 99;
  revive(w, e);
  assert.equal(e.grave.scar, undefined);
  e.grave.action = "B";
  assert.equal(w.grave.plan(e).length, 1);
});
test("first lethal does not win, reward, kill or become targetable; repeated hits cannot bank into life2", () => {
  const w = world(),
    e = boss(w);
  const kills = w.kills;
  lethal(w, e);
  assert.equal(e.hp, 0);
  assert.equal(w.state, "battle");
  assert.equal(w.kills, kills);
  assert(w.grave.keep(e));
  assert.equal(w.target(), undefined);
  lethal(w, e);
  assert.equal(w.kills, kills);
  w.time = 2.399;
  w.grave.tick();
  assert.equal(e.hp, 0);
  w.time = 2.4;
  w.grave.tick();
  assert.equal(e.hp, e.grave.total * 0.6);
  assert.equal(e.grave.life, 2);
  const hp = e.hp;
  w.grave.tick();
  assert.equal(e.hp, hp);
});
test("active first-life pulse survives, future echo cancels, revival starts after released tail", () => {
  const w = world(),
    e = boss(w);
  e.grave.action = "B";
  const hs = w.grave.plan(e);
  w.hazards = hs;
  e.grave.items = hs;
  w.time = 2.45;
  lethal(w, e);
  assert(!hs[0].grave.pulses[0].cancelled);
  assert(hs[0].grave.pulses[1].cancelled);
  assert(Math.abs(e.grave.deadUntil - 4.98) < 1e-8);
  w.time = 2.5;
  w.player = { x: -2, y: 0 };
  w.grave.sample(w.player, w.player, 2.45, 2.5);
  assert.equal(w.challenge.bossHits, 1);
});
test("game pause stops revival and world filter retains dead lifecycle boss", () => {
  const w = world(),
    e = boss(w);
  lethal(w, e);
  w.pause("test", true);
  w.step(4);
  assert.equal(w.time, 0);
  assert.equal(e.hp, 0);
  w.pause("test", false);
  w.step(0.1);
  assert(w.enemies.includes(e));
});
test("life2 resets target debuffs/links only; player and weapon cooldown persist", () => {
  const w = world(),
    e = boss(w);
  w.hp = 77;
  w.cooldowns.fire = 1.7;
  w.armory.support.marks.set(e.id, { until: 100, factor: 2 });
  w.armory.support.link = { a: e.id, b: 123, until: 100 };
  e.burnUntil = e.freezeUntil = e.slowUntil = e.fractureUntil = 100;
  e.fracture = 2;
  revive(w, e);
  assert.equal(e.burnUntil, 0);
  assert.equal(e.fracture, 0);
  assert.equal(w.hp, 77);
  assert.equal(w.cooldowns.fire, 1.7);
  assert(!w.armory.support.marks.has(e.id));
  assert.equal(w.armory.support.link, null);
});
test("supplies track total actual HP damage at25/50/75 only once across both lives", () => {
  const w = world(),
    e = boss(w);
  e.hp = e.grave.total * 0.14;
  w.grave.supplies(e);
  assert.equal(w.potions.length, 1);
  revive(w, e);
  e.hp = e.grave.total * 0.49;
  w.grave.supplies(e);
  assert.equal(w.potions.length, 2);
  e.hp = e.grave.total * 0.24;
  w.grave.supplies(e);
  assert.equal(w.potions.length, 3);
  w.grave.supplies(e);
  assert.equal(w.potions.length, 3);
});
test("second final death wins once; account rewards400 only final, survives cold reload", () => {
  const w = world(),
    e = boss(w),
    st = storage(),
    p = new ProgressStore(st);
  lethal(w, e);
  assert.deepEqual(p.observe(w), []);
  assert.equal(p.coins, 0);
  w.time = e.grave.deadUntil;
  w.grave.tick();
  lethal(w, e);
  assert.equal(w.state, "won");
  p.observe(w);
  assert.equal(p.coins, 400);
  assert(p.hasAchievement("echograve_clear"));
  p.observe(w);
  assert.equal(p.coins, 400);
  const cold = new ProgressStore(st);
  assert.equal(cold.coins, 400);
  assert(cold.data.stages.includes(16));
});
test("HUD death interval retains Boss label and explicit revival, report uses total remaining", () => {
  const w = world(),
    e = boss(w);
  lethal(w, e);
  const hud = battleHud(w, false, []);
  assert(hud.bossHealth.label.includes("裂棺复生"));
  assert(hud.hint.includes("裂棺复生"));
  assert.equal(battleReport(w).bossRemaining, 60);
  assert.equal(battleReport(w).form, 1);
});
test("challenge needs completed real dualB and near live body hit; cancel/single-source groups cannot qualify", () => {
  const w = world(),
    e = boss(w);
  const s = e.grave;
  s.life = 2;
  s.action = "B";
  s.vulnerable = true;
  e.state = "recover";
  s.qualified = false;
  w.grave.onHit(e, "blade", 5);
  assert(!w.challenge.graveGroups.has("2B"));
  s.qualified = true;
  w.skills.blade = 8;
  w.player.x = -2;
  w.grave.onHit(e, "blade", 5);
  assert(w.challenge.graveGroups.has("2B"));
});
test("fire epic exactly2.05 damage and no added count/radius/cooldown, ordinary-to-epic cost2520", () => {
  const w = world();
  w.skills.fire = 8;
  w.weaponGrades.fire = 1;
  const a = weaponStats(w, "fire");
  w.weaponGrades.fire = 4;
  const b = weaponStats(w, "fire");
  assert(Math.abs(b.damage / a.damage - 2.05) < 1e-9);
  for (const k of ["count", "radius", "cooldown", "duration"])
    assert.equal(a[k], b[k]);
  const p = new ProgressStore(storage());
  p.data.coins = 2520;
  for (let i = 1; i <= 3; i++)
    assert.equal(p.evolveWeapon("fire", i), "evolved");
  assert.equal(p.coins, 0);
  assert.equal(p.data.grades.fire, 4);
});
test("60 distinct qualified recipe wins required, repeat/failure/missingB/boss damage do not add, optional data cold reload", () => {
  const st = storage(),
    p = new ProgressStore(st),
    weapons = ALL_WEAPONS.slice(0, 12);
  const pairs = (s) =>
    MODS[s].flatMap((a, i) =>
      MODS[s]
        .slice(i + 1)
        .filter((b) => a.excludes !== b.id && b.excludes !== a.id)
        .map((b) => [a.id, b.id]),
    );
  const win = (s, pair) => {
    const w = world();
    w.startingWeapon = s;
    w.skills[s] = 8;
    w.mods[s] = pair;
    w.challenge.graveGroups = new Set(["1A", "1B", "2B"]);
    w.state = "won";
    return w;
  };
  const missing = win(weapons[0], pairs(weapons[0])[0]);
  missing.challenge.graveGroups.delete("2B");
  p.observe(missing);
  assert(!p.data.graveQualified);
  const damaged = win(weapons[0], pairs(weapons[0])[0]);
  damaged.challenge.bossHits = 1;
  p.observe(damaged);
  assert(!p.data.graveQualified);
  let count = 0;
  for (const s of weapons)
    for (const pair of pairs(s)) {
      const w = win(s, pair);
      p.observe(w);
      p.observe(w);
      count++;
      if (count < 60) assert(!p.hasAchievement("grave_twelve_paths"));
    }
  assert.equal(count, 60);
  assert(p.hasAchievement("grave_twelve_paths"));
  const cold = new ProgressStore(st);
  assert.equal(cold.data.graveQualifiedVersion, 1);
  assert.equal(
    Object.values(cold.data.graveQualified).filter((v) => v.length === 5)
      .length,
    12,
  );
});
test("real completed groups qualify recover hits; actual secondB dual origin needed and cancellation cannot earn", () => {
  for (const life of [1, 2])
    for (const action of life === 1 ? ["A", "B"] : ["B"]) {
      const w = world(),
        e = boss(w),
        s = e.grave;
      s.life = life;
      s.action = action;
      s.scar = pulse({ x: -3, y: 2 });
      s.scarUntil = 12;
      assert(w.grave.begin(e));
      w.time = s.next;
      w.player = { x: 14, y: 14 };
      w.grave.stepEnemy(e, 0);
      assert(s.qualified);
      w.player = { x: e.x + 1, y: e.y };
      w.skills.blade = 8;
      w.hit(e, 5, "blade");
      assert(w.challenge.graveGroups.has(life + action));
    }
  const w = world(),
    e = boss(w);
  e.grave.life = 2;
  e.grave.action = "B";
  assert(w.grave.begin(e));
  w.time = e.grave.next;
  w.grave.stepEnemy(e, 0);
  assert(!e.grave.qualified);
});

test("freezing cancels future echo but preserves already active .18 window, interrupted group never qualifies", () => {
  const w = world(),
    e = boss(w);
  e.grave.action = "B";
  assert(w.grave.begin(e));
  const h = e.grave.items[0],
    first = h.grave.pulses[0];
  w.time = first.due + 0.05;
  e.freezeUntil = w.time + 0.5;
  w.grave.clean();
  assert(!first.cancelled);
  assert(h.grave.pulses[1].cancelled);
  w.time = h.until;
  w.grave.stepEnemy(e, 0);
  assert(!e.grave.qualified);
});
test("two danger chains remain reserved during silent echo gap, no third group; final elite delays Boss spawn", () => {
  const w = world(),
    e = boss(w);
  e.grave.action = "C";
  assert(w.grave.begin(e));
  assert.equal(w.grave.slots, 2);
  const other = w.addEnemy("echoacolyte", 1, 0);
  other.state = "seek";
  other.grave = w.grave.state(other);
  other.grave.action = "echo";
  assert(!w.grave.begin(other));
  assert(w.hazards.length <= 2);
  const v = world();
  v.time = 359;
  const elite = v.addEnemy("coffinregent", 4, 0);
  elite.state = "seek";
  v.time = 360;
  v.grave.director(0);
  assert(!v.enemies.some((e) => e.kind === "boss"));
  v.hit(elite, 1e9, "blade");
  v.grave.director(0);
  assert(!v.enemies.some((e) => e.kind === "boss"));
  v.time = 363;
  v.grave.director(0);
  assert(v.enemies.some((e) => e.kind === "boss"));
});
test("secondA moves actual body after initial pulse while echo retains old source; secondB recovery schedules physical C relocation", () => {
  const w = world(),
    e = boss(w);
  e.grave.life = 2;
  e.grave.action = "A";
  assert(w.grave.begin(e));
  const oldX = e.x,
    oldY = e.y,
    h = e.grave.items[0],
    f = h.grave.pulses[1];
  w.time = e.grave.moveAt + 0.5;
  w.grave.stepEnemy(e, 0.5);
  assert(Math.hypot(e.x - oldX, e.y - oldY) > 0.5);
  assert.equal(f.x, oldX);
  assert.equal(f.y, oldY);
  assert.equal(w.hazards.length, 1);
  w.time = e.grave.next;
  w.grave.stepEnemy(e, 0);
  e.state = "seek";
  e.grave.action = "B";
  assert(w.grave.begin(e));
  w.time = e.grave.next;
  w.grave.stepEnemy(e, 0);
  assert(e.grave.relocate);
  assert(
    Math.hypot(e.grave.relocate.x - e.x, e.grave.relocate.y - e.y) >= 2.39,
  );
});
