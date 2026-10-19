import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {stepBoss} from '../temp/tests/battle/BossSystem.mjs';
import {STAGES} from '../temp/tests/battle/StageRules.mjs';
import {ENEMIES} from '../temp/tests/battle/SurvivalConfig.mjs';

test('each stage scales threats monotonically from stage one to four',()=>{
 const rows=[1,2,3,4].map(id=>STAGES[id]);
 for(let i=1;i<rows.length;i++){
  assert.ok(rows[i].health>rows[i-1].health,`health ${i}`);
  assert.ok(rows[i].elite>rows[i-1].elite,`elite ${i}`);
  assert.ok(rows[i].bossHealth>rows[i-1].bossHealth,`boss ${i}`);
  assert.ok(rows[i].damage>rows[i-1].damage,`damage ${i}`);
 }
 // Every stage uses the same experience rate and medicine cadence.
 assert.ok(rows.every(r=>r.xp===rows[0].xp));
 assert.ok(rows.every(r=>r.medicine===rows[0].medicine));
});

test('stage health multipliers apply to ordinary and boss enemies alike',()=>{
 const a=new SurvivalWorld(1,'ranger',1),b=new SurvivalWorld(1,'ranger',2);
 for(const kind of ['minion','boss']){
  const x=a.addEnemy(kind),y=b.addEnemy(kind);
  const ratio=STAGES[2].health/STAGES[1].health;
  const bossRatio=STAGES[2].bossHealth/STAGES[1].bossHealth;
  assert.ok(Math.abs(y.maxHp/x.maxHp-(kind==='boss'?bossRatio:ratio))<1e-10);
 }
 a.hurt(10,'minion');b.hurt(10,'minion');
 assert.ok(Math.abs(a.hp-(100-10*STAGES[1].damage))<1e-9);
 assert.ok(Math.abs(b.hp-(100-10*STAGES[2].damage))<1e-9);
});

test('every stage routes its boss to its own system and recovers into an attack',()=>{
 for(const stage of [1,2,3,4]){
  const w=new SurvivalWorld(1,'ranger',stage);
  const b=w.addEnemy('boss');
  b.state='recover';b.timer=.05;b.attack=0;
  stepBoss(w,b,1);
  assert.equal(b.state,'seek',`stage ${stage} recovery`);
  assert.ok(Number.isFinite(b.timer),`stage ${stage} timer`);
 }
});

test('medicine drops every stage at the authored kill cadence',()=>{
 for(const stage of [1,2,3,4]){
  const w=new SurvivalWorld(2,'ranger',stage);w.kills=STAGES[stage].medicine-1;
  const e=w.addEnemy('minion',0,0);w.hit(e,10000,'blade');
  assert.equal(w.potions.length,1,`stage ${stage}`);
 }
});

test('potions expire, cap at three, and count only effective healing',()=>{
 const w=new SurvivalWorld(1,'ranger',2),at={...w.player};
 for(let i=0;i<5;i++)w.dropPotion(at.x,at.y);
 assert.equal(w.potions.length,3);
 w.hp=95;w.collect(0);assert.equal(w.hp,100);assert.equal(w.healing.potion,5);assert.equal(w.potions.length,2);
 w.time=25;w.collect(0);assert.equal(w.potions.length,0);
 const a=new SurvivalWorld(1,'ranger',1);a.dropPotion(a.player.x,a.player.y);a.time=100;a.collect(0);assert.equal(a.potions.length,0);
});

test('later elite out-pressures the first elite on every stage',()=>{
 for(const stage of [1,2]){
  const w=new SurvivalWorld(1,'ranger',stage);w.time=180;w.director.step(w,0);
  const firstKind=stage===1?'siegeflag':'broodelite';
  const first=w.enemies.find(e=>e.kind===firstKind);
  assert.ok(first,`stage ${stage} first elite`);
  const base=new SurvivalWorld(1,'ranger',stage);base.time=180;
  const f=base.addEnemy(firstKind);
  assert.ok(Math.abs(first.maxHp/f.maxHp-.9)<1e-9,`stage ${stage} first elite scale`);
  const secondDue=stage===1?300:400;
  w.enemies=[];w.time=secondDue;w.director.step(w,0);
  const secondKind=stage===1?'siegerider':'breakerelite';
  const second=w.enemies.find(e=>e.kind===secondKind);
  assert.ok(second,`stage ${stage} second elite`);
  base.time=secondDue;const s=base.addEnemy(secondKind);
  assert.ok(Math.abs(second.maxHp/s.maxHp-1.1)<1e-9,`stage ${stage} second elite scale`);
 }
});
