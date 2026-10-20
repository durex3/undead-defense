/** Controlled output comparisons and offline runtime motion previews, not human playtests. */
import fs from 'node:fs';
import sharp from 'sharp';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {Armory} from '../temp/tests/battle/Armory.mjs';
import {weaponStats} from '../temp/tests/battle/ArmoryConfig.mjs';
import {ALL_WEAPONS} from '../temp/tests/battle/SurvivalConfig.mjs';
import {BattlePainter} from '../temp/tests/presentation/BattlePainter.mjs';
import {Graphics} from '../temp/tests/node_modules/cc/index.mjs';
const source=fs.readFileSync('temp/tests/battle/Armory.mjs','utf8');
const baseline=source.replace('step = Math.min(d, speed * dt)','step = Math.min(d, 3.8 * dt)')
  .replace('(child ? 12 : 22)','(child ? 7 : 7)');
if(baseline===source)throw Error('Baseline controls did not apply');
fs.writeFileSync('temp/tests/battle/ArmoryBaseline.mjs',baseline);
const {Armory:Baseline}=await import('../temp/tests/battle/ArmoryBaseline.mjs');
const world=()=>{const w=new SurvivalWorld(19,'ranger',1);w.player={x:0,y:0};w.camera={...w.player};for(const s of ALL_WEAPONS)w.skills[s]=0;return w;};
const enemy=(w,x,y=0,hp=1e6)=>{const e=w.addEnemy('minion',x,y);Object.assign(e,{state:'seek',hp,maxHp:hp});return e;};
function impact(Engine) {
  const w=world();w.armory=new Engine(w);w.skills.fire=w.skills.bone=1;enemy(w,6);
  w.armory.step(0);for(const s of ALL_WEAPONS)w.cooldowns[s]=100;
  const times={};
  for(let i=1;i<=180;i++){w.time=i/120;w.armory.step(1/120);for(const s of ['fire','bone'])if(w.damage[s]>0&&times[s]===undefined)times[s]=Number(w.time.toFixed(3));}
  return times;
}
function water(Engine,recall,legacy=false,speed=1.55) {
  const w=world();w.armory=new Engine(w);w.mods.water=recall?['recall']:[];
  const s=weaponStats(w,'water',8);if(legacy)s.duration*=.85;
  const e=enemy(w,7);w.armory.addField('water',{x:6,y:0},0,s);
  for(let i=1;i<=600;i++){w.time=i/120;e.x=Math.max(.7,e.x-speed/120);w.armory.step(1/120);}
  return Number((w.damage.water||0).toFixed(2));
}
const out='artifacts/weapon-feedback';fs.mkdirSync(out,{recursive:true});
const report={scope:'One seed, fixed stationary hero and high-HP scripted targets. Fire/bone single cast. Water single field with identical damage, old recall 85% duration. Offline painter, no browser/phone validation.',
  impact:{before:impact(Baseline),after:impact(Armory)},
  water:[1.5,1.55,1.7,1.75].map(speed=>({speed,stationary:water(Armory,false,false,speed),oldRecall:water(Baseline,true,true,speed),newRecall:water(Armory,true,false,speed)})),clips:[]};
for(const skill of ['blade','water','lightning']) {
  const w=world();w.skills[skill]=8;
  w.mods[skill]=skill==='blade'?['hunt','shards']:skill==='water'?['recall','pulse']:['relay','bridge'];
  for(let i=0;i<8;i++)enemy(w,3+i*.6,(i%3-1)*1.2);
  const g=new Graphics(),painter=new BattlePainter(g);painter.reset();const raw=[],tiles=[];
  for(let frame=0;frame<300;frame++) {
    w.time+=1/60;
    for(const e of w.enemies) {const d=Math.hypot(e.x,e.y);if(d>.7){e.x-=e.x/d*1.55/60;e.y-=e.y/d*1.55/60;}}
    w.armory.step(1/60);
    if(frame%6)continue;
    painter.draw(w,.1,w.drain(),false);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="844" height="390"><rect width="844" height="390" fill="#233a32"/><g transform="translate(230 210) scale(.65 -.65)">${g.toSVG()}</g><text x="12" y="22" fill="white" font-size="15">${skill} - ${w.time.toFixed(1)}s - offline runtime</text></svg>`;
    raw.push(await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer());
    if([2,4,6,8,10,12,16,24,32,42].includes(raw.length-1)) {
      const image=await sharp(Buffer.from(svg)).resize(422,195).png().toBuffer();
      const i=tiles.length;tiles.push({input:image,left:(i%2)*422,top:Math.floor(i/2)*195});
    }
  }
  await sharp(Buffer.concat(raw),{raw:{width:844,height:390*raw.length,channels:4,pageHeight:390}}).gif({loop:0,delay:100,colours:128}).toFile(`${out}/${skill}.gif`);
  await sharp({create:{width:844,height:975,channels:4,background:'#233a32'}}).composite(tiles).png().toFile(`${out}/${skill}-motion.png`);
  report.clips.push({skill,frames:raw.length,file:`${skill}.gif`});
}
fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
