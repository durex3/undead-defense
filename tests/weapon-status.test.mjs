import test from 'node:test';
import assert from 'node:assert/strict';
import { SurvivalWorld } from '../temp/tests/battle/SurvivalWorld.mjs';
import { WEAPONS, EVOLUTIONS, SYNTHESIS_RECIPES } from '../temp/tests/battle/SurvivalConfig.mjs';
import { weaponStatus, combinationRecipes } from '../temp/tests/battle/WeaponStatus.mjs';
import { battleHud } from '../temp/tests/presentation/BattleHud.mjs';

test('all eighteen weapons choose branches at ten without a partner',()=>{
  for(const skill of WEAPONS){
    const w=new SurvivalWorld();for(const s of WEAPONS)w.skills[s]=0;
    w.skills[skill]=9;w.state='upgrade';w.cards=[skill];
    assert.equal(w.choose(skill),true);assert.equal(w.pendingEvolution,skill);
    assert.equal(w.evolve(EVOLUTIONS[skill][1].id),true);
    assert.equal(weaponStatus(w,skill).branch,EVOLUTIONS[skill][1].name);
    assert.equal(weaponStatus(w,skill).combined,false);
    assert.equal(weaponStatus(w,skill).icons,'◇');
  }
});

test('later partner activates combination exactly once without replacing the chosen branch',()=>{
  for(const [main,partner] of Object.entries(SYNTHESIS_RECIPES)){
    const w=new SurvivalWorld(1,'ranger',1,6);
    for(const s of WEAPONS)w.skills[s]=0;
    w.skills[main]=9;w.state='upgrade';w.cards=[main];w.choose(main);
    w.evolve(EVOLUTIONS[main][1].id);w.drain();
    w.skills[partner]=9;w.state='upgrade';w.cards=[partner];w.choose(partner);
    const events=w.drain();assert.equal(events.filter(e=>e.type==='comboReady').length,1);
    assert.equal(w.evolutions[main],EVOLUTIONS[main][1].id);
    assert.equal(weaponStatus(w,main).icons,'◇∞');
    assert.equal(weaponStatus(w,partner).combined,true);
    while(w.state==='evolution')w.back();w.drain();w.step(1/60);
    assert.equal(w.drain().filter(e=>e.type==='comboReady').length,0);
  }
});

test('six-slot screenshot build distinguishes five branches from two combinations',()=>{
  const w=new SurvivalWorld(1,'ranger',1,6);
  for(const s of WEAPONS)w.skills[s]=0;
  for(const s of ['ghost','water','poison','bone','mine','pillar'])w.skills[s]=10;
  for(const s of ['water','poison','bone','mine','pillar'])w.evolutions[s]=EVOLUTIONS[s][0].id;
  const recipes=combinationRecipes(w),ready=recipes.filter(r=>r.ready);
  assert.equal(w.weaponCount,6);assert.equal(ready.length,2);
  assert.equal(weaponStatus(w,'pillar').combined,false);
  assert.equal(weaponStatus(w,'ghost').combined,false);
  assert.ok(ready.every(r=>r.label.includes('＋')&&r.label.includes('→')));
  const hud=battleHud(w,true,[]);assert.ok(!hud.weapons.includes('★'));
  assert.ok(hud.weapons.includes('6/6'));assert.ok(hud.weapons.includes('◇'));assert.ok(hud.weapons.includes('∞'));
});

test('stale upgrade card cannot equip a seventh weapon',()=>{
  const w=new SurvivalWorld(1,'ranger',1,6);
  for(const s of ['blade','fire','water','poison','bone','mine'])w.skills[s]=1;
  w.state='upgrade';w.cards=['ghost'];
  assert.equal(w.choose('ghost'),false);assert.equal(w.weaponCount,6);
});
