import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { captureArchitecture } from "../tools/architecture-snapshot.mjs";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { settleVictory } from "../temp/tests/battle/AchievementRules.mjs";
import { ProgressStore } from "../temp/tests/platform/ProgressStore.mjs";
test("all6784 armor cases,160 HUD cases and32 settlement/reload snapshots match pre-refactor behavior", () => {
  const before = JSON.parse(
    fs.readFileSync(
      new URL(
        "../artifacts/architecture-refactor/before.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.deepEqual(captureArchitecture(), before);
});
test("a registered non-blade modification hook receives the installed mod exactly once, with cooldown preserved", () => {
  const w = new SurvivalWorld(19, "ranger", 1);
  w.skills.fire = 4;
  w.state = "modification";
  w.pendingModification = "fire";
  w.cooldowns.fire = 0.71;
  let called = 0;
  w.armory.strategies.fire.onModification = (id) => {
    assert.equal(id, "heavy");
    assert(w.mods.fire.includes(id));
    called++;
  };
  assert(w.chooseMod("heavy"));
  assert.equal(called, 1);
  assert.equal(w.cooldowns.fire, 0.71);
  assert(!w.chooseMod("heavy"));
  assert.equal(called, 1);
});
test("registered combat policy determines damage before shared accounting without a hidden stage multiplier", () => {
  const w = new SurvivalWorld(19, "ranger", 15),
    e = w.addEnemy("boss", 3, 0);
  e.state = "recover";
  e.lead = { vulnerable: true };
  const before = e.hp;
  let hits = 0;
  w.stageStrategy.combat.incoming = () => 7;
  w.stageStrategy.combat.onHit = (target, source, dealt) => {
    assert.equal(target, e);
    assert.equal(source, "blade");
    assert.equal(dealt, 7);
    hits++;
  };
  w.hit(e, 100, "blade");
  assert.equal(before - e.hp, 7);
  assert.equal(w.damage.blade, 7);
  assert.equal(hits, 1);
});
test("lifecycle initialization dispatches for a registered stage without a stage16 condition", () => {
  const w = new SurvivalWorld(19, "ranger", 1);
  let initialized = 0;
  w.stageStrategy.lifecycle = {
    initialize: (e) => {
      initialized++;
      e.hp = e.maxHp = 123;
    },
    keep: () => false,
    tick: () => {},
    onHit: () => {},
    supplies: () => {},
  };
  const e = w.addEnemy("boss");
  assert.equal(e.maxHp, 123);
  assert.equal(initialized, 1);
});
test("victory rules operate on a candidate snapshot and stay idempotent independently of storage", () => {
  const p = new ProgressStore({ getItem: () => null, setItem: () => {} }),
    before = JSON.stringify(p.data),
    candidate = JSON.parse(before),
    w = new SurvivalWorld(19, "ranger", 16);
  w.state = "won";
  w.runId = "architecture-domain-victory";
  assert(settleVictory(candidate, w).length);
  assert.equal(candidate.coins, 400);
  assert(candidate.achievements.includes("echograve_clear"));
  const once = JSON.stringify(candidate);
  assert.deepEqual(settleVictory(candidate, w), []);
  assert.equal(JSON.stringify(candidate), once);
  assert.equal(JSON.stringify(p.data), before);
});
test("active warnings across all late-stage patterns and resurrection retain the pre-refactor HUD", async () => {
  const { captureActiveHud } =
    await import("../tools/architecture-snapshot.mjs");
  const expected = JSON.parse(
    fs.readFileSync(
      new URL(
        "../artifacts/architecture-refactor/active-hud-before.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.deepEqual(captureActiveHud(), expected);
});

test("all seven extra weapon lifecycles preserve140 full event/entity traces including modified moving and retargeted attacks", async () => {
  const { captureExtraBehaviors } =
    await import("../tools/extra-behavior-snapshot.mjs");
  const expected = JSON.parse(
    fs.readFileSync(
      new URL(
        "../artifacts/architecture-refactor/extra-behavior-before.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(expected.length, 140);
  assert.deepEqual(captureExtraBehaviors(), expected);
});
test("all106 enemy priority classifications and actual blade/holy targeting retain their distinct boss preference", async () => {
  const { ENEMY_KINDS, isPriorityTarget } =
    await import("../temp/tests/battle/SurvivalConfig.mjs");
  const { weaponStats } = await import("../temp/tests/battle/ArmoryConfig.mjs");
  const expected = JSON.parse(
    fs.readFileSync(
      new URL(
        "../artifacts/architecture-refactor/target-priority-before.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.deepEqual(
    ENEMY_KINDS.filter(k=>expected.some(r=>r.kind===k)),
    expected.map((r) => r.kind),
  );
  for (const row of expected) {
    assert.equal(isPriorityTarget(row.kind), row.blade, row.kind);
    assert.equal(isPriorityTarget(row.kind, true), row.extra, row.kind);
    const w = new SurvivalWorld(22, "ranger", 1);
    w.enemies = [];
    w.player = { x: 0, y: 0 };
    const near = w.addEnemy("minion", 1, 0),
      far = w.addEnemy(row.kind, 3, 0);
    near.state = far.state = "seek";
    assert.equal(
      w.armory.target("blade", weaponStats(w, "blade")).id,
      (row.blade ? far : near).id,
      row.kind + ":blade",
    );
    assert.equal(
      w.armory.extra.target("holy", weaponStats(w, "holy")).id,
      (row.extra ? far : near).id,
      row.kind + ":holy",
    );
  }
});
test("all50 achievement page, badge and progress projections retain original submissions without changing account state", async () => {
  const { captureAchievementScreens } =
    await import("../tools/achievement-screen-snapshot.mjs");
  const expected = JSON.parse(
    fs.readFileSync(
      new URL(
        "../artifacts/architecture-refactor/achievement-screens-before.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(expected.length, 50);
  assert.deepEqual(captureAchievementScreens(), expected);
  const { achievementProgress } =
    await import("../temp/tests/battle/AchievementProgress.mjs");
  const p = new ProgressStore({ getItem: () => null, setItem: () => {} }),
    before = JSON.stringify(p.data);
  achievementProgress(p.data, "grave_twelve_paths");
  assert.equal(JSON.stringify(p.data), before);
});
test("storage extraction preserves21 injected read/write failure traces including exact IO order, raw bytes and cold reload", async () => {
  const { captureStorageBoundaries } =
    await import("../tools/storage-boundary-snapshot.mjs");
  const expected = JSON.parse(
    fs.readFileSync(
      new URL(
        "../artifacts/architecture-refactor/storage-before.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(expected.length, 21);
  assert.deepEqual(captureStorageBoundaries(), expected);
});
