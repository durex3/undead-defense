import test from 'node:test';
import assert from 'node:assert/strict';
import { SurvivalWorld } from '../temp/tests/battle/SurvivalWorld.mjs';
import { combatWeaponEntries } from '../temp/tests/battle/WeaponStatus.mjs';
import { battleReport } from '../temp/tests/battle/BattleReport.mjs';
const enemy=(w,x,y=0,hp=100000)=>{const e=w.addEnemy('minion',x,y);e.state='seek';e.hp=e.maxHp=hp;return e;};
const prepare=(main,partner,form)=>{const w=new SurvivalWorld(1,'ranger',1,6);w.skills.blade=0;w.skills[main]=w.skills[partner]=10;w.evolutions[main]=form;return w;};

test('purification is an independent bounded pulse and duplicate source fields cannot multiply damage',()=>{
  const w=prepare('water','poison','spring'),e=enemy(w,0);
  for(let i=0;i<12;i++){w.expansion.field('water',{x:0,y:0},3,5,0);w.expansion.field('poison',{x:0,y:0},3,5,0);}
  w.combinations.superWeapons.stepPurification();
  assert.equal(w.combinations.superWeapons.seals.length,1);
  const damage=100000-e.hp;assert.ok(damage>0);
  assert.equal(w.combinations.stats.water.triggers,1);
  assert.ok(Math.abs(w.combinations.stats.water.damage-damage)<1e-8);
  w.combinations.superWeapons.stepPurification();assert.equal(100000-e.hp,damage);
  w.time=1.2;w.combinations.superWeapons.stepPurification();assert.ok(Math.abs((100000-e.hp)-2*damage)<1e-8);
});

test('seal lies inside both damage fields, ignores flying flasks and disappearing sources clear it',()=>{
  const w=prepare('water','poison','spring');
  w.expansion.field('water',{x:0,y:0},3,5,0,1);
  w.expansion.field('poison',{x:2,y:0},2,5,0);
  w.combinations.superWeapons.stepPurification();assert.equal(w.combinations.superWeapons.seals.length,0);
  w.time=1;w.combinations.superWeapons.stepPurification();
  const s=w.combinations.superWeapons.seals[0];assert.ok(s);
  assert.ok(Math.hypot(s.x,s.y)+s.radius<=3+.001);
  assert.ok(Math.hypot(s.x-2,s.y)+s.radius<=2+.001);
  const outside=enemy(w,-2);w.time=2.2;w.combinations.superWeapons.stepPurification();assert.equal(outside.hp,100000);
  w.expansion.remove('poison');assert.equal(w.combinations.superWeapons.seals.length,0);
});

test('all water/poison branch combinations create seals and many overlaps remain capped at three',()=>{
  for(const water of ['spring','tide'])for(const poison of ['plague','venom']){
    const w=prepare('water','poison',water);w.evolutions.poison=poison;
    for(let i=0;i<10;i++){w.expansion.field('water',{x:i*3,y:0},2,4,0);w.expansion.field('poison',{x:i*3,y:0},1.2,4,0);}
    w.combinations.superWeapons.stepPurification();assert.equal(w.combinations.superWeapons.seals.length,3);
  }
});

test('bat-marked death releases two real tracking souls, deals attributed damage, and never chains more souls',()=>{
  const w=prepare('ghost','bat','hunters'),a=enemy(w,0,0,1),b=enemy(w,1,0,1),c=enemy(w,2,0,1);
  for(const e of [a,b,c])w.combinations.mark('ghost',e);
  w.hit(a,10,'blade');
  assert.equal(w.combinations.superWeapons.souls.length,2);
  w.time=.5;w.combinations.step(.5);
  assert.equal(b.hp<=0,true);assert.equal(c.hp<=0,true);
  assert.equal(w.combinations.superWeapons.souls.length,0);
  assert.equal(w.combinations.stats.ghost.triggers,1);
  assert.equal(w.combinations.stats.ghost.damage,2);
  assert.equal(battleReport(w).comboDamage,2);
});

test('expired marks, incomplete recipes and ordinary deaths do not release souls',()=>{
  for(const mode of ['expired','missing','unmarked']){
    const w=prepare('ghost','bat','legion'),a=enemy(w,0,0,1);enemy(w,1);
    if(mode!=='unmarked')w.combinations.mark('ghost',a);
    if(mode==='expired')w.time=2;
    if(mode==='missing')w.skills.bat=9;
    w.hit(a,10,'blade');assert.equal(w.combinations.superWeapons.souls.length,0);
  }
});

test('soul release rate and capacity are bounded and pause freezes the flight',()=>{
  const w=prepare('ghost','bat','legion');enemy(w,3);
  for(let i=0;i<10;i++){const a=enemy(w,0,0,1);w.combinations.mark('ghost',a);w.hit(a,10,'blade');}
  assert.ok(w.combinations.superWeapons.souls.length<=2);
  for(let i=1;i<20;i++){w.time=i*.25;const a=enemy(w,0,0,1);w.combinations.mark('ghost',a);w.hit(a,10,'blade');}
  assert.equal(w.combinations.superWeapons.souls.length,12);
  const before=JSON.stringify(w.combinations.superWeapons.souls);
  w.pause('menu',true);w.step(5);assert.equal(JSON.stringify(w.combinations.superWeapons.souls),before);
  w.removeWeapon('bat');assert.equal(w.combinations.superWeapons.souls.length,0);
});

test('HUD replaces each completed pair with one superweapon name without hiding actual slot count',()=>{
  const w=prepare('water','poison','spring');w.skills.ghost=10;w.skills.bone=w.skills.mine=10;w.evolutions.bone='ram';
  const entries=combatWeaponEntries(w);
  assert.equal(w.weaponCount,5);assert.equal(entries.length,3);
  assert.ok(entries.includes('水毒净化 ∞'));assert.ok(entries.includes('骨雷震爆 ∞'));
  assert.ok(entries.some(x=>x.includes('幽灵伙伴')));
  assert.ok(!entries.some(x=>x.includes('毒雾尾迹')));
});

test('a soul killing the boss cannot reopen upgrade after victory',()=>{
  const w=prepare('ghost','bat','hunters');w.evolutions.bat='bloodhunt';
  const boss=w.addEnemy('boss',1,0);boss.state='seek';boss.hp=1;
  w.combinations.superWeapons.souls.push({id:w.id(),x:1,y:0,target:boss.id,ttl:2,vx:0,vy:0});
  w.xp=w.xpNeed;w.step(1/60);
  assert.equal(w.state,'won');assert.deepEqual(w.cards,[]);
});
