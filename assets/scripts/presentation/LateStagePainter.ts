import {isFrontier} from "../battle/FrontierMaps";
import {drawFrontierMap} from "./FrontierPainter";
import {HARBOR_CARGO} from "../battle/HarborMap";
import {ARSENAL_RACKS} from "../battle/ArsenalMap";
import {OBSERVATORY_BASES} from "../battle/ObservatoryMap";
import { FURNACE_STONES } from "../battle/FurnaceEncounters";
import { Graphics, Color } from 'cc';
import { CROWN_STONES } from '../battle/CrownSystem';
export function drawLateStage(g: Graphics, stage: number) {
  if(isFrontier(stage)){drawFrontierMap(g,stage);return;}
  if(stage===10){
    g.clear();g.fillColor=new Color('#191c30');g.rect(-1152,-1344,2304,2688);g.fill();
    for(let y=-27;y<28;y++)for(let x=-23;x<24;x++){g.fillColor=new Color((x+y)%3?'#292d43':'#30334c');g.rect(x*48+2,y*48+2,44,44);g.fill();}
    g.strokeColor=new Color('#535b7a');g.lineWidth=2;
    for(const r of [6,15,22]){g.circle(0,0,r*48);g.stroke();}
    for(const b of OBSERVATORY_BASES){
      g.fillColor=new Color('#4c4e68');g.rect((b.x-2)*48,-5*48,4*48,10*48);g.fill();
      g.strokeColor=new Color('#9b9fbd');g.lineWidth=3;g.rect((b.x-2)*48,-5*48,4*48,10*48);g.stroke();
      g.strokeColor=new Color('#777e9d');g.lineWidth=2;g.rect((b.x-1.65)*48,-4.65*48,3.3*48,9.3*48);g.stroke();
      for(const sy of [-3.5,3.5]){g.moveTo((b.x-1.65)*48,sy*48);g.lineTo((b.x+1.65)*48,sy*48);g.stroke();}
      g.strokeColor=new Color('#afb1cd');
      g.circle(b.x*48,0,64);g.stroke();
      for(let i=0;i<8;i++){const a=i*Math.PI/4;g.moveTo(b.x*48+Math.cos(a)*35,Math.sin(a)*35);g.lineTo(b.x*48+Math.cos(a)*74,Math.sin(a)*74);}g.stroke();
    }
    return;
  }
  if(stage===9){
    g.clear();g.fillColor=new Color('#25262c');g.rect(-1152,-1344,2304,2688);g.fill();
    for(let y=-27;y<28;y++)for(let x=-23;x<24;x++){
      g.fillColor=new Color((x+y)%3?'#38393e':'#414047');g.rect(x*48+2,y*48+2,44,44);g.fill();
    }
    for(const b of ARSENAL_RACKS){
      const x=(b.x-2.5)*48,y=(b.y-1.5)*48;
      g.fillColor=new Color('#625044');g.rect(x,y,240,144);g.fill();
      g.strokeColor=new Color('#a58b6c');g.lineWidth=3;g.rect(x,y,240,144);g.stroke();
      for(let i=0;i<6;i++){
        const sx=x+20+i*39;g.strokeColor=new Color('#c6c5bd');g.moveTo(sx,y+18);g.lineTo(sx,y+119);g.stroke();
        g.fillColor=new Color('#c6c5bd');g.moveTo(sx,y+125);g.lineTo(sx-6,y+107);g.lineTo(sx+6,y+107);g.close();g.fill();
      }
    }
    return;
  }
  if(stage===8){
    g.clear();g.fillColor=new Color("#172b35");g.rect(-1152,-1344,2304,2688);g.fill();
    g.strokeColor=new Color("#4a6268");g.lineWidth=2;
    for(let y=-26;y<=26;y++){g.fillColor=new Color(y%2?"#253d43":"#294148");g.rect(-22*48,y*48,44*48,46);g.fill();g.moveTo(-22*48,y*48);g.lineTo(22*48,y*48);for(let x=-20;x<22;x+=4){g.moveTo((x+(y%2?2:0))*48,y*48);g.lineTo((x+(y%2?2:0))*48,(y+1)*48);}g.stroke();}
    for(const x of [-23,23]){g.fillColor=new Color("#204653");g.rect((x-1)*48,-1344,96,2688);g.fill();}
    for(const b of HARBOR_CARGO){const x=(b.x-2)*48,y=(b.y-3)*48;g.fillColor=new Color("#695943");g.rect(x,y,192,288);g.fill();g.strokeColor=new Color("#c2a97b");g.rect(x,y,192,288);g.stroke();for(let row=0;row<3;row++)for(let col=0;col<2;col++){const cx=x+col*96+4,cy=y+row*96+4;g.fillColor=new Color((row+col)%2?"#756348":"#62553f");g.rect(cx,cy,88,88);g.fill();g.rect(cx+4,cy+4,80,80);g.moveTo(cx+4,cy+4);g.lineTo(cx+84,cy+84);g.moveTo(cx+84,cy+4);g.lineTo(cx+4,cy+84);g.stroke();}}
    return;
  }
  const furnace = stage === 6;
  const fill = (hex: string) => g.fillColor = new Color(hex);
  g.clear(); fill(furnace ? '#231f24' : '#161e32'); g.rect(-1152,-1344,2304,2688); g.fill();
  for (let y=-27;y<28;y++) for(let x=-23;x<24;x++) {
    fill(furnace ? (x+y)%3 ? '#393139' : '#46333a' : (x+y)%3 ? '#242e49' : '#2b3856');
    g.rect(x*48+2,y*48+2,44,44);g.fill();
  }
  if(furnace){
    // Muted work floors identify positioning spaces, not damage zones.
    fill('#494047');g.rect(-4.65*48,-12*48,9.3*48,24*48);g.fill();
    for(const cx of [-8,8]){fill('#51433d');g.roundRect((cx-2)*48,-3*48,4*48,6*48,16);g.fill();}
  }
  g.strokeColor=new Color(furnace?'#d79562':'#97a7ed');g.lineWidth=3;
  for(const p of furnace?FURNACE_STONES:CROWN_STONES){
    fill(furnace?'#70574c':'#485b82');g.circle(p.x*48,p.y*48,1.05*48);g.fill();
    g.circle(p.x*48,p.y*48,19);g.stroke();
  }
  // Decorative edge machinery never reads as a traversable damage region.
  for(const x of [-1000,1000])for(const y of [-1000,-500,0,500,1000]){
    if(furnace){fill('#89634d');g.roundRect(x-28,y-45,56,90,8);g.fill();fill('#ed9959');g.rect(x-15,y-22,30,44);g.fill();}
    else {g.moveTo(x,y+45);g.lineTo(x+23,y);g.lineTo(x,y-45);g.lineTo(x-23,y);g.close();g.stroke();}
  }
}
