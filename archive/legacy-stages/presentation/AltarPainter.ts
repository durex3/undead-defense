import { Graphics, Color } from 'cc';
import { ALTAR_ZONES, ALTAR_RADIUS } from '../battle/AltarSystem';
import { ALTAR_STONES } from '../battle/GardenMap';
export function drawAltar(g: Graphics) {
 const fill=(hex:string)=>g.fillColor=new Color().fromHEX(hex);
 fill('#24212b');g.rect(-1152,-1344,2304,2688);g.fill();
 for(let y=-27;y<28;y++)for(let x=-23;x<24;x++){
  fill(Math.abs(x)<3||Math.abs(y)<3?'#49404a':(x+y)%3?'#302b35':'#38303b');
  g.rect(x*48+2,y*48+2,44,44);g.fill();
  if((x*7+y*11)%9===0){fill('#654143');g.rect(x*48+9,y*48+8,2,24);g.rect(x*48+9,y*48+8,20,2);g.fill();}
 }
 for(const p of ALTAR_ZONES){
  fill('#482d35');g.circle(p.x*48,p.y*48,ALTAR_RADIUS*48);g.fill();
  g.strokeColor=new Color('#a96550');g.lineWidth=3;g.circle(p.x*48,p.y*48,ALTAR_RADIUS*48);g.stroke();
  g.circle(p.x*48,p.y*48,42);g.stroke();
 }
 g.strokeColor=new Color('#bb8b68');g.lineWidth=4;g.circle(0,0,100);g.stroke();g.circle(0,0,120);g.stroke();
 for(const p of ALTAR_STONES){
  fill('#171923');g.circle(p.x*48,p.y*48,1.05*48);g.fill();
  fill('#afa293');g.roundRect(p.x*48-20,p.y*48-15,40,64,8);g.fill();
  fill('#3a2931');g.circle(p.x*48-8,p.y*48+28,6);g.circle(p.x*48+8,p.y*48+28,6);g.fill();
 }
}
