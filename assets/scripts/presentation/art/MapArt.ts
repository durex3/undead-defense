import {LIBRARY_BASES} from "../../battle/LibraryMap";
import {WIND_BASES} from "../../battle/WindMap";
import {ROOT_BASES} from "../../battle/RootMap";
import {PRISM_BASES} from "../../battle/PrismMap";
import { TIDE_BASES } from "../../battle/TideMap";
import { BELL_BASES } from "../../battle/BellMap";
import type { Graphics } from "cc";
import { SIEGE_WALLS } from "../../battle/SiegeMap";
import { SAND_ROCKS, SAND_NESTS } from "../../battle/SandMap";
import { THUNDER_BASES } from "../../battle/ThunderMap";
import { MOON_BASES } from "../../battle/MoonMap";
import { ink } from "./Ink";

type Point = [number, number];
const floors = ["", "#303439", "#674936", "#202e35", "#24382e", "#34303b", "#25383c", "#302d3b", "#303b32", "#293740", "#30343d"];
export const stageMapBackdrop = (stage: number) => floors[stage] || floors[1];
const grain = ["", "#454a4c", "#8c6345", "#374950", "#3c5140", "#554957", "#56665e", "#51485d", "#566052", "#52616a", "#575561"];
const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
function path(g: Graphics, p: Point[]) {
  g.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]);
  g.close();
}
function face(g: Graphics, p: Point[], color: string, alpha = 255) {
  path(g, p); g.fillColor = ink(color, alpha); g.fill();
}

/** Sparse wear, independent of gameplay RNG and away from the central court. */
function ambientMarks(g: Graphics,stage: number) {
  g.fillColor=ink(stage===1?"#929085":stage===2?"#3f302a":stage===3?"#91704e":"#7c8561",28);
  for(let i=0;i<96;i++) {
    const x=(hash(i,41)-.5)*2100,y=(hash(i,97)-.5)*2500;
    if(Math.hypot(x,y)<280)continue;
    const size=5+hash(i,13)*10;
    if(stage===4)path(g,[[x-size,y],[x,y+size*.35],[x+size*.7,y],[x,y-size*.25]]);
    else path(g,[[x-size,y-size*.25],[x+size*.5,y-size*.4],[x+size,y+size*.3],[x-size*.2,y+size*.5]]);
  }
  g.fill();
  if(stage===3) {
    g.strokeColor=ink("#9fb1a5",30);g.lineWidth=1.2;
    for(let i=0;i<64;i++) {
      const x=(hash(i,21)-.5)*2100,y=(hash(i,71)-.5)*2500;
      if(Math.hypot(x,y)<280)continue;
      g.moveTo(x,y);g.lineTo(x+12,y+8);g.moveTo(x+5,y-3);g.lineTo(x+14,y+3);
    }
    g.stroke();
  }
}

