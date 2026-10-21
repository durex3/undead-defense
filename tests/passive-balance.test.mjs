import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ALL_WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
import {weaponStats} from '../temp/tests/battle/ArmoryConfig.mjs';
function world(skill){const w=new SurvivalWorld(31,'ranger',1);w.enemies=[];w.player={x:0,y:0};for(const s of ALL_WEAPONS)w.skills[s]=0;w.skills[skill]=1;return w;}
function enemy(w,x,y=0){const e=w.addEnemy('minion',x,y);e.state='seek';e.hp=e.maxHp=1e7;return e;}
function advance(w,t){for(let i=0;i<t*120;i++){w.time+=1/120;w.armory.step(1/120);}}
test('candle grows coverage area by 40%, not radius by 40%; character bonus shares the same conversion',()=>{
 for(const skill of ALL_WEAPONS){const w=world(skill),base=weaponStats(w,skill);w.passives.area=4;const s=weaponStats(w,skill);assert(Math.abs((s.radius/base.radius)**2-1.4)<1e-12);assert.equal(s.damage,base.damage);assert.equal(s.count,base.count);}
 const w=world('void');w.character='alchemist';w.passives.area=4;assert(Math.abs(weaponStats(w,'void').radius/2.2-Math.sqrt(1.55))<1e-12);
});
test('ring preserves native fire/water/extra attacks and gives only the two replicas 40% damage',()=>{
 for(const skill of ['fire','water','bone','ghost','mine','void','holy','frost']){
  const w=world(skill);w.passives.amount=2;enemy(w,2);w.armory.step(0);const s=weaponStats(w,skill);
  const instances=['fire','water'].includes(skill)?[...w.armory.shots.filter(a=>a.active),...w.armory.pending]:w.armory.extra.attacks.filter(a=>a.active);
  assert.equal(instances.length,s.count,skill);
  instances.forEach(a=>{
   assert(Math.abs(a.stats.damage/s.damage-(a.index<s.count-2?1:.4))<1e-12,skill);
   const small=["fire","water","frost","mine","void","holy"].includes(skill)&&a.index>=s.count-2;
   assert(Math.abs(a.stats.radius/s.radius-(small?.8:1))<1e-12,skill);
  });
 }
});
test('ring lightning extra nodes and echo inherit reduced damage; native nodes retain full damage',()=>{
 const w=world('lightning');w.passives.amount=2;w.mods.lightning=['echo'];
 const es=Array.from({length:5},(_,i)=>enemy(w,1+i*2.5));const d=weaponStats(w,'lightning').damage;
 w.armory.step(0);w.cooldowns.lightning=100;advance(w,.8);
 es.forEach((e,i)=>assert(Math.abs((e.maxHp-e.hp)/d-(i<3?1.65:.66))<1e-7,`node ${i}`));
});
test('ring does not multiply the existing hammer follow-up attenuation twice',()=>{
 const w=world('hammer');w.passives.amount=2;enemy(w,2);w.armory.step(0);const a=w.armory.unlocked.attacks.filter(a=>a.active),d=weaponStats(w,'hammer').damage;
 assert.equal(a.length,3);assert.equal(a[0].stats.damage,d);assert.equal(a[1].stats.damage,d*.4);assert.equal(a[2].stats.damage,d*.4);
});
test('bone burst starts on a real hit, hits nearby off-line enemies, and deduplicates overlapping bursts',()=>{
 const w=world('bone');w.mods.bone=['ridge'];const primary=enemy(w,2),next=enemy(w,2.6),side=enemy(w,2.3,.85);const far=enemy(w,6,3);const d=weaponStats(w,'bone').damage;
 w.armory.step(0);w.cooldowns.bone=100;advance(w,1);
 assert(Math.abs(primary.maxHp-primary.hp-d*1.35)<1e-6);
 assert(Math.abs(next.maxHp-next.hp-d*1.35)<1e-6);
 assert(Math.abs(side.maxHp-side.hp-d*.35)<1e-6);
 assert.equal(far.hp,far.maxHp);assert(w.armory.extra.attacks.every(a=>!a.active));
 const bursts=w.drain().filter(e=>e.form==='boneBurst');assert.equal(bursts.length,2);assert(bursts.every(e=>e.x<3));
});
test('bone burst is capped at three actual hits per spear and cannot recursively create attacks',()=>{
 const w=world('bone');w.mods.bone=['ridge'];for(let i=0;i<6;i++)enemy(w,1+i*1.6);w.armory.step(0);w.cooldowns.bone=100;advance(w,1.5);
 assert.equal(w.drain().filter(e=>e.form==='boneBurst').length,3);assert.equal(w.armory.extra.attacks.length,1);
});
