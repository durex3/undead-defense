/** Cast the actual armory against stationary targets; inspect every legal build.
 * This isolates weapon visuals, not a recording of a complete game. */
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import sharp from "sharp";
import {createHash} from "node:crypto";
execFileSync(process.execPath,["tools/test-build.mjs"],{stdio:"inherit"});
const {Graphics}=await import("../temp/tests/node_modules/cc/index.mjs");
const {WEAPONS}=await import("../temp/tests/battle/SurvivalConfig.mjs");
const {MODS}=await import("../temp/tests/battle/ArmoryConfig.mjs");
const {drawGroundFields,drawProjectiles,spawnParticles,updateParticles,resetParticles}=await import("../temp/tests/presentation/art/SpellPainter.mjs");
const {drawExtraSpell}=await import("../temp/tests/presentation/art/spells/ExtraSpellArt.mjs");
const {crowdedEffects}=await import("../temp/tests/presentation/art/VisualDensity.mjs");
const {makeWorld,addEnemy}=await import("./art-fixtures.mjs");
const out="artifacts/art-builds";fs.mkdirSync(out,{recursive:true});
const times=[1/30,.2,.42,.52,.86,1.23,1.4,2.6],report=[];
for(const skill of WEAPONS) {
  const mods=MODS[skill],builds=[[],...mods.map(m=>[m.id])];
  for(let i=0;i<mods.length;i++)for(let j=i+1;j<mods.length;j++)
    if(mods[i].excludes!==mods[j].id&&mods[j].excludes!==mods[i].id)builds.push([mods[i].id,mods[j].id]);
  let content="",row=0;
  for(const build of builds) {
    resetParticles();
    const w=makeWorld(1,{time:0,viewport:{x:7.5*844/390,y:7.5}});
    for(const s of WEAPONS){w.skills[s]=0;w.cooldowns[s]=0;w.mods[s]=[];}
    w.skills[skill]=8;w.mods[skill]=build;
    for(let i=0;i<14;i++) {
      const angle=i*Math.PI*2/14, radius=i%3===0?1.5:3.5;
      addEnemy(w,i===0?"siegeflag":"siegebone",{x:Math.cos(angle)*radius,y:Math.sin(angle)*radius,hp:1e7,fields:{maxHp:1e7}});
    }
    let capture=0;
    for(let step=1;capture<times.length;step++) {
      w.time=step/60;w.effects.length=0;w.armory.step(1/60);
      spawnParticles(w.effects,false,w.stageId);updateParticles(new Graphics(),1/60,false);
      if(w.time+1e-6<times[capture])continue;
      const g=new Graphics(),busy=crowdedEffects(w);
      drawGroundFields(g,w,false,busy);drawExtraSpell(g,w,true,false,busy);
      drawProjectiles(g,w,false,busy);drawExtraSpell(g,w,false,false,busy);
      updateParticles(g,0,false);
      const x=capture*350,y=row*200+28,id=`c${row}_${capture}`;
      content+=`<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="350" height="198"/></clipPath></defs>
        <rect x="${x}" y="${y}" width="350" height="198" fill="${row%2?'#293139':'#30383f'}"/>
        <g clip-path="url(#${id})"><g transform="translate(${x+175} ${y+110}) scale(${390/720} ${-390/720})">${g.toSVG()}</g></g>
        <text x="${x+8}" y="${y+16}" fill="#e3dbc0" font-size="11">${build.join(' + ')||'base'} | ${times[capture].toFixed(2)}s</text>`;
      report.push({skill,mods:build,time:times[capture],casts:w.castCounts[skill]||0,
        submissions:g.commands.length,vertices:g.vertexCount,visible:g.commands.length>0,
        geometry:createHash("sha256").update(JSON.stringify(g.commands.map(({op,d,width})=>({op,d,width})))).digest("hex")});capture++;
    }
    row++;
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${times.length*350}" height="${row*200+28}"><rect width="${times.length*350}" height="100%" fill="#10191e"/>
    <g font-family="sans-serif"><text x="10" y="19" fill="#e5dcc0" font-size="13">${skill} | all legal builds | actual armory, stationary targets | game scale | offline painter</text>${content}</g></svg>`;
  fs.writeFileSync(`${out}/${skill}.svg`,svg);await sharp(Buffer.from(svg)).png().toFile(`${out}/${skill}.png`);
}
const keys=[...new Set(report.map(r=>`${r.skill}:${r.mods.join('+')}`))];
const missing=keys.filter(key=>!report.some(r=>`${r.skill}:${r.mods.join('+')}`===key&&r.visible));
const signature=(skill,mods)=>report.filter(r=>r.skill===skill&&r.mods.join('+')===mods.join('+')).map(r=>r.geometry).join(':');
const unchangedSingles=[];
for(const skill of WEAPONS)for(const mod of MODS[skill])if(signature(skill,[])===signature(skill,[mod.id]))unchangedSingles.push({skill,mod:mod.id});
fs.writeFileSync(`${out}/report.json`,JSON.stringify({configurations:report.length/times.length,frames:report.length,missing,unchangedSingles,records:report},null,2));
console.log(JSON.stringify({configurations:report.length/times.length,frames:report.length,missing,unchangedSingles,out}));
if(missing.length)process.exitCode=1;
