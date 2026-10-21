import fs from 'node:fs';
import sharp from 'sharp';
import {Graphics} from '../temp/tests/node_modules/cc/index.mjs';
import {drawHeroBody} from '../temp/tests/presentation/art/HeroPainter.mjs';
import {drawActorLayer} from '../temp/tests/presentation/art/EnemyPainter.mjs';
import {makeWorld,addEnemy} from './art-fixtures.mjs';
const out='artifacts/characters-0.33.5';fs.mkdirSync(out,{recursive:true});
const pieces=[];
for(const [i,kind] of ['siegebone','thornshield','siegebow','flanker'].entries()){
 const w=makeWorld(1);addEnemy(w,kind);const g=new Graphics();drawActorLayer(g,w,false,false);
 pieces.push(`<g transform="translate(${120+i*210},225) scale(2.4,-2.4)">${g.toSVG()}</g><text x="${120+i*210}" y="255">${kind}</text>`);
}
for(const [i,id] of ['ranger','alchemist','necromancer'].entries()){
 const w=makeWorld(1,{character:id});const g=new Graphics();drawHeroBody(g,w);
 pieces.push(`<g transform="translate(${170+i*270},465) scale(2.5,-2.5)">${g.toSVG()}</g><text x="${170+i*270}" y="500">${id}</text>`);
 const small=new Graphics();w.move={x:-1,y:0};w.time=1;drawHeroBody(small,w);
 pieces.push(`<g transform="translate(${215+i*270},465) scale(.65,-.65)">${small.toSVG()}</g>`);
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="880" height="540"><rect width="880" height="540" fill="#313b46"/><g fill="#e5ddca" text-anchor="middle" font-family="Arial" font-size="17">${pieces.join('')}</g></svg>`;
fs.writeFileSync(out+'/characters.svg',svg);await sharp(Buffer.from(svg)).png().toFile(out+'/characters.png');
fs.writeFileSync(out+'/manifest.json',JSON.stringify({version:'0.33.5',engine:'Cocos Creator 3.8.8',renderer:'Graphics vector ink',worldUnitPixels:48,pivot:'feet',source:'Project-authored procedural geometry; no external images',assets:[{ids:['siegebone','thornshield','siegebow'],source:'assets/scripts/presentation/art/enemies/SiegeArt.ts',catalog:'assets/scripts/presentation/art/EnemyCatalog.ts',change:'Exposed chipped skulls and revenant equipment'},{ids:['ranger','alchemist','necromancer'],source:'assets/scripts/presentation/art/HeroPainter.ts',change:'Independent adventurer silhouettes, material blocks and equipment'}],preview:'characters.png',runtimeEvidence:'../save-recovery/stage-one-redesign.png',collision:'Gameplay collision and damage unchanged'},null,2)+'\n');
