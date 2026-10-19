import test from "node:test";
import assert from "node:assert/strict";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { BattlePainter } from "../temp/tests/presentation/BattlePainter.mjs";
import { drawGroundFields, drawProjectiles } from "../temp/tests/presentation/art/SpellPainter.mjs";
import { drawExtraSpell } from "../temp/tests/presentation/art/spells/ExtraSpellArt.mjs";
import { ENEMY_KINDS } from "../temp/tests/battle/SurvivalConfig.mjs";
import { makeWorld, addEnemy, makeShot, makeField, makeCast, makeExtra } from "../tools/art-fixtures.mjs";

const SIEGE = new Set(["siegebone", "thornshield", "siegebow", "flanker", "siegeflag", "siegerider"]);
const SAND = new Set(["sandworker", "sandlarva", "sandegg", "shellroller", "sandspitter", "sandstalker", "broodelite", "breakerelite"]);
const THUNDER = new Set(["rivetwalker", "anchorweaver", "arclantern", "railsaw", "gridwarden", "railreaper", "thunderanchor", "gridelectrode"]);
const MOON = new Set(["thornrunner", "crescentmantis", "vaultlynx", "antlerprowler", "moonreaver", "hornwarden"]);

function stageFor(kind) {
  if (SIEGE.has(kind)) return 1;
  if (SAND.has(kind)) return 2;
  if (THUNDER.has(kind)) return 3;
  if (MOON.has(kind)) return 4;
  return 3; // minion / fallback
}

function draw(world) {
  const g = new Graphics();
  const painter = new BattlePainter(g);
  painter.draw(world, 1 / 60, [], false);
  return g;
}

test("every enemy kind draws without throwing", () => {
  for (const kind of ENEMY_KINDS) {
    if (kind === "boss") continue;
    const stage = stageFor(kind);
    const world = makeWorld(stage);
    addEnemy(world, kind, { x: 0, y: 0 });
    const g = draw(world);
    assert.ok(g.commands.length > 0, `${kind} produced no draw commands`);
  }
});

test("every stage boss draws without throwing", () => {
  for (const stage of [1, 2, 3, 4]) {
    const world = makeWorld(stage);
    addEnemy(world, "boss", { x: 0, y: 0, hp: 1 });
    const g = draw(world);
    assert.ok(g.commands.length > 0, `stage ${stage} boss produced no draw commands`);
  }
});

test("100 fodder enemies stay inside the performance budget", () => {
  const world = makeWorld(1, { viewport: { x: 100, y: 100 } });
  for (let i = 0; i < 100; i++)
    addEnemy(world, "siegebone", { x: (i % 10) * 1.2 - 5.4, y: Math.floor(i / 10) * 1.2 - 5.4 });
  const g = draw(world);
  assert.ok(g.commands.length > 0);
  assert.ok(g.commands.length < 1200, `too many draw submissions: ${g.commands.length}`);
  assert.ok(g.vertexCount < 22000, `too many vertices: ${g.vertexCount}`);
});

test("all three heroes and common status overlays draw without throwing", () => {
  for (const character of ["ranger", "alchemist", "necromancer"]) {
    const world = makeWorld(1);
    world.character = character;
    const g = draw(world);
    assert.ok(g.commands.length > 0, `${character} hero produced no draw commands`);
  }
  const world = makeWorld(2);
  const enemy = addEnemy(world, "sandstalker", { x: 0, y: 0, freeze: true, slow: true, recover: true });
  enemy.sand = { action: "break", step: 0, angle: 0, vulnerable: true, buried: false, next: 9 };
  const g = draw(world);
  assert.ok(g.commands.length > 0);
});

test("basic and extra spell layers draw without throwing", () => {
  const world = makeWorld(1, { time: 2 });
  world.armory.shots = [
    makeShot("blade"),
    makeShot("blade", { mods: ["hunt", "return"], returning: true }),
    makeShot("fire", { mods: ["heavy"] }),
    makeShot("fire", { child: true }),
    makeShot("water", { age: 0.3 }),
  ];
  world.armory.fields = [
    makeField("fire"),
    makeField("water", { mods: ["wave", "pulse"] }),
  ];
  world.armory.pending = [makeCast("fire", { mods: ["heavy"], due: 0.2 })];
  const g = new Graphics();
  drawGroundFields(g, world, false);
  drawProjectiles(g, world, false);
  assert.ok(g.commands.length > 0);

  for (const skill of ["frost", "lightning", "ghost", "bone", "mine", "void", "holy"]) {
    world.armory.extra.attacks = [makeExtra(skill, { phase: 0, age: 0.4, index: 2 })];
    const before = g.commands.length;
    drawExtraSpell(g, world, true, false);
    drawExtraSpell(g, world, false, false);
    assert.ok(g.commands.length > before, `${skill} produced no draw commands`);
  }
});
