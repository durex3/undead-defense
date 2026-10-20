import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ALL_WEAPONS,NAMES,WEAPON_ROLES} from '../temp/tests/battle/SurvivalConfig.mjs';
import {weaponStats,MODS} from '../temp/tests/battle/ArmoryConfig.mjs';
import {weaponDetails,upgradeChanges} from '../temp/tests/battle/WeaponStatus.mjs';
const world=()=>{const w=new SurvivalWorld(19,'ranger',1);w.player={x:0,y:0};for(const s of ALL_WEAPONS)w.skills[s]=0;return w;};
const enemy=(w,x,y=0)=>{const e=w.addEnemy('minion',x,y);Object.assign(e,{state:'seek',hp:1e6,maxHp:1e6});return e;};
function tick(w,seconds,dt=1/120){for(let t=0;t<seconds-1e-9;t+=dt){w.time+=dt;w.armory.step(dt);}}
test('normal fire reaches near, middle and far targets before a simultaneously cast bone spear',()=>{
  for(const x of [2,6,10]) {
    const w=world();w.skills.fire=w.skills.bone=1;enemy(w,x);w.armory.step(0);
    for(const s of ALL_WEAPONS)w.cooldowns[s]=100;
    const first={};
    for(let i=0;i<180;i++){tick(w,1/120);for(const s of ['fire','bone'])if(w.damage[s]>0&&first[s]===undefined)first[s]=w.time;}
    assert(first.fire<first.bone,JSON.stringify({x,first}));
  }
});
test('fast fire explodes on the crossed enemy instead of overshooting during a long frame',()=>{
  const w=world();w.skills.fire=1;const e=enemy(w,2);w.armory.step(0);w.cooldowns.fire=100;tick(w,.25,.25);
  assert(e.hp<e.maxHp);const blast=w.effects.find(e=>e.type==='explosion');assert(blast.x<2);
});
test('recall keeps full lifetime, catches empty ground then matches a covered pursuer',()=>{
  const w=world();w.mods.water=['recall'];const s=weaponStats(w,'water',8);
  assert.equal(s.duration,weaponStats(world(),'water',8).duration);
  w.armory.addField('water',{x:8,y:0},0,s);const f=w.armory.fields[0];
  w.time=s.duration/2+.01;w.armory.step(0);const locked={...f.returnTarget};
  const before=f.x;tick(w,.1);const fast=before-f.x;
  const e=enemy(w,f.x-.2);const covered=f.x;tick(w,.1);
  assert(covered-f.x<fast);assert(e.hp<=e.maxHp);
  w.player.x=10;assert.deepEqual(f.returnTarget,locked);
  w.time=f.until;w.armory.step(0);assert(!f.active);
});
test('recall retains multiple damage ticks while following a normal-speed chase',()=>{
  const w=world();w.mods.water=['recall'];const s=weaponStats(w,'water',8);
  w.armory.addField('water',{x:6,y:0},0,s);const e=enemy(w,7);
  for(let i=0;i<600;i++){e.x=Math.max(.7,e.x-1.55/120);tick(w,1/120);}
  assert(w.damage.water>=s.damage*9);
});
test('water and lightning have a useful numeric improvement at every level',()=>{
  for(const skill of ['water','lightning']) {
    const w=world();
    for(let level=1;level<8;level++) {
      w.skills[skill]=level;const a=weaponStats(w,skill),b=weaponStats(w,skill,level+1);
      assert(b.damage>a.damage||b.count>a.count||b.cooldown<a.cooldown||b.radius>a.radius,`${skill}:${level}`);
      assert(upgradeChanges(w,skill).length>0);
    }
  }
});
test('extra lightning means two more actual strikes, and all player copy describes falling lightning',()=>{
  const count=mods=>{const w=world();w.skills.lightning=1;w.mods.lightning=mods;const targets=[1,3,5,7,9].map(x=>enemy(w,x));w.armory.step(0);return targets.filter(e=>e.hp<e.maxHp).length;};
  assert.equal(count(['relay']),count([])+2);
  const w=world();w.skills.lightning=8;w.mods.lightning=['relay'];
  const text=[NAMES.lightning,WEAPON_ROLES.lightning,weaponDetails(w,'lightning'),...MODS.lightning.map(m=>m.effect)].join('\n');
  assert.match(text,/落雷数量\+2/);assert.match(text,/道落雷上限/);assert.doesNotMatch(text,/跳跃|链节|链式/);
});
test('knife fragments leave the real terminal point along its final flight direction',()=>{
  const w=world();w.skills.blade=1;w.mods.blade=['hunt','shards'];enemy(w,6);w.armory.step(0);
  for(const p of w.armory.shots.filter(p=>p.active)){p.x=2;p.y=4;p.angle=Math.PI/2;w.armory.finish(p);}
  const children=w.armory.shots.filter(p=>p.active&&p.child);assert.equal(children.length,2);
  for(const c of children){assert.deepEqual(c.start,{x:2,y:4});assert(Math.sin(c.angle)>.9);assert.deepEqual(c.stats.mods,[]);}
});
test('both split knives begin together even when one reuses a pool slot and one is appended',()=>{
  const w=world();const e=enemy(w,6);const s={...weaponStats(w,'blade',1),count:1,mods:['hunt','shards']};
  w.armory.cast('blade',s,e);w.armory.step(0);
  const main=w.armory.shots.find(p=>p.active);main.range=.1;
  tick(w,.02,.02);
  let children=w.armory.shots.filter(p=>p.active&&p.child);assert.equal(children.length,2);
  assert(children.every(p=>p.age===0));
  tick(w,.02,.02);children=w.armory.shots.filter(p=>p.active&&p.child);
  assert(children.every(p=>Math.abs(p.age-.02)<1e-9));
  assert(Math.abs(children[0].travel-children[1].travel)<1e-9);
});
