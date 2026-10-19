import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ProgressStore,PROGRESS_KEY} from '../temp/tests/platform/ProgressStore.mjs';
import {WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
import {BOSS_TIME,encounterRealTime,encounterScoreTime} from '../temp/tests/battle/EncounterPacing.mjs';

test('all stage directors preserve both elites and the full enemy introduction sequence before 360 seconds',()=>{
  const elites={1:['siegeflag','siegerider'],2:['broodelite','breakerelite'],3:['gridwarden','railreaper'],4:['moonreaver','hornwarden']};
  const specials={1:['thornshield','siegebow','flanker'],2:['shellroller','sandspitter','sandstalker'],3:['anchorweaver','arclantern','railsaw'],4:['crescentmantis','vaultlynx','antlerprowler']};
  for(const stage of [1,2,3,4]) {
    const w=new SurvivalWorld(19,'ranger',stage), events=[];
    w.player={x:0,y:0};w.camera={...w.player};
    for(let seconds=0;seconds<=360;seconds++) {
      w.time=seconds;w.enemies=[];w.hazards=[];
      w.director.step(w,1);
      for(const e of w.enemies)events.push({kind:e.kind,seconds});
      assert(w.enemies.length<=100);
    }
    for(const kind of [...elites[stage],...specials[stage]])
      assert(events.some(e=>e.kind===kind&&e.seconds<350),`${stage}: missing ${kind}`);
    for(const kind of elites[stage])assert.equal(events.filter(e=>e.kind===kind).length,1);
    assert.deepEqual(events.filter(e=>e.kind==='boss').map(e=>e.seconds),[360]);
  }
});

test('the six-minute encounter score reaches the former ending rather than cutting off late waves',()=>{
  assert.equal(BOSS_TIME,360);
  assert.equal(encounterScoreTime(360),480);
  for(const mark of [35,150,175,185,345,355,460,472,480])
    assert.equal(encounterScoreTime(encounterRealTime(mark)),mark);
  assert.equal(encounterRealTime(472),354);
});

test('four owned weapons block a forged fifth choice and rerolls but keep owned upgrades',()=>{
  for(const requested of [undefined,6,99]) {
    const w=new SurvivalWorld(19,'ranger',3,requested);
    assert.equal(w.weaponSlots,4);
    for(const s of WEAPONS)w.skills[s]=0;
    for(const s of WEAPONS.slice(0,4))w.skills[s]=1;
    const fifth=WEAPONS[4];
    w.state='upgrade';w.cards=[fifth];
    assert.equal(w.choose(fifth),false);
    for(let n=0;n<30;n++) {
      w.upgrades.roll();
      assert(w.cards.every(c=>!WEAPONS.includes(c)||w.skills[c]>0));
    }
    w.cards=[WEAPONS[0]];assert(w.choose(WEAPONS[0]));
    assert.equal(w.weaponCount,4);
  }
});

test('old six-weapon historical records retain progress while new runs use four slots',()=>{
  const m=new Map(), storage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};
  const data=new ProgressStore(storage).data;
  data.stages=[1,2];data.best.weapons=6;
  m.set(PROGRESS_KEY,JSON.stringify(data));
  const p=new ProgressStore(storage);
  assert(p.unlockedStage(3));assert(p.unlockedCharacter('necromancer'));
  assert.equal(p.data.best.weapons,6);assert.equal(p.weaponSlots,4);
  assert.equal(new SurvivalWorld(19,'ranger',3,p.weaponSlots).weaponSlots,4);
});
