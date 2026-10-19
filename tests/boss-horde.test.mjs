import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {bossCrowdRules,BOSS_REINFORCEMENT_XP} from '../temp/tests/battle/HordePressure.mjs';
import {MAX_ENEMIES,ENEMIES} from '../temp/tests/battle/SurvivalConfig.mjs';
import {STAGES} from '../temp/tests/battle/StageRules.mjs';
import {bossTimeForStage} from '../temp/tests/battle/EncounterPacing.mjs';

/** Stage 1 uses a shorter run; the boss arrives at its own time on every stage. */
function battle(stage=2){
  const w=new SurvivalWorld(1,'ranger',stage);
  w.time=bossTimeForStage(stage);
  w.director.step(w,0);
  const b=w.enemies.find(e=>e.kind==='boss');
  b.state='seek';
  return {w,b};
}
/** Fodder kind each stage uses for boss reinforcements. */
const fodder=stage => stage===1 ? 'siegebone' : stage===2 ? 'sandworker' : stage===3 ? 'rivetwalker' : 'thornrunner';
/** Authored boss reinforcements add their own elite escorts on stage one. */
const escort=stage => stage===1 ? ['thornshield','siegebow','flanker'] : [];

test('boss pressure scales across four stages and phases without exceeding global capacity',()=>{
 let last=0;for(let stage=1;stage<=4;stage++){
  const rules=bossCrowdRules(stage);assert.ok(rules.target>last);last=rules.target;
  const {w,b}=battle(stage);b.bossPhase=2;
  for(let i=0;i<60;i++){w.time+=1;w.director.step(w,1);}
  assert.ok(w.enemies.length>20);assert.ok(w.enemies.length<=bossCrowdRules(stage,b.bossPhase).target+1);assert.ok(w.enemies.length<=MAX_ENEMIES);
  assert.ok(w.enemies.every(e=>['boss',fodder(stage),...escort(stage)].includes(e.kind)));
 }
});

test('reinforcements arrive with a gap and give half XP without gold or potions',()=>{
 // Stage one fodder dies cleanly; sand workers split into larvae, so XP is tested here.
 const {w}=battle(1);w.time=bossTimeForStage(1)+3;w.director.step(w,3);const adds=w.enemies.filter(e=>e.kind===fodder(1));
 assert.ok(adds.length>=10);
 for(const e of adds){
  assert.ok(Math.hypot(e.x-w.player.x,e.y-w.player.y)>=4);
  assert.equal(e.state,'arriving');assert.equal(e.timer,1);assert.equal(e.summoned,true);assert.equal(e.owner,0);
  e.state='seek';w.hit(e,1e6,'blade');
 }
 assert.ok(Math.abs(w.gems.reduce((n,g)=>n+g.value,0)-adds.length*ENEMIES[fodder(1)].xp*STAGES[1].xp*BOSS_REINFORCEMENT_XP)<1e-8);
 assert.equal(w.potions.length,0);assert.equal(w.gold,0);
});

test('only marked ordinary boss reinforcements drop XP; skill summons do not',()=>{
 for(const stage of [1,3,4]){
  const {w,b}=battle(stage);const summon=w.addEnemy('minion',1,0,true);summon.owner=b.id;
  w.hit(summon,1e6,'blade');assert.equal(w.gems.length,0);
  const normal=w.addEnemy('minion',3,0);w.hit(normal,1e6,'blade');
  assert.equal(w.gems.reduce((n,g)=>n+g.value,0),ENEMIES.minion.xp*STAGES[stage].xp);
  w.gems=[];w.kills=STAGES[stage].medicine-1;w.time=bossTimeForStage(stage)+3;w.director.step(w,3);
  const add=w.enemies.find(e=>e.hp>0&&e.bossReinforcement);assert(add);add.state="seek";w.hit(add,1e6,'blade');
  assert.equal(w.gems.reduce((n,g)=>n+g.value,0),ENEMIES.minion.xp*STAGES[stage].xp*.5);assert.equal(w.potions.length,0);
 }
});

