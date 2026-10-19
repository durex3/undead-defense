import test from "node:test";
import assert from "node:assert/strict";
import { ENEMY_KINDS } from "../temp/tests/battle/SurvivalConfig.mjs";
import { SIEGE_KINDS } from "../temp/tests/battle/SiegeSystem.mjs";
import { SAND_KINDS } from "../temp/tests/battle/SandSystem.mjs";
import { thunderEnemy } from "../temp/tests/battle/ThunderSystem.mjs";
import { moonEnemy } from "../temp/tests/battle/MoonSystem.mjs";
import {
  BOSS_ART,
  CATALOG_STAGE_KINDS,
  enemyArt,
  isDeviceKind,
} from "../temp/tests/presentation/art/EnemyCatalog.mjs";

const asSet = (list) => new Set(list);
const same = (actual, expected, label) => {
  assert.deepEqual([...actual].sort(), [...expected].sort(), label);
};

test("catalog stage membership matches the gameplay stage lists", () => {
  same(CATALOG_STAGE_KINDS[1], SIEGE_KINDS, "stage 1");
  same(CATALOG_STAGE_KINDS[2], SAND_KINDS, "stage 2");
  same(CATALOG_STAGE_KINDS[3], ENEMY_KINDS.filter((k) => thunderEnemy(k)), "stage 3");
  same(CATALOG_STAGE_KINDS[4], ENEMY_KINDS.filter((k) => moonEnemy(k)), "stage 4");
});

test("every enemy kind has a drawable catalog entry", () => {
  for (const kind of ENEMY_KINDS) {
    if (kind === "boss") continue;
    const stage = kind === "minion" ? 1 : [1, 2, 3, 4].find((s) => asSet(CATALOG_STAGE_KINDS[s]).has(kind));
    const art = enemyArt(stage, kind);
    assert.ok(art, `${kind} has no art`);
    assert.ok(art.height > 0, `${kind} height`);
    assert.ok(art.halfWidth > 0, `${kind} halfWidth`);
    assert.ok(art.scale > 0, `${kind} scale`);
    assert.ok(art.palette.outline && art.palette.base, `${kind} palette`);
    assert.equal(art.kind, kind === "minion" ? "minion" : kind);
  }
});

test("all four bosses have distinct palettes and silhouettes", () => {
  for (const stage of [1, 2, 3, 4]) {
    const art = enemyArt(stage, "boss");
    assert.equal(art.kind, "boss");
    assert.ok(art.detail >= 3);
    assert.equal(art.stage, stage);
  }
  assert.notEqual(BOSS_ART[1].palette.base, BOSS_ART[2].palette.base);
  assert.notEqual(BOSS_ART[2].palette.base, BOSS_ART[3].palette.base);
  assert.notEqual(BOSS_ART[3].palette.base, BOSS_ART[4].palette.base);
});

test("thunder anchors and electrodes are the only device kinds", () => {
  const devices = ENEMY_KINDS.filter(isDeviceKind);
  assert.deepEqual(devices.sort(), ["gridelectrode", "thunderanchor"]);
});
