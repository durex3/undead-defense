import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {UpgradeSystem} from '../temp/tests/battle/UpgradeSystem.mjs';
import {ALL_WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
import {battleHud} from '../temp/tests/presentation/BattleHud.mjs';
import {drawBossCastSignals} from '../temp/tests/presentation/art/HazardPainter.mjs';
import {Graphics} from '../temp/tests/node_modules/cc/index.mjs';

for(let stage=1;stage<=10;stage++) {
  test(`stage ${stage}: boss supplies cross each health threshold once`,()=>{
    const w=new SurvivalWorld(19,'ranger',stage);w.time=360;
    const b=w.addEnemy('boss',3,0);b.state='seek';
    b.hp=b.maxHp*.74;w.hit(b,1,'blade');assert.equal(w.potions.length,1);
    w.hit(b,1,'blade');assert.equal(w.potions.length,1);
    b.hp=b.maxHp*.49;w.hit(b,1,'blade');assert.equal(w.potions.length,2);
    b.hp=b.maxHp*.24;w.hit(b,1,'blade');assert.equal(w.potions.length,3);
    w.hit(b,1,'blade');assert.equal(w.potions.length,3);
    assert(w.potions.every(p=>p.expires===w.time+25));
    const p=w.potions[0];w.potions=[p];w.player={x:p.x,y:p.y};w.hp=70;w.collect(0);
    assert.equal(w.hp,90);assert.equal(w.healing.potion,20);
  });
  test(`stage ${stage}: current boss cast overrides ambient hints and cue ends`,()=>{
    const w=new SurvivalWorld(19,'ranger',stage);w.time=360;
    const b=w.addEnemy('boss',3,0);b.state='windup';
    const h={id:100,source:b.id,kind:'circle',x:0,y:0,radius:2,width:0,angle:0,created:360,due:361,until:361.2,damage:20,fired:false,next:0,damageLabel:'测试招式'};
    w.hazards.push(h);w.time=360.5;
    assert.match(battleHud(w,true,[]).hint,/测试招式 · 0.5秒后释放/);
    const g=new Graphics();drawBossCastSignals(g,w);assert(g.vertexCount>0);
    w.time=361.1;g.clear();drawBossCastSignals(g,w);assert.equal(g.vertexCount,0);
  });
}

function maxWeapons(w) {
  for(const s of ALL_WEAPONS)w.skills[s]=0;
  for(const s of ALL_WEAPONS.slice(0,4)){w.skills[s]=8;w.mods[s]=['test-a','test-b'];}
}
test('maxed weapons guarantee optional medicine alongside unfinished passives',()=>{
  const w=new SurvivalWorld();maxWeapons(w);w.hp=45;w.xp=w.xpNeed;
  const upgrades=new UpgradeSystem(w);upgrades.checkUpgrade();
  assert.equal(w.state,'upgrade');assert(w.cards.includes('repair'));assert(w.cards.length>1);
  assert.equal(w.hp,45);upgrades.refresh();assert.equal(w.hp,45);
  assert(w.cards.includes('repair'));assert(w.choose('repair'));assert.equal(w.hp,65);
  assert.equal(w.healing.repair,20);assert(w.effects.some(e=>e.type==='heal'));
});
test('ordinary upgrades never automatically heal; capped level still spends XP on supplies',()=>{
  const w=new SurvivalWorld();w.hp=45;w.xp=w.xpNeed;w.checkUpgrade();assert.equal(w.hp,45);
  const capped=new SurvivalWorld();maxWeapons(capped);capped.level=64;capped.hp=95;capped.xp=capped.xpNeed;
  capped.checkUpgrade();assert.equal(capped.level,64);assert(capped.cards.includes('repair'));
  capped.choose('repair');assert.equal(capped.hp,100);assert.equal(capped.healing.repair,5);
});
