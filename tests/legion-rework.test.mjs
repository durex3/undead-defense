import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ENEMIES,isElite} from '../temp/tests/battle/SurvivalConfig.mjs';
import {stepEnemies,stepHazards} from '../temp/tests/battle/EnemySystem.mjs';
const world=()=>{const w=new SurvivalWorld(19,'ranger', 1,6);w.time=140;w.skills.blade=0;return w;};
function enemy(w,kind,x=4,y=0){const e=w.addEnemy(kind,x,y);e.state='seek';e.visibleSince=0;e.attack=0;return e;}
test('legion roles have dedicated elites and final contact values are doubled exactly once',()=>{
 assert(isElite('siegeflag')&&isElite('siegerider'));assert.equal(ENEMIES.siegeflag.contact,18);assert.equal(ENEMIES.siegerider.contact,20);
 assert.equal(ENEMIES.siegeflag.health,20);assert.equal(ENEMIES.siegebow.health,1.8);
 assert.equal(ENEMIES.flanker.name,'猎袭战犬');
});
test('third bow shot locks ground and residual damage is throttled',()=>{
 const w=world(),e=enemy(w,'siegebow');e.pattern=2;assert(w.siege.castBow(e));const h=w.hazards[0];assert(h.siegeGround);assert.equal(e.pattern,3);
 w.time=h.due;stepHazards(w);assert.equal(w.hp,86);w.invulnerable=0;w.time+=.2;stepHazards(w);assert.equal(w.hp,86);
 w.time+=.51;stepHazards(w);assert.equal(w.hp,78);assert.equal(h.x,0);w.player.x=3;w.invulnerable=0;w.time+=.8;stepHazards(w);assert.equal(w.hp,78);
});
test('killing a caster cancels unlaunched ground but preserves a fired arrow',()=>{
 const w=world(),e=enemy(w,'siegebow');assert(w.siege.castBow(e));const arrow=w.hazards[0];w.player.y=4;w.time=arrow.due;stepHazards(w);assert(arrow.fired);
 e.hp=0;stepHazards(w);assert(w.hazards.includes(arrow));
 const q=world(),b=enemy(q,'siegebow');b.pattern=2;assert(q.siege.castBow(b));b.hp=0;stepHazards(q);assert.equal(q.hazards.length,0);
});
test('warhound announces one rush, freezes without moving, and hits at most once',()=>{
 const w=world(),dog=enemy(w,'flanker');w.siege.stepEnemy(dog,0);assert.equal(dog.state,'windup');const h=w.hazards[0],due=h.due;
 w.slow(dog,true);stepEnemies(w,.1);assert.equal(h.due,due+.1);assert.equal(dog.x,4);
 dog.freezeUntil=0;dog.timer=0;w.siege.stepEnemy(dog,0);assert.equal(dog.state,'charge');dog.lockedAngle=Math.PI;
 w.siege.stepEnemy(dog,.65);const hp=w.hp;w.invulnerable=0;w.siege.stepEnemy(dog,.02);assert.equal(w.hp,hp);assert.equal(dog.pattern,1);
});
test('flag shields are finite, never heal, disappear with owner, and cannot immediately refresh',()=>{
 const w=world(),flag=enemy(w,'siegeflag',-4),guard=enemy(w,'thornshield',-3,2),bow=enemy(w,'siegebow',-2,2);
 w.siege.stepEnemy(flag,0);assert.equal(w.siege.stats.elite,1);assert.equal(guard.siegeShield,guard.maxHp*.15);const hp=guard.hp;
 w.hit(guard,5,'water',false,undefined,false);assert.equal(guard.hp,hp);assert.equal(guard.siegeShield,guard.maxHp*.15-5);
 flag.hp=0;w.siege.sample();assert.equal(guard.siegeShield,0);assert.equal(bow.siegeShield,0);assert.equal(w.siege.reserved(),0);
 w.hit(guard,5,'water',false,undefined,false);assert.equal(guard.hp,hp-5);
});
test('rider wall recovery is contact safe and gives exactly 25 percent vulnerability',()=>{
 const w=world(),e=enemy(w,'siegerider',-12,-8);w.player={x:-5,y:-8};w.camera={x:-8,y:-8};w.siege.stepEnemy(e,0);assert.equal(e.state,'windup');
 e.timer=0;w.siege.stepEnemy(e,0);w.siege.stepEnemy(e,.5);assert.equal(e.state,'recover');assert(e.siegeWall);assert.equal(e.timer,2.8);
 const hp=e.hp;w.hit(e,10,'water',false,undefined,false);assert.equal(hp-e.hp,12.5);
 w.player={x:e.x,y:e.y};w.siege.stepEnemy(e,.1);assert.equal(w.hp,100);
});
test('second rider rush cannot consume a third danger slot and has separated impacts',()=>{
 const w=world(),e=enemy(w,'siegerider',-4);e.pattern=1;w.siege.stepEnemy(e,0);assert.equal(w.hazards.length,2);
 const ground=w.hazards.find(h=>h.kind==='circle'),line=w.hazards.find(h=>h.kind==='line');assert(line.due-ground.due>=.5);assert.equal(line.damage,26);
 assert(!w.siege.castBow(enemy(w,'siegebow',5)));
});
test('boss finite freeze resistance leaves control effective and resets after its window',()=>{
 const w=world(),b=enemy(w,'boss');w.slow(b,true);assert.equal(b.freezeUntil-w.time,.5);
 w.time+=.6;w.slow(b,true);assert(Math.abs(b.freezeUntil-w.time-.175)<1e-9);w.time+=3;w.slow(b,true);assert.equal(b.freezeUntil-w.time,.5);
 const q=new SurvivalWorld(1,'ranger',4),old=enemy(q,'boss');q.slow(old,true);assert.ok(old.freezeUntil>q.time);
});
test('boss phase transition releases a pending sequence without healing or touching player',()=>{
 const w=world(),b=enemy(w,'boss',-4);assert(w.siege.castBoss(b,0));assert.equal(w.siege.reserved(),2);
 b.hp=b.maxHp*.49;const hp=b.hp;w.siege.stepBoss(b,0);assert.equal(b.hp,hp);assert.equal(w.siege.reserved(),0);assert.equal(w.hazards.length,0);
 w.player={x:b.x,y:b.y};w.siege.stepBoss(b,1);assert.equal(w.hp,100);
});
test('boss inner sweep is followed by an independently warned hollow ring',()=>{
 const w=world(),b=enemy(w,'boss',-4);assert(w.siege.castBoss(b,2));const first=w.hazards[0];assert.equal(first.radius,3);
 w.time=first.until+.01;stepHazards(w);w.siege.stepBoss(b,2);w.time+=.4;w.siege.stepBoss(b,.4);
 const ring=w.hazards[0];assert.equal(ring.kind,'bellRing');assert.equal(ring.width,3);assert.equal(ring.radius,5);assert(Math.abs(ring.due-w.time-1.1)<1e-9);
 w.player={x:b.x,y:b.y};w.time=ring.due;stepHazards(w);assert.equal(w.hp,100);
});
test('expired or dead-source reservations never starve later casts',()=>{
 const w=world(),b=enemy(w,'boss',-4);assert(w.siege.castBoss(b,0));b.hp=0;w.siege.sample();stepHazards(w);assert.equal(w.siege.reserved(),0);
 assert(w.siege.castBow(enemy(w,'siegebow',5)));
});
test('landed ground persists after caster death while expired ground releases its slot',()=>{
 const w=world(),e=enemy(w,'siegebow');e.pattern=2;assert(w.siege.castBow(e));const h=w.hazards[0];
 w.player.y=4;w.time=h.due;stepHazards(w);e.hp=0;stepHazards(w);assert(w.hazards.includes(h));
 w.time=h.until;stepHazards(w);assert.equal(w.hazards.length,0);
});
test('bow fires from outside common eight-unit weapon range instead of walking into it',()=>{
 const w=world(),e=enemy(w,'siegebow',9);const x=e.x;w.siege.stepEnemy(e,.1);assert.equal(e.state,'windup');
 assert.equal(e.x,x);assert.equal(w.hazards[0].radius,18);assert.equal(w.hazards[0].until-w.hazards[0].due,2);
});
test('a launched explosive bolt retains its full landing warning after death or freeze',()=>{
 const w=world(),e=enemy(w,'siegebow');e.pattern=2;assert(w.siege.castBow(e));const h=w.hazards[0],due=h.due;
 w.time=h.created+.21;stepHazards(w);assert(h.siegeLaunched);w.slow(e,true);stepEnemies(w,.1);assert.equal(h.due,due);
 e.hp=0;stepHazards(w);assert(w.hazards.includes(h));assert(!h.fired);w.time=due;stepHazards(w);assert.equal(w.hp,86);
});

test('shield guard steps out of weapon ground without teleport or ground immunity',()=>{
 const w=world(),e=enemy(w,'thornshield');w.armory.fields.push({active:true,skill:'water',x:e.x,y:e.y,radius:2,created:w.time,until:w.time+5,stats:{damage:2,mods:[]},returning:false,next:w.time+.4,interval:.4});
 const old={...e};for(let i=0;i<7;i++)w.siege.stepEnemy(e,.1);assert(e.siegeDodgeReady>w.time);assert(e.siegeTarget);assert(Math.hypot(e.x-old.x,e.y-old.y)<=1.2);
 const hp=e.hp;w.hit(e,10,'water',false,undefined,false);assert.equal(hp-e.hp,10);
});
