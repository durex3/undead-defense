import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS } from '../temp/tests/battle/SurvivalConfig.mjs';
import { formTier, WEAPON_FORMS, weaponFormName } from '../temp/tests/battle/WeaponForms.mjs';
test('all 18 weapons have four distinct named silhouettes', () => {
  assert.equal(WEAPONS.length, 18);
  for (const skill of WEAPONS) {
    assert.equal(new Set(WEAPON_FORMS[skill]).size, 4, skill);
    assert.deepEqual([1,4,7,10].map(l => weaponFormName(skill,l)), WEAPON_FORMS[skill]);
  }
});
test('early evolution reaches異化 but max rank retains final form', () => {
  assert.equal(formTier(4,true), 2);
  assert.equal(formTier(10,true), 3);
  assert.deepEqual([1,3,4,6,7,9,10].map(l=>formTier(l)),[0,0,1,1,2,2,3]);
});
