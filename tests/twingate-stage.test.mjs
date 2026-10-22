import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {gateImpact,gateCut,gateBody,gateConflict} from '../temp/tests/battle/TwingateGeometry.mjs';
import {stageReference} from '../temp/tests/battle/StageGrowth.mjs';
import {ProgressStore} from '../temp/tests/platform/ProgressStore.mjs';
import {freshProgress,decodeProgress} from '../temp/tests/platform/ProgressCodec.mjs';
import {settleVictory} from '../temp/tests/battle/AchievementRules.mjs';
import {GATE_OPENERS} from '../temp/tests/battle/TwingateChallenge.mjs';
import {nextGrade,gradeMultiplier} from '../temp/tests/battle/WeaponGrade.mjs';
import {MODS,isLegalModPair,weaponStats} from '../temp/tests/battle/ArmoryConfig.mjs';
const world=()=>{const w=new SurvivalWorld(31,'ranger',19);w.time=400;w.state='battle';w.player={x:0,y:0};w.camera={x:0,y:0};w.viewport={x:16,y:7.5};return w;};
const duo=w=>{const a=w.addEnemy('boss',-3,0),b=w.addEnemy('boss',0,-3.5);for(const e of [a,b]){e.state='seek';e.attack=0;}return[a,b];};
const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
test('19 unlocks after 18; two bodies share the formula budget without sharing damage',()=>{
 const p=new ProgressStore(storage());assert(!p.unlockedStage(19));p.data.stages=[18];assert(p.unlockedStage(19));
 const w=world(),[a,b]=duo(w),r=stageReference(19);assert.equal(a.maxHp+b.maxHp,r.bossDps*r.bossSeconds);assert.equal(a.maxHp,b.maxHp);w.hit(a,100,'blade');assert.equal(b.hp,b.maxHp);assert(w.twingate.summary().remaining<1);
});
test('atomic boss spawn rejects a full arena without creating a half encounter',()=>{
 const w=world();for(let i=0;i<99;i++)w.addEnemy('gategrub',10,10);assert.equal(w.twingate.spawnBosses(),undefined);assert.equal(w.twingate.encounter.members.length,0);
 w.enemies.pop();const pair=w.twingate.spawnBosses();assert.equal(pair.length,2);assert.equal(w.enemies.length,100);assert.equal(w.twingate.encounter.members.length,2);assert(w.twingate.pair(pair[0],pair[1],'A'));
});
test('first kill cannot settle, heal survivor, or lose aggregate ownership after corpse removal',()=>{
 const w=world(),[a,b]=duo(w),p=new ProgressStore(storage());w.hit(b,100,'blade');const hp=b.hp;w.hit(a,1e9,'blade');p.observe(w);assert.equal(w.state,'battle');assert.equal(p.coins,0);assert.equal(b.hp,hp);assert.equal(w.twingate.encounter.soloAt,401.8);w.enemies=w.enemies.filter(e=>e.hp>0);assert.equal(w.twingate.summary().hp,hp);assert.equal(w.twingate.summary().bodiesRemaining,1);
 w.hit(b,30,'blade');const remaining=b.hp;assert(remaining<hp);assert.equal(w.state,'battle');w.time=401.8;w.twingate.tick();assert.equal(b.bossPhase,2);assert.equal(b.hp,remaining);
 w.frame++;w.hit(b,1e9,'blade');p.observe(w);p.observe(w);assert.equal(w.state,'won');assert.equal(p.coins,460);assert.equal(p.data.stageBest[19].bodiesRemaining,0);assert.equal(p.data.stageBest[19].killOrder,'hunter_first');assert.equal(w.potions.length,3);
});
test('same world frame double kill wins normally but records no order certificate',()=>{
 const w=world(),[a,b]=duo(w),d=freshProgress();w.hit(a,1e9,'blade');w.hit(b,1e9,'blade');assert.equal(w.twingate.encounter.order,'simultaneous');settleVictory(d,w);assert.equal(d.coins,460);assert(!d.duetOrders?.blade?.length);
});
test('aggregate supplies follow actual total HP rather than damage attempts',()=>{
 const w=world(),[a,b]=duo(w);w.hit(a,a.hp*.5/.45,'blade');assert.equal(w.potions.length,1);w.hit(a,1e9,'blade');assert.equal(w.potions.length,2);w.hit(a,1e9,'blade');assert.equal(w.potions.length,2);w.hit(b,b.hp*.5/.45,'blade');assert.equal(w.potions.length,3);
});
test('charge/bolt collision uses actual continuous heads, not the warning corridor',()=>{
 const w=world(),[a]=duo(w),f=w.twingate.part(a,'charge');assert(!gateImpact(f,{x:0,y:0},f.due-.01));assert(!gateImpact(f,{x:2,y:0},f.due));assert(gateImpact(f,{x:0,y:0},f.end,f.due));assert(!gateImpact(f,{x:0,y:0},f.end+.1,f.end));
 const bolt=w.twingate.part(a,'bolt');assert(gateImpact(bolt,{x:0,y:0},bolt.end,bolt.due));assert(!gateImpact(bolt,{x:0,y:2},bolt.end,bolt.due));
});
test('cutting charge is monotonic, while emitted bolts retain their original lifetime',()=>{
 const w=world(),[a,b]=duo(w),h=w.twingate.plan(a,'A',false),f=h.twin.parts[0];gateCut(h,f.due+.1);const p=gateBody(h,f.end);gateCut(h,f.due+.4);assert.deepEqual(gateBody(h,f.end),p);assert(!gateImpact(f,{x:0,y:0},f.end,f.due+.1));
 const shot=w.twingate.plan(b,'A',false),end=shot.until;gateCut(shot,shot.twin.parts[0].due+.1);assert.equal(shot.until,end);assert(!shot.twin.parts[0].cancelled);
});
test('freezing an already interrupted surviving charge still stops its body and damage',()=>{
 const w=world(),[a]=duo(w),h=w.twingate.plan(a,'A',false),f=h.twin.parts[0];w.hazards.push(h);a.state='windup';w.time=f.due+.1;gateCut(h,w.time,false);assert(h.twin.interrupted);a.freezeUntil=w.time+2;w.twingate.clean();assert.equal(f.cutAt,w.time);const p=gateBody(h,w.time);w.time+=.2;w.twingate.clean();assert.deepEqual(gateBody(h,w.time),p);
});
test('an emitted bolt still counts boss damage after its owner is removed',()=>{
 const w=world(),[a,b]=duo(w),h=w.twingate.plan(b,'A',false),f=h.twin.parts[0];w.hazards.push(h);w.time=f.due+.05;w.hit(b,1e9,'blade');w.enemies=w.enemies.filter(e=>e.hp>0);w.time=f.due+3.5/f.speed;w.twingate.stepHazard(h);assert.equal(w.challenge.bossHits,1);const hp=w.hp;w.twingate.stepHazard(h);assert.equal(w.hp,hp);assert(a.hp>0);
});
test('published charges cannot cross the other body and normal blade fan stays 65 degrees',()=>{
 const w=world(),[a,b]=duo(w),h=w.twingate.plan(a,'A',false);assert(gateConflict(h,{x:0,y:0},undefined,w.time));b.x=0;b.y=0;assert(!w.twingate.legal(h));const e=w.addEnemy('splitblade',-2,0);assert.equal(w.twingate.part(e,'sweep').half,65*Math.PI/180);
});
test('solo follow locks from actual arrival with a full new warning',()=>{
 const w=world(),[a,b]=duo(w);w.hit(b,1e9,'blade');w.time=w.twingate.encounter.soloAt;w.twingate.tick();assert(w.twingate.begin(a,'A'));const h=a.twin.item,first=h.twin.parts[0];w.time=first.end+.05;w.twingate.clean();assert.equal(h.twin.parts.length,2);const follow=h.twin.parts[1];assert(Math.abs(follow.due-w.time-2.4)<1e-8);assert.equal(follow.x,a.x);assert.equal(follow.y,a.y);assert.equal(follow.kind,'bolt');
});
const qualify=(w,skill)=>{w.startingWeapon=skill;w.skills[skill]=8;w.mods[skill]=MODS[skill].flatMap((a,i)=>MODS[skill].slice(i+1).map(b=>[a.id,b.id])).find(m=>isLegalModPair(skill,m));w.challenge.gateGroups=new Set(['A','B']);w.challenge.gateSolo=new Set(['A','B']);w.challenge.gateBodies=new Set(['hunter','warden']);};
test('mastery needs twelve different series and both kill orders, deduplicates repeated victories',()=>{
 const d=freshProgress();for(const skill of GATE_OPENERS.slice(0,12))for(const order of ['hunter_first','warden_first']){const w=world();qualify(w,skill);w.twingate.encounter.order=order;w.state='won';settleVictory(d,w);settleVictory(d,w);assert.equal(d.duetOrders[skill].filter(x=>x===order).length,1);}assert(d.achievements.includes('twingate_twelve_orders'));assert.equal(Object.keys(d.duetOrders).length,12);
});
test('missing group, solo counter, second body or a boss hit prevents order certification',()=>{
 for(const fail of ['group','solo','body','hurt','simultaneous']){const w=world(),d=freshProgress();qualify(w,'blade');w.twingate.encounter.order='hunter_first';if(fail==='group')w.challenge.gateGroups.delete('B');if(fail==='solo')w.challenge.gateSolo.delete('A');if(fail==='body')w.challenge.gateBodies.delete('warden');if(fail==='hurt')w.challenge.bossHits=1;if(fail==='simultaneous')w.twingate.encounter.order='simultaneous';w.state='won';settleVictory(d,w);assert(!d.duetOrders?.blade?.length,fail);}
});
test('ghost upgrades change damage alone and stop at rare',()=>{
 const w=world();w.skills.ghost=8;const stats=[];for(const grade of [1,2,3]){w.weaponGrades.ghost=grade;stats.push(weaponStats(w,'ghost'));assert.equal(gradeMultiplier('ghost',w.weaponGrades),{1:1,2:1.25,3:1.6}[grade]);}for(const key of ['radius','count','cooldown','speed'])assert.equal(stats[0][key],stats[2][key]);assert.equal(nextGrade('ghost',{ghost:3}),null);
 const p=new ProgressStore(storage());p.data.coins=1080;p.data.grades={ghost:1};assert.equal(p.evolveWeapon('ghost',1),'evolved');assert.equal(p.coins,720);assert.equal(p.evolveWeapon('ghost',2),'evolved');assert.equal(p.coins,0);assert.equal(p.weaponGrades.ghost,3);
});

