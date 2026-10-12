import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ProgressStore,PROGRESS_KEY} from '../temp/tests/platform/ProgressStore.mjs';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};
test('fresh unlocks require achievement count and cleared stage, and old unlocked heroes survive migration',()=>{
 const s=storage(),p=new ProgressStore(s),w=new SurvivalWorld();
 w.level=2;w.skills.fire=w.skills.water=w.skills.bone=1;w.evolutions.fire='meteor';w.eliteKills=1;w.time=181;w.kills=301;
 p.observe(w);assert.equal(p.unlockedCharacter('alchemist'),false);
 w.state='won';p.observe(w);assert.equal(p.unlockedCharacter('alchemist'),true);assert.equal(p.unlockedCharacter('necromancer'),false);
 w.stageId=2;w.character='alchemist';p.observe(w);assert.equal(p.unlockedCharacter('necromancer'),true);
 assert.equal(new ProgressStore(s).unlockedCharacter('necromancer'),true);
 const legacy=storage();legacy.setItem(PROGRESS_KEY,JSON.stringify({version:2,revision:1,best:{kills:0,time:0,weapons:0},achievements:['level','learn','four','evolve','elite','survive'],evolutions:[],winners:[],stages:[]}));
 assert.equal(new ProgressStore(legacy).unlockedCharacter('necromancer'),true);
});
test('bat leech cannot fill health, cannot scale with overlapping batches and pauses after damage',()=>{
 const w=new SurvivalWorld();w.skills.bat=4;w.evolutions.bat='bloodmoon';w.hp=69.5;
 const e=w.addEnemy('minion',3,0);e.state='seek';e.hp=10000;
 const returnBatch=()=>{w.expansion.cast('bat');for(const b of w.expansion.bats){b.returning=true;b.hit=[e.id];b.x=w.player.x;b.y=w.player.y;}w.expansion.stepBats(0);};
 returnBatch();assert.equal(w.hp,70);assert.equal(w.expansion.healed,.5);
 w.hp=60;returnBatch();assert.equal(w.hp,60);
 w.time=3;returnBatch();assert.equal(w.hp,61);
 w.time=6;w.hurt(10,'minion');returnBatch();assert.equal(w.hp,51);
 w.time=7.99;returnBatch();assert.equal(w.hp,51);
 w.time=8;returnBatch();assert.equal(w.hp,52);
 w.time=20;w.hp=100;returnBatch();assert.equal(w.hp,100);
});
test('all five stages expire full-health potions at 25 seconds and cap the oldest drops',()=>{
 for(let stage=1;stage<=5;stage++){
  const w=new SurvivalWorld(1,'ranger',stage);w.time=10;
  w.dropPotion(0,0);const old=w.potions[0].id;
  w.time=20;for(let i=0;i<3;i++)w.dropPotion(0,0);
  assert.equal(w.potions.length,3);assert.ok(w.potions.every(p=>p.id!==old));
  w.time=44.99;w.collect(0);assert.equal(w.potions.length,3);assert.equal(w.hp,100);
  w.time=45;w.hp=80;w.collect(0);assert.equal(w.potions.length,0);assert.equal(w.hp,80);assert.equal(w.healing.potion,0);
 }
});
test('valid potion heals once and pause does not consume its battle-time lifetime',()=>{
 const w=new SurvivalWorld();w.dropPotion(0,0);w.pause('test',true);w.step(30);
 assert.equal(w.time,0);assert.equal(w.potions.length,1);w.pause('test',false);
 w.hp=85;w.collect(0);w.collect(0);assert.equal(w.hp,100);assert.equal(w.healing.potion,15);assert.equal(w.potions.length,0);
});
test('feedback fixes: nova kills drop XP, boss is targetable at range, and black hole deals periodic damage',()=>{
 const w=new SurvivalWorld(1,'ranger',1);w.skills.blade=1;const min=w.addEnemy('minion',5,0),boss=w.addEnemy('boss',7,0);min.hp=boss.hp=10;w.xp=0;w.useUltimate();assert.ok(w.gems.length>=1);assert.ok(w.gems.some(g=>g.value>0));
 const w2=new SurvivalWorld(1,'ranger',1);const farBoss=w2.addEnemy('boss',10,0),near=w2.addEnemy('minion',2,0);farBoss.state=near.state='seek';const picked=w2.target(w2.player,14);assert.equal(picked.kind,'boss');
 const w3=new SurvivalWorld(1,'ranger',1);w3.skills.void=1;w3.expansion.field('void',{x:1,y:0},2,2,10);const e=w3.addEnemy('minion',1,0);const hp=e.hp;w3.expansion.stepFields(.6);assert.ok(e.hp<hp);
});
test('third altar boundary remains movable at the right edge',()=>{
 const w=new SurvivalWorld(1,'ranger',3);w.player={x:22,y:0};w.setMove(1,0);for(let i=0;i<60;i++)w.step(1/60);assert.ok(w.player.x<=22);assert.ok(w.player.x>=21);w.setMove(-1,0);for(let i=0;i<120;i++)w.step(1/60);assert.ok(w.player.x<21);
});
test('elite boss-like kills drop a visible high-value experience gem',()=>{
 const w=new SurvivalWorld(1,'ranger',3);w.time=175;const e=w.addEnemy('charger',0,0);e.hp=1;w.hit(e,1000,'blade');
 assert.equal(w.gems.length,1);assert.equal(w.gems[0].value,8*.85);assert.equal(w.xp,0);
});
