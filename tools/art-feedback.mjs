/** Runtime painters sampled offline: hero readability and three impact tiers. No HUD/device evidence. */
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import sharp from "sharp";
execFileSync(process.execPath,["tools/test-build.mjs"],{stdio:"inherit"});
const {Graphics}=await import("../temp/tests/node_modules/cc/index.mjs");
const {BattlePainter}=await import("../temp/tests/presentation/BattlePainter.mjs");
const {spawnParticles,updateParticles,resetParticles}=await import("../temp/tests/presentation/art/SpellPainter.mjs");
const {makeWorld,makeField}=await import("./art-fixtures.mjs");
const out="artifacts/art-feedback";fs.mkdirSync(out,{recursive:true});
const raw=[],characters=["ranger","alchemist","necromancer"];
let maxVertices=0;
for(let frame=0;frame<24;frame++) {
  const age=frame/30,parts=[];let vertices=0;
  for(let col=0;col<3;col++) {
    const w=makeWorld(4,{character:characters[col],time:3+age,move:{x:-1,y:0}});
    w.armory.fields=Array.from({length:6},(_,i)=>makeField("water",{x:(i%3-1)*.55,y:(Math.floor(i/3)-.5)*.5,radius:.8}));
    const hero=new Graphics(),painter=new BattlePainter(hero);painter.reset();painter.draw(w,0,[]);
    vertices+=hero.vertexCount;
    parts.push(`<g transform="translate(${col*280+140} 152) scale(1 -1)">${hero.toSVG()}</g>`);
    const events=[{type:"hit",skill:"blade",x:0,y:0},{type:"explosion",skill:"fire",form:"heavy",radius:1,x:0,y:0},{type:"eliteDown",skill:"hornwarden",x:0,y:0}];
    resetParticles();spawnParticles([events[col]],false);
    for(let step=0;step<frame*2;step++)updateParticles(new Graphics(),1/60,false);
    const effect=new Graphics();updateParticles(effect,0,false);vertices+=effect.vertexCount;
    parts.push(`<g transform="translate(${col*280+140} 340) scale(1 -1)">${effect.toSVG()}</g>`);
    parts.push(`<text x="${col*280+18}" y="26" fill="#dfdcc4" font-size="15">${characters[col]} · crowded</text><text x="${col*280+18}" y="236" fill="#dfdcc4" font-size="15">${["ordinary hit","heavy impact","elite defeated"][col]} · ${age.toFixed(2)}s</text>`);
  }
  maxVertices=Math.max(maxVertices,vertices);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="840" height="420"><rect width="840" height="420" fill="#243b32"/>${parts.join("")}</svg>`;
  raw.push(await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer());
  if([2,6,12,23].includes(frame))await sharp(Buffer.from(svg)).png().toFile(`${out}/frame-${frame}.png`);
}
await sharp(Buffer.concat(raw),{raw:{width:840,height:420*raw.length,channels:4,pageHeight:420}}).gif({loop:0,delay:33,colours:128,dither:0}).toFile(`${out}/feedback.gif`);
fs.writeFileSync(`${out}/report.json`,JSON.stringify({scope:"Offline runtime painter, synthetic crowded fields, normal/reduced tests separately. No browser/HUD/phone evidence.",frames:24,maxVertices},null,2));
console.log(JSON.stringify({frames:24,maxVertices,out}));
