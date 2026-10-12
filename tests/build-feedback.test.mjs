import test from "node:test";
import assert from "node:assert/strict";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import { WEAPON_TAGS } from "../temp/tests/battle/SurvivalConfig.mjs";
import { battleReport } from "../temp/tests/battle/BattleReport.mjs";

test("expanded weapons expose readable build tags in the report", () => {
  const w = new SurvivalWorld();
  w.skills.axe = 1;
  w.skills.totem = 2;
  const report = battleReport(w);
  assert.deepEqual(report.rows.find((r) => r.skill === "axe").tags, WEAPON_TAGS.axe);
  assert.ok(report.rows.find((r) => r.skill === "totem").tags.includes("summon"));
});

test("early upgrade cards keep three unique choices while favoring new weapons", () => {
  const w = new SurvivalWorld(7);
  w.xp = 8;
  w.step(1 / 60);
  assert.equal(w.cards.length, 3);
  assert.equal(new Set(w.cards).size, 3);
  assert.ok(w.cards.some((c) => c !== "blade" && c in w.skills));
});

test("upgrade pool prioritizes evolution and never offers a fifth weapon at a full four-slot build", () => {
  const evolved = new SurvivalWorld(12);
  evolved.skills.fire = 10;
  evolved.skills.blade = 1;
  evolved.skills.water = 1;
  evolved.skills.ice = 1;
  evolved.xp = 8;
  evolved.step(1 / 60);
  assert.equal(evolved.weaponCount, 4);
  assert.ok(!evolved.cards.includes("fire"));
  assert.ok(evolved.cards.every((c) => !(c in evolved.skills) || evolved.skills[c] > 0));
});

test("paused supply shop has bounded refreshes and idempotent purchases", () => {
  const w = new SurvivalWorld(3);
  w.pause("menu", true); w.gold = 20;
  assert.equal(w.openShop(), true);
  assert.equal(w.shopItems.length, 4);
  const item = w.shopItems[0];
  assert.equal(w.buyShop(item), true);
  const after = w.gold;
  assert.equal(w.buyShop(item), false);
  assert.equal(w.refreshShop(), true);
  assert.equal(w.gold, after - 2);
});

test("synthesis retains both maxed weapons and triggers exactly once", () => {
  const w = new SurvivalWorld(4);
  w.skills.fire = 10; w.skills.blade = 10; w.pause("menu", true); w.openShop();
  assert.ok(w.synthesisOptions().includes("fire"));
  assert.equal(w.synthesize("fire"), true);
  assert.equal(w.skills.blade, 10);
  assert.equal(w.evolutions.fire, "meteor");
  assert.equal(w.synthesize("fire"), false);
});

test("shop locks survive refresh and recycling cannot sell the final weapon twice", () => {
  const w = new SurvivalWorld(31);
  const seed = w.seed;
  assert.equal(w.openShop(), false);
  assert.equal(w.seed, seed);
  w.pause("menu", true); w.gold = 20; w.openShop();
  const locked = w.shopItems[0];
  assert.equal(w.toggleShopLock(locked), true);
  assert.equal(w.refreshShop(), true);
  assert.ok(w.shopItems.includes(locked));
  w.skills.axe = 1;
  assert.equal(w.sellShop("axe"), true);
  const gold = w.gold;
  assert.equal(w.sellShop("axe"), false);
  assert.equal(w.gold, gold);
  assert.equal(w.sellShop("blade"), false);
});

test("shop can close back to the pause menu without resuming the run", () => {
  const w = new SurvivalWorld(41);
  w.pause("menu", true);
  assert.equal(w.openShop(), true);
  assert.ok(w.shopItems.length > 0);
  assert.equal(w.closeShop(), true);
  assert.equal(w.shopOpen, false);
  assert.ok(w.shopItems.length > 0);
  assert.equal(w.pauses.has("menu"), true);
  assert.equal(w.state, "battle");
});

 test("closing shop preserves stock, locks and refresh budget",()=>{
 const w=new SurvivalWorld(42);w.pause("menu",true);w.openShop();
 const stock=[...w.shopItems];w.toggleShopLock(stock[0]);const seed=w.seed;
 w.closeShop();w.openShop();assert.deepEqual(w.shopItems,stock);assert.deepEqual(w.shopLocked,[stock[0]]);assert.equal(w.seed,seed);assert.equal(w.shopRefreshes,2);
 w.gold=0;const levels={...w.skills};assert.equal(w.buyShop(stock[0]),false);assert.equal(w.shopMessage,"金币不足");assert.deepEqual(w.skills,levels);
 });
 test("fusion requires both maxed weapons and preserves partner evolution",()=>{
 const w=new SurvivalWorld(43);w.pause("menu",true);w.openShop();w.skills.fire=3;w.skills.blade=3;
 assert.equal(w.synthesize("fire"),false);w.skills.fire=10;assert.equal(w.synthesize("fire"),false);w.skills.blade=10;w.evolutions.blade="storm";w.cooldowns.blade=20;
 assert.equal(w.synthesize("fire"),true);assert.equal(w.skills.fire,10);assert.equal(w.evolutions.blade,"storm");assert.equal(w.cooldowns.blade,20);
 });
