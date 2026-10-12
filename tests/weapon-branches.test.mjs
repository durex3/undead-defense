import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
const enemy=(w,x,y=0,kind='minion')=>{const e=w.addEnemy(kind,x,y);e.state='seek';e.hp=e.maxHp=100000;return e;};
test('fulfilled recipes open branch choices automatically, pause time and preserve both weapons',()=>{
 const w=new SurvivalWorld();w.skills.fire=w.skills.blade=10;w.step(1/60);
 assert.equal(w.state,'evolution');assert.equal(w.pendingEvolution,'fire');assert.equal(w.time,0);
 w.step(1);assert.equal(w.time,0);assert.equal(w.evolve('invalid'),false);
 assert(w.evolve('inferno'));assert.equal(w.state,'battle');assert.equal(w.evolutions.fire,'inferno');assert.equal(w.skills.blade,10);
 w.step(1/60);assert.equal(w.pendingEvolution,null);
});
test('simultaneous recipes queue without extra XP and default branch resumes safely',()=>{
 const w=new SurvivalWorld();w.skills.fire=w.skills.blade=w.skills.water=w.skills.poison=10;w.xp=0;
 w.step(1/60);assert.equal(w.pendingEvolution,'fire');w.back();assert.equal(w.pendingEvolution,'water');assert.equal(w.state,'evolution');
 w.back();assert.equal(w.state,'battle');assert.equal(w.xp,0);assert.equal(w.evolutions.water,'spring');
});
test('pending shop branch waits until unpaused and can select the alternate form',()=>{
 const w=new SurvivalWorld();w.skills.water=9;w.skills.poison=10;w.gold=100;w.pause('menu',true);w.openShop();w.shopItems=['water'];w.buyShop('water');
 w.step(1);assert.equal(w.state,'battle');w.closeShop();w.pause('menu',false);w.step(1/60);
 assert.equal(w.pendingEvolution,'water');assert(w.evolve('tide'));assert.equal(w.skills.poison,10);
});
test('fire rain creates four distinct projectiles instead of one meteor',()=>{
 for(const [form,count] of [['meteor',1],['inferno',4]]){
  const w=new SurvivalWorld();w.skills.fire=10;w.evolutions.fire=form;
  for(let i=0;i<4;i++)enemy(w,4+i,1);w.cast('fire');assert.equal(w.scheduled.length,count);
  for(const q of w.scheduled)w.castPart(q);
  assert.equal(w.shots.length,count);assert.equal(new Set(w.shots.map(p=>p.target)).size,count);
  if(form==='inferno')assert(w.shots.every(p=>p.damage===w.attack*1.25));
 }
});
test('thunder prioritizes boss and elite, hits at most three targets with no decay',()=>{
 const w=new SurvivalWorld();w.skills.lightning=10;w.evolutions.lightning='thunder';
 const boss=enemy(w,10,0,'boss'),elite=enemy(w,9,0,'charger');for(let i=0;i<5;i++)enemy(w,1+i,1);
 w.lightning();const hits=w.drain().filter(e=>e.type==='lightning');assert.equal(hits.length,3);assert.equal(hits[0].endX,boss.x);assert.equal(hits[1].endX,elite.x);
 assert.equal(100000-boss.hp,100000-elite.hp);
});
test('ice and lightning synergy only boosts chilled targets after recipe completion',()=>{
 const w=new SurvivalWorld();w.skills.lightning=w.skills.ice=10;w.evolutions.lightning='thunder';const chilled=enemy(w,3),normal=enemy(w,4);chilled.slowUntil=10;
 w.lightning();assert(100000-chilled.hp>100000-normal.hp);
});
test('tide follows player while spring remains at its landing point',()=>{
 for(const form of ['tide','spring']){
  const w=new SurvivalWorld();w.skills.water=10;w.evolutions.water=form;w.expansion.cast('water');const f=w.expansion.fields[0],x=f.x;
  w.player.x=8;w.time=1;w.expansion.stepFields(0);
  assert.equal(f.x,form==='tide'?8:x);assert.equal(w.expansion.fields.length,form==='tide'?1:5);
 }
});
test('water poison overlap adds fifty percent once even with overlapping fields',()=>{
 const damage=(poison)=>{const w=new SurvivalWorld();w.skills.water=w.skills.poison=10;w.evolutions.water='tide';const e=enemy(w,0);w.expansion.cast('water');w.expansion.cast('water');
  if(poison){w.expansion.field('poison',w.player,2,4,0);w.expansion.field('poison',w.player,2,4,0);}
  w.time=1;w.expansion.stepFields(0);return 100000-e.hp;};
 assert.ok(Math.abs(damage(true)/damage(false)-1.5)<1e-8);
});
test('fire blade combination reaches enemies outside the original blast radius',()=>{
 const w=new SurvivalWorld();w.skills.fire=w.skills.blade=10;w.evolutions.fire='meteor';const e=enemy(w,3);
 w.explode({x:0,y:0,damage:100});assert(e.hp<100000);assert(w.drain().some(e=>e.type==='comboFire'&&e.skill==='blade'));
});

