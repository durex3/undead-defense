/** Offline runtime painter review. Not a browser or human playtest. */
import fs from 'node:fs';
import sharp from 'sharp';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {stepEnemies,stepHazards} from '../temp/tests/battle/EnemySystem.mjs';
import {Graphics} from '../temp/tests/node_modules/cc/index.mjs';
import {BattlePainter} from '../temp/tests/presentation/BattlePainter.mjs';
import {drawStageMap} from '../temp/tests/presentation/StageMapPainter.mjs';
const out='artifacts/boss-readability';fs.mkdirSync(out,{recursive:true});
const report=[], tiles=[];
for(let stage=1;stage<=10;stage++) {
  const w=new SurvivalWorld(19,'ranger',stage);w.time=360;w.hp=w.maxHp=1e8;
  w.player={x:0,y:0};w.camera={...w.player};
  const b=w.addEnemy('boss',3,0);b.state='seek';b.attack=0;b.visibleSince=358;
  if(stage===4)b.pattern=1;
  const g=new Graphics(),ground=new Graphics(),painter=new BattlePainter(g);
  drawStageMap(ground,stage);painter.reset();
  let captured=false;
  for(let frame=0;frame<60*30;frame++) {
    w.time+=1/60;w.stageStrategy.clean();stepEnemies(w,1/60);stepHazards(w);
    const h=w.hazards.find(h=>h.source===b.id&&h.created<=w.time&&h.due-w.time>.2);
    if(!h)continue;
    // Sample close to release so that the countdown is visible.
    w.time=Math.max(w.time,h.due-.25);
    painter.draw(w,1/60,[],false);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="844" height="390"><g transform="translate(422 220) scale(.54 -.54)">${ground.toSVG()}${g.toSVG()}</g><rect width="844" height="28" fill="#111820"/><text x="12" y="20" fill="white" font-family="sans-serif" font-size="15">Stage ${stage} - warning - offline runtime painter</text></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(`${out}/stage-${stage}.png`);
    tiles.push({input:await sharp(Buffer.from(svg)).resize(633,293).toBuffer(),left:((stage-1)%2)*633,top:Math.floor((stage-1)/2)*293});
    report.push({stage,maxHp:b.maxHp,skill:h.damageLabel,warningSeconds:h.due-h.created,vertices:g.vertexCount});
    captured=true;break;
  }
  if(!captured)throw Error(`No real boss warning captured: ${stage}`);
}
await sharp({create:{width:1266,height:1465,channels:4,background:'#111820'}}).composite(tiles).png().toFile(`${out}/contact-sheet.png`);
fs.writeFileSync(`${out}/report.json`,JSON.stringify({scope:'Real boss casts, offline runtime painter at phone landscape size; no browser/human validation.',stages:report},null,2));
console.log(JSON.stringify(report));
