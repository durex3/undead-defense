import fs from 'node:fs';
import sharp from 'sharp';
import { Graphics } from '../temp/tests/node_modules/cc/index.mjs';
import { SurvivalWorld } from '../temp/tests/battle/SurvivalWorld.mjs';
import { ALL_WEAPONS } from '../temp/tests/battle/SurvivalConfig.mjs';
import { drawWeaponGlyph } from '../temp/tests/presentation/art/WeaponGlyph.mjs';
import { BattlePainter } from '../temp/tests/presentation/BattlePainter.mjs';
const out='artifacts/weapon-progression';fs.mkdirSync(out,{recursive:true});
const forms=[['blade',1],['blade',2],['blade',3],['blade',4],['hammer',2],['hammer',3],['hammer',4],['lamp',3],['needle',4]];
const parts=[];
for(const [i,[skill,grade]] of forms.entries()){
 const g=new Graphics();drawWeaponGlyph(g,skill,grade);
 parts.push(`<g transform="translate(${80+i%5*160} ${85+Math.floor(i/5)*155})"><g transform="scale(1.7 -1.7)">${g.toSVG()}</g><text y="64" text-anchor="middle" fill="#dddece" font-family="sans-serif" font-size="14">${skill} ${grade}</text></g>`);
}
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="330"><rect width="800" height="330" fill="#29323d"/>${parts.join('')}</svg>`)).png().toFile(out+'/forms.png');
const w=new SurvivalWorld(17,'ranger',10);w.level=64;w.player=w.camera={x:0,y:0};w.viewport={x:16,y:8};
for(const s of ALL_WEAPONS)w.skills[s]=0;
for(const s of ['blade','hammer','lamp','needle'])w.skills[s]=8;
w.weaponGrades.blade=w.weaponGrades.hammer=4;
w.mods.blade=['orbit','return'];w.mods.hammer=['rift','return'];w.mods.lamp=['wide','linger'];w.mods.needle=['deep','barb'];
for(let i=0;i<100;i++){const e=w.addEnemy(i===0?'sealprovost':i===1?'claspjailer':'paperbonegrub',(i%10-5)*1.1,(Math.floor(i/10)-5)*.7);e.state='seek';e.hp=e.maxHp=1e9;}
let maxVertices=0,maxCommands=0;
for(let i=0;i<360;i++){
 w.time+=1/60;w.armory.step(1/60);
 if(i%6===0){const g=new Graphics();new BattlePainter(g).draw(w,1/10,w.drain(),false);maxVertices=Math.max(maxVertices,g.vertexCount);maxCommands=Math.max(maxCommands,g.commands.length);if(g.vertexCount>45000)throw Error('Visual budget exceeded');}
}
const report={forms:forms.length,enemies:w.enemies.length,maxVertices,maxCommands,budget:45000};fs.writeFileSync(out+'/art-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
