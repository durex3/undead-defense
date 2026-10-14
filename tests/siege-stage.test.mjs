import test from 'node:test';
import assert from 'node:assert/strict';
import { SurvivalWorld } from '../temp/tests/battle/SurvivalWorld.mjs';
import { siegeMap,SIEGE_WALLS } from '../temp/tests/battle/SiegeMap.mjs';
import { siegeProjectileFactor,shieldRaised,siegeRest } from '../temp/tests/battle/SiegeSystem.mjs';
import { stepEnemies,stepHazards } from '../temp/tests/battle/EnemySystem.mjs';
import { stepGarden } from '../temp/tests/battle/GardenMap.mjs';
import { ProgressStore } from '../temp/tests/platform/ProgressStore.mjs';
import { STAGES } from '../temp/tests/battle/StageRules.mjs';
function world(){const w=new SurvivalWorld(19,'ranger',14,6);w.time=10;for(const s of Object.keys(w.skills))w.skills[s]=0;w.enemies=[];return w;}
function enemy(w,kind,x=4,y=0){const e=w.addEnemy(kind,x,y);e.state="seek";e.attack=0;e.visibleSince=0;e.facing=Math.PI;return e;}

test('stage fourteen unlocks after thirteen and preserves best across save reload',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 let p=new ProgressStore(storage);assert(!p.unlockedStage(14));
 const old=new SurvivalWorld(1,'ranger',13);old.state='won';p.observe(old);assert(p.unlockedStage(14));
 const w=world();w.state='won';w.time=550;p.observe(w);p=new ProgressStore(storage);
 assert.equal(p.data.stageBest[14].time,550);assert(p.data.stages.includes(13)&&p.data.stages.includes(14));assert.equal(STAGES[14].boss,'铁棘围城督军');
});

test('siege map resolves shared walls and navigation reaches an opposite flank',()=>{
 const w=world();for(const p of SIEGE_WALLS){assert(siegeMap.blocked(p,.3));Object.assign(w.player,p);stepGarden(w,0);assert(!siegeMap.blocked(w.player,.299));}
 const e=enemy(w,'siegebone',-15,-8),target={x:15,y:-8};
 for(let i=0;i<1600&&Math.hypot(e.x-target.x,e.y-target.y)>.2;i++){const a=siegeMap.heading(e,target);e.x+=Math.cos(a)*.05;e.y+=Math.sin(a)*.05;siegeMap.resolve(e,.35);}
 assert(Math.hypot(e.x-target.x,e.y-target.y)<.3);assert(!siegeMap.blocked({x:0,y:0},6));
});

test('shield directional reduction, nonstacking escort, freeze and recovery are immediate',()=>{
 const w=world(),shield=enemy(w,'thornshield',4),bow=enemy(w,'siegebow',5.4);shield.shieldPartner=bow.id;
 assert.equal(siegeProjectileFactor(w,shield,{x:0,y:0}),.45);assert.equal(siegeProjectileFactor(w,shield,{x:8,y:0}),1);
 assert.equal(siegeProjectileFactor(w,bow,{x:0,y:0}),.65);
 const other=enemy(w,'thornshield',4.1);other.shieldPartner=bow.id;assert.equal(siegeProjectileFactor(w,bow,{x:0,y:0}),.65);
 other.hp=0;shield.freezeUntil=w.time+1;assert(!shieldRaised(w,shield));assert.equal(siegeProjectileFactor(w,bow,{x:0,y:0}),1);
 shield.freezeUntil=0;shield.shieldClock=4;assert.equal(siegeProjectileFactor(w,shield,{x:0,y:0}),1);
 shield.shieldClock=0;bow.x=7;assert.equal(siegeProjectileFactor(w,bow,{x:0,y:0}),1);
});

test('actual hit accounting applies shields only to travelling projectiles',()=>{
 const w=world(),e=enemy(w,'thornshield',4);w.skills.bone=1;w.skills.water=1;
 const hp=e.hp;w.hit(e,10,'bone',false,{x:0,y:0},true,undefined,1,true);assert.equal(hp-e.hp,4.5);assert.equal(w.damage.bone,4.5);
 const before=e.hp;w.hit(e,10,'water',false,{x:0,y:0},false);assert.equal(before-e.hp,10);
});

test('shield escorts moving bow, turns at bounded speed and exposes timed opening',()=>{
 const w=world(),s=enemy(w,'thornshield',4),b=enemy(w,'siegebow',5.4);s.shieldPartner=b.id;
 w.player={x:0,y:4};const facing=s.facing;w.siege.stepEnemy(s,.1);assert(Math.abs(s.facing-facing)<=Math.PI*.05+1e-9);
 w.player={x:0,y:0};for(let i=0;i<39;i++)w.siege.stepEnemy(s,.1);assert(!shieldRaised(w,s));
 assert(Math.hypot(s.x-b.x,s.y-b.y)<=2);for(let i=0;i<19;i++)w.siege.stepEnemy(s,.1);assert(shieldRaised(w,s));
});

test('prediction clamps displacement, arrow snapshots its direction and uses post-buff values once',()=>{
 const w=world();w.player={x:0,y:0};w.siege.sample();w.time+=.35;w.player.x=1.47;w.siege.sample();
 assert(Math.abs(w.siege.prediction().x-3.36)<1e-6);
 const e=enemy(w,'siegebow',-4);assert(w.siege.castBow(e));const h=w.hazards[0],angle=h.angle;
 assert.equal(h.projectileSpeed,9);assert.equal(h.damage,20);assert(Math.abs(h.due-w.time-.675)<1e-9);
 w.player.y=3;w.siege.stepEnemy(e,.1);assert.equal(h.angle,angle);
 w.player={x:e.x,y:e.y};w.siege.stepEnemy(e,0);assert.equal(w.hazards.length,0);assert.equal(e.state,'recover');
});

