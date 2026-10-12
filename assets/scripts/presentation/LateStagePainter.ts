import { Graphics, Color } from 'cc';
import { CROWN_STONES } from '../battle/CrownSystem';
export function drawLateStage(g: Graphics, stage: number) {
  const furnace = stage === 6;
  const fill = (hex: string) => g.fillColor = new Color(hex);
  g.clear(); fill(furnace ? '#231f24' : '#161e32'); g.rect(-1152,-1344,2304,2688); g.fill();
  for (let y=-27;y<28;y++) for(let x=-23;x<24;x++) {
    fill(furnace ? (x+y)%3 ? '#393139' : '#46333a' : (x+y)%3 ? '#242e49' : '#2b3856');
    g.rect(x*48+2,y*48+2,44,44);g.fill();
  }
  g.strokeColor=new Color(furnace?'#d79562':'#97a7ed');g.lineWidth=3;
  for(const p of CROWN_STONES){
    fill(furnace?'#70574c':'#485b82');g.roundRect(p.x*48-30,p.y*48-30,60,60,8);g.fill();
    g.circle(p.x*48,p.y*48,19);g.stroke();
  }
  // Decorative edge machinery never reads as a traversable damage region.
  for(const x of [-1000,1000])for(const y of [-1000,-500,0,500,1000]){
    if(furnace){fill('#89634d');g.roundRect(x-28,y-45,56,90,8);g.fill();fill('#ed9959');g.rect(x-15,y-22,30,44);g.fill();}
    else {g.moveTo(x,y+45);g.lineTo(x+23,y);g.lineTo(x,y-45);g.lineTo(x-23,y);g.close();g.stroke();}
  }
}
