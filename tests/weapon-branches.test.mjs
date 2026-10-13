import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
const enemy=(w,x,y=0,kind='minion')=>{const e=w.addEnemy(kind,x,y);e.state='seek';e.hp=e.maxHp=100000;return e;};
test('fulfilled recipes open branch choices automatically, pause time and preserve both weapons',()=>{
 const w=new SurvivalWorld();w.skills.fire=w.skills.blade=10;w.step(1/60);
 assert.equal(w.state,'evolution');assert.equal(w.pendingEvolution,'fire');assert.equal(w.time,0);
 w.step(1);assert.equal(w.time,0);assert.equal(w.evolve('invalid'),false);
 assert(w.evolve('inferno'));assert.equal(w.pendingEvolution,'blade');w.back();assert.equal(w.state,'battle');assert.equal(w.evolutions.fire,'inferno');assert.equal(w.skills.blade,10);
 w.step(1/60);assert.equal(w.pendingEvolution,null);
});
test('simultaneous recipes queue without extra XP and default branch resumes safely',()=>{
 const w=new SurvivalWorld();w.skills.fire=w.skills.blade=w.skills.water=w.skills.poison=10;w.xp=0;
 w.step(1/60);assert.equal(w.pendingEvolution,'fire');w.back();assert.equal(w.pendingEvolution,'water');assert.equal(w.state,'evolution');
 w.back();assert.equal(w.pendingEvolution,'blade');w.back();assert.equal(w.pendingEvolution,'poison');w.back();assert.equal(w.state,'battle');assert.equal(w.xp,0);assert.equal(w.evolutions.water,'spring');
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
 assert.ok(Math.abs((100000-boss.hp)/(100000-elite.hp)-1.25/1.8)<1e-9);
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
  assert.equal(w.pendingEvolution,partner);w.back();
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

test('ice poison and axe automatically choose branches at ten without another upgrade or partner',()=>{
 for(const [skill,form]of [['ice','icicle'],['poison','venom'],['axe','execution']]){
  const w=new SurvivalWorld();w.skills[skill]=9;w.state='upgrade';w.cards=[skill];w.xp=0;
  assert(w.choose(skill));assert.equal(w.pendingEvolution,skill);assert.equal(w.state,'evolution');assert.equal(w.skills[skill],10);
  assert(!w.evolve('invalid'));assert(w.evolve(form));assert.equal(w.state,'battle');assert.equal(w.xp,0);assert.equal(w.evolutions[skill],form);assert(!w.legal().includes(skill));
  w.step(0);assert.equal(w.pendingEvolution,null);
 }
});
test('icicles focus the boss, slow without freezing and trade away the domain ring',()=>{
 const w=new SurvivalWorld();w.skills.ice=10;w.evolutions.ice='icicle';enemy(w,1);const boss=enemy(w,6,0,'boss');
 w.cast('ice');assert.equal(w.rings.length,0);assert.equal(w.shots.length,3);assert(w.shots.every(p=>p.target===boss.id));
 for(const p of w.shots){p.x=boss.x;p.y=boss.y;w.stepShot(p,0);}
 assert(boss.hp<100000);assert(boss.slowUntil>w.time);assert.equal(boss.freezeUntil,0);
});
test('venom casts while stationary, caps stacks, persists outside the pool and never triggers plague bursts',()=>{
 const w=new SurvivalWorld();w.skills.poison=10;w.evolutions.poison='venom';const boss=enemy(w,4,0,'boss');enemy(w,1);
 w.expansion.step(.01);const f=w.expansion.fields[0];assert(f);assert.equal(f.x,4);assert.equal(f.radius,1.2);assert.equal(f.form,'venom');
 for(let i=0;i<8;i++){w.time=i;f.until=20;w.expansion.stepFields(0);}
 assert.equal(w.expansion.venom.get(boss.id).stacks,5);
 const hp=boss.hp;w.expansion.fields=[];w.time=8;w.expansion.stepFields(0);assert(boss.hp<hp);
 w.time=12;w.expansion.stepFields(0);assert.equal(w.expansion.venom.size,0);
 const dead=enemy(w,0);w.expansion.field('poison',dead,2,5,0);w.expansion.onDeath(dead,'blade');assert.equal(w.expansion.poisonBursts.length,0);
 w.removeWeapon('poison');assert.equal(w.expansion.venom.size,0);
});
test('overlapping venom pools share one stack interval and preserve water purification',()=>{
 const w=new SurvivalWorld();w.skills.poison=w.skills.water=10;w.evolutions.poison='venom';w.evolutions.water='tide';const e=enemy(w,0);
 for(let i=0;i<10;i++)w.expansion.field('poison',e,1.2,5,0);
 w.expansion.cast('water');w.time=1;w.expansion.stepFields(0);
 assert.equal(w.expansion.venom.get(e.id).stacks,1);assert(w.drain().some(e=>e.type==='comboPurify'));
});
test('heavy axe aims at boss, narrows the lane and retains scythe marks and snapshot return damage',()=>{
 const w=new SurvivalWorld();w.skills.axe=w.skills.scythe=10;w.evolutions.scythe='reaper';w.evolutions.axe='execution';enemy(w,1);const boss=enemy(w,0,6,'boss');
 w.cast('axe');assert.equal(w.scheduled.length,1);w.castPart(w.scheduled[0]);const p=w.shots[0];assert.equal(p.target,boss.id);assert(p.vy>0);assert(Math.abs(p.vx)<.01);assert.equal(p.width,.55);
 p.x=boss.x;p.y=boss.y;p.returning=true;w.evolutions.axe='warwheel';w.stepShot(p,0);
 assert(w.combinations.marked('scythe',boss));assert(boss.hp<100000);
});
test('bone shards bounce between different enemies with decay and do not gain ram knockback',()=>{
 const w=new SurvivalWorld();w.skills.bone=w.skills.mine=10;w.evolutions.bone='ricochet';const a=enemy(w,3),b=enemy(w,3,2),c=enemy(w,3,4),d=enemy(w,3,6),extra=enemy(w,3,8);
 w.expansion.cast('bone');assert.equal(w.shots.length,3);const p=w.shots[1];assert.equal(p.form,'ricochet');assert.equal(p.left,4);
 const amount=p.damage;
 for(const e of [a,b,c,d]){p.x=e.x;p.y=e.y;w.stepShot(p,0);assert.equal(e.x,3);}
 assert.equal(p.left,0);assert.equal(new Set(p.hit).size,4);assert(p.damage<amount);assert.equal(extra.hp,100000);
});
