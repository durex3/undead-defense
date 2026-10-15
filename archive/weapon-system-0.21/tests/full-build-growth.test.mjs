import test from 'node:test';
import assert from 'node:assert/strict';
import { SurvivalWorld } from '../temp/tests/battle/SurvivalWorld.mjs';
import { ProgressStore } from '../temp/tests/platform/ProgressStore.mjs';
import { WEAPONS, EVOLUTIONS } from '../temp/tests/battle/SurvivalConfig.mjs';

test('new and existing progress always provide six weapon slots', () => {
  const data = new Map();
  const storage = {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
  const p = new ProgressStore(storage);
  assert.equal(p.weaponSlots, 6);
  p.flush();
  assert.equal(new ProgressStore(storage).weaponSlots, 6);
  const w = new SurvivalWorld(1,'ranger',1,p.weaponSlots);
  for (const s of ['blade','fire','ice','lightning']) w.skills[s]=10;
  assert.equal(w.weaponCount, 4);
  assert.ok(w.legal().includes('ghost'));
  w.skills.ghost=w.skills.bat=10;
  assert.equal(w.weaponCount, 6);
  assert.ok(!w.legal().includes('water'));
});

function fullBuild() {
  const w = new SurvivalWorld(1,'ranger',1,6);
  for (const s of WEAPONS) w.skills[s]=0;
  for (const s of ['blade','fire','ice','lightning','ghost','bat']) {
    w.skills[s]=10;
    w.evolutions[s]=EVOLUTIONS[s][0].id;
  }
  w.passives.boots=w.passives.hourglass=2;
  return w;
}

test('fully grown build gains automatic supplies without a full-health potion dialog', () => {
  const w=fullBuild();
  w.gems=[{id:w.id(),x:20,y:20,value:w.xpNeed}];
  assert.equal(w.useUltimate(),true);
  assert.equal(w.level,2);
  assert.equal(w.gold,10);
  assert.equal(w.hp,w.maxHp);
  assert.equal(w.state,'battle');
  assert.deepEqual(w.cards,[]);
  assert.ok(w.drain().some(e=>e.type==='supply'));
});

test('automatic supply heals once and queued levels stop at the level cap', () => {
  const w=fullBuild();w.level=63;w.hp=40;
  w.gems=[{id:w.id(),x:20,y:20,value:100000}];
  w.useUltimate();
  assert.equal(w.level,64);
  assert.equal(w.hp,65);
  assert.equal(w.healing.repair,20);
  assert.equal(w.gold,10);
  assert.equal(w.state,'battle');
});

test('six weapons and two passives can reach maximum ranks through actual upgrade choices', () => {
  const w=new SurvivalWorld(1,'ranger',1,6);
  const weapons=['blade','fire','ice','lightning','ghost','bat'];
  const chooseUpgrade=c=>{
    assert.ok(w.legal().includes(c));
    w.xp=w.xpNeed;w.checkUpgrade();
    assert.equal(w.state,'upgrade');
    w.cards=[c];assert.equal(w.choose(c),true);
    while(w.state==='evolution') assert.equal(w.evolve(EVOLUTIONS[w.pendingEvolution][0].id),true);
  };
  for(const s of weapons) while(w.skills[s]<10) chooseUpgrade(s);
  for(const p of ['boots','hourglass']) while(w.passives[p]<2) chooseUpgrade(p);
  assert.equal(w.level,64);
  assert.equal(w.weaponCount,6);
  assert.ok(weapons.every(s=>w.skills[s]===10));
  assert.ok(['fire','lightning','ghost'].every(s=>!!w.evolutions[s]));
  assert.equal(w.state,'battle');
});
