import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {HarborDirector,harborRest,stepHarborBoss} from '../temp/tests/battle/HarborSystem.mjs';
import {harborBlocked,harborSegment,harborHeading,resolveHarbor} from '../temp/tests/battle/HarborMap.mjs';
import {stepEnemies,stepHazards} from '../temp/tests/battle/EnemySystem.mjs';
import {ProgressStore} from '../temp/tests/platform/ProgressStore.mjs';
import {ENEMIES,MAX_ENEMIES} from '../temp/tests/battle/SurvivalConfig.mjs';
const enemy=(w,k,x,y=0)=>{const e=w.addEnemy(k,x,y);e.state='seek';e.visibleSince=0;return e;};
const world=()=>{const w=new SurvivalWorld(19,'ranger',8);w.director.elites=[true,true];return w;};
test('harbor unlocks after seven, preserves old saves and stores eighth-stage results',()=>{
 const m=new Map(),storage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};const p=new ProgressStore(storage);
 assert(!p.unlockedStage(8));const w=new SurvivalWorld(19,'ranger',7);w.state='won';p.observe(w);assert(p.unlockedStage(8));
 const q=new ProgressStore(storage);assert(q.unlockedStage(8));w.stageId=8;q.observe(w);const r=new ProgressStore(storage);assert(r.data.stageBest[8].won);assert(r.data.stages.includes(8));
});
test('cargo uses rectangle boundaries, three open lanes and navigable corner detours',()=>{
 assert(harborBlocked({x:8,y:8}));assert(harborBlocked({x:9.9,y:10.9}));assert(!harborBlocked({x:11,y:8}));
 for(const x of [-15,0,15])for(let y=-26;y<=26;y+=.2)assert(!harborBlocked({x,y}));
 const w=world(),e=enemy(w,'sailor',-12,-8),target={x:0,y:-8};assert(harborSegment(e,target));
 for(let i=0;i<1500&&Math.hypot(e.x-target.x,e.y-target.y)>.25;i++){const a=harborHeading(e,target);e.x+=Math.cos(a)*1.4/60;e.y+=Math.sin(a)*1.4/60;resolveHarbor(e,.35);assert(!harborBlocked(e,.34));}
 assert(Math.hypot(e.x-target.x,e.y-target.y)<.3);
});
test('harbor teaches formation then sidecuts then anchors, with strict caps and real rest windows',()=>{
 for(const [time,roles]of [[30,['sailor']],[60,['sailor','drowned']],[120,['sailor','anchorhand']]]){
  const w=world();w.time=time;w.director.step(w,0);for(const k of roles)assert(w.enemies.some(e=>e.kind===k),`${time} ${k}`);
  if(time<120)assert(!w.enemies.some(e=>e.kind==='anchorhand'));
  assert(w.enemies.every(e=>e.state==='arriving'&&e.timer>=1&&!harborBlocked(e,.35)));
 }
 for(const time of [164,250,330,470]){const w=world();w.time=time;assert(harborRest(time));w.director.step(w,0);assert.equal(w.enemies.length,0);}
 const w=world();w.time=400;for(let i=0;i<MAX_ENEMIES;i++)w.addEnemy('minion',0,10);w.director.step(w,0);assert.equal(w.enemies.length,MAX_ENEMIES);
});
test('formation and sidecut targets lock, expire and remain controllable without teleporting',()=>{
 const w=world();w.time=65;w.director.step(w,0);const e=w.enemies.find(e=>e.kind==='drowned');assert(e.harborTarget);const target={...e.harborTarget};
 e.state='seek';w.player={x:10,y:0};stepEnemies(w,.1);assert.deepEqual(e.harborTarget,target);
 const old={x:e.x,y:e.y};e.freezeUntil=w.time+1;stepEnemies(w,.2);assert.equal(e.x,old.x);assert.equal(e.y,old.y);
 w.pause('test',true);const t=w.time;w.step(2);assert.equal(w.time,t);
});
test('anchor locks its circle, warns fully, damages once and cancels when approached or killed',()=>{
 const w=world();w.time=10;const e=enemy(w,'anchorhand',5);e.attack=0;stepEnemies(w,0);assert.equal(w.hazards.length,1);const h=w.hazards[0];assert.equal(h.due,10.7);assert.equal(h.radius,1.1);
 w.time=10.69;stepHazards(w);assert.equal(w.hp,100);w.time=10.7;stepHazards(w);assert.equal(w.hp,80);w.invulnerable=0;stepHazards(w);assert.equal(w.hp,80);
 const q=world();q.time=10;const a=enemy(q,'anchorhand',5);a.attack=0;stepEnemies(q,0);q.player.x=4;stepEnemies(q,0);assert.equal(q.hazards.length,0);assert.equal(a.state,'recover');
 const r=world();r.time=10;const b=enemy(r,'anchorhand',5);b.attack=0;stepEnemies(r,0);b.hp=0;stepHazards(r);assert.equal(r.hazards.length,0);
});
test('captain charge stops at cargo, offers a recovery and never damages through it',()=>{
 const w=world();w.time=500;w.player={x:12,y:8};w.camera={x:8,y:8};const b=enemy(w,'boss',5,8);b.pattern=1;b.attack=0;
 stepHarborBoss(w,b,0);assert.equal(b.bossAction,'harborCharge');assert.equal(b.timer,1.3);
 stepHarborBoss(w,b,1.3);assert.equal(b.state,'charge');stepHarborBoss(w,b,.1);assert.equal(b.state,'recover');assert.equal(b.timer,2.8);assert.equal(w.hp,100);assert.equal(w.hazards.length,0);
});
test('captain phase clears old danger and second anchor has a fresh full warning',()=>{
 const w=world();w.time=500;const b=enemy(w,'boss',4);b.hp=b.maxHp*.5;b.attack=0;w.hazards=[{source:0}];stepHarborBoss(w,b,0);assert.equal(b.bossPhase,2);assert.equal(w.hazards.length,0);assert.equal(b.bossAction,'transition');
 b.state='seek';b.attack=0;stepHarborBoss(w,b,0);const first=w.hazards[0];assert(first);w.player.y=3;w.time=first.until;stepHazards(w);stepHarborBoss(w,b,1.65);
 const second=w.hazards[0];assert(second);assert.equal(second.y,3);assert(Math.abs(second.due-w.time-1.4)<1e-8);assert.equal(b.combo,1);
});
test('eight-minute arrival replaces old harbor threats, keeps normal reinforcements and pause defers all spawns',()=>{
 const w=world();w.time=479;enemy(w,'anchorhand',5);enemy(w,'sailor',7);w.time=480;w.director.step(w,0);assert.equal(w.enemies.filter(e=>e.kind==='boss').length,1);assert(w.enemies.every(e=>['minion','boss'].includes(e.kind)));
 const count=w.enemies.length;w.pause('test',true);w.step(10);assert.equal(w.time,480);assert.equal(w.enemies.length,count);
});
test('captain charge hits at most once and shares the strict two-hazard budget',()=>{
 const w=world();w.time=500;const b=enemy(w,'boss',4);b.state='charge';b.lockedAngle=Math.PI;b.timer=1;b.combo=0;
 for(let i=0;i<60;i++){w.invulnerable=0;stepHarborBoss(w,b,1/60);}assert.equal(w.hp,82);assert.equal(b.state,'recover');
 const q=world();q.time=500;const e=enemy(q,'boss',4);e.attack=0;q.hazards=[{source:0},{source:0}];stepHarborBoss(q,e,0);assert.equal(e.state,'seek');assert.equal(q.hazards.length,2);
});
