import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { battleHud } from "../temp/tests/presentation/BattleHud.mjs";
for (const stage of [14, 15, 16, 17])
  test(`stage ${stage}: fixed boss health survives danger hints and disappears on death`, () => {
    const w = new SurvivalWorld(19, "ranger", stage);
    assert.equal(battleHud(w, true, []).bossHealth, null);
    const boss = {
      kind: "boss",
      hp: 250,
      maxHp: 1000,
      bossPhase: 2,
      x: 100,
      y: 100,
    };
    w.enemies.push(boss);
    w.hazards.push({ damageLabel: "危险预警", kind: "starLeap" });
    const hud = battleHud(w, true, []);
    assert.match(hud.hint, stage===17 ? /去程/ : stage===16 ? /拆电锚/ : /危险预警/);
    assert.equal(hud.bossHealth.ratio, 0.25);
    assert.match(hud.bossHealth.label, /狂怒 · 250 \/ 1000/);
    boss.hp = 0;
    assert.equal(battleHud(w, true, []).bossHealth, null);
  });
