import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {WEAPONS,EVOLUTIONS,SYNTHESIS_RECIPES} from '../temp/tests/battle/SurvivalConfig.mjs';
const enemy=(w,x,y=0,kind='minion')=>{const e=w.addEnemy(kind,x,y);e.state='seek';e.hp=e.maxHp=100000;return e;};
const stop=w=>{for(const s of WEAPONS)w.cooldowns[s]=99;};
test('all eighteen weapons have two distinct branches and fulfilment queues every branch once',()=>{
 for(const skill of WEAPONS){
  assert.equal(EVOLUTIONS[skill].length,2,skill);assert.equal(new Set(EVOLUTIONS[skill].map(e=>e.id)).size,2);
  const w=new SurvivalWorld();w.skills[skill]=10;if(SYNTHESIS_RECIPES[skill])w.skills[SYNTHESIS_RECIPES[skill]]=10;
  w.step(0);const seen=[];
  while(w.state==='evolution'){const s=w.pendingEvolution;assert(!seen.includes(s));seen.push(s);w.evolve(EVOLUTIONS[s][1].id);}
  assert(seen.includes(skill));assert.equal(w.skills[skill],10);w.step(0);assert.equal(w.state,'battle');
 }
});
test('heavy mines target the boss, trade radius for damage, disable bone synergy and do not chain',()=>{
 const w=new SurvivalWorld();w.skills.mine=w.skills.bone=10;w.evolutions.mine='demolition';w.evolutions.bone='ram';const boss=enemy(w,4,0,'boss');
 w.expansion.cast('mine');assert.equal(w.expansion.mines.length,2);assert(w.expansion.mines.every(m=>m.x===4&&m.form==='demolition'));
 const remote={id:w.id(),x:6.2,y:0,armed:0,until:10,queued:false,form:'demolition'};w.expansion.mines.push(remote);
 w.time=1;w.expansion.stepMines();assert(boss.hp<100000);assert(w.expansion.mines.includes(remote));
 assert(!w.drain().some(e=>e.type==='comboBone'));
});
test('compressed void narrows its field and releases its snapshotted terminal explosion once',()=>{
 const w=new SurvivalWorld();w.skills.void=10;w.evolutions.void='singularity';const e=enemy(w,4);
 w.expansion.cast('void');const f=w.expansion.fields[0];assert.equal(f.radius,1.6);assert.equal(f.form,'singularity');
 const hp=e.hp;w.time=f.until;w.expansion.stepFields(0);assert(e.hp<hp);const after=e.hp;
 w.expansion.stepFields(0);assert.equal(e.hp,after);assert.equal(w.expansion.fields.length,0);
});
test('hunting bats concentrate on boss, disable ghost marks and hunt a second enemy without healing',()=>{
 const w=new SurvivalWorld();w.skills.bat=w.skills.ghost=10;w.evolutions.ghost='hunters';w.evolutions.bat='bloodhunt';enemy(w,1);const b=enemy(w,4,0,'boss');
 w.hp=20;w.time=10;w.lastHurt=0;w.expansion.cast('bat');assert.equal(w.expansion.bats.length,3);
 assert(w.expansion.bats.every(p=>p.target===b.id&&p.maxHits===2&&p.form==='bloodhunt'));
 for(const p of w.expansion.bats){p.x=b.x;p.y=b.y;}w.expansion.stepBats(0);assert(!w.combinations.marked('ghost',b));
 for(const p of w.expansion.bats){const t=w.enemies.find(e=>e.id===p.target);p.x=t.x;p.y=t.y;}w.expansion.stepBats(0);
 for(const p of w.expansion.bats){p.x=w.player.x;p.y=w.player.y;}w.expansion.stepBats(0);assert.equal(w.hp,20);assert.equal(w.expansion.bats.length,0);
});
test('focused fire and soul links each lock two priority targets and produce no recipe marks',()=>{
 const w=new SurvivalWorld();Object.assign(w.skills,{chain:10,pillar:10,soul:10,totem:10});Object.assign(w.evolutions,{chain:'brand',soul:'torment',totem:'obelisk'});
 const b=enemy(w,4,0,'boss');enemy(w,1);stop(w);
 assert(w.arsenal.cast('chain'));assert(w.arsenal.cast('soul'));w.arsenal.step(0);
 const links=w.arsenal.links.filter(p=>p.active);assert.equal(links.length,4);assert(links.every(p=>p.a===p.b));assert.equal(links.filter(p=>p.a===b.id).length,2);assert.equal(b.slowUntil,0);
 assert(!w.arsenal.chainMarks.has(b.id));assert(!w.arsenal.soulMarks.has(b.id));
 const hp=b.hp;w.time=2;w.arsenal.step(0);assert(b.hp<hp);
 w.time=4;w.arsenal.step(0);assert.equal(w.arsenal.links.filter(p=>p.active).length,0);assert(!w.drain().some(e=>e.type==='explosion'&&e.skill==='soul'));
});
test('light spear makes one focused impact while meteor impact leaves no afterburn',()=>{
 for(const [skill,form]of [['pillar','sunlance'],['meteor','impact']]){
  const w=new SurvivalWorld();w.skills[skill]=10;w.evolutions[skill]=form;const b=enemy(w,4,0,'boss');for(let i=0;i<5;i++)enemy(w,1,i*.1);stop(w);
  assert(w.arsenal.cast(skill));const p=w.arsenal.markers.find(p=>p.active);assert.equal(p.x,4);assert.equal(p.remaining,1);
  w.time=Math.max(...w.arsenal.markers.filter(p=>p.active).map(p=>p.due));w.arsenal.step(0);assert(b.hp<100000);const hp=b.hp;
  w.time+=.6;w.arsenal.step(0);assert.equal(b.hp,hp);assert.equal(p.active,false);
 }
});
test('moving bone tower follows the player and its primary and secondary shots hit distinct targets',()=>{
 const w=new SurvivalWorld();w.skills.totem=10;w.evolutions.totem='obelisk';const b=enemy(w,4,0,'boss'),other=enemy(w,2);stop(w);
 w.arsenal.cast('totem');assert.equal(w.arsenal.totems.filter(p=>p.active).length,1);
 w.player={x:1,y:1};w.arsenal.step(0);const p=w.arsenal.totems.find(p=>p.active);assert.equal(p.x,1);assert.equal(p.y,2.1);
 assert(b.hp<100000);assert(other.hp<100000);assert(100000-b.hp>100000-other.hp);
});
test('new persistent branches obey entity pools, pause time and recycling cleanup',()=>{
 const w=new SurvivalWorld();Object.assign(w.skills,{chain:10,soul:10,totem:10,pillar:10,meteor:10});Object.assign(w.evolutions,{chain:'brand',soul:'torment',totem:'obelisk',pillar:'sunlance',meteor:'impact'});enemy(w,4);
 for(let i=0;i<100;i++)for(const s of ['chain','soul','totem','pillar','meteor'])w.arsenal.cast(s);
 assert.equal(w.arsenal.links.length,48);assert.equal(w.arsenal.markers.length,12);assert.equal(w.arsenal.totems.length,6);
 w.pause('test',true);w.step(1);assert.equal(w.time,0);
 for(const s of ['chain','soul','totem','pillar','meteor'])w.removeWeapon(s);
 assert(w.arsenal.links.every(p=>!p.active));assert(w.arsenal.markers.every(p=>!p.active));assert(w.arsenal.totems.every(p=>!p.active));
});
