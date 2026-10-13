import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {SYNTHESIS_RECIPES,EVOLUTIONS} from '../temp/tests/battle/SurvivalConfig.mjs';
test('every combination triggers automatically once and retains both weapons',()=>{
 for(const [main,other] of Object.entries(SYNTHESIS_RECIPES)){
  const w=new SurvivalWorld(7);w.skills[main]=10;w.skills[other]=9;w.step(1/60);
  assert.equal(w.evolutions[main],EVOLUTIONS[main][0].id);assert.equal(w.combinations.ready(main),false);
  while(w.state==='evolution')w.back();
  w.state='upgrade';w.cards=[other];assert(w.choose(other));
  assert.equal(w.evolutions[main],EVOLUTIONS[main][0].id);
  assert.equal(w.skills[main],10);assert.equal(w.skills[other],10);assert.equal(w.combinations.ready(main),true);
  w.drain();w.step(1/60);assert(!w.drain().some(e=>e.type==='evolve'&&e.skill===main));
 }
});
test('shop purchase of last required rank triggers combination before resuming',()=>{
 const w=new SurvivalWorld();w.skills.fire=10;w.skills.blade=9;w.gold=100;w.pause('menu',true);w.openShop();w.shopItems=['blade'];
 assert(w.buyShop('blade'));assert.equal(w.evolutions.fire,'meteor');assert.equal(w.skills.blade,10);
});
test('final form adds 80 percent effective damage beyond level ten',()=>{
 const w=new SurvivalWorld();w.skills.fire=10;const e=w.addEnemy('minion',2,0);e.state='seek';e.hp=e.maxHp=10000;
 w.hit(e,20,'fire',false,w.player,false);const normal=10000-e.hp;
 e.hp=10000;w.evolutions.fire='meteor';w.hit(e,20,'fire',false,w.player,false);
 assert.ok(Math.abs((10000-e.hp)/normal-1.8)<1e-8);
});
test('growth continues past level 25 and premature final evolution is rejected',()=>{
 const w=new SurvivalWorld();w.level=25;w.xp=w.xpNeed;w.step(1/60);assert.equal(w.level,26);assert.equal(w.state,'upgrade');
 w.state='evolution';w.pendingEvolution='blade';w.skills.blade=1;assert.equal(w.evolve('ring'),false);
});
