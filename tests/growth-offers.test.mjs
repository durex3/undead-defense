import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {SYNTHESIS_RECIPES,WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
test('owned skills and their partners are possible but can both be absent',()=>{
 for(const [main,partner] of Object.entries(SYNTHESIS_RECIPES)){
  const w=new SurvivalWorld(72);for(const skill of WEAPONS)w.skills[skill]=0;w.skills[main]=4;
  let a=0,b=0,missing=0;
  for(let i=0;i<200;i++){w.roll();a+=w.cards.includes(main);b+=w.cards.includes(partner);missing+=!w.cards.includes(main)&&!w.cards.includes(partner);}
  assert(a>0);assert(b>0);assert(missing>0);
 }
});
test('recipe recommendations honor full slots and never offer an unequippable partner',()=>{
 const w=new SurvivalWorld();w.skills.blade=5;w.skills.water=4;w.skills.bone=3;w.skills.pillar=1;
 assert.equal(w.growthPair,null);w.level=8;
 for(let i=0;i<40;i++){w.roll();assert(w.cards.every(c=>!WEAPONS.includes(c)||w.skills[c]>0));}
 w.skills.pillar=0;assert.equal(w.growthPair.main,'fire');
});
test('an owned pair can finish with full equipment slots and recommendations move to the next pair',()=>{
 const w=new SurvivalWorld();w.skills.blade=9;w.skills.fire=8;w.skills.water=4;w.skills.poison=2;
 assert.deepEqual(w.growthPair,{main:'fire',partner:'blade'});w.level=15;assert(w.legal().includes('blade'));assert(w.legal().includes('fire'));
 w.skills.blade=w.skills.fire=10;w.evolutions.blade='ring';w.evolutions.fire='meteor';
 assert.deepEqual(w.growthPair,{main:'water',partner:'poison'});assert(w.legal().includes('water'));assert(w.legal().includes('poison'));
});
test('invested unrelated weapons remain available and the third slot permits build changes',()=>{
 const w=new SurvivalWorld();w.skills.bone=9;w.skills.blade=3;w.level=8;w.roll();
 assert(w.legal().includes('bone'));assert(w.legal().includes('blade'));assert(w.legal().includes('mine'));
 const opener=new SurvivalWorld();opener.level=2;const alternatives=new Set();
 for(let i=0;i<80;i++){opener.roll();for(const c of opener.cards)if(c!=='blade'&&c!=='fire')alternatives.add(c);}
 assert(alternatives.size>4);
});
test('selling a recipe member updates the recommendation without bypassing equipment limits',()=>{
 const w=new SurvivalWorld();w.skills.fire=6;w.skills.blade=4;w.skills.water=3;w.skills.poison=2;w.pause('menu',true);w.openShop();
 assert(w.sellShop('fire'));assert.equal(w.growthPair.main,'water');assert.equal(w.skills.blade,4);
});

test('unrelated evolution and both recipe weapons remain in the legal random pool',()=>{
 const w=new SurvivalWorld();w.skills.blade=6;w.skills.fire=5;w.skills.bone=9;w.skills.pillar=10;w.level=25;
 assert(w.legal().includes('pillar'));assert(w.legal().includes('blade'));assert(w.legal().includes('fire'));
});