test('frozen shooter postpones locked warning and pause does not advance clocks',()=>{
 const w=world(),e=enemy(w,'siegebow',5);assert(w.siege.castBow(e));const h=w.hazards[0],due=h.due,timer=e.timer;
 w.slow(e,true);stepEnemies(w,.2);assert.equal(h.due,due+.2);assert.equal(e.timer,timer);
 w.pause('test',true);const time=w.time;w.step(1);assert.equal(w.time,time);assert.equal(h.due,due+.2);
 e.hp=0;stepHazards(w);assert.equal(w.hazards.length,0);
});

test('flank target is fixed, freeze pauses its route and movement never teleports',()=>{
 const w=world(),e=enemy(w,'flanker',6);e.siegeTarget={x:2,y:3};e.siegeRouteTime=2.5;const target={...e.siegeTarget},x=e.x;
 w.player.y=4;w.siege.stepEnemy(e,.1);assert.deepEqual(e.siegeTarget,target);assert(Math.hypot(e.x-x,e.y)<=.221);
 const left=e.siegeRouteTime;e.freezeUntil=w.time+1;stepEnemies(w,.2);assert.equal(e.siegeRouteTime,left);
});

test('pack spawn is atomic, caps threat and does not replay skipped pressure windows',()=>{
 const w=world();assert(w.siege.spawnPack(['thornshield','siegebow'],0));
 const shield=w.enemies.find(e=>e.kind==='thornshield'),bow=w.enemies.find(e=>e.kind==='siegebow');assert.equal(shield.shieldPartner,bow.id);assert(Math.hypot(shield.x-bow.x,shield.y-bow.y)<=2);assert(w.enemies.every(e=>e.state==='arriving'&&e.timer===1));
 assert(w.siege.spawnPack(['flanker','flanker'],Math.PI/2));const before=w.enemies.length;
 assert(!w.siege.spawnPack(['thornshield','siegebow'],Math.PI));assert.equal(w.enemies.length,before);
 for(const t of [172,289,477]){w.time=t;assert(siegeRest(t));w.siege.director(1,()=>({x:10,y:0}));assert.equal(w.enemies.length,before);}
});

test('boss locks the occupied position and reserves both danger slots for a fresh second lock',()=>{
 const w=world(),b=enemy(w,'boss',-4);assert(w.siege.castBoss(b,0));assert.equal(w.hazards.length,1);assert.equal(w.siege.reserved(),2);
 const h=w.hazards[0];assert.equal(h.x,w.player.x);assert.equal(h.damage,26);w.time=h.due+.01;stepHazards(w);assert.equal(w.hp,74);
 w.time=h.until+.01;stepHazards(w);w.siege.stepBoss(b,2);assert.equal(b.siegeStep,1);
 w.player.y=3;w.time+=.4;w.siege.stepBoss(b,.4);assert.equal(w.hazards.length,1);assert.equal(w.hazards[0].y,3);assert(Math.abs(w.hazards[0].due-w.time-1)<1e-9);
 const q=world(),boss=enemy(q,'boss',-4),bow=enemy(q,'siegebow',5);assert(q.siege.castBoss(boss,0));assert(!q.siege.castBow(bow));
});

test('boss charge stops at wall, then gives a fresh sweep warning before wall recovery',()=>{
 const w=world(),b=enemy(w,'boss',-12,-8);w.player={x:-5,y:-8};w.camera={x:-8,y:-8};assert(w.siege.castBoss(b,1));
 b.state='charge';b.timer=6/7;const x=b.x;w.siege.stepBoss(b,.5);assert.equal(b.x,x);assert(b.siegeWall);assert.equal(b.siegeStep,1);assert.equal(w.hazards.length,0);
 w.siege.stepBoss(b,.01);assert.equal(w.hazards.length,1);assert(Math.abs(w.hazards[0].due-w.time-1)<1e-9);
 w.time+=1.2;stepHazards(w);w.siege.stepBoss(b,1.2);assert.equal(b.state,'recover');assert.equal(b.timer,3.4);assert.equal(w.siege.reserved(),0);
});

test('boss phase transition clears own hazards, does not heal and recovery is contact safe',()=>{
 const w=world(),b=enemy(w,'boss',0);b.hp=b.maxHp*.49;const hp=b.hp;
 w.siege.stepBoss(b,0);assert.equal(b.bossPhase,2);assert.equal(b.timer,1.5);assert.equal(b.hp,hp);
 w.siege.stepBoss(b,1.5);assert.equal(b.state,'recover');w.siege.stepBoss(b,.1);assert.equal(w.hp,100);
});

test('boss tactical reinforcements occur once per two cycles, grant half xp and respect rests',()=>{
 const w=world(),b=enemy(w,'boss',4);w.time=482;w.siege.bossReinforcements();assert.equal(w.enemies.length,3);w.siege.bossReinforcements();assert.equal(w.enemies.length,3);
 const e=w.enemies.find(e=>e.kind==='flanker');assert(e.bossReinforcement&&e.summoned);e.state='seek';w.hit(e,10000,'lightning');assert.equal(w.gems[0].value,.425);assert.equal(w.gold,0);
 for(const o of w.enemies)if(o.kind==='flanker')o.hp=0;b.bossPhase=2;w.time=510;w.siege.bossReinforcements();assert(w.enemies.some(e=>e.kind==='thornshield')&&w.enemies.some(e=>e.kind==='siegebow'));
 const count=w.enemies.length;w.time=519;w.siege.bossReinforcements();assert.equal(w.enemies.length,count);
});
