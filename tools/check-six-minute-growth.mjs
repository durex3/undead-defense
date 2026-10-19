import fs from 'node:fs';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
import {modReason} from '../temp/tests/battle/ArmoryConfig.mjs';
import {siegeMap} from '../temp/tests/battle/SiegeMap.mjs';
import {sandMap} from '../temp/tests/battle/SandMap.mjs';
import {thunderMap} from '../temp/tests/battle/ThunderMap.mjs';
import {moonMap} from '../temp/tests/battle/MoonMap.mjs';

// An invulnerable collector isolates XP/upgrade pacing; it is not a win-rate test.
const result=[];
for(const stage of [1,2,3,4])for(const seed of [19,73]) {
  const w=new SurvivalWorld(seed,'ranger',stage), arena=[null,siegeMap,sandMap,thunderMap,moonMap][stage];
  w.offerStartingWeapons();
  const preferred=['blade','fire','lightning','water','bone','holy','ghost','frost','void','mine'];
  w.chooseStartingWeapon(preferred.find(s=>w.startingWeapons.includes(s)));
  const primary=w.buildWeapons[0], snapshots=[];
  let firstEight=null, choices=0, peak=0, next=60;
  for(let frame=0;frame<400*30 && w.time<360+1/30;frame++) {
    while(['upgrade','modification','tactical'].includes(w.state)) {
      if(++choices>150)throw Error('upgrade loop');
      if(w.state==='tactical')w.chooseTacticalBlessing(w.tacticalChoices[0].id);
      else if(w.state==='modification') {
        const s=w.pendingModification;
        const order={blade:['hunt','return'],fire:['heavy','embers'],water:['spring','pulse'],lightning:['relay','echo']};
        const id=order[s]?.find(id=>!modReason(w,s,id));
        w.chooseMod(id||w.modOptions().find(m=>!modReason(w,s,m.id)).id);
      } else {
        const owned=w.buildWeapons.filter(s=>w.cards.includes(s));
        const card=(w.cards.includes(primary)&&w.skills[primary]<8?primary:null)
          ||owned.sort((a,b)=>w.skills[b]-w.skills[a])[0]
          ||preferred.find(s=>w.cards.includes(s))
          ||['power','hourglass','amount','area'].find(p=>w.cards.includes(p))||w.cards[0];
        w.choose(card);
      }
    }
    if(firstEight===null&&w.skills[primary]===8)firstEight=Math.round(w.time);
    const nearby=w.gems.slice().sort((a,b)=>Math.hypot(a.x-w.player.x,a.y-w.player.y)-Math.hypot(b.x-w.player.x,b.y-w.player.y))[0];
    const target=nearby||{x:Math.cos(w.time*.06)*6,y:Math.sin(w.time*.06)*6};
    const heading=arena.heading({...w.player},target);
    w.setMove(Math.cos(heading),Math.sin(heading));
    w.camera={x:Math.max(-10.6,Math.min(10.6,w.player.x)),y:Math.max(-19.5,Math.min(19.5,w.player.y))};
    if(w.gems.length>8||w.gems.reduce((sum,g)=>sum+g.value,0)>=w.xpNeed)w.useUltimate();
    w.invulnerable=1e6;
    w.step(1/30);w.drain();peak=Math.max(peak,w.enemies.length);
    if(w.time>=next-1e-6){snapshots.push({seconds:next,level:w.level,skills:{...w.skills},kills:w.kills});next+=60;}
  }
  result.push({stage,seed,primary,firstEight,peak,snapshots,bossPresent:w.enemies.some(e=>e.kind==='boss'),weapons:w.weaponCount});
}
const report={scope:'Invulnerable automated XP collector. No claims about human survival, real win rate, rendering or phone performance.',result};
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/six-minute-growth.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(result.map(r=>({stage:r.stage,seed:r.seed,firstEight:r.firstEight,levels:r.snapshots.map(s=>s.level),weapons:r.weapons,bossPresent:r.bossPresent,peak:r.peak})),null,2));