test('collecting boss reinforcement XP opens a normal upgrade, preserves excess and respects level 64',()=>{
 const {w}=battle(4);w.level=50;w.xp=w.xpNeed-.2;w.time=bossTimeForStage(4)+3;w.director.step(w,3);
 const add=w.enemies.find(e=>e.bossReinforcement);add.state='seek';w.hit(add,1e6,'blade');assert(w.useUltimate());
 assert.equal(w.level,51);assert.equal(w.state,'upgrade');assert(Math.abs(w.xp-(ENEMIES[fodder(4)].xp*STAGES[4].xp*BOSS_REINFORCEMENT_XP-.2))<1e-8);
 const {w:c}=battle(4);c.level=63;c.xp=c.xpNeed-.2;c.time=bossTimeForStage(4)+3;c.director.step(c,3);
 const last=c.enemies.find(e=>e.bossReinforcement);last.state='seek';c.hit(last,1e6,'blade');assert(c.useUltimate());assert.equal(c.level,64);
 while(c.state==='upgrade'||c.state==='modification'){if(c.state==='upgrade')c.choose(c.cards[0]);else c.chooseMod(c.modOptions().find(m=>!c.mods[c.pendingModification].includes(m.excludes)).id);}
 c.xp+=1000;c.checkUpgrade();assert.equal(c.level,64);assert.equal(c.state,'battle');
});

test('boss transition and pause defer waves; kills are replenished; victory stops spawns',()=>{
 const {w,b}=battle(2);
 b.bossAction='transition';b.state='windup';w.time=bossTimeForStage(2)+10;w.director.step(w,10);assert.equal(w.enemies.length,1);
 b.state='seek';w.pause('test',true);w.time=bossTimeForStage(2)+15;w.director.step(w,5);assert.equal(w.enemies.length,1);w.pause('test',false);
 w.director.step(w,0);assert.ok(w.enemies.length>1);w.enemies=w.enemies.filter(e=>e===b);w.time+=3;w.director.step(w,3);assert.ok(w.enemies.length>1);
 w.hit(b,1e6,'blade');assert.equal(w.state,'won');const count=w.enemies.length;w.time+=10;w.director.step(w,10);assert.equal(w.enemies.length,count);assert.ok(w.enemies.every(e=>e.hp<=0));
});

test('own boss summons count toward wave target and edges never spawn on player',()=>{
 const {w,b}=battle(2);w.player={x:22,y:26};w.camera={x:10,y:20};
 for(let i=0;i<8;i++){const e=w.addEnemy('minion',0,0,true);e.owner=b.id;}
 for(let i=0;i<20;i++){w.time+=3;w.director.step(w,3);}
 assert.ok(w.enemies.length<=bossCrowdRules(2).target+1);
 assert.ok(w.enemies.filter(e=>e.owner===0&&e.kind===fodder(2)).every(e=>Math.hypot(e.x-22,e.y-26)>=4));
});

test('boss crowds fill quickly and replenish cleared fodder without adding special attacks',()=>{
 for(const stage of [1,2,3,4]){
  const {w,b}=battle(stage);
  for(let i=0;i<60;i++){w.time+=.1;w.director.step(w,.1);}
  const adds=w.enemies.filter(e=>e.kind!=='boss');
  // Blocked maps reject some spawn points, so each stage fills to its own ceiling.
  assert.ok(adds.length>=24,`stage ${stage}: ${adds.length}`);
  assert.ok(adds.every(e=>e.kind===fodder(stage)||escort(stage).includes(e.kind)));
  w.enemies=[b];
  for(let i=0;i<18;i++){w.time+=.1;w.director.step(w,.1);}
  // Blocked maps (3, 4) have fewer legal spawn points, so they refill more slowly.
  // Blocks on stages 3 and 4 leave fewer legal spawn points.
  assert.ok(w.enemies.length>=9,`stage ${stage} replenish: ${w.enemies.length}`);
  assert.ok(w.enemies.length<=MAX_ENEMIES);
 }
});

test('dense boss surges leave a five-second clear-and-approach window',()=>{
 const {w,b}=battle(2);const t0=bossTimeForStage(2);
 w.time=t0+10;w.director.step(w,0);assert.equal(w.enemies.length,1);
 w.time=t0+13.9;w.director.step(w,0);assert.equal(w.enemies.length,1);
 w.time=t0+14.3;w.director.step(w,0);assert.ok(w.enemies.length>1);assert.equal(w.enemies[0],b);
});
