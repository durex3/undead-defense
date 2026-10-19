import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ENEMIES, RANGED_ENEMIES, enemyAttackRate} from '../temp/tests/battle/SurvivalConfig.mjs';
import {stepEnemies, stepHazards} from '../temp/tests/battle/EnemySystem.mjs';
import {castFrontier} from '../temp/tests/battle/FrontierSystem.mjs';

function setup(kind,x=6,stage=1){
 const w=new SurvivalWorld(19,'ranger',stage,6);w.time=10;w.enemies=[];
 for(const s of Object.keys(w.skills))w.skills[s]=0;
 const e=w.addEnemy(kind,x,0);e.attack=0;e.visibleSince=0;
 return {w,e};
}

test('elite and every ranged role have doubled health, contact and unchanged movement',()=>{
 const base={executioner:[10,15],charger:[12,15],mage:[.9,6],archer:[.8,6],anchorhand:[1.25,8],crossbowman:[.85,8],starweaver:[1.05,8],lineworker:[1,8],hammerer:[1.1,8],prismarcher:[.9,8],mirrorpriest:[1.05,8],tidecaller:[1.05,8],echoferryman:[1,8]};
 for(const [kind,[hp,damage]] of Object.entries(base)){
  assert.equal(ENEMIES[kind].health,hp*2,kind);
  assert.equal(ENEMIES[kind].contact,damage*2,kind);
 }
 assert.equal(ENEMIES.minion.health,1);assert.equal(ENEMIES.boss.health,2800);
 assert.equal(ENEMIES.mage.speed,1.1);assert.equal(enemyAttackRate('executioner'),1);
 for(const kind of RANGED_ENEMIES)assert.equal(enemyAttackRate(kind),2);
 const {w,e}=setup('mage',10);e.attack=5;stepEnemies(w,.1);
 assert.ok(Math.abs(e.attack-4.8)<1e-9);assert.ok(Math.abs(e.x-9.89)<1e-9);
 e.state='recover';e.timer=1;stepEnemies(w,.1);assert.equal(e.timer,.8);
});

test('elite melee skills double their actual hit damage',()=>{
 const {w,e}=setup('executioner',2);stepEnemies(w,0);
 assert.equal(w.hazards[0].damage,36);
 w.time=w.hazards[0].due+.01;stepHazards(w);assert.equal(w.hp,64);
 const q=setup('charger',2);q.e.state='charge';q.e.x=0;q.e.lockedAngle=0;
 stepEnemies(q.w,.01);assert.equal(q.w.hp,68);
});

test('archer projectile traverses the doubled distance with continuous hit detection',()=>{
 const {w}=setup('archer',6);stepEnemies(w,0);const h=w.hazards[0];
 assert.equal(h.projectileSpeed,9);assert.equal(h.damage,20);
 assert.equal(h.due,10.325);
 // One long frame crossing the player must still hit once.
 w.time=h.due+.75;stepHazards(w);assert.equal(w.hp,80);
 w.invulnerable=0;stepHazards(w);assert.equal(w.hp,80);
});

test('ranged frontier warning and damage double while boss attacks retain their values',()=>{
 const {w,e}=setup('hammerer',4,11);
 assert.equal(castFrontier(w,e),true);const h=w.hazards[0];
 assert.equal(h.due-w.time,.75);assert.equal(h.damage,20);
 const q=setup('boss',4,11);q.e.bossPhase=1;
 assert.equal(castFrontier(q.w,q.e,2),true);
 assert.equal(q.w.hazards[0].damage,18);assert.equal(q.w.hazards[0].due-q.w.time,1.5);
});