test('malformed optional order and report fields never reset the existing account',()=>{
 for(const field of [{duetOrdersVersion:2,duetOrders:{blade:['hunter_first']}},{duetOrdersVersion:1,duetOrders:{blade:['hunter_first','bogus','hunter_first','warden_first'],bogus:['warden_first']}},{duetOrdersVersion:1,duetOrders:[]}]){const r=decodeProgress({...freshProgress(),coins:900,stages:[1,18],grades:{holy:4,ghost:3},...field});assert(r);assert.equal(r.data.coins,900);assert.deepEqual(r.data.stages,[1,18]);assert.equal(r.data.grades.ghost,3);assert((r.data.duetOrders?.blade?.length??0)<=2);assert(!r.data.duetOrders?.blade?.includes('bogus'));assert(!r.data.duetOrders?.bogus);}
});
test('duet reserves both slots immediately, then locks the second source anew without editing the first',()=>{
 const w=world(),[a,b]=duo(w);assert(w.twingate.pair(a,b,'A'));assert.equal(w.twingate.slots,2);const first=structuredClone(a.twin.item.twin.parts[0]);assert.equal(b.twin.item.twin.parts.length,0);w.time+=.89;w.twingate.clean();assert.equal(b.twin.item.twin.parts.length,0);w.time+=.21;w.twingate.clean();assert.equal(b.twin.item.twin.parts.length,1);assert.deepEqual(a.twin.item.twin.parts[0],first);assert(Math.abs(b.twin.item.twin.parts[0].due-w.time-2.4)<1e-8);
});
test('recovery certification requires a complete threatening group and actual nearby equipment damage',()=>{
 const w=world(),[a,b]=duo(w);w.skills.blade=8;assert(w.twingate.pair(a,b,'A'));w.time+=.9;w.twingate.clean();w.time=Math.max(a.twin.item.until,b.twin.item.until)+.01;for(const e of [a,b]){e.state='recover';e.twin.vulnerable=true;}w.player={x:a.x+1,y:a.y};w.hit(a,100,'blade');assert(w.challenge.gateGroups.has('A'));assert(!w.challenge.gateBodies.has('warden'));assert(w.challenge.gateBodies.has('hunter'));w.player={x:b.x+1,y:b.y};w.hit(b,100,'blade');assert(w.challenge.gateGroups.has('A'));assert(w.challenge.gateBodies.has('warden'));
});
test('pause prevents inheritance and publication cleanup from advancing',()=>{
 const w=world(),[a,b]=duo(w);w.hit(a,1e9,'blade');w.pause('capture',true);const hp=b.hp;w.time=w.twingate.encounter.soloAt;w.twingate.tick();assert.equal(b.bossPhase,1);assert.equal(b.hp,hp);w.pause('capture',false);w.twingate.tick();assert.equal(b.bossPhase,2);
});
test('ghost reacquires a surviving real body without teleporting or clawing the dead target',()=>{
 const w=world(),[a,b]=duo(w);a.x=2;a.y=0;b.x=4;b.y=0;w.skills.ghost=8;w.weaponGrades.ghost=3;const extra=w.armory.extra;extra.castWeapon('ghost',0);const attack=extra.attacks.find(a=>a.skill==='ghost'&&a.active);assert(attack);const target=w.enemies.find(e=>e.id===attack.targetId),other=target===a?b:a;w.hit(target,1e9,'blade');const from={x:attack.x,y:attack.y},hp=other.hp;extra.advance(.01);assert.equal(attack.targetId,other.id);assert(attack.retargeted);assert(Math.hypot(attack.x-from.x,attack.y-from.y)<=.100001);assert.equal(other.hp,hp);for(let i=0;i<240&&attack.active;i++){w.time+=1/60;extra.advance(1/60);}assert(other.hp<hp);assert.equal(attack.active,false);
});
test('needle links transfer bounded actual damage across the two bodies then expire with the first death',()=>{
 const w=world(),[a,b]=duo(w);a.x=2;a.y=0;b.x=4;b.y=0;w.skills.needle=8;const support=w.armory.support;support.castWeapon('needle',0);assert(support.link);const beforeA=a.hp,beforeB=b.hp;w.time+=.3;w.hit(a,100,'blade');assert(a.hp<beforeA);assert(b.hp<beforeB);assert(beforeB-b.hp<100);w.hit(a,1e9,'blade');const hp=b.hp;support.prepare();assert.equal(support.link,null);assert.equal(b.hp,hp);assert.equal(w.state,'battle');
});
test('each ghost grade has a distinct actual glyph',async()=>{
 const {drawWeaponGlyph}=await import('../temp/tests/presentation/art/WeaponGlyph.mjs');const {Graphics}=await import('../temp/tests/node_modules/cc/index.mjs');const sig=[];for(const grade of [1,2,3]){const g=new Graphics();drawWeaponGlyph(g,'ghost',grade);sig.push(JSON.stringify(g.operations??g.paths??g));}assert.equal(new Set(sig).size,3);
});
test('solo warden repositions around the east plinth instead of repeating harmless split-and-sweep groups',()=>{
 const w=world();w.player={x:20,y:0};w.camera={...w.player};w.hp=w.maxHp=1e6;w.director.step=()=>{};w.armory.step=()=>{};const [a,b]=w.twingate.spawnBosses();for(const e of [a,b]){e.state='seek';e.attack=0;e.visibleSince=399;}w.hit(a,1e9,'blade');w.time=w.twingate.encounter.soloAt;w.twingate.tick();for(let i=0;i<1800;i++){w.camera={x:512/48,y:0};w.step(1/30);w.drain();assert(w.twingate.slots<=2);assert(!w.stageStrategy.map.blocked(b,.699));}assert(w.hp<w.maxHp);
});
