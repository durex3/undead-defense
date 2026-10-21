import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressStore, PROGRESS_KEY } from '../temp/tests/platform/ProgressStore.mjs';
import { SurvivalWorld } from '../temp/tests/battle/SurvivalWorld.mjs';
import { ALL_WEAPONS } from '../temp/tests/battle/SurvivalConfig.mjs';
import { weaponStats, MODS } from '../temp/tests/battle/ArmoryConfig.mjs';
import { gradeOf, initialGrade, weaponName } from '../temp/tests/battle/WeaponGrade.mjs';
import { ACHIEVEMENTS } from '../temp/tests/battle/UnlockConfig.mjs';
import { stageRecoveryFactor } from '../temp/tests/battle/StagePressure.mjs';
import { Graphics } from '../temp/tests/node_modules/cc/index.mjs';
import { drawWeaponGlyph } from '../temp/tests/presentation/art/WeaponGlyph.mjs';
import { BattlePainter } from '../temp/tests/presentation/BattlePainter.mjs';
const storage=()=>{const m=new Map();return {m,getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
function world(stage=3,skill='blade') {const w=new SurvivalWorld(43,'ranger',stage);for(const s of ALL_WEAPONS)w.skills[s]=0;w.skills[skill]=8;w.player={x:0,y:0};w.enemies=[];return w;}
function enemy(w,x=2) {const e=w.addEnemy(w.stageId===3?'rivetwalker':'paperbonegrub',x,0);e.state='seek';e.hp=e.maxHp=1e6;return e;}
test('grade trades follow 360/720/1440, reject stale clicks, snapshot next run, and leave pool unchanged',()=>{
 const p=new ProgressStore(storage());p.data.coins=6000;
 const before=p.availableWeapons, w=world();w.weaponGrades=p.weaponGrades;
 for(const [g,cost]of [[1,360],[2,720],[3,1440]]){const coins=p.coins;assert.equal(p.evolveWeapon('blade',g),'evolved');assert.equal(p.coins,coins-cost);assert.equal(p.evolveWeapon('blade',g),'already');}
 assert.equal(gradeOf('blade',p.weaponGrades),4);assert.equal(gradeOf('blade',w.weaponGrades),1);
 assert.deepEqual(p.availableWeapons,before);assert.equal(p.evolveWeapon('blade',4),'unavailable');
 assert.equal(p.evolveWeapon('frost',1),'unavailable');assert.equal(p.evolveWeapon('hammer',2),'locked');
});
test('purchase retains all goods, initial epic has no paid evolution, and backup restores evolved form',()=>{
 const s=storage(),p=new ProgressStore(s);p.data.coins=9000;
 assert.equal(p.buyWeapon('lamp'),'purchased');assert.equal(p.buyHammer(),'purchased');
 assert.deepEqual(new Set(p.data.purchasedWeapons),new Set(['lamp','hammer']));
 assert.equal(p.evolveWeapon('hammer',2),'evolved');
 p.data.achievements=['seal_pathfinder'];assert.equal(p.evolveWeapon('needle',4),'unavailable');
 s.setItem(PROGRESS_KEY,'corrupt');const restored=new ProgressStore(s);assert(restored.unlockedWeapon('lamp'));assert.equal(restored.weaponGrades.hammer,3);
});
test('all grade transactions fail atomically when both writes fail',()=>{
 const p=new ProgressStore({getItem:()=>null,setItem:()=>{throw Error('quota');}});p.data.coins=9999;
 const old=JSON.stringify(p.data);assert.equal(p.evolveWeapon('blade',1),'save-failed');assert.equal(p.buyWeapon('lamp'),'save-failed');assert.equal(JSON.stringify(p.data),old);
});
test('old account backfills clear marks only and preserves coins, purchases and forge',()=>{
 const s=storage(),p=new ProgressStore(s);p.data.stages=[3,7,10];p.data.coins=777;p.data.purchasedWeapons=['hammer'];p.data.achievements=['forge_mastery'];s.setItem(PROGRESS_KEY,JSON.stringify(p.data));
 const q=new ProgressStore(s);assert.equal(q.coins,777);assert.equal(q.weaponGrades.hammer,2);assert(q.hasAchievement('library_clear'));assert(q.hasAchievement('forge_mastery'));assert(!q.unlockedWeapon('needle'));assert.equal(q.data.sealOpeners,undefined);
});
test('all grade/mod combinations multiply damage exactly once, preserving count, cooldown, reach and level',()=>{
 for(const skill of ['blade','hammer'])for(const a of MODS[skill])for(const b of MODS[skill]){
  if(a.id===b.id || a.excludes===b.id)continue;
  const w=world(3,skill);w.mods[skill]=[a.id,b.id];const base=weaponStats(w,skill);
  for(const [g,m]of skill==='blade'?[[2,1.25],[3,1.6],[4,2.05]]:[[3,1.28],[4,1.64]]){
   w.weaponGrades[skill]=g;const next=weaponStats(w,skill);assert(Math.abs(next.damage/base.damage-m)<1e-9);for(const k of ['count','cooldown','range','radius','duration'])assert.equal(next[k],base[k]);
  }
 }
});
test('six unique qualifying stage-ten openers are required; repeats, failures, missed phases and one Boss hit do not count',()=>{
 const p=new ProgressStore(storage());
 const qualify=(skill,stage=10,hits=0,phases=[1,2,3],state='won')=>{const w=world(stage,skill);w.startingWeapon=skill;w.challenge.bossSealPhases=new Set(phases);w.challenge.bossHits=hits;w.state=state;p.observe(w);return w;};
 qualify('blade');qualify('blade');qualify('fire',10,1);qualify('fire',10,0,[1,2]);qualify('fire',10,0,[1,2,3],'lost');qualify('fire',9);
 assert.deepEqual(p.data.sealOpeners,['blade']);
 for(const skill of ['fire','water','frost','lightning'])qualify(skill);
 assert.equal(p.data.sealOpeners.length,5);assert(!p.unlockedWeapon('needle'));
 const last=qualify('bone');p.observe(last);assert.equal(p.data.sealOpeners.length,6);assert(p.unlockedWeapon('needle'));assert.equal(initialGrade('needle'),4);
});
test('derived blade shards and hammer rifts/rebounds inherit grade once in actual attacks',()=>{
 for(const [skill,mods,ratio]of [['blade',['hunt','shards'],2.05],['hammer',['rift','return'],1.64]]) {
  const totals=[];
  for(const upgraded of [false,true]) {const w=world(3,skill);w.mods[skill]=mods;if(upgraded)w.weaponGrades[skill]=4;for(const x of [1,2,3,4,5])enemy(w,x);
   for(let i=0;i<600;i++){w.time+=1/60;w.armory.step(1/60);}totals.push(w.damage[skill]);
  }
  assert(totals[0]>0);assert(Math.abs(totals[1]/totals[0]-ratio)<1e-8);
 }
});
test('actual Boss damage counts once per health deduction and device telemetry excludes cleanup',()=>{
 const w=world(10);const boss=w.addEnemy('boss',3,0);boss.state='seek';
 w.hurt(5,'page',false,boss.id);w.hurt(5,'page',false,boss.id);assert.equal(w.challenge.bossHits,1);
 w.invulnerable=0;w.hurt(5,'paperbonegrub',false);assert.equal(w.challenge.bossHits,1);
 const d=world(3),e=d.addEnemy('thunderanchor',2,0);e.state='seek';d.hit(e,1e9,'blade');d.hit(e,1e9,'blade');assert.equal(d.challenge.devices.size,1);
});
test('all new support mods commute, have finite bounded combat and visible art',()=>{
 for(const skill of ['lamp','needle']){
  const mods=MODS[skill], configs=[[],...mods.map(m=>[m.id]),...mods.flatMap((a,i)=>mods.slice(i+1).filter(b=>a.excludes!==b.id).map(b=>[a.id,b.id]))];assert.equal(configs.length,10);
  for(const m of configs){const w=world(10,skill);w.mods[skill]=m;enemy(w);enemy(w,3);const s=weaponStats(w,skill);w.mods[skill]=[...m].reverse();assert.deepEqual(weaponStats(w,skill),{...s,mods:[...s.mods].reverse()});
   for(let i=0;i<300;i++){w.time+=1/60;w.armory.support.step(1/60);}assert(w.damage[skill]>0);assert(Number.isFinite(w.damage[skill]));assert(w.armory.support.marks.size<=10);
   const g=new Graphics();new BattlePainter(g).draw(w,0,[],false);assert(g.vertexCount>0 && g.vertexCount<45000);
  }
 }
});
test('lamp amplification expires, cannot stack, and never marks more than its capacity',()=>{
 const w=world(10,'lamp');for(let i=0;i<30;i++)enemy(w,2+i*.02);w.armory.support.step(0);assert.equal(w.armory.support.marks.size,6);
 const e=w.enemies[0];assert.equal(w.armory.support.amplification(e),1.16);w.armory.support.step(0);assert.equal(w.armory.support.amplification(e),1.16);
 w.time=4;w.armory.support.step(0);assert.equal(w.armory.support.amplification(e),1);
});
test('needle echo cannot recurse or exceed caps; dead/out-of-range endpoints break, solo attacks still work',()=>{
 const w=world(3,'needle'),a=enemy(w),b=enemy(w,3);w.armory.support.step(0);const l=w.armory.support.link;assert(l);w.time+=.3;
 const before=w.damage.needle;w.hit(a,10000,'blade');const echo=w.damage.needle-before;assert(echo>0 && echo<=l.cap);const after=w.damage.needle;w.hit(a,10000,'blade');assert.equal(w.damage.needle,after);
 b.x=100;assert.equal(w.armory.support.linked(),null);
 const solo=world(3,'needle');enemy(solo);solo.armory.support.step(0);assert(solo.damage.needle>0);assert.equal(solo.armory.support.link,null);assert(solo.armory.support.strike);
});
test('three exploration challenges use successful canonical series snapshots only',()=>{
 const p=new ProgressStore(storage());
 for(const [i,skill]of ['blade','fire','water','frost','lightning'].entries()){const w=world(i%3+1,skill);w.startingWeapon=skill;w.state='won';p.observe(w);}assert(p.hasAchievement('five_openers'));
 for(const [i,m]of [['orbit','return'],['return','shards'],['hunt','shards']].entries()){const w=world(i%2+1);w.mods.blade=m;w.state='won';p.observe(w);}assert(p.hasAchievement('modification_paths'));
 const w=world(7);for(const skill of ['blade','fire','water']){w.skills[skill]=8;w.mods[skill]=[MODS[skill][0].id,MODS[skill][2].id];}w.state='won';p.observe(w);assert(p.hasAchievement('triple_mastery'));
});
test('grade glyphs differ by geometry, not just color; twenty-six achievements and late recovery curve are explicit',()=>{
 for(const [skill,grades]of [['blade',[1,2,3,4]],['hammer',[2,3,4]]]){const shapes=grades.map(g=>{const a=new Graphics();drawWeaponGlyph(a,skill,g);assert(a.vertexCount<2500);return JSON.stringify(a.commands.map(({op,d,width})=>({op,d,width})));});assert.equal(new Set(shapes).size,grades.length);}
 assert.equal(ACHIEVEMENTS.length,26);assert.equal(new Set(ACHIEVEMENTS.map(a=>a.id)).size,26);assert.equal(stageRecoveryFactor(4),1);assert(Math.abs(stageRecoveryFactor(10)-.531441)<1e-8);
 const w=world(10),e=w.addEnemy('boss',3,0);e.state='seek';w.library.state(e).countered=true;w.library.recover(e,2);assert(Math.abs(e.timer-(2*.531441+.6))<1e-8);
});
