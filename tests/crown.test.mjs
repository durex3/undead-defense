import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {CrownDirector,crownEscape,CROWN_STONES} from '../temp/tests/battle/CrownSystem.mjs';
import {stepKing,kingCast} from '../temp/tests/battle/KingBossSystem.mjs';
import {stepHazards} from '../temp/tests/battle/EnemySystem.mjs';
import {ProgressStore} from '../temp/tests/platform/ProgressStore.mjs';
import {ACHIEVEMENTS} from '../temp/tests/battle/ProgressionConfig.mjs';
function setup(){const w=new SurvivalWorld(1,'ranger',5);w.time=10;w.player={x:4,y:0};const e=w.addEnemy('boss',0,0);e.state='seek';e.visibleSince=0;e.attack=0;return {w,e};}
test('five-stage progression persists and prior three-stage milestone remains fixed',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};let p=new ProgressStore(storage);
 assert.equal(ACHIEVEMENTS.length,20);
 for(let stage=1;stage<=5;stage++){
  assert.equal(p.unlockedStage(stage),true);if(stage<5)assert.equal(p.unlockedStage(stage+1),false);
  const w=new SurvivalWorld(stage,'ranger',stage);w.state='won';p.observe(w);p=new ProgressStore(storage);
  if(stage===3)assert.ok(p.data.achievements.includes('allStages'));
 }
 for(const id of ['king','fiveStages','kingNoLeech'])assert.ok(p.data.achievements.includes(id));
 assert.deepEqual(p.data.stages,[1,2,3,4,5]);
});
test('king phase transitions merge skipped thresholds, do not heal and do not repeat',()=>{
 const {w,e}=setup();assert.equal(e.maxHp,44800);kingCast(w,e,'lance');e.hp=e.maxHp*.25;
 stepKing(w,e,0);assert.equal(e.bossPhase,3);assert.equal(e.timer,1.5);assert.equal(w.hazards.length,0);assert.equal(e.hp,11200);
 const count=w.effects.filter(x=>x.type==='bossPhase').length;stepKing(w,e,.2);assert.equal(w.effects.filter(x=>x.type==='bossPhase').length,count);
 e.hp=0;stepKing(w,e,5);assert.equal(e.timer,1.3);
});
test('phase-three combo waits until first damage window closes and warns afresh',()=>{
 const {w,e}=setup();e.bossPhase=3;e.hp=1000;assert.equal(kingCast(w,e,'bellRing'),true);e.combo=0;
 const first=w.hazards[0];w.time=first.due;stepKing(w,e,1.4);assert.equal(e.bossAction,'bellRing');
 w.time=first.until+.01;stepHazards(w);stepKing(w,e,.3);assert.equal(e.bossAction,'bellPulse');
 assert.ok(w.hazards[0].due>=w.time+1.1);assert.equal(e.combo,1);
 w.time=w.hazards[0].until+.01;stepHazards(w);stepKing(w,e,1.4);assert.equal(e.state,'recover');assert.equal(e.timer,2.5);
});
test('king damage is fixed, aim locks, and unsafe candidates are rejected',()=>{
 const {w,e}=setup();kingCast(w,e,'lance');const h=w.hazards[0];assert.equal(h.angle,0);w.time=h.due;stepHazards(w);assert.equal(w.hp,78);assert.equal(w.losses['裂魂焰'],22);
 w.player={...CROWN_STONES[0]};assert.equal(crownEscape(w,[{...h,created:w.time,due:w.time+1,until:w.time+1.25}]),false);
});
test('environment events skip blocked windows rather than accumulating; pre-boss clears hazards',()=>{
 const w=new SurvivalWorld(1,'ranger',5),d=new CrownDirector();w.time=120;w.addEnemy('executioner');d.step(w);assert.equal(w.hazards.length,0);
 w.enemies=[];w.time=130;d.step(w);assert.equal(w.hazards.length,0);
 w.time=160;d.step(w);assert.equal(w.hazards.length,1);
 w.time=166;d.step(w);assert.equal(w.hazards.length,0);
 w.time=434;d.step(w);assert.equal(w.hazards.length,1);assert.equal(w.hazards[0].kind,'bellRing');
 w.time=460;d.step(w);assert.equal(w.hazards.length,0);
});
test('king summon cap holds and phase three never adds summons',()=>{
 const {w,e}=setup();e.pattern=2;stepKing(w,e,0);assert.equal(w.enemies.filter(x=>x.owner===e.id).length,4);
 e.state='seek';e.attack=0;e.pattern=2;stepKing(w,e,0);assert.equal(w.enemies.filter(x=>x.owner===e.id).length,8);
 e.state='seek';e.attack=0;e.pattern=2;stepKing(w,e,0);assert.equal(w.enemies.filter(x=>x.owner===e.id).length,8);
 assert.ok(w.enemies.filter(x=>x.owner===e.id).every(x=>x.summoned&&x.timer===1.2));
 e.bossPhase=3;e.hp=1000;e.state='seek';e.attack=0;e.pattern=2;stepKing(w,e,0);assert.equal(w.enemies.filter(x=>x.owner===e.id).length,8);assert.equal(e.bossAction,'bellRing');
});
test('defeat report displays actual remaining boss health rather than a manufactured near miss',async()=>{
 const {battleReport}=await import('../temp/tests/battle/BattleReport.mjs');const {w,e}=setup();e.hp=e.maxHp*.81;w.state='lost';assert.equal(battleReport(w).bossRemaining,81);e.hp=0;assert.equal(battleReport(w).bossRemaining,null);
});
