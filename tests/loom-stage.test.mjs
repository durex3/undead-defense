import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ENEMIES,ALL_WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
import {loomMap} from '../temp/tests/battle/LoomMap.mjs';
import {loomImpacts,loomState,loomPosition,loomSolid,loomCross,loomEscape} from '../temp/tests/battle/LoomGeometry.mjs';
import {stageGrowth} from '../temp/tests/battle/StageGrowth.mjs';
import {stageRecoveryFactor} from '../temp/tests/battle/StagePressure.mjs';
import {ProgressStore,PROGRESS_KEY} from '../temp/tests/platform/ProgressStore.mjs';
import {Graphics} from '../temp/tests/node_modules/cc/index.mjs';
import {drawLoomHazard} from '../temp/tests/presentation/art/LoomHazardArt.mjs';
import {drawActorLayer} from '../temp/tests/presentation/art/EnemyPainter.mjs';
import {drawWeaponGlyph} from '../temp/tests/presentation/art/WeaponGlyph.mjs';
import {weaponStats} from '../temp/tests/battle/ArmoryConfig.mjs';
import {weaponName,validGrade} from '../temp/tests/battle/WeaponGrade.mjs';
import {battleHud} from '../temp/tests/presentation/BattleHud.mjs';
function world(){const w=new SurvivalWorld(19,'ranger',11);w.player={x:0,y:0};w.camera={x:0,y:0};w.enemies=[];for(const s of ALL_WEAPONS)w.skills[s]=0;return w;}
function actor(w,kind='weftbinder',x=3,y=0){const e=w.addEnemy(kind,x,y);e.state='seek';e.attack=0;return e;}
function line(w,shape='repeat',angle=0){const e=actor(w);return w.loom.thread(e,shape,{x:0,y:0},angle);}
const store=()=>{const m=new Map();return {m,getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
test('loom registration has its own map, full-time health, stage11 growth and clear prerequisite',()=>{
 const w=world();assert.equal(w.stageStrategy.map,loomMap);w.time=240;
 const e=actor(w,'twinweftwarden');assert.equal(ENEMIES.twinweftwarden.health,20);assert(Math.abs(e.maxHp-30*1.8*20*stageGrowth(11).elite)<1e-8);
 assert.equal(Math.round(actor(w,'boss').maxHp),57662);
 const s=store(),p=new ProgressStore(s);assert(!p.unlockedStage(11));p.data.stages=[10];assert(p.unlockedStage(11));
});
test('repeat line is safe during warnings/slack/end, and each tight pulse uses only its finite capsule',()=>{
 const w=world(),h=line(w),t=h.due;
 assert.equal(loomState(h,t-.001),'warning');assert.equal(loomState(h,t+.8),'slack');assert.equal(loomState(h,t+3),'tight');
 assert.deepEqual(loomImpacts(h,{x:0,y:0},t-.1,t-.2),[]);
 assert.deepEqual(loomImpacts(h,{x:0,y:0},t+.3,t+.2),[0]);
 assert.deepEqual(loomImpacts(h,{x:0,y:0},t+2,t+1),[]);
 assert.deepEqual(loomImpacts(h,{x:0,y:0},t+3.2,t+3),[1]);
 assert.deepEqual(loomImpacts(h,{x:0,y:0},t+4,t+3.6),[]);
 assert.deepEqual(loomImpacts(h,{x:3.1,y:0},t+.3,t+.2),[]);
 assert.deepEqual(loomImpacts(h,{x:0,y:.481},t+.3,t+.2),[]);
 assert.deepEqual(loomImpacts(h,{x:0,y:.479},t+.3,t+.2),[0]);
});
test('capsule rotation, end caps and large frames never turn slack crossing into a hit',()=>{
 const w=world(),h=line(w,'repeat',Math.PI/4),d=h.due;
 const p={x:-.48/Math.sqrt(2),y:.48/Math.sqrt(2)};
 assert.deepEqual(loomImpacts(h,p,d+.3,d+.2),[0]);
 assert.deepEqual(loomImpacts(h,{x:0,y:1},d+2.8,d+.8,{x:0,y:-1}),[]);
 assert.deepEqual(loomImpacts(h,{x:0,y:0},d+4,d-.1),[0,1]);
});
test('shuttle collides with relative current motion, not its empty warning envelope',()=>{
 const w=world(),h=line(w,'shuttle');const d=h.due;
 assert.deepEqual(loomImpacts(h,{x:0,y:1.8},d-.1,d-.2),[]);
 assert.deepEqual(loomImpacts(h,{x:0,y:1.8},d+.1,d),[]);
 assert.deepEqual(loomImpacts(h,{x:0,y:1.8},d+2,d),[0]);
 assert(Math.abs(loomPosition(h,h.until).y-2)<1e-9);
});
test('terrain validation rejects full line width and full moving sweep; empty central plans have escape',()=>{
 const w=world(),h=line(w,'fixed');assert(!loomSolid(h));assert(loomEscape(w,[h]));
 h.x=-10;h.y=-9;assert(loomSolid(h));
});
test('pulse damage is independent once per pulse, consumes no damage during slack, and preserves boss source',()=>{
 const w=world(),e=actor(w,'boss'),h=w.loom.thread(e,'repeat');w.hazards=[h];w.hp=w.maxHp=500;
 w.time=h.due+.2;w.loom.sample({x:0,y:0},{x:0,y:0},h.due,h.due+.2);assert.equal(w.hp,474);assert.equal(w.challenge.bossHits,1);
 w.invulnerable=0;w.loom.sample(w.player,w.player,h.due+.2,h.due+.4);assert.equal(w.hp,474);
 w.loom.sample(w.player,w.player,h.due+.8,h.due+2.8);assert.equal(w.hp,474);
 w.time=h.due+3.1;w.loom.sample(w.player,w.player,h.due+2.9,h.due+3.1);assert.equal(w.hp,448);assert.equal(w.challenge.bossHits,2);
});
test('kill/freeze cancels unreleased and second pulses, but current tight/shuttle ends naturally',()=>{
 for(const shape of ['fixed','repeat','shuttle'])for(const when of ['warning','active','slack']){
  const w=world(),e=actor(w),h=w.loom.thread(e,shape);w.hazards=[h];w.loom.state(e).step=1;
  w.time=when==='warning'?h.due-.1:when==='slack'?h.due+1:h.due+.2;e.freezeUntil=w.time+1;w.loom.clean();
  if(when==='warning'||shape==='repeat'&&when==='slack')assert(h.loom.cancelled,`${shape}/${when}`);
  else if(shape==='repeat'){assert(h.loom.secondCancelled);assert.equal(h.until,h.due+.7);}else assert(!h.loom.cancelled);
 }
});
test('Boss phase transition cancels future pulse, keeps active pulse, accepts direct phase skips without healing',()=>{
 const w=world(),e=actor(w,'boss');w.time=360;e.hp=e.maxHp*.3;const hp=e.hp;
 const h=w.loom.thread(e,'repeat');w.hazards=[h];w.time=h.due+.2;h.fired=true;
 w.loom.stepEnemy(e,.1);assert.equal(e.bossPhase,3);assert.equal(e.hp,hp);assert(h.loom.secondCancelled);assert.equal(h.until,h.due+.7);assert.equal(e.loom.action,'transition');
});
test('dual-line plans are atomic, fully warned and limited to two slots',()=>{
 const w=world(),e=actor(w,'twinweftwarden');w.time=135;e.loom=w.loom.state(e);e.loom.action='pair';const plan=w.loom.plan(e);
 assert.equal(plan.length,2);assert(Math.abs(plan[1].due-plan[0].due-.8)<1e-9);assert(plan.every(h=>h.due-h.created>=2.1-1e-9));
 assert(w.loom.begin(e));assert.equal(w.hazards.length,2);
 const other=actor(w,'shuttlejailer',-3);other.loom=w.loom.state(other);other.loom.action='mixed';assert(!w.loom.begin(other));assert.equal(w.hazards.length,2);
});
test('cross challenge accepts actual slack line crossing, rejects warnings/end-run and records only same Boss plan',()=>{
 for(const phase of [1,2,3]){
  const w=world(),e=actor(w,'boss');e.bossPhase=phase;w.loom.state(e).action='C';const hs=w.loom.plan(e);w.hazards=hs;
  const start=Math.max(...hs.map(h=>h.due+.7))+.05,end=Math.min(...hs.map(h=>h.due+2.9))-.05;
  const a=phase===1?{x:0,y:-3}:{x:-1,y:-1},z=phase===1?{x:0,y:3}:{x:1,y:1};
  w.loom.sample(a,z,start,end);assert(w.challenge.loomPhases.has(phase),`phase ${phase}`);
 }
 const w=world(),h=line(w);h.loom.bossPair=true;
 assert(!loomCross(h,{x:0,y:-1},{x:0,y:1},0,1));
 assert(!loomCross(h,{x:4,y:-1},{x:4,y:1},h.due+.8,h.due+2.8));
});
test('new achievement needs eight distinct qualified wins; stage11 gives 300 once, preserves old triple scope and survives reload',()=>{
 const s=store(),p=new ProgressStore(s);p.data.coins=400;p.data.stages=[4];
 for(let i=0;i<8;i++){const w=world();w.startingWeapon=ALL_WEAPONS[i];w.state='won';for(const phase of [1,2,3])w.challenge.loomPhases.add(phase);p.observe(w);p.observe(w);}
 assert.equal(p.coins,2800);assert(p.hasAchievement('emberloom_clear'));assert(p.hasAchievement('loom_eight_paths'));assert(!p.hasAchievement('triple_mastery'));
 const q=new ProgressStore(s);assert.equal(q.coins,2800);assert.equal(q.data.loomQualifiedOpeners.length,8);assert(q.data.stages.includes(4));
 const bad=world();bad.startingWeapon=ALL_WEAPONS[9];bad.state='won';bad.challenge.bossHits=1;for(const phase of [1,2,3])bad.challenge.loomPhases.add(phase);q.observe(bad);assert.equal(q.data.loomQualifiedOpeners.length,8);
});
test('wheel evolves twice without pool growth or duplicate charge, and all three forms have distinct geometry',()=>{
 const s=store(),p=new ProgressStore(s);p.data.achievements=['forge_mastery'];p.data.coins=2160;const pool=p.availableWeapons.length;
 assert.equal(p.evolveWeapon('wheel',2),'evolved');assert.equal(p.coins,1440);assert.equal(p.evolveWeapon('wheel',2),'already');assert.equal(p.evolveWeapon('wheel',3),'evolved');assert.equal(p.coins,0);assert.equal(p.availableWeapons.length,pool);
 assert.equal(weaponName('wheel',p.weaponGrades),'裁界环轮');assert(validGrade('wheel',4));
 const shapes=[2,3,4].map(g=>{const ctx=new Graphics();drawWeaponGlyph(ctx,'wheel',g);return JSON.stringify(ctx.commands);});assert.equal(new Set(shapes).size,3);
 const w=world();w.skills.wheel=8;const base=weaponStats(w,'wheel').damage;w.weaponGrades.wheel=4;assert(Math.abs(weaponStats(w,'wheel').damage/base-1.64)<1e-12);
});
test('loom hazards retain distinct state geometry and HUD keeps all three challenge stages',()=>{
 const w=world(),h=line(w);const shapes=[h.due-.2,h.due+.2,h.due+1].map(t=>{const g=new Graphics();drawLoomHazard(g,h,t);assert(g.vertexCount>0);return JSON.stringify(g.commands);});assert.equal(new Set(shapes).size,3);
 actor(w,'boss');assert(battleHud(w,false,[]).hint.includes('松线双穿'));
});

test('full plan translates before publication at arena corners, preserving orthogonality and a real warned threat',()=>{
 const w=world();w.player={x:21.6,y:25.6};w.camera={x:10.6,y:1124/48};const e=actor(w,'boss',18,22);e.bossPhase=3;e.pattern=1;w.loom.state(e).action='C';const hs=w.loom.plan(e);
 assert.equal(hs.length,2);assert(Math.abs(hs[1].angle-hs[0].angle-Math.PI/2)<1e-12);assert(hs.every(h=>w.loom.legal(h)));
 assert(hs.some(h=>loomImpacts(h,w.player,h.due+.2,h.due+.1).length));assert(loomEscape(w,hs));
});

test('freeze never starts recovery before a released pulse has actually ended',()=>{
 const w=world(),e=actor(w,'shuttlejailer'),h=w.loom.thread(e,'shuttle');w.hazards=[h];const s=w.loom.state(e);s.step=1;e.state='windup';w.time=h.due+.1;e.freezeUntil=w.time+.25;w.loom.clean();assert.equal(e.state,'windup');assert.equal(s.step,1);
 w.time=h.until+.01;e.freezeUntil=0;w.loom.stepEnemy(e,.01);assert.equal(e.state,'recover');assert(Math.abs(e.timer-s.recover*stageRecoveryFactor(11))<1e-9);
});
