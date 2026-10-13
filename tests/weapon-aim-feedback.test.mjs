import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {WEAPONS,EVOLUTIONS} from '../temp/tests/battle/SurvivalConfig.mjs';
import {upgradeSynergy,upgradeInventory} from '../temp/tests/battle/WeaponStatus.mjs';
const world=()=>{const w=new SurvivalWorld(19,'ranger',1,6);for(const s of WEAPONS)w.skills[s]=0;return w;};
function enemy(w,x,y=0,kind='minion'){const e=w.addEnemy(kind,x,y);e.state='seek';e.hp=e.maxHp=1e7;return e;}
function attack(w,seconds){for(let i=0;i<seconds*60;i++){w.time+=1/60;w.stepWeapons(1/60);w.drain();}}
test('returning weapons acquire and hit targets in all four directions independently of movement',()=>{
 for(const [skill,form]of [['scythe','reaper'],['scythe','cross'],['axe','warwheel'],['axe','execution']])for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const w=world();w.skills[skill]=10;w.evolutions[skill]=form;w.lastMove={x:Math.cos(angle),y:Math.sin(angle)};
  const e=enemy(w,Math.cos(angle)*4,Math.sin(angle)*4);attack(w,2);
  assert(e.hp<e.maxHp,`${skill}/${form}/${angle}`);
 }
});
test('curved scythes hit distant valid targets and do not chase an unreachable boss over nearby foes',()=>{
 const w=world();w.skills.scythe=10;w.evolutions.scythe='reaper';const e=enemy(w,7.7);attack(w,2);assert(e.hp<e.maxHp);
 const q=world();q.skills.scythe=10;q.evolutions.scythe='cross';const near=enemy(q,4),boss=enemy(q,12,0,'boss');
 attack(q,2);assert(near.hp<near.maxHp);assert.equal(boss.hp,boss.maxHp);
});
test('returning weapon waits for a reachable target instead of wasting cooldown, and ignores arrival targets',()=>{
 const w=world();w.skills.axe=10;w.evolutions.axe='warwheel';const e=enemy(w,12);attack(w,.5);
 assert.equal(w.shots.length,0);assert.equal(w.cooldowns.axe,0);
 e.x=3;e.state='arriving';attack(w,.2);assert.equal(w.shots.length,0);
 e.state='seek';attack(w,.2);assert(w.shots.length>0);
});
test('both blade branches acquire close enemies with matching visible and damaging geometry',()=>{
 for(const [form,x]of [['ring',3.3],['return',5]]){
  const w=world();w.skills.blade=10;w.evolutions.blade=form;const e=enemy(w,x);attack(w,3);
  assert(e.hp<e.maxHp,form);assert.equal(w.bladeCount,form==='ring'?6:4);
 }
});
test('full meteor adds secondary targets without triple-hitting a lone boss',()=>{
 const w=world();w.skills.fire=10;w.evolutions.fire='meteor';enemy(w,5,0,'boss');
 w.cast('fire');for(const q of w.scheduled)w.castPart(q);assert.equal(w.shots.length,1);assert.equal(w.shots[0].damage,w.attack*3);
 const q=world();q.skills.fire=10;q.evolutions.fire='meteor';for(const x of [3,6,9])enemy(q,x);
 q.cast('fire');for(const c of q.scheduled)q.castPart(c);assert.equal(q.shots.length,3);assert.equal(new Set(q.shots.map(p=>p.target)).size,3);
});
test('full sunlance retains a priority impact and covers up to three distinct landing points',()=>{
 const w=world();w.skills.pillar=10;w.evolutions.pillar='sunlance';const boss=enemy(w,8,0,'boss');enemy(w,2,3);enemy(w,-3,-3);
 w.arsenal.cast('pillar');const markers=w.arsenal.markers.filter(p=>p.active);
 assert.equal(markers.length,3);assert.equal(markers[0].x,boss.x);assert(markers.every(p=>p.remaining===1));
 w.time=markers[0].due;w.arsenal.step(0);assert(w.enemies.every(e=>e.hp<e.maxHp));assert.equal(w.skills.pillar,10);
});
test('new weapon recipe hints work from either member and name the owned partner and superweapon',()=>{
 const w=world();w.skills.axe=6;assert.deepEqual(upgradeSynergy(w,'scythe'),{owned:true,text:'已拥有 回旋战斧 6级\n∞ 双月收割 · 双方第一分支＋10级联动'});
 w.skills.axe=0;w.skills.scythe=4;assert.match(upgradeSynergy(w,'axe').text,/已拥有 回旋镰刀 4级/);
 w.skills.scythe=0;assert.equal(upgradeSynergy(w,'axe').owned,false);assert.match(upgradeSynergy(w,'axe').text,/双月收割/);
});
test('reported full branches preserve growth against rank nine in their intended roles',()=>{
 for(const [skill,form,scene]of [['scythe','reaper','crowd'],['scythe','cross','crowd'],['axe','warwheel','crowd'],['axe','execution','boss'],['fire','meteor','crowd'],['fire','inferno','crowd'],['lightning','judgment','crowd'],['lightning','thunder','crowd'],['pillar','judgmentsky','crowd'],['pillar','sunlance','crowd'],['chain','brand','boss']]){
  const damage=(rank)=>{const w=world();w.skills[skill]=rank;if(rank===10)w.evolutions[skill]=form;
   if(scene==='boss')enemy(w,4,0,'boss');else for(let i=0;i<12;i++)enemy(w,Math.cos(i*Math.PI/6)*2.5,Math.sin(i*Math.PI/6)*2.5);
   attack(w,12);return w.damage[skill]||0;};
  const old=damage(9),full=damage(10);assert(old>0&&full>old,`${skill}/${form}: ${old} -> ${full}`);
 }
});

