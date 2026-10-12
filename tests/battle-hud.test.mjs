import test from 'node:test';
import assert from 'node:assert/strict';
import { SurvivalWorld } from '../temp/tests/battle/SurvivalWorld.mjs';
import { battleHud, clock } from '../temp/tests/presentation/BattleHud.mjs';

test('HUD shows selected final form, rank and cooldown without changing world state', () => {
  const w = new SurvivalWorld(19);
  w.skills.fire = 10; w.evolutions.fire = 'meteor'; w.ultimate = 2.2;
  const seed = w.seed, revision = w.revision;
  const hud = battleHud(w, false, []);
  assert(hud.weapons.includes('★'));
  assert(hud.weapons.includes('1'));
  assert.equal(hud.nova, '新星  3s');
  assert.equal(w.seed, seed); assert.equal(w.revision, revision);
  assert.equal(clock(269), '04:29');
});

test('HUD prioritizes environmental warnings over potion hints and adapts input prompts', () => {
  const w = new SurvivalWorld(1, 'ranger', 4);
  const potion = [{x: 0, y: 0}];
  assert.match(battleHud(w, true, potion).hint, /药水/);
  w.hazards.push({kind:'bellRing'});
  assert.match(battleHud(w, true, potion).hint, /幽钟/);
  w.hazards = [];
  assert.match(battleHud(w, true, []).hint, /拖动/);
  assert.match(battleHud(w, false, []).hint, /WASD/);
});
