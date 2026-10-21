import type {Graphics} from 'cc';
import type {Hazard,Point} from '../../battle/SurvivalTypes';
import {loomEnds,loomPosition,loomState} from '../../battle/LoomGeometry';
import {ink} from './Ink';
/** Shape, end caps and timing notches remain visible in every quality mode. */
export function drawLoomHazard(g:Graphics,h:Hazard,time:number){
 const b=h.loom!,state=loomState(h,time);if(state==='ended')return;
 const [a,z]=loomEnds(h,time),center=loomPosition(h,time),c=state==='tight'?'#efb68e':state==='slack'?'#bcd9cd':'#d6bbeb';
 const segment=(p:Point,q:Point,width:number,alpha=230)=>{g.strokeColor=ink(c,alpha);g.lineWidth=width;g.moveTo(p.x*48,p.y*48);g.lineTo(q.x*48,q.y*48);g.stroke();};
 if(b.shape==='shuttle'&&state==='warning'){
  const [p,q]=loomEnds(h,h.until),[s,t]=loomEnds(h,h.due);segment(p,q,2,95);segment(s,p,1.5,110);segment(t,q,1.5,110);
  const x=(s.x+t.x)/2,y=(s.y+t.y)/2,nx=b.velocity.x/1.4,ny=b.velocity.y/1.4;
  segment({x,y},{x:x+nx*1.5,y:y+ny*1.5},3);segment({x:x+nx*1.5,y:y+ny*1.5},{x:x+nx*1.1-ny*.25,y:y+ny*1.1+nx*.25},3);
 }
 if(state==='tight'){
  segment(a,z,b.halfWidth*96+3,255);segment(a,z,3,255);
  for(let i=0;i<12;i++){const f=(i+.5)/12,p={x:a.x+(z.x-a.x)*f,y:a.y+(z.y-a.y)*f};segment({x:p.x-Math.sin(h.angle)*.13,y:p.y+Math.cos(h.angle)*.13},{x:p.x+Math.sin(h.angle)*.13,y:p.y-Math.cos(h.angle)*.13},1.5);}
 }else if(state==='slack'){
  g.strokeColor=ink(c,245);g.lineWidth=4;g.moveTo(a.x*48,a.y*48);g.quadraticCurveTo(center.x*48,center.y*48-26,z.x*48,z.y*48);g.stroke();
 }else{
  for(let i=0;i<20;i+=2)segment({x:a.x+(z.x-a.x)*i/20,y:a.y+(z.y-a.y)*i/20},{x:a.x+(z.x-a.x)*(i+1)/20,y:a.y+(z.y-a.y)*(i+1)/20},3);
 }
 for(const p of [a,z]){
  const x=p.x*48,y=p.y*48,r=state==='tight'?9:11;g.strokeColor=ink(c);g.fillColor=ink('#261f2e');g.lineWidth=2.5;
  if(state==='tight'){g.moveTo(x,y+r);g.lineTo(x+r,y);g.lineTo(x,y-r);g.lineTo(x-r,y);g.close();g.fill();g.stroke();}
  else {g.moveTo(x-r,y+7);g.lineTo(x-r-4,y);g.lineTo(x-r,y-7);g.moveTo(x+r,y+7);g.lineTo(x+r+4,y);g.lineTo(x+r,y-7);g.stroke();}
 }
 const next=state==='slack'?h.due+2.9:h.due,full=state==='slack'?2.2:h.due-h.created,progress=Math.max(0,Math.min(1,(next-time)/full));
 const x=a.x*48,y=a.y*48+22;g.strokeColor=ink(c);g.lineWidth=4;
 for(let i=0;i<10;i++)if(i<Math.ceil(progress*10)){g.moveTo(x+i*4,y);g.lineTo(x+i*4,y+5);}
 for(let i=0;i<(b.shape==='repeat'?(time<h.due+.7?2:1):1);i++){g.moveTo(x+i*10,y+14);g.lineTo(x+i*10+4,y+20);g.lineTo(x+i*10+8,y+14);}g.stroke();
 // Stable per-plan line number, including delayed second warnings.
 g.strokeColor=ink('#f4e8ca');g.lineWidth=2;for(let i=0;i<b.order;i++){g.moveTo(x+i*6-3,y-11);g.lineTo(x+i*6-3,y-3);}g.stroke();
}
