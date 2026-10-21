import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ALL_WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
import {weaponStats} from '../temp/tests/battle/ArmoryConfig.mjs';
import {WEAPON_BALANCE,weaponBalanceBand} from '../temp/tests/battle/WeaponBalance.mjs';
function setup(skill,grade=2){const w=new SurvivalWorld(31,'ranger',1);w.player={x:0,y:0};w.enemies=[];for(const s of ALL_WEAPONS){w.skills[s]=0;w.mods[s]=[];}w.skills[skill]=8;w.weaponGrades[skill]=grade;const e=w.addEnemy('minion',2.4,0);Object.assign(e,{hp:1e8,maxHp:1e8,state:'seek'});return w;}
function step(w,t){for(let i=0;i<t*600;i++){w.time+=1/600;w.armory.step(1/600);}}
for(const grade of [2,3,4])test(`hammer grade ${grade}: full opening strike, bounded same-volley followups, grade applied once`,()=>{
 const w=setup('hammer',grade),s=weaponStats(w,'hammer');w.armory.step(0);w.cooldowns.hammer=1e6;
 step(w,.4);assert(Math.abs(w.damage.hammer-s.damage)<1e-5,'opening hit must keep full damage');
 step(w,.4);assert(Math.abs(w.damage.hammer-s.damage*1.8)<1e-5,'quantity must not triple full damage');
 assert.equal(w.enemies[0].fracture,2);
});
test('wheel quantity keeps two finite passes but bounds same-volley damage',()=>{
 const w=setup('wheel'),s=weaponStats(w,'wheel');w.armory.step(0);w.cooldowns.wheel=1e6;step(w,2.6);
 assert(Math.abs(w.damage.wheel-s.damage*1.8*2)<1e-5);assert(!w.armory.unlocked.attacks.some(a=>a.active));
});
test('all weapon series have explicit role budgets and grades scale the reference range',()=>{
 assert.deepEqual(Object.keys(WEAPON_BALANCE).sort(),[...ALL_WEAPONS].sort());
 const plain=weaponBalanceBand('blade',1),epic=weaponBalanceBand('blade',4);
 assert.equal(epic.min,plain.min*2.05);assert.equal(epic.max,plain.max*2.05);
 for(const p of Object.values(WEAPON_BALANCE))assert(p.min>0&&p.max>p.min);
});
