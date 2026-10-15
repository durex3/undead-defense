import test from 'node:test';
import assert from 'node:assert/strict';
import { SurvivalWorld } from '../temp/tests/battle/SurvivalWorld.mjs';
import { WEAPONS, EVOLUTIONS } from '../temp/tests/battle/SurvivalConfig.mjs';
import { upgradeChanges, compactSynergy, weaponDetails } from '../temp/tests/battle/WeaponStatus.mjs';

test('upgrade copy covers every weapon and rank in at most three lines',()=>{
  const w=new SurvivalWorld();
  for(const skill of WEAPONS)for(let rank=0;rank<=10;rank++){
    w.skills[skill]=rank;
    const copy=upgradeChanges(w,skill);
    assert.ok(copy.length>0,`${skill} ${rank}`);
    assert.ok(!copy.includes('undefined'));
    assert.ok(copy.split('\n').length<=3);
    if(rank>=4&&rank<10)assert.ok(copy.includes('→'));
  }
  w.skills.fire=9;
  assert.equal(upgradeChanges(w,'fire'),'伤害倍率 2.6 → 3\n解锁最终分支选择');
  w.skills.water=2;
  assert.equal(upgradeChanges(w,'water'),'半径 1.6 → 1.9\n持续 4 → 5 秒');
});

test('synergy hints distinguish owned partners, missing partners and independent routes',()=>{
  const w=new SurvivalWorld();for(const s of WEAPONS)w.skills[s]=0;
  assert.equal(compactSynergy(w,'lightning'),'搭配冰霜新环 · 可组合冰雷碎击（未激活）');
  w.skills.ice=7;
  assert.equal(compactSynergy(w,'lightning'),'已拥有冰霜新环 · 可组合冰雷碎击（未激活）');
  w.skills.ice=10;w.evolutions.ice=EVOLUTIONS.ice[1].id;
  assert.match(compactSynergy(w,'lightning'),/独立路线/);
  assert.match(weaponDetails(w,'ice'),/极点冰刺/);
  assert.match(weaponDetails(w,'ice'),/不参与组合/);
});

test('healing and passive previews respect caps and actual rank values',()=>{
  const w=new SurvivalWorld();w.hp=95;
  assert.equal(upgradeChanges(w,'repair'),'生命 95 → 100');
  w.passives.hourglass=1;
  assert.equal(upgradeChanges(w,'hourglass'),'冷却时间 90% → 82%');
  w.passives.boots=1;
  assert.equal(upgradeChanges(w,'boots'),'移动速度 110% → 118%');
});
