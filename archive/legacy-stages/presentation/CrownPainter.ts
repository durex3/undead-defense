import { Graphics,Color } from 'cc';
import { CROWN_STONES } from '../battle/CrownSystem';
import { ALTAR_ZONES } from '../battle/AltarSystem';
import { CHURCH_BELLS } from '../battle/ChurchSystem';
export function drawCrown(g:Graphics){
 const fill=(hex:string)=>g.fillColor=new Color(hex);
 fill('#201d2c');g.rect(-1152,-1344,2304,2688);g.fill();
 for(let y=-27;y<28;y++)for(let x=-23;x<24;x++){
  fill(Math.abs(x)<3?'#49333e':(x+y)%3?'#302b3d':'#383043');g.rect(x*48+2,y*48+2,44,44);g.fill();
 }
 g.strokeColor=new Color('#7c6756');g.lineWidth=2;
 for(const p of ALTAR_ZONES){g.circle(p.x*48,p.y*48,192);g.stroke();}
 for(const p of CHURCH_BELLS){g.circle(p.x*48,p.y*48,35);g.stroke();}
 for(const p of CROWN_STONES){const x=p.x*48,y=p.y*48;fill('#ac9c86');g.roundRect(x-22,y-18,44,72,8);g.fill();fill('#292336');g.circle(x-9,y+30,7);g.circle(x+9,y+30,7);g.fill();}
 fill('#776044');g.roundRect(-115,900,230,180,12);g.fill();fill('#512e3c');g.roundRect(-80,920,160,140,8);g.fill();
 fill('#bc9b60');g.moveTo(-70,1060);g.lineTo(-90,1120);g.lineTo(-35,1090);g.lineTo(0,1140);g.lineTo(35,1090);g.lineTo(90,1120);g.lineTo(70,1060);g.close();g.fill();
 for(const x of [-900,900])for(const y of [-800,0,800]){fill('#785045');g.rect(x,y,5,120);g.fill();fill('#633343');g.moveTo(x+5,y+120);g.lineTo(x+65,y+120);g.lineTo(x+50,y+40);g.lineTo(x+5,y+55);g.close();g.fill();}
}
