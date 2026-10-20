import { Graphics } from 'cc';
import { SIEGE_WALLS, SIEGE_ROUTES } from '../battle/SiegeMap';
import { Hazard } from '../battle/SurvivalTypes';
// Shared immutable palette avoids thousands of Color allocations per crowd frame.
import { ink } from './StagePalette';
export function drawSiegeMap(g:Graphics) {
  g.clear();g.fillColor=ink('#28272b');g.rect(-1152,-1344,2304,2688);g.fill();
  for(let y=-27;y<28;y++)for(let x=-23;x<24;x++){
    g.fillColor=ink((x+y)%3?'#39353a':'#423a3d');g.rect(x*48+2,y*48+2,44,44);g.fill();
  }
  // Worn stone routes connect every flank; these marks do not block movement or attacks.
  for(const p of SIEGE_ROUTES){g.fillColor=ink('#9d8868',45);g.roundRect(p.x*48-95,p.y*48-65,190,130,14);g.fill();}
  g.strokeColor=ink('#b6a17d',65);g.lineWidth=7;
  for(const p of SIEGE_ROUTES.slice(1)){g.moveTo(0,0);g.lineTo(p.x*48,p.y*48);g.stroke();}
  for(const p of SIEGE_WALLS){
    const x=(p.x-p.halfWidth)*48,y=(p.y-p.halfHeight)*48,ww=p.halfWidth*96,hh=p.halfHeight*96;
    g.fillColor=ink('#64514b');g.rect(x,y,ww,hh);g.fill();g.strokeColor=ink('#cc9b6f');g.lineWidth=3;g.rect(x,y,ww,hh);g.stroke();
    for(let i=1;i<hh/48;i++){g.moveTo(x,y+i*48);g.lineTo(x+ww,y+i*48);}g.stroke();
    for(let i=0;i<Math.floor(ww/48);i++){g.fillColor=ink('#b89478');g.rect(x+i*48+6,y+hh-12,26,18);g.fill();}
  }
}
export function drawSiegeCharge(g:Graphics,h:Hazard,time:number) {
  const x=h.x*48,y=h.y*48,progress=Math.max(0,Math.min(1,(time-h.created)/(h.due-h.created||1)));
  const active=time>=h.due;
  g.strokeColor=ink(active?'#fff0bd':'#ffe5ba',255);g.fillColor=ink('#ed7656',active?145:48+progress*45);g.lineWidth=active?6:5;
  const bx=(h.x+Math.cos(h.angle)*h.radius)*48,by=(h.y+Math.sin(h.angle)*h.radius)*48,a=Math.atan2(by-y,bx-x),r=h.width*48;
  g.moveTo(x-Math.sin(a)*r,y+Math.cos(a)*r);
  for(let i=0;i<=12;i++){const t=a+Math.PI/2-i*Math.PI/12;g.lineTo(bx+Math.cos(t)*r,by+Math.sin(t)*r);}
  for(let i=0;i<=12;i++){const t=a-Math.PI/2-i*Math.PI/12;g.lineTo(x+Math.cos(t)*r,y+Math.sin(t)*r);}g.close();g.fill();g.stroke();
  g.moveTo(x,y);g.lineTo(x+(bx-x)*progress,y+(by-y)*progress);g.stroke();
  g.fillColor=ink('#fff2cf',240);const count=h.sequence||0;for(let i=0;i<count;i++){g.circle(x+(i-(count-1)/2)*8,y+8,3);g.fill();}
}
