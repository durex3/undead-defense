import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {battleReport} from '../temp/tests/battle/BattleReport.mjs';
const enemy=(w,x=3,y=0)=>{const e=w.addEnemy('minion',x,y);e.state='seek';e.hp=e.maxHp=100000;return e;};
const prepare=(main,partner,form)=>{const w=new SurvivalWorld();w.skills[main]=w.skills[partner]=10;w.evolutions[main]=form;return w;};

test('both ghost branches consume bat marks, record effective bonus damage and share a per-enemy gate',()=>{
 for(const form of ['legion','hunters']){
  const w=prepare('ghost','bat',form),e=enemy(w);w.combinations.mark('ghost',e);
  w.cast('ghost');w.castPart(w.scheduled[0]);const p=w.shots[0];p.x=e.x;p.y=e.y;p.vx=p.vy=0;
  w.stepShot(p,0);assert.equal(w.combinations.stats.ghost.triggers,1);assert(w.combinations.stats.ghost.damage>0);
  const damage=w.combinations.stats.ghost.damage;w.combinations.mark('ghost',e);w.combinations.strike('ghost',e,e);
  assert.equal(w.combinations.stats.ghost.damage,damage);
  w.time=.6;w.combinations.strike('ghost',e,e);assert.equal(w.combinations.stats.ghost.triggers,2);
  w.combinations.strike('ghost',e,e);assert.equal(w.combinations.stats.ghost.triggers,2);
 }
});

test('actual bat and axe hits mark targets, while only returning scythes consume axe marks',()=>{
 const w=prepare('ghost','bat','hunters'),e=enemy(w,1);
 w.expansion.cast('bat');w.expansion.bats[0].x=e.x;w.expansion.bats[0].y=e.y;
 w.expansion.stepBats(0);assert(w.combinations.marked('ghost',e));
 for(const form of ['reaper','cross']){
  const q=prepare('scythe','axe',form),target=enemy(q,3);
  q.cast('axe');q.castPart(q.scheduled[0]);const axe=q.shots[0];axe.x=3;axe.y=0;axe.vx=axe.vy=0;q.stepShot(axe,0);
  assert(q.combinations.marked('scythe',target));
  q.scheduled=[];q.cast('scythe');q.castPart(q.scheduled[0]);const p=q.shots.at(-1);p.x=3;p.y=0;p.vx=p.vy=0;
  q.stepShot(p,0);assert.equal(q.combinations.stats.scythe,undefined);
  p.hit=[];p.returning=true;q.stepShot(p,0);assert.equal(q.combinations.stats.scythe.triggers,1);
 }
});

test('marks expire in combat time, require both max ranks and clear when a partner is recycled',()=>{
 const w=prepare('ghost','bat','legion'),e=enemy(w);w.skills.bat=9;w.combinations.mark('ghost',e);
 assert.equal(w.combinations.marked('ghost',e),false);w.skills.bat=10;w.combinations.mark('ghost',e);
 w.pause('menu',true);w.step(5);assert(w.combinations.marked('ghost',e));w.pause('menu',false);
 w.time=2;w.combinations.step();assert(!w.combinations.marked('ghost',e));
 w.combinations.mark('ghost',e);w.combinations.remove('bat');assert(!w.combinations.marked('ghost',e));
});

test('extra-damage accounting clips overkill, respects shields and does not add a second copy to totals',()=>{
 const w=prepare('ghost','bat','hunters'),e=enemy(w);e.hp=e.maxHp=5;
 w.combinations.mark('ghost',e);w.combinations.strike('ghost',e,e);
 assert.equal(w.combinations.stats.ghost.damage,5);assert.equal(w.kills,1);
 const report=battleReport(w);assert.equal(report.total,5);assert.equal(report.comboDamage,5);assert.equal(report.comboTriggers,1);
 assert.equal(report.combinations[0].damage,5);assert.equal(report.otherDamage,0);
 const q=prepare('water','poison','tide'),target=enemy(q);target.hp=5;
 q.hit(target,30,'water',false,target,false,'water',1/3);
 assert.equal(q.combinations.stats.water,undefined); // ordinary portion alone already kills
 const shield=q.addEnemy('shield',4,0);shield.state='seek';shield.hp=shield.maxHp=10000;shield.facing=0;
 const before=shield.hp;q.hit(shield,30,'water',false,{x:5,y:0},true,'water',1/3);
 assert(Math.abs(q.combinations.stats.water.damage-(before-shield.hp)/3)<1e-8);
});

test('meteor collapse needs a live overlapping void field and only triggers on impact',()=>{
 for(const overlap of [false,true]){
  const w=prepare('meteor','void','doomsfall');enemy(w,3);
  w.expansion.field('void',{x:overlap?3:10,y:0},2,4,0);
  w.arsenal.cast('meteor');for(const key of Object.keys(w.cooldowns))w.cooldowns[key]=99;
  w.time=1.2;w.arsenal.step(0);
  assert.equal(w.combinations.stats.meteor?.triggers||0,overlap?1:0);
  const count=w.combinations.stats.meteor?.triggers||0;w.time=1.7;w.arsenal.step(0);
  assert.equal(w.combinations.stats.meteor?.triggers||0,count);
 }
});

test('water overlap records the independent purification pulse separately from the base water tick',()=>{
 const w=prepare('water','poison','tide');const e=enemy(w,0);
 w.expansion.cast('water');w.expansion.field('poison',w.player,2,4,0);w.time=1;w.expansion.stepFields(0);
 assert.equal(w.combinations.stats.water.triggers,1);
 assert(Math.abs(w.combinations.stats.water.damage-w.damage.water/2)<1e-8);
 assert(w.combinations.stats.water.damage<=w.damage.water);
});

test('a returning scythe chases nearby axe marks without teleporting, repeating hits or extending its lifetime',()=>{
 const w=prepare('scythe','axe','cross'),e=enemy(w,3,2);w.combinations.mark('scythe',e);
 w.cast('scythe');w.castPart(w.scheduled[0]);const p=w.shots[0];p.x=3;p.y=0;p.returning=true;p.age=1;
 const ttl=p.ttl;w.stepShot(p,.1);assert(p.vy>0);assert(Math.abs(p.x-3)<1e-8);assert(p.y>0&&p.y<=1.01);assert(p.ttl<ttl);
 p.hit.push(e.id);w.stepShot(p,.1);assert(p.vx<0); // already-hit mark cannot lure the same return leg again
 w.combinations.remove('axe');assert(!w.combinations.marked('scythe',e));
});
