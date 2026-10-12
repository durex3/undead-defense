import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {SYNTHESIS_RECIPES, EVOLUTIONS, WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';

test('all nine explicitly targeted recipes stay offered from an unrelated starter through automatic fusion',()=>{
 for(const [main,partner] of Object.entries(SYNTHESIS_RECIPES))for(let seed=1;seed<=25;seed++){
  const w=new SurvivalWorld(seed);assert(w.setBuildTarget(main));
  const upgrades=20-w.skills[main]-w.skills[partner];
  for(let i=0;i<upgrades;i++){
   w.state='upgrade';w.level=i+2;w.roll();
   for(const skill of [main,partner])if(w.skills[skill]<10)assert(w.cards.includes(skill),`${main} seed ${seed} missing ${skill}`);
   assert.equal(new Set(w.cards).size,w.cards.length);assert.equal(w.cards.length,3);
   const skill=[main,partner].filter(s=>w.skills[s]<10).sort((a,b)=>w.skills[a]-w.skills[b])[0];
   assert(w.choose(skill));
   if(w.state==='evolution')assert(w.evolve(EVOLUTIONS[w.pendingEvolution][0].id));
  }
  assert(w.evolutions[main]);assert.equal(w.buildTarget,null);assert.equal(w.skills[partner],10);assert.equal(w.refreshes,2);
 }
});

test('switching target updates cards immediately without RNG, resources or free alternative rerolls',()=>{
 const w=new SurvivalWorld(19);w.state='upgrade';w.level=2;w.roll();
 const {seed,xp,gold,refreshes}=w;assert(w.setBuildTarget('scythe'));
 assert(w.cards.includes('scythe'));assert(w.cards.includes('axe'));
 const cards=[...w.cards];assert(w.setBuildTarget('scythe'));assert.deepEqual(w.cards,cards);
 assert(w.setBuildTarget(null));assert.deepEqual(w.cards,cards);
 assert.deepEqual({seed:w.seed,xp:w.xp,gold:w.gold,refreshes:w.refreshes},{seed,xp,gold,refreshes});
 assert.equal(w.growthProgress.locked,false);
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

test('locked pair survives unrelated evolution priority and paid refreshes without duplicate offers',()=>{
 const w=new SurvivalWorld();w.skills.pillar=10;assert(w.setBuildTarget('scythe'));w.state='upgrade';w.roll();
 assert.deepEqual(w.cards.slice(0,2),['scythe','axe']);assert(w.cards.includes('pillar'));
 assert(w.refresh());assert.deepEqual(w.cards.slice(0,2),['scythe','axe']);assert.equal(w.refreshes,1);
});

test('shop purchases that fill reserved space clear impossible targets rather than offering illegal weapons',()=>{
 const w=new SurvivalWorld();w.skills.bone=1;assert(w.setBuildTarget('scythe'));
 w.pause('menu',true);w.openShop();w.gold=100;w.shopItems=['water'];assert(w.buyShop('water'));
 assert.equal(w.buildTarget,null);assert(!w.growthPair||w.growthPair.main!=='scythe');
 w.closeShop();w.pause('menu',false);w.state='upgrade';w.roll();
 assert(w.cards.every(c=>!WEAPONS.includes(c)||w.skills[c]||w.weaponCount<w.weaponSlots));
});