function organicObstacle(g: Graphics, stage: number, x: number, y: number, w: number, h: number) {
  g.fillColor=ink("#101814",65);g.ellipse(x+6,y-5,w+3,h+3);g.fill();
  if(stage===2) {
    // Chipped silhouette retains the collision bounds; bevels stay under 8px.
    const c=6;
    face(g,[[x-w+c,y-h],[x+w*.25,y-h],[x+w,y-h+c],[x+w-2,y+h*.4],
      [x+w-c,y+h],[x-w*.35,y+h],[x-w,y+h-c],[x-w+2,y-h*.25]],"#8c654b");
    g.strokeColor=ink("#3c302a");g.lineWidth=3;g.stroke();
    face(g,[[x-w+8,y+h-8],[x+w-13,y+h-9],[x+w*.55,y+h*.35],[x-w*.45,y+h*.2]],"#b38a61");
    face(g,[[x+w-6,y+h-10],[x+w-4,y-h+8],[x-w+8,y-h+5],
      [x-w*.35,y-h*.55],[x+w*.6,y-h*.4]],"#694738");
    face(g,[[x-w+9,y+h*.45],[x-w*.25,y+h*.3],[x-w*.4,y-h*.6],[x-w+9,y-h*.2]],"#a67b56",180);
    g.strokeColor=ink("#4b362c",170);g.lineWidth=2;
    g.moveTo(x-w+10,y+h*.25);g.lineTo(x+w*.14,y+h*.05);g.lineTo(x+w*.36,y-h*.35);
    g.moveTo(x+w*.14,y+h*.05);g.lineTo(x+w-10,y+h*.4);g.stroke();
  } else {
    // Cylindrical cut trunk with bark flutes, roots and an elliptical end grain.
    face(g,[[x-w+5,y+h-17],[x-w*.7,y+h],[x+w*.7,y+h],[x+w-5,y+h-17],
      [x+w*.78,y-h*.5],[x+w,y-h+3],[x+w*.3,y-h],[x-w*.4,y-h],[x-w,y-h+3],[x-w*.78,y-h*.4]],"#5b6150");
    g.strokeColor=ink("#223026");g.lineWidth=3;g.stroke();
    face(g,[[x-w+10,y+h-20],[x-w*.3,y+h-22],[x-w*.3,y-h+8],[x-w+8,y-h+10]],"#7c8167");
    face(g,[[x+w*.4,y+h-20],[x+w-9,y+h-20],[x+w*.65,y-h*.5],[x+w-6,y-h+7],[x+w*.2,y-h+4]],"#3b4b39");
    g.strokeColor=ink("#303e2e",170);g.lineWidth=2;
    for(const i of [-2,-1,1,2]) {
      g.moveTo(x+i*w*.25,y-h+12);g.quadraticCurveTo(x+i*w*.25-7,y,x+i*w*.25,y+h-30);
    }
    g.stroke();g.fillColor=ink("#92947a");g.ellipse(x,y+h-18,w-7,17);g.fill();
    g.strokeColor=ink("#5a654e",190);g.lineWidth=1.5;
    g.ellipse(x-2,y+h-18,w*.58,11);g.ellipse(x-4,y+h-18,w*.32,6);g.stroke();
    g.moveTo(x+9,y+h-17);g.lineTo(x+w-11,y+h-13);g.stroke();
  }
}

/** Static, seeded scenery. Obstacle faces use the original collision extents.
 * Detail is batched and deliberately quieter than actors and hazard edges. */