test('upgrade inventory lists all six actual slots with levels and independent branch/combination icons',()=>{
 const w=world();Object.assign(w.skills,{scythe:10,axe:10,ice:9,lightning:3,chain:1,pillar:2});w.evolutions.scythe='reaper';w.evolutions.axe='warwheel';
 const text=upgradeInventory(w);assert.match(text,/已装备 6\/6/);assert.match(text,/冰霜新环 9级/);assert.match(text,/回旋镰刀 10级◇∞/);assert.match(text,/火焰锁链 1级/);assert.equal(text.split('\n').length,2);
});
test('focused tethers transfer after a kill without extending lifetime or resetting tick cadence',()=>{
 for(const [skill,form] of [['chain','brand'],['soul','torment']]){
  const w=world();w.skills[skill]=10;w.evolutions[skill]=form;
  const a=enemy(w,3),b=enemy(w,5);w.arsenal.cast(skill);
  const link=w.arsenal.links.find(p=>p.active),until=link.until,created=link.created;
  a.hp=0;w.cooldowns[skill]=10;w.time=.5;w.arsenal.step(0);
  assert.equal(link.a,b.id);assert.equal(link.b,b.id);assert.equal(link.until,until);assert.equal(link.created,created);assert(b.hp<b.maxHp);
  const hp=b.hp;w.arsenal.step(0);assert.equal(b.hp,hp);
  w.time=until;w.arsenal.step(0);assert.equal(link.active,false);
 }
});
test('brand scorches neighbors and impact adds distinct fragments without multiplying a lone boss hit',()=>{
 const w=world();w.skills.chain=10;w.evolutions.chain='brand';const boss=enemy(w,4,0,'boss'),near=enemy(w,4,.7);
 w.arsenal.cast('chain');w.cooldowns.chain=10;w.arsenal.step(0);assert(boss.hp<boss.maxHp);assert(near.hp<near.maxHp);
 for(const multiple of [false,true]){
  const q=world();q.skills.meteor=10;q.evolutions.meteor='impact';enemy(q,5,0,'boss');if(multiple){enemy(q,-4,0);enemy(q,0,5);}
  q.arsenal.cast('meteor');const markers=q.arsenal.markers.filter(p=>p.active);
  assert.equal(markers.length,multiple?3:1);assert.equal(markers[0].damage,q.attack*7);
  assert(markers.slice(1).every(p=>p.damage===q.attack*2.5));
 }
});
test('hunters reacquire a live enemy after their original target dies without refreshing projectile lifetime',()=>{
 const w=world();w.skills.ghost=10;w.evolutions.ghost='hunters';const a=enemy(w,3),b=enemy(w,5);
 w.cast('ghost');w.castPart(w.scheduled[0]);const p=w.shots[0],ttl=p.ttl;a.hp=0;
 w.stepShot(p,.01);assert.equal(p.target,b.id);assert(p.ttl<ttl);
});
test('nearby experience stacks add values and all-pickup conserves the whole map exactly once',()=>{
 const w=world();
 for(let i=0;i<100;i++){const e=enemy(w,8+i%2*.1,8);w.hit(e,1e8,'blade');}
 assert.equal(w.gems.length,1);assert.equal(w.gems[0].value,100);
 w.gems.push({id:w.id(),x:-10,y:-10,value:17.5});
 w.collect(0);assert.equal(w.gems.reduce((n,g)=>n+g.value,0),117.5);
 w.level=64;const before=w.xp;assert.equal(w.useUltimate(),true);assert.equal(w.xp-before,117.5);assert.equal(w.gems.length,0);
 assert.equal(w.useUltimate(),false);assert.equal(w.xp-before,117.5);
});
