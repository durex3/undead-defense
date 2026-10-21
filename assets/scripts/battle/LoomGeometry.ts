import type {Hazard,Point} from './SurvivalTypes';
import type {SurvivalWorld} from './SurvivalWorld';
import {distance} from './SurvivalTypes';
import {loomMap} from './LoomMap';
import {libraryLocal,libraryRoundedEnter} from './LibraryGeometry';
export interface LoomHazard {
 shape:'fixed'|'repeat'|'shuttle';length:number;halfWidth:number;velocity:Point;
 group:number;order:number;phase:number;bossPair:boolean;last:number;player:Point;
 hits:Set<number>;cancelled?:boolean;secondCancelled?:boolean;side?:number;crossCandidate?:number;crossed?:boolean;
}
export const loomWindows=(h:Hazard):[number,number][]=>h.loom!.shape==='repeat'&&!h.loom!.secondCancelled?[[h.due,h.due+.7],[h.due+2.9,h.due+3.6]]:[[h.due,h.until]];
export function loomState(h:Hazard,t:number):'warning'|'tight'|'slack'|'ended'{
 const b=h.loom!;if(b.cancelled||t>=h.until)return 'ended';if(t<h.due)return 'warning';
 if(b.shape==='repeat'&&t>=h.due+.7&&t<h.due+2.9)return 'slack';return 'tight';
}
export function loomPosition(h:Hazard,t:number):Point{const b=h.loom!,d=Math.max(0,Math.min(t,h.until)-h.due);return {x:h.x+b.velocity.x*d,y:h.y+b.velocity.y*d};}
export function loomEnds(h:Hazard,t:number):[Point,Point]{const p=loomPosition(h,t),b=h.loom!,x=Math.cos(h.angle)*b.length/2,y=Math.sin(h.angle)*b.length/2;return [{x:p.x-x,y:p.y-y},{x:p.x+x,y:p.y+y}];}
const lerp=(a:Point,b:Point,f:number)=>({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f});
/** Split at each pulse; relative swept point against exact capsule, never the slack envelope. */
export function loomImpacts(h:Hazard,p:Point,t:number,previous=t-.05,old=p):number[]{
 if(h.loom!.cancelled||t<previous)return [];
 const at=(time:number)=>lerp(old,p,t===previous?1:Math.max(0,Math.min(1,(time-previous)/(t-previous))));
 const hits:number[]=[];loomWindows(h).forEach(([start,end],i)=>{
  const a=Math.max(previous,start),z=Math.min(t,end,h.until);if(t<start||previous>=end||a>=z)return;
  const pa=libraryLocal(at(a),loomPosition(h,a),h.angle),pz=libraryLocal(at(z),loomPosition(h,z),h.angle);
  if(libraryRoundedEnter(pa,pz,{x:h.loom!.length/2,y:0},h.loom!.halfWidth+.3)!==null)hits.push(i);
 });return hits;
}
/** Conservative full-motion hull for terrain/visibility; live damage always uses the capsule. */
export function loomEnvelope(h:Hazard):Point[]{
 const b=h.loom!,a=loomPosition(h,h.due),z=loomPosition(h,h.until),nx=-Math.sin(h.angle),ny=Math.cos(h.angle),dx=Math.cos(h.angle)*(b.length/2+b.halfWidth),dy=Math.sin(h.angle)*(b.length/2+b.halfWidth);
 return [a,z].flatMap(p=>[-1,1].flatMap(s=>[-1,1].map(v=>({x:p.x+s*dx+v*nx*b.halfWidth,y:p.y+s*dy+v*ny*b.halfWidth}))));
}
export function loomSolid(h:Hazard){
 const b=h.loom!,n=b.velocity.x||b.velocity.y?Math.max(1,Math.ceil((h.until-h.due)/.04)):1;for(let i=0;i<=n;i++){const ends=loomEnds(h,h.due+(h.until-h.due)*i/n);
  if(ends.some(p=>Math.abs(p.x)>22-b.halfWidth||Math.abs(p.y)>26-b.halfWidth)||loomMap.segment(ends[0],ends[1],b.halfWidth))return true;
 }return false;
}
/** Axis-resolved actual movement, sampled densely so a wall cannot be skipped. */
export function loomMove(p:Point,v:Point,dt:number,r:number,time:number,visit?:(a:Point,z:Point,from:number,to:number)=>void){
 const n=Math.max(1,Math.ceil(Math.max(Math.abs(v.x*dt),Math.abs(v.y*dt),dt*4)/.05));
 for(let i=0;i<n;i++)for(let axis=0;axis<2;axis++){
  const a={...p},from=time-dt+dt*(2*i+axis)/(2*n),to=from+dt/(2*n);
  if(axis===0)p.x=Math.max(-22+r,Math.min(22-r,p.x+v.x*dt/n));else p.y=Math.max(-26+r,Math.min(26-r,p.y+v.y*dt/n));
  loomMap.resolve(p,r);visit?.(a,{...p},from,to);
 }
}
export function loomCross(h:Hazard,a:Point,z:Point,from:number,to:number){
 const b=h.loom!;if(!b.bossPair||b.crossed||b.cancelled||b.secondCancelled)return false;
 const lo=Math.max(from,h.due+.7),hi=Math.min(to,h.due+2.9);if(lo>=hi)return false;
 const f=(t:number)=>to===from?1:(t-from)/(to-from),p=libraryLocal(lerp(a,z,f(lo)),h,h.angle),q=libraryLocal(lerp(a,z,f(hi)),h,h.angle),margin=b.halfWidth+.35;
 if(Math.abs(p.y)>margin&&b.side===undefined)b.side=Math.sign(p.y);
 if(p.y*q.y<=0&&Math.abs(p.y-q.y)>1e-12){const x=p.x+(q.x-p.x)*(-p.y)/(q.y-p.y);if(Math.abs(x)<=b.length/2-.5&&b.side!==undefined)b.crossCandidate=-b.side;else b.crossCandidate=undefined;}
 if(Math.abs(q.y)>margin){const side=Math.sign(q.y);if(b.side!==undefined&&side!==b.side&&b.crossCandidate===side){b.crossed=true;return true;}b.side=side;b.crossCandidate=undefined;}
 return false;
}
/** Search complete reaction + movement paths against both pulses, walls and current crowd. */
export function loomEscape(w:SurvivalWorld,extra:Hazard[]){
 const hazards=[...w.hazards.filter(h=>h.loom&&!h.loom.cancelled&&h.until>w.time),...extra],until=Math.max(w.time,...hazards.map(h=>h.until));
 const actors=w.enemies.filter(e=>e.hp>0&&e.state==='seek'&&!e.immovable&&distance(e,w.player)<8);
 for(let i=-1;i<24;i++)for(const turn of [0,-Math.PI/2,Math.PI/2]){
  if(i===-1&&turn!==0)continue;const p={...w.player};let safe=true;
  for(let t=w.time;t<until-1e-8;){const dt=Math.min(.05,until-t),elapsed=t-w.time,angle=i*Math.PI/12+(elapsed>=1.3?turn:0),speed=i<0||elapsed<.35?0:4.2;
   loomMove(p,{x:Math.cos(angle)*speed,y:Math.sin(angle)*speed},dt,.3,t+dt,(a,z,from,to)=>{if(actors.some(e=>distance(e,z)<.65)||hazards.some(h=>loomImpacts(h,z,to,from,a).length))safe=false;});
   if(!safe)break;t+=dt;
  }if(safe)return true;
 }return false;
}
