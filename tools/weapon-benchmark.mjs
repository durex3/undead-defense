/** Isolated Armory comparison, not full gameplay, player win-rate or device performance. */
import fs from "node:fs";
import {execFileSync} from "node:child_process";
execFileSync(process.execPath,["tools/test-build.mjs"],{stdio:"inherit"});
const {SurvivalWorld}=await import("../temp/tests/battle/SurvivalWorld.mjs");
const {WEAPONS}=await import("../temp/tests/battle/SurvivalConfig.mjs");
const {weaponStats}=await import("../temp/tests/battle/ArmoryConfig.mjs");
const rows=[];
for(const level of [1,4,8])for(const skill of WEAPONS)for(const scene of ["single","moving","spread","line","cluster","surrounded"]) {
  const w=new SurvivalWorld(31,"ranger",1);w.enemies=[];w.player={x:0,y:0};
  for(const s of WEAPONS)w.skills[s]=s===skill?level:0;
  const count=["single","moving"].includes(scene)?1:8;
  for(let i=0;i<count;i++) {
    const angle=i*Math.PI*2/count;
    const p=scene==="line"?{x:1.5+i*.8,y:0}:scene==="cluster"?{x:3+Math.cos(angle)*.4,y:Math.sin(angle)*.4}:
      scene==="surrounded"?{x:Math.cos(angle)*1.9,y:Math.sin(angle)*1.9}:
      scene==="spread"?{x:Math.cos(angle)*5,y:Math.sin(angle)*5}:{x:3,y:0};
    const e=w.addEnemy("minion",p.x,p.y);Object.assign(e,{hp:1e8,maxHp:1e8,state:"seek"});
  }
  let freezeSeconds=0,maxEntities=0;
  for(let step=0;step<1800;step++) {
    w.time+=1/60;
    if(scene==="moving"){w.enemies[0].x=3+Math.sin(w.time*1.2)*2;w.enemies[0].y=Math.cos(w.time*1.2)*2;}
    w.armory.step(1/60);freezeSeconds+=w.enemies.filter(e=>e.freezeUntil>w.time).length/60;
    maxEntities=Math.max(maxEntities,w.armory.shots.filter(a=>a.active).length+w.armory.fields.filter(a=>a.active).length+w.armory.extra.attacks.filter(a=>a.active).length);
    w.drain();
  }
  rows.push({skill,level,scene,damage:w.damage[skill]||0,dps:(w.damage[skill]||0)/30,freezeSeconds,maxEntities,stats:weaponStats(w,skill)});
}
fs.mkdirSync("artifacts/weapon-redesign",{recursive:true});
fs.writeFileSync("artifacts/weapon-redesign/benchmark.json",JSON.stringify({scope:"30 seconds isolated armory, static high-HP minions except moving scene, ranger, no passives/mods, no enemy AI/contact. No survival/boss/balance certification.",rows},null,2));
console.log(JSON.stringify({cases:rows.length,invalid:rows.filter(r=>!Number.isFinite(r.damage)).length}));
