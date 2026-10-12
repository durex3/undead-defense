import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {SYNTHESIS_RECIPES,WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
test('all nine recipes can grow from either starting weapon without seed or reroll luck',()=>{
 for(const [main,partner] of Object.entries(SYNTHESIS_RECIPES))for(const starter of [main,partner])for(let seed=1;seed<=40;seed++){
  const w=new SurvivalWorld(seed);for(const s of WEAPONS)w.skills[s]=0;w.skills[starter]=1;
  for(let level=2;level<=20;level++){
   w.level=level;w.state='upgrade';w.roll();
   for(const s of [main,partner])if(w.skills[s]<10)assert(w.cards.includes(s),`${main}/${partner} ${starter} seed ${seed} L${level} missing ${s}`);
   assert.equal(new Set(w.cards).size,w.cards.length);
   const pick=[main,partner].filter(s=>w.skills[s]<10).sort((a,b)=>w.skills[a]-w.skills[b])[0];assert(w.choose(pick));
  }
  assert.equal(w.skills[main],10);assert.equal(w.skills[partner],10);assert(w.evolutions[main]);assert.equal(w.refreshes,2);
 }
});
test('all character openers offer starter, recipe partner and a different third choice',()=>{
 for(const [character,starter,partner] of [['ranger','blade','fire'],['alchemist','water','poison'],['necromancer','ghost','bat']])for(let seed=1;seed<=80;seed++){
  const w=new SurvivalWorld(seed,character);w.level=2;w.roll();assert(w.cards.includes(starter));assert(w.cards.includes(partner));assert.equal(w.cards.length,3);
 }
});
test('recipe recommendations honor full slots and never offer an unequippable partner',()=>{
 const w=new SurvivalWorld();w.skills.blade=5;w.skills.water=4;w.skills.bone=3;w.skills.pillar=1;
 assert.equal(w.growthPair,null);w.level=8;
 for(let i=0;i<40;i++){w.roll();assert(w.cards.every(c=>!WEAPONS.includes(c)||w.skills[c]>0));}
 w.skills.pillar=0;assert.equal(w.growthPair.main,'fire');w.roll();assert(w.cards.includes('fire'));
});
test('an owned pair can finish with full equipment slots and recommendations move to the next pair',()=>{
 const w=new SurvivalWorld();w.skills.blade=9;w.skills.fire=8;w.skills.water=4;w.skills.poison=2;
 assert.deepEqual(w.growthPair,{main:'fire',partner:'blade'});w.level=15;w.roll();assert(w.cards.includes('blade'));assert(w.cards.includes('fire'));
 w.skills.blade=w.skills.fire=10;w.evolutions.blade='ring';w.evolutions.fire='meteor';
 assert.deepEqual(w.growthPair,{main:'water',partner:'poison'});w.roll();assert(w.cards.includes('water'));assert(w.cards.includes('poison'));
});
test('invested unrelated weapons remain available and the third slot permits build changes',()=>{
 const w=new SurvivalWorld();w.skills.bone=9;w.skills.blade=3;w.level=8;w.roll();
 assert(w.cards.includes('bone'));assert(w.cards.includes('blade'));assert(w.cards.includes('mine'));
 const opener=new SurvivalWorld();opener.level=2;const alternatives=new Set();
 for(let i=0;i<80;i++){opener.roll();for(const c of opener.cards)if(c!=='blade'&&c!=='fire')alternatives.add(c);}
 assert(alternatives.size>4);
});
test('selling a recipe member updates the recommendation without bypassing equipment limits',()=>{
 const w=new SurvivalWorld();w.skills.fire=6;w.skills.blade=4;w.skills.water=3;w.skills.poison=2;w.pause('menu',true);w.openShop();
 assert(w.sellShop('fire'));assert.equal(w.growthPair.main,'water');assert.equal(w.skills.blade,4);
});

test('pending unrelated evolution cannot crowd the two recipe weapons out of the offers',()=>{
 const w=new SurvivalWorld();w.skills.blade=6;w.skills.fire=5;w.skills.bone=9;w.skills.pillar=10;w.level=25;
 w.roll();assert(w.cards.includes('pillar'));assert(w.cards.includes('blade'));assert(w.cards.includes('fire'));
});
