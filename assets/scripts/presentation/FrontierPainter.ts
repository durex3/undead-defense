import { Graphics, Color } from 'cc';
import { FRONTIER_MAPS, FrontierStage } from '../battle/FrontierMaps';
import { Enemy, Hazard } from '../battle/SurvivalTypes';
const ink=(hex:string,a=255)=>{const c=new Color().fromHEX(hex);c.a=a;return c;};
export function drawFrontierMap(g:Graphics,stage:FrontierStage) {
  const m=FRONTIER_MAPS[stage];g.clear();g.fillColor=ink(m.floor);g.rect(-1152,-1344,2304,2688);g.fill();
  g.fillColor=ink(m.tile);
  for(let y=-27;y<28;y++)for(let x=-23;x<24;x++){g.rect(x*48+2,y*48+2,44,44);}g.fill();
  g.strokeColor=ink(m.edge,65);g.lineWidth=2;
  if(stage===11){for(const x of [-5,5]){g.moveTo(x*48,-26*48);g.lineTo(x*48,26*48);}g.stroke();}
  if(stage===12){for(const y of [-5,5]){g.moveTo(-22*48,y*48);g.lineTo(22*48,y*48);}g.stroke();}
  if(stage===13){for(const y of [-20,20]){g.moveTo(-22*48,y*48);g.lineTo(22*48,y*48);}g.stroke();}
  for(const p of m.boxes){
    const x=(p.x-m.width)*48,y=(p.y-m.height)*48,w=m.width*96,h=m.height*96;
    g.fillColor=ink(stage===11?'#67514c':stage===12?'#4e5e75':'#526e70');g.rect(x,y,w,h);g.fill();
    g.strokeColor=ink(m.edge);g.lineWidth=3;g.rect(x,y,w,h);g.stroke();
    if(stage===11){g.rect(x+12,y+12,w-24,h-24);g.moveTo(x+12,y+12);g.lineTo(x+w-12,y+h-12);g.stroke();}
    else if(stage===12){g.moveTo(x+8,y+h/2);g.lineTo(x+w/2,y+h-8);g.lineTo(x+w-8,y+h/2);g.lineTo(x+w/2,y+8);g.close();g.stroke();}
    else {for(let i=1;i<4;i++){g.moveTo(x,y+h*i/4);g.lineTo(x+w,y+h*i/4);}g.stroke();}
  }
}
export function drawFrontierEnemy(g:Graphics,e:Enemy,stage:number) {
  const x=e.x*48,y=e.y*48+(e.kind==='boss'?65:35);
  g.strokeColor=ink(stage===11?'#ffd092':stage===12?'#c5dfff':'#9fe9df',240);g.fillColor=g.strokeColor;g.lineWidth=e.kind==='boss'?4:2;
  const r=e.kind==='boss'?24:11;
  if(stage===11){g.moveTo(x-r,y-r);g.lineTo(x+r,y-r);g.lineTo(x+r,y+r*.2);g.lineTo(x-r,y+r*.2);g.close();g.stroke();g.moveTo(x,y-r);g.lineTo(x,y-r*1.8);g.stroke();if(e.kind==='lineworker'){g.moveTo(x-r,y+r*.5);g.lineTo(x+r,y+r*.5);g.stroke();}}
  else if(stage===12){g.moveTo(x,y+r);g.lineTo(x+r,y);g.lineTo(x,y-r);g.lineTo(x-r,y);g.close();g.stroke();if(e.kind==='mirrorpriest'||e.kind==='boss'){g.moveTo(x-r,y-r);g.lineTo(x+r,y+r);g.moveTo(x-r,y+r);g.lineTo(x+r,y-r);g.stroke();}}
  else {g.moveTo(x-r,y-r);g.lineTo(x+r,y+r);g.moveTo(x+r*.5,y-r*.5);g.lineTo(x+r*1.1,y-r*1.1);g.stroke();g.arc(x,y,r,0,Math.PI,false);g.stroke();if(e.kind==='echoferryman'||e.kind==='boss'){g.arc(x,y,r*.6,0,Math.PI,false);g.stroke();}}
}
/** Draw exactly the capsule/circle used by FrontierGeometry; second impact has its own clock. */
export function drawFrontierHazard(g:Graphics,h:Hazard,time:number) {
  const x=h.x*48,y=h.y*48,progress=Math.max(0,Math.min(1,(time-h.created)/(h.due-h.created||1)));
  const active=time>=h.due;
  g.strokeColor=ink(active?'#fff0bd':'#ffbc91',250);g.fillColor=ink('#ed7656',active?130:18+progress*35);g.lineWidth=active?4:2;
  if(h.kind==='frontierLane'){
    const bx=h.endX!*48,by=h.endY!*48,a=Math.atan2(by-y,bx-x),r=h.width*48;
    g.moveTo(x-Math.sin(a)*r,y+Math.cos(a)*r);
    for(let i=0;i<=12;i++){const t=a+Math.PI/2-i*Math.PI/12;g.lineTo(bx+Math.cos(t)*r,by+Math.sin(t)*r);}
    for(let i=0;i<=12;i++){const t=a-Math.PI/2-i*Math.PI/12;g.lineTo(x+Math.cos(t)*r,y+Math.sin(t)*r);}g.close();g.fill();g.stroke();
    g.moveTo(x,y);g.lineTo(x+(bx-x)*progress,y+(by-y)*progress);g.stroke();
  }else{g.circle(x,y,h.radius*48);g.fill();g.stroke();g.circle(x,y,h.radius*48*progress);g.stroke();}
  // One/two pips identify the locked order; the contracting time gap is shown by each fill clock.
  g.fillColor=ink('#fff2cf',240);const count=h.sequence||0;for(let i=0;i<count;i++){g.circle(x+(i-(count-1)/2)*8,y+8,3);g.fill();}
}
