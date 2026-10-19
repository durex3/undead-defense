import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {STAGES} from '../temp/tests/battle/StageRules.mjs';
import {WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
import {modReason} from '../temp/tests/battle/ArmoryConfig.mjs';

function levelFromKills(stage, xpRate) {
  const previous=STAGES[stage].xp;
  try {
    STAGES[stage].xp=xpRate;
    const w=new SurvivalWorld(19,'ranger',stage);
    const kind=stage===3?'rivetwalker':'thornrunner';
    for(let i=0;i<300;i++) {
      const e=w.addEnemy(kind,0,0);
      w.hit(e,1e6,'blade');
      w.enemies=[];
    }
    const dropped=w.gems.reduce((n,g)=>n+g.value,0);
    assert(w.useUltimate());
    let choices=0;
    while(w.state==='upgrade'||w.state==='modification') {
      assert(choices++<100);
      if(w.state==='modification') {
        const skill=w.pendingModification;
        assert(w.chooseMod(w.modOptions().find(m=>!modReason(w,skill,m.id)).id));
      } else assert(w.choose(w.cards[0]));
    }
    return {level:w.level,dropped};
  } finally { STAGES[stage].xp=previous; }
}

test('later-stage real drops buy more upgrades for the same kills without changing the level curve',()=>{
  for(const stage of [3,4]) {
    const baseline=levelFromKills(stage,.85);
    const current=levelFromKills(stage,STAGES[stage].xp);
    assert(current.dropped>baseline.dropped*1.4);
    assert(current.level>=baseline.level+3,JSON.stringify({stage,baseline,current}));
  }
});

test('later-stage boss reinforcements still grant half XP and mechanical devices grant none',()=>{
  for(const stage of [3,4]) {
    const w=new SurvivalWorld(19,'ranger',stage);
    const e=w.addEnemy(stage===3?'rivetwalker':'thornrunner',0,0,true);
    e.bossReinforcement=true;
    w.hit(e,1e6,'blade');
    assert.equal(w.gems.reduce((n,g)=>n+g.value,0),STAGES[stage].xp*.5);
    if(stage===3) {
      const before=w.gems.reduce((n,g)=>n+g.value,0), device=w.addEnemy('thunderanchor',1,0);
      w.hit(device,1e6,'lightning');
      assert.equal(w.gems.reduce((n,g)=>n+g.value,0),before);
    }
  }
});

function lightningWorld() {
  const w=new SurvivalWorld(19,'ranger',3);
  w.player={x:0,y:0};
  for(const skill of WEAPONS)w.skills[skill]=0;
  w.skills.lightning=1;
  return w;
}
function target(w,x) {
  const e=w.addEnemy('rivetwalker',x,0);
  e.state='seek';e.hp=e.maxHp=1e6;
  return e;
}

test('opening lightning reaches three separated chain targets without repeating damage',()=>{
  const w=lightningWorld(), targets=[2,4.5,7].map(x=>target(w,x));
  w.armory.step(0);
  const damage=targets.map(e=>e.maxHp-e.hp);
  assert(damage.every(d=>d>0));
  assert.equal(new Set(damage).size,1);
  w.cooldowns.lightning=100;
  for(let i=0;i<60;i++){w.time+=1/60;w.armory.step(1/60);}
  assert.deepEqual(targets.map(e=>e.maxHp-e.hp),damage);
});

test('opening lightning improves sustained single-target output, including storm modification',()=>{
  for(const storm of [false,true]) {
    const w=lightningWorld();target(w,2);
    if(storm)w.mods.lightning=['storm'];
    for(let i=0;i<30*60;i++){w.time+=1/60;w.armory.step(1/60);}
    const oldDamage=23*1.1*Math.ceil(30/2.7)*(storm?.55:1);
    assert(w.damage.lightning>oldDamage*1.4,`${storm?'storm':'chain'}: ${w.damage.lightning}`);
    assert(w.castCounts.lightning<=14,'no catch-up casts or duplicated attacks');
  }
});
