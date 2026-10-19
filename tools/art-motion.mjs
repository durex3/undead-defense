/** Controlled runtime-painter poses, not a recording of a played game. */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
execFileSync(process.execPath,["tools/test-build.mjs"],{stdio:"inherit"});
const {Graphics}=await import("../temp/tests/node_modules/cc/index.mjs");
const {drawActorLayer,drawEnemyWarnings}=await import("../temp/tests/presentation/art/EnemyPainter.mjs");
const {drawExtraSpell}=await import("../temp/tests/presentation/art/spells/ExtraSpellArt.mjs");
const {makeWorld,addEnemy,makeExtra,makeHazard}=await import("./art-fixtures.mjs");
const out="artifacts/art-review";fs.mkdirSync(out,{recursive:true});
const rawFrames=[],frames=36,width=900,height=410;
for(let f=0;f<frames;f++) {
  const t=f/12;
  let content="";
  for(const [col,kind] of ["siegebone","siegeflag","boss","lightning"].entries()) {
    const w=makeWorld(1,{time:3+t});const g=new Graphics();
    if(kind!=="lightning") {
      const e=addEnemy(w,kind,{fields:{facing:0}});
      if(kind==="siegebone") {if(t>2.2&&t<2.8)e.freezeUntil=w.time+1;}
      else if(t>=1&&t<2) {
        e.state="windup";e.timer=Math.max(.05,1.65-t);
        if(t>=1.65) w.hazards=[makeHazard("circle",{source:e.id,due:w.time-.1,until:w.time+.3})];
      } else if(t>=2&&t<2.8) {e.state="recover";e.timer=2.8-t;}
      drawActorLayer(g,w,false,false);drawEnemyWarnings(g,w,false);
    } else {
      const age=t%1;
      w.armory.extra.attacks=[makeExtra("lightning",{age,index:2,phase:age<.45?1:2,
        next:age<.45?.45:.63,active:age<.63,mods:["echo"],points:[{x:-.55,y:0},{x:.55,y:.8}]})];
      drawExtraSpell(g,w,false,false);
    }
    const x=col*225+112;
    content+=`<defs><clipPath id="up${col}"><rect x="${col*225}" y="48" width="225" height="190"/></clipPath>
      <clipPath id="down${col}"><rect x="${col*225}" y="260" width="225" height="145"/></clipPath></defs>
      <text x="${col*225+12}" y="42" fill="#d5d6bf" font-size="15">${kind}</text>
      <g clip-path="url(#up${col})"><g transform="translate(${x} 230) scale(1 -1)">${g.toSVG()}</g></g>
      <g clip-path="url(#down${col})"><g transform="translate(${x} 378) scale(${390/720} ${-390/720})">${g.toSVG()}</g></g>`;
  }
  const label=t<1?"walk":t<1.65?"anticipation":t<2?"release":t<2.8?"settle / freeze":"walk";
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="900" height="410" fill="#303439"/>
    <path d="M0 236H900 M0 384H900 M225 27V410 M450 27V410 M675 27V410" stroke="#515953" stroke-width="1" opacity=".45"/>
    <rect width="900" height="25" fill="#111b20"/><g font-family="sans-serif"><text x="10" y="17" fill="#e5dcc0" font-size="12">Offline controlled poses | ${label} | upper: enlarged | lower: 844x390 scale | lightning: strike / echo / rest</text>${content}</g></svg>`;
  rawFrames.push(await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer());
  if([0,3,6,15,21,29].includes(f)) {
    fs.writeFileSync(`${out}/motion-${f}.svg`,svg);
    await sharp(Buffer.from(svg)).png().toFile(`${out}/motion-${f}.png`);
  }
}
await sharp(Buffer.concat(rawFrames),{raw:{width,height:height*frames,channels:4,pageHeight:height}})
  .gif({loop:0,delay:Array(frames).fill(83),colours:128,dither:0})
  .toFile(`${out}/motion-study.gif`);
const metadata=await sharp(`${out}/motion-study.gif`,{animated:true}).metadata();
fs.writeFileSync(`${out}/motion-study.json`,JSON.stringify({frames:metadata.pages,width:metadata.width,
  frameHeight:metadata.pageHeight,mode:"controlled offline poses; no simulation recording",source:"runtime TypeScript Graphics painters"},null,2));
console.log(JSON.stringify({frames:metadata.pages,file:`${out}/motion-study.gif`}));
