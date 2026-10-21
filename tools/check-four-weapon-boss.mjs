import fs from 'node:fs';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {ALL_WEAPONS as WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
import {STAGES} from '../temp/tests/battle/StageRules.mjs';
import {BOSS_TIME} from '../temp/tests/battle/EncounterPacing.mjs';

// Fixed full builds and invulnerability isolate output windows, not player survival.
const builds={
  armor:{hammer:['heavy','rift'],wheel:['heavy','grind'],water:['spring','pulse'],lightning:['echo','bridge']},
  support:{blade:['hunt','return'],bone:['lance','marrow'],lamp:['focus','linger'],needle:['swift','barb']},
  precision:{blade:['hunt','return'],fire:['heavy','embers'],water:['spring','pulse'],lightning:['relay','echo']},
  ground:{water:['spring','pulse'],mine:['burrow','fuse'],void:['collapse','repel'],holy:['execution','brand']},
  pursuit:{blade:['hunt','return'],ghost:['execution','haunt'],bone:['lance','marrow'],holy:['execution','brand']},
};
const result=[];
for(const seed of [19,41,73])for(const stage of [1,2,3,4,5,6,7,8,9,10])for(const [build,mods] of Object.entries(builds)) {
  const w=new SurvivalWorld(seed,'ranger',stage), arena=w.stageStrategy.map;
  w.player={x:0,y:0};w.camera={...w.player};w.time=BOSS_TIME;w.level=64;
  for(const s of WEAPONS){w.skills[s]=mods[s]?8:0;w.mods[s]=mods[s]||[];}
  for(const p of ['power','hourglass','area'])w.passives[p]=4;
  w.passives.amount=2;
  w.director.step(w,0);
  const phaseTimes={};
  for(let frame=0;frame<240*30&&w.state!=='won';frame++) {
    if(w.state==='upgrade')w.choose(w.cards.find(c=>c!=='repair')??w.cards[0]);
    const boss=w.enemies.find(e=>e.kind==='boss'&&e.hp>0);
    if(boss&&phaseTimes[boss.bossPhase]===undefined)phaseTimes[boss.bossPhase]=+(w.time-BOSS_TIME).toFixed(2);
    if(!boss)throw Error(`Missing boss in stage ${stage}`);
    const a=(w.time-BOSS_TIME)*.35;
    const target={x:boss.x+Math.cos(a)*3,y:boss.y+Math.sin(a)*3};
    arena.resolve(target,.35);
    const heading=arena.heading({...w.player},target);
    w.setMove(Math.cos(heading),Math.sin(heading));
    w.camera={x:Math.max(-10.6,Math.min(10.6,w.player.x)),y:Math.max(-19.5,Math.min(19.5,w.player.y))};
    w.invulnerable=1e6;w.step(1/30);w.drain();
  }
  const boss=w.enemies.find(e=>e.kind==='boss'&&e.hp>0);
  result.push({seed,stage,build,weapons:w.weaponCount,maxHp:2800*STAGES[stage].bossHealth*3,phaseTimes,damage:w.damage,patterns:stage===10?w.library.stats.patterns:undefined,seconds:Math.round(w.time-BOSS_TIME),state:w.state,bossRemaining:boss?Math.round(boss.hp/boss.maxHp*100):0});
}
const report={scope:'Four max-level weapons, fixed passives and mods, three seeds, invulnerable orbit controller. Output-window diagnostic, not human win rate.',result};
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/four-weapon-boss-0.33.8.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