export function drawInkMap(g: Graphics, stage: number) {
  g.fillColor = ink(floors[stage]);
  g.rect(-1152, -1344, 2304, 2688); g.fill();
  // Broken flagstones, wind-carved sand, recessed metal and tufts share an
  // irregular rhythm instead of a high-contrast square grid.
  g.fillColor = ink(grain[stage], stage === 2 ? 75 : stage === 3 ? 42 : 48);
  for (let row = -16; row <= 16; row++) for (let col = -15; col <= 15; col++) {
    const n = hash(col, row), x = col * 78 + (row % 2) * 35 + n * 52, y = row * 84 + hash(row,col)*62;
    if (stage === 1) {
      if(n<.18) continue;
      const w=21+n*14,h=19+hash(row,col)*17;
      path(g, [[x-w,y-h],[x+w*.7,y-h+3],[x+w,y-h*.6],[x+w*.8,y+h],[x-w*.7,y+h-3],[x-w,y+h*.2]]);
    }
    else if (stage === 2) path(g, [[x-34,y],[x-8,y+10],[x+34,y+4],[x+12,y+2],[x-5,y+5]]);
    else if (stage === 3) path(g, [[x-32,y-32],[x+29,y-32],[x+29,y+23],[x+19,y+32],[x-32,y+32]]);
    else if(stage===10) path(g,[[x-28,y-14],[x+22,y-14],[x+26,y+13],[x-25,y+16]]);
    else if(stage===9) path(g,[[x-28,y-12],[x+24,y-12],[x+28,y+13],[x-25,y+15]]);
    else if(stage===8) path(g,[[x-18,y-4],[x+18,y-4],[x+22,y+5],[x-14,y+7]]);
    else if(stage===7) path(g,[[x-26,y],[x-12,y+12],[x+23,y+5],[x+30,y-4],[x-8,y-8]]);
    else if(stage===6) path(g,[[x-34,y-4],[x+34,y-4],[x+34,y+2],[x-34,y+2]]);
    else if(stage===5) path(g,[[x-16,y-3],[x-6,y+5],[x+15,y+3],[x+20,y-4],[x+3,y-7]]);
    else if (n > 0.3) path(g, [[x-8,y],[x-12,y+14+n*8],[x-3,y+7],[x+2,y+22],[x+6,y+5],[x+14,y+13],[x+9,y-2]]);
  }
  g.fill();
  ambientMarks(g,stage);
  if(stage===1 || stage===2 || stage===3) {
    g.strokeColor=ink(stage===2?"#bf9162":stage===1?"#83918b":"#73938e",stage===3?24:32);g.lineWidth=1.5;
    for(let row=-15;row<=15;row++) for(let col=-14;col<=14;col++) {
      const n=hash(col,row);if(n<.62) continue;
      const x=col*78+(row%2)*35+n*24,y=row*84+hash(row,col)*28;
      g.moveTo(x-18,y+20);g.lineTo(x+3,y+23);g.lineTo(x+13,y+14);
      if(stage===1) {g.moveTo(x-3,y-7);g.lineTo(x+3,y+2);g.lineTo(x+12,y+4);}
    }
    g.stroke();
  }
  // Wide worn routes with soft contrast; no painted gameplay boundary.
  g.strokeColor = ink(stage === 2 ? "#ad8055" : stage === 4 ? "#61715a" : "#7e8580", 25);
  g.lineWidth = 100;
  for (const side of [-1, 1]) {
    g.moveTo(side * 900, -1100);
    g.quadraticCurveTo(side * 270, -400, side * 360, 0);
    g.quadraticCurveTo(side * 480, 650, side * 850, 1150);
  }
  g.stroke();
  if (stage === 3) {
    g.strokeColor = ink("#6a9b91", 48); g.lineWidth = 2;
    for (const side of [-1, 1]) {
      g.moveTo(side * 340, -1250); g.lineTo(side * 340, -160);
      g.lineTo(side * 220, -40); g.lineTo(side * 220, 1250);
    }
    g.stroke();
  }
  if (stage === 2) for (const nest of SAND_NESTS) {
    const x = nest.x * 48, y = nest.y * 48;
    g.fillColor = ink("#362c29", 110); g.ellipse(x, y, 48, 31); g.fill();
    g.strokeColor = ink("#a97d54", 125); g.lineWidth = 4;
    g.moveTo(x+48,y); g.arc(x,y,48,0,Math.PI*2,false); g.stroke();
  }
  const obstacles = stage === 10 ? LIBRARY_BASES : stage === 9 ? WIND_BASES : stage === 8 ? ROOT_BASES : stage === 7 ? PRISM_BASES : stage === 6 ? TIDE_BASES : stage === 5 ? BELL_BASES : stage === 1 ? SIEGE_WALLS : stage === 2 ? SAND_ROCKS : stage === 3 ? THUNDER_BASES : MOON_BASES;
  for (const b of obstacles) {
    const x = b.x * 48, y = b.y * 48, w = b.halfWidth * 48, h = b.halfHeight * 48;
    if(stage===10){
      g.fillColor=ink("#14151d",100);g.rect(x-w+7,y-h-7,w*2,h*2);g.fill();
      face(g,[[x-w,y-h],[x+w,y-h],[x+w,y+h],[x-w,y+h]],"#705846");
      g.strokeColor=ink("#211c24");g.lineWidth=4;g.rect(x-w,y-h,w*2,h*2);g.stroke();
      face(g,[[x-w+6,y+h-5],[x+w-6,y+h-5],[x+w-12,y+h-19],[x-w+12,y+h-19]],"#aa8d65");
      const vertical=h>w,span=vertical?h:w;
      for(let i=-span+20;i<span-15;i+=24){
        g.fillColor=ink(Math.floor((i+span)/24)%3===0?"#8a7784":"#a3977d");
        if(vertical)g.rect(x-w+13,y+i,w*2-26,16);else g.rect(x+i,y-h+12,16,h*2-29);g.fill();
      }
      g.strokeColor=ink("#362b2e");g.lineWidth=3;g.rect(x-w+10,y-h+8,w*2-20,h*2-31);g.stroke();
      continue;
    }
    if(stage===9){
      g.fillColor=ink("#101b24",110);g.rect(x-w+6,y-h-6,w*2,h*2);g.fill();
      face(g,[[x-w,y-h],[x+w,y-h],[x+w,y+h],[x-w,y+h]],"#999c91");
      g.strokeColor=ink("#18242d");g.lineWidth=4;g.rect(x-w,y-h,w*2,h*2);g.stroke();
      face(g,[[x-w+6,y-h+7],[x-w+6,y+h-6],[x+w-6,y+h-6],[x+w-15,y+h-18],[x-w+17,y+h-20],[x-w+17,y-h+7]],"#cec6ae");
      face(g,[[x+w-12,y-h+5],[x+w-5,y+h-8],[x+w-20,y+h-20],[x+w-20,y-h+5]],"#657581");
      g.strokeColor=ink("#77634e");g.lineWidth=3;
      for(const side of [-1,1]){g.moveTo(x+side*w*.45,y-h+9);g.lineTo(x+side*w*.45,y+h-22);}g.stroke();
      g.strokeColor=ink("#344752",160);g.lineWidth=2;g.moveTo(x-w+20,y+10);g.lineTo(x+5,y+18);g.lineTo(x+16,y-3);g.stroke();continue;
    }
    if(stage===8){
      face(g,[[x-w,y-h],[x+w,y-h],[x+w,y+h],[x-w,y+h]],"#766b54");g.strokeColor=ink("#19251b");g.lineWidth=4;g.rect(x-w,y-h,w*2,h*2);g.stroke();
      face(g,[[x-w+7,y-h+7],[x+w-7,y-h+7],[x+w-7,y+h-7],[x-w+7,y+h-7]],"#414f39");
      g.strokeColor=ink("#a29776");g.lineWidth=5;g.moveTo(x-w,y+h);g.lineTo(x+w*.4,y+h);g.moveTo(x+w,y-h);g.lineTo(x-w*.3,y-h);g.stroke();
      g.strokeColor=ink("#8a946b",140);g.lineWidth=3;for(let i=-1;i<=1;i++){g.moveTo(x+i*w*.5,y-h+12);g.lineTo(x+i*w*.3+8,y+h-12);}g.stroke();continue;
    }
    if(stage===7){
      g.fillColor=ink('#151220',120);g.rect(x-w+5,y-h-5,w*2,h*2);g.fill();
      face(g,[[x-w,y-h],[x+w,y-h],[x+w,y+h],[x-w,y+h]],'#635875');g.strokeColor=ink('#1b1727');g.lineWidth=4;g.rect(x-w,y-h,w*2,h*2);g.stroke();
      face(g,[[x-w+4,y-h+5],[x-5,y+8],[x-w+4,y+h-5]],'#96869f');
      face(g,[[x-w+4,y+h-4],[x+w-4,y+h-4],[x+5,y+8],[x-5,y+8]],'#b1a2b5');
      face(g,[[x+5,y+8],[x+w-4,y+h-4],[x+w-4,y-h+4]],'#49405d');
      g.strokeColor=ink('#c8ad86',180);g.lineWidth=2;g.rect(x-w+3,y-h+3,w*2-6,h*2-6);g.stroke();continue;
    }
    if(stage===6){
      g.fillColor=ink('#101b20',130);g.rect(x-w+5,y-h-6,w*2,h*2);g.fill();
      face(g,[[x-w,y-h],[x+w,y-h],[x+w,y+h],[x-w,y+h]],'#735c48');
      g.strokeColor=ink('#182529');g.lineWidth=4;g.rect(x-w,y-h,w*2,h*2);g.stroke();
      face(g,[[x-w+4,y+h-4],[x+w-4,y+h-4],[x+w-13,y+h-18],[x-w+13,y+h-18]],'#aa9070');
      g.strokeColor=ink('#323c38');g.lineWidth=6;
      for(const side of [-1,1]){g.moveTo(x+side*w*.65,y-h+5);g.lineTo(x+side*w*.65,y+h-6);}
      g.stroke();g.strokeColor=ink('#ba9564');g.lineWidth=3;g.moveTo(x-w+10,y-h+12);g.lineTo(x+w-10,y+h-22);g.moveTo(x+w-10,y-h+12);g.lineTo(x-w+10,y+h-22);g.stroke();continue;
    }
    if(stage===5){
      g.fillColor=ink('#14151b',110);g.rect(x-w+5,y-h-6,w*2,h*2);g.fill();
      face(g,[[x-w,y-h],[x+w,y-h],[x+w,y+h],[x-w,y+h]],'#736c73');
      g.strokeColor=ink('#1a1a23');g.lineWidth=4;g.rect(x-w,y-h,w*2,h*2);g.stroke();
      face(g,[[x-w+4,y+h-4],[x+w-4,y+h-4],[x+w-14,y+h-20],[x-w+14,y+h-20]],'#b4a58b');
      face(g,[[x-w+8,y-h+8],[x-w+12,y+h-24],[x-w+27,y+h-24],[x-w+21,y-h+22]],'#d3c5a1');
      g.fillColor=ink('#9c8964');g.ellipse(x,y+8,w*.65,h*.45);g.fill();g.strokeColor=ink('#dcc58d');g.lineWidth=4;g.moveTo(x-w*.6,y+6);g.lineTo(x+w*.6,y+6);g.stroke();continue;
    }
    if(stage===2 || stage===4) { organicObstacle(g,stage,x,y,w,h);continue; }
    g.fillColor = ink("#090f13", 80); g.rect(x-w+7,y-h-9,w*2,h*2); g.fill();
    const edge = "#18242b";
    const base = stage === 1 ? "#626364" : "#41545b";
    const light = stage === 1 ? "#85877f" : "#6e8588";
    const shade = stage === 1 ? "#434c52" : "#2b3b44";
    // Full footprint stays visibly solid, including all four corners.
    g.fillColor = ink(base); g.rect(x-w,y-h,w*2,h*2); g.fill();
    g.strokeColor = ink(edge); g.lineWidth = 3; g.rect(x-w,y-h,w*2,h*2); g.stroke();
    face(g, [[x-w+3,y+h-3],[x+w-3,y+h-3],[x+w-14,y+h-17],[x-w+14,y+h-17]], light);
    face(g, [[x+w-3,y+h-3],[x+w-3,y-h+3],[x-w+3,y-h+3],[x-w+14,y-h+16],[x+w-15,y-h+16],[x+w-15,y+h-17]], shade);
    g.strokeColor = ink(edge, 120); g.lineWidth = 2;
      for (let yy = y-h+40; yy < y+h-20; yy += stage === 1 ? 38 : 70) {
        g.moveTo(x-w+8,yy); g.lineTo(x+w-8,yy);
        if (stage === 1) { g.moveTo(x,yy); g.lineTo(x,yy+30); }
      }
      g.stroke();
      if (stage === 3) {
        g.strokeColor = ink("#9db8aa", 170); g.lineWidth = 3;
        g.moveTo(x-w+15,y+h-23); g.lineTo(x-w+15,y+8); g.lineTo(x-8,y-8); g.stroke();
      }
  }
}
