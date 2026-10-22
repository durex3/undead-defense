import test from "node:test";
import assert from "node:assert/strict";
import { GameMenus } from "../temp/tests/presentation/GameMenus.mjs";
import { ProgressStore } from "../temp/tests/platform/ProgressStore.mjs";
import { Graphics, KeyCode } from "../temp/tests/node_modules/cc/index.mjs";
Object.assign(KeyCode, {
  ESCAPE: 27,
  ENTER: 13,
  SPACE: 32,
  ARROW_LEFT: 37,
  ARROW_UP: 38,
  ARROW_RIGHT: 39,
  ARROW_DOWN: 40,
});
function menu() {
  const data = new Map(),
    progress = new ProgressStore({
      getItem: (k) => data.get(k) || null,
      setItem: (k, v) => data.set(k, v),
    });
  progress.data.coins = 2000;
  progress.pending = true;
  progress.flush();
  const host = {
    progress,
    overlay: { destroyAllChildren() {} },
    clearInput() {},
    panel() {
      return {};
    },
    text(_parent, string) {
      return { string };
    },
    button(_parent, string) {
      return { string };
    },
    make() {
      return {
        setPosition() {},
        setScale() {},
        addComponent: () => new Graphics(),
      };
    },
  };
  const m = new GameMenus(host);
  return { m, progress };
}
function click(m, title) {
  const i = m.catalogLabels.findIndex((b) => b.title === title);
  assert(i >= 0, title);
  m.catalogFocus = i;
  m.catalogActions[i]();
}
test("keyboard focus on an evolution confirmation preserves mode, price and expected grade; duplicate callbacks never charge twice", () => {
  const { m, progress } = menu();
  m.showWeaponDetail("blade");
  click(m, "进阶精良 · 360金币");
  assert.equal(m.catalog, "purchase");
  m.handleTargetKey(39);
  assert.equal(m.catalogFocus, 1);
  assert.equal(m.catalog, "purchase");
  const confirm = m.catalogActions[1];
  m.handleTargetKey(13);
  assert.equal(progress.coins, 1640);
  assert.equal(progress.weaponGrades.blade, 2);
  assert.equal(m.catalog, "detail");
  confirm();
  assert.equal(progress.coins, 1640);
  assert.equal(progress.weaponGrades.blade, 2);
});
test("canceling purchase by Escape restores parent focus without charging or changing a grade", () => {
  const { m, progress } = menu();
  m.showWeaponDetail("blade");
  click(m, "进阶精良 · 360金币");
  m.handleTargetKey(39);
  m.handleTargetKey(27);
  assert.equal(m.catalog, "detail");
  assert.equal(m.catalogFocus, 1);
  assert.equal(progress.coins, 2000);
  assert.equal(progress.weaponGrades.blade, 1);
  assert(m.catalogLabels[1].label.string.startsWith("▸ "));
});
test("opener progress remains open while navigating, then returns to its category and originating focus", () => {
  const { m } = menu();
  m.showAchievements(0, "机制挑战");
  click(m, "起手进度");
  assert.equal(m.catalog, "paths");
  m.handleTargetKey(39);
  assert.equal(m.catalog, "paths");
  m.handleTargetKey(13);
  assert.equal(m.catalog, "achievements");
  assert.equal(m.achievementCategory, "机制挑战");
  assert.equal(m.achievementPage, 0);
  assert.equal(m.catalogFocus, 3);
});
test("manual save confirmation Escape returns to slots rather than the main menu and never saves or deletes", () => {
  const { m, progress } = menu();
  m.showManualSaves();
  click(m, "保存");
  assert.equal(m.catalog, "manual-confirm");
  m.handleTargetKey(39);
  m.handleTargetKey(27);
  assert.equal(m.catalog, "manual");
  assert.equal(progress.manualSaves[0].state, "empty");
  assert.equal(progress.coins, 2000);
});
test("reward weapon details return to the original achievement page and focus", () => {
  const { m } = menu();
  m.showAchievements(2, "机制挑战");
  click(m, "查看奖励武器");
  m.handleTargetKey(27);
  assert.equal(m.catalog, "achievements");
  assert.equal(m.achievementPage, 2);
  assert.equal(m.achievementCategory, "机制挑战");
  assert(m.catalogLabels[m.catalogFocus].title === "查看奖励武器");
});
