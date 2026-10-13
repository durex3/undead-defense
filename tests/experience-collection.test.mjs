import test from 'node:test';
import assert from 'node:assert/strict';
import { SurvivalWorld } from '../temp/tests/battle/SurvivalWorld.mjs';

test('experience collection gathers distant drops once without damaging or healing', () => {
  const w = new SurvivalWorld();
  const e = w.addEnemy('minion', 1, 0), hp = e.hp;
  w.hp = 40;
  w.gems = [{id:w.id(), x:22,y:26,value:2},{id:w.id(),x:-22,y:-26,value:3}];
  assert.equal(w.useUltimate(), true);
  assert.equal(w.xp, 5);
  assert.equal(w.gems.length, 0);
  assert.equal(e.hp, hp);
  assert.equal(w.hp, 40);
  assert.equal(w.ultimate, 25);
  assert.equal(w.useUltimate(), false);
});

test('empty field and paused battle do not consume collection cooldown', () => {
  const w = new SurvivalWorld();
  assert.equal(w.useUltimate(), false);
  assert.equal(w.ultimate, 0);
  w.gems = [{id:w.id(),x:20,y:20,value:2}];
  w.pause('test', true);
  assert.equal(w.useUltimate(), false);
  assert.equal(w.gems.length, 1);
  w.pause('test', false);
  assert.equal(w.useUltimate(), true);
  w.pause('test', true);
  w.step(10);
  assert.equal(w.ultimate, 25);
});

test('large collection opens upgrade and preserves excess experience', () => {
  const w = new SurvivalWorld(), need = w.xpNeed;
  w.gems = [{id:w.id(),x:20,y:20,value:need+50}];
  assert.equal(w.useUltimate(), true);
  assert.equal(w.level, 2);
  assert.equal(w.xp, 50);
  assert.ok(w.cards.length > 0);
});
