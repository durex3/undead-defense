import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {SYNTHESIS_RECIPES, EVOLUTIONS, WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';

test('all nine targeted recipes receive a probabilistic bias without guaranteed cards',()=>{
 for(const main of Object.keys(SYNTHESIS_RECIPES)){
  const partner=SYNTHESIS_RECIPES[main];let hit=0,miss=0;
  const w=new SurvivalWorld(19);assert(w.setBuildTarget(main));w.state='upgrade';
  for(let i=0;i<150;i++){w.roll();assert.equal(new Set(w.cards).size,w.cards.length);if(w.cards.includes(main)||w.cards.includes(partner))hit++;else miss++;}
  assert(hit>50,main);assert(miss>0,main);
 }
});
test('switching target only changes future odds, never current cards or RNG/resources',()=>{
 const w=new SurvivalWorld(19);w.state='upgrade';w.roll();const cards=[...w.cards],seed=w.seed,refreshes=w.refreshes;
 assert(w.setBuildTarget('scythe'));assert.deepEqual(w.cards,cards);assert.equal(w.seed,seed);
 assert(w.setBuildTarget(null));assert.deepEqual(w.cards,cards);assert.equal(w.refreshes,refreshes);
});

test('target selection rejects incomplete recipes with insufficient slots and completed or nonexistent recipes',()=>{
 const w=new SurvivalWorld();w.skills.water=1;w.skills.bone=1;
 assert.match(w.targetReason('scythe'),/2个/);assert.equal(w.setBuildTarget('scythe'),false);
 assert(w.setBuildTarget('water'));assert.equal(w.growthPair.partner,'poison');
 w.skills.poison=10;w.skills.water=10;assert.equal(w.buildTarget,null);assert.equal(w.setBuildTarget('water'),false);
 assert.equal(w.setBuildTarget('blade'),false);assert.equal(w.setBuildTarget('not-a-skill'),false);
});

test('locked progress counts exact remaining weapon ranks and completion recommends a legal next pair',()=>{
 const w=new SurvivalWorld();w.skills.water=8;w.skills.poison=9;assert(w.setBuildTarget('water'));
 assert.deepEqual(w.growthProgress,{main:'water',partner:'poison',remaining:3,locked:true});
 w.skills.water=w.skills.poison=10;w.step(1/60);assert(w.evolve('tide'));
 assert.equal(w.buildTarget,null);assert.equal(w.growthPair.main,'fire');assert.equal(w.growthProgress.locked,false);
 w.skills.bone=1;assert.equal(w.growthPair,null);
});

test('battle and final screens cannot switch target; a new run never inherits the previous target',()=>{
 const w=new SurvivalWorld();assert(w.setBuildTarget('scythe'));w.time=1;
 assert.equal(w.setBuildTarget('ghost'),false);w.pause('menu',true);assert(w.setBuildTarget('ghost'));
 w.state='evolution';assert.equal(w.setBuildTarget(null),false);w.state='won';assert.equal(w.setBuildTarget(null),false);
 assert.equal(new SurvivalWorld().buildTarget,null);
});

test('paid refresh samples a legal distinct set and consumes one refresh',()=>{
 const w=new SurvivalWorld(19);w.setBuildTarget('scythe');w.state='upgrade';w.roll();assert(w.refresh());
 assert.equal(w.refreshes,1);assert.equal(new Set(w.cards).size,3);assert(w.cards.every(c=>w.legal().includes(c)));
});

test('shop purchases that fill reserved space clear impossible targets rather than offering illegal weapons',()=>{
 const w=new SurvivalWorld();w.skills.bone=1;assert(w.setBuildTarget('scythe'));
 w.pause('menu',true);w.openShop();w.gold=100;w.shopItems=['water'];assert(w.buyShop('water'));
 assert.equal(w.buildTarget,null);assert(!w.growthPair||w.growthPair.main!=='scythe');
 w.closeShop();w.pause('menu',false);w.state='upgrade';w.roll();
 assert(w.cards.every(c=>!WEAPONS.includes(c)||w.skills[c]||w.weaponCount<w.weaponSlots));
});