test('ghost and scythe recipes automatically queue their new branches and retain partners',()=>{
 for(const [skill,partner,form] of [['ghost','bat','hunters'],['scythe','axe','cross']]){
  const w=new SurvivalWorld();w.skills[skill]=w.skills[partner]=10;w.step(1/60);
  assert.equal(w.pendingEvolution,skill);assert.equal(w.time,0);assert(w.evolve(form));
  assert.equal(w.skills[partner],10);assert.equal(w.evolutions[skill],form);
  assert.equal(w.drain().filter(e=>e.final&&e.skill===skill).length,1);
  w.step(1/60);assert.equal(w.state,'battle');
 }
});

test('hunters concentrate two fast non-piercing shots on boss then elite instead of splitting the legion',()=>{
 for(const [form,count]of [['legion',4],['hunters',2]]){
  const w=new SurvivalWorld();w.skills.ghost=10;w.evolutions.ghost=form;
  const boss=enemy(w,9,0,'boss'),elite=enemy(w,8,1,'charger');enemy(w,2,2);enemy(w,3,1);
  w.cast('ghost');for(const q of w.scheduled)w.castPart(q);
  assert.equal(w.shots.length,count);
  if(form==='hunters'){
   assert(w.shots.every(p=>p.target===boss.id&&p.left===1&&Math.abs(Math.hypot(p.vx,p.vy)-17)<1e-8));
   assert(w.shots.every(p=>p.damage>w.attack*3));
   boss.hp=0;w.shots=[];for(const q of w.scheduled)w.castPart(q);
   assert(w.shots.every(p=>p.target===elite.id));
  }else assert.equal(new Set(w.shots.map(p=>p.target)).size,4);
 }
});

test('hunter form snapshot never splashes even if the selected form changes in flight',()=>{
 const w=new SurvivalWorld();w.skills.ghost=10;w.evolutions.ghost='hunters';
 const direct=enemy(w,3,0),nearby=enemy(w,3,.7);w.cast('ghost');w.castPart(w.scheduled[0]);
 const p=w.shots[0];p.x=direct.x;p.y=direct.y;p.vx=p.vy=0;
 w.evolutions.ghost='legion';w.stepShot(p,0);
 assert(direct.hp<100000);assert.equal(nearby.hp,100000);assert.equal(p.left,0);
 assert(!w.drain().some(e=>e.type==='explosion'));
});

test('cross scythes sweep opposite arcs, return earlier and boost return damage without extension',()=>{
 const w=new SurvivalWorld();w.skills.scythe=10;w.evolutions.scythe='cross';enemy(w,8,8);
 w.cast('scythe');for(const q of w.scheduled)w.castPart(q);
 assert.equal(w.shots.length,2);const [a,b]=w.shots;
 assert.equal(a.range,5.5);assert(a.vy*b.vy<0);
 const oldA=Math.atan2(a.vy,a.vx),oldB=Math.atan2(b.vy,b.vx);
 w.stepShot(a,.1);w.stepShot(b,.1);
 const delta=(p,old)=>Math.atan2(Math.sin(Math.atan2(p.vy,p.vx)-old),Math.cos(Math.atan2(p.vy,p.vx)-old));
 assert(delta(a,oldA)>0);assert(delta(b,oldB)<0);
 const target=enemy(w,3,0);a.x=3;a.y=0;a.age=1;a.returning=false;a.hit=[];
 w.stepShot(a,0);assert(a.returning);const returnDamage=100000-target.hp;
 target.hp=100000;a.returning=false;a.age=0;a.hit=[];w.stepShot(a,0);
 assert(Math.abs(returnDamage/(100000-target.hp)-1.5)<1e-8);
 target.hp=1;a.returning=true;a.hit=[];w.stepShot(a,0);assert.equal(a.excursion,0);
});
