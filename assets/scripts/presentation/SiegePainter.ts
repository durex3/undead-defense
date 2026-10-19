import { Graphics, Color } from 'cc';
import { SIEGE_WALLS, SIEGE_ROUTES } from '../battle/SiegeMap';
import { Enemy, Hazard } from '../battle/SurvivalTypes';
import type { SurvivalWorld } from '../battle/SurvivalWorld';
import { shieldRaised } from '../battle/SiegeSystem';
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
export function drawSiegeEnemy(g:Graphics,w:SurvivalWorld,e:Enemy) {
  drawLegionBody(g,w,e);
  const x=e.x*48,y=e.y*48;
  if(e.kind==='thornshield'){
    const raised=shieldRaised(w,e),dx=Math.cos(e.facing),dy=Math.sin(e.facing);
    g.strokeColor=ink(raised?'#ffd887':'#8993a0',230);g.lineWidth=raised?5:2;
    g.arc(x,y,25,e.facing-Math.PI/3,e.facing+Math.PI/3,false);g.stroke();
    if(raised&&e.shieldPartner){const p=w.enemies.find(o=>o.id===e.shieldPartner&&o.hp>0);if(p&&Math.hypot(p.x-e.x,p.y-e.y)<=2){g.strokeColor=ink('#ffd887',170);g.lineWidth=2;g.moveTo(x-dx*10,y-dy*10);g.lineTo(p.x*48,p.y*48);g.stroke();}}
  }
  if(e.kind==='siegebow')for(let i=0;i<3;i++){g.fillColor=ink(i===e.pattern%3?'#f8cb86':'#606c78');g.rect(x-10+i*8,y+68,5,4);g.fill();}
  if(e.kind==='flanker'&&e.siegeTarget&&(e.siegeRouteTime??0)>0&&e.state==='arriving'){const p=e.siegeTarget;g.strokeColor=ink('#e8a58d',125);g.lineWidth=2;g.moveTo(x,y);g.lineTo(p.x*48,p.y*48);g.circle(p.x*48,p.y*48,9);g.stroke();}
}
/** Original, code-authored pixel silhouettes. Feet share the actor's world anchor. */
function drawLegionBody(g:Graphics,w:SurvivalWorld,e:Enemy) {
  const x=e.x*48,y=e.y*48,face=Math.cos(e.facing)<0?-1:1;
  const boss=e.kind==='boss',rider=e.kind==='siegerider',dog=e.kind==='flanker';
  const scale=boss?1.65:rider?1.25:e.kind==='siegeflag'?1.3:1;
  const walking=e.state==='seek'||e.state==='charge',stride=walking?Math.round(Math.sin(w.time*(dog?15:10)+e.id)*3):0;
  const crouch=e.state==='windup'?3:0,bob=walking?Math.abs(stride)*.5:0;
  const rect=(a:number,b:number,c:number,d:number,hex:string)=>{
    g.fillColor=ink(e.freezeUntil>w.time?'#8ed9ee':hex,e.state==='arriving'?155:255);
    g.rect(x+(face<0?-a-c:a)*scale,y+(b+bob-crouch)*scale,c*scale,d*scale);g.fill();
  };
  const armor='#879595',dark='#18232b',edge='#d6b78a',cloth='#893b42',metal='#46535d';
  if(dog||rider){
    rect(-23,8,40,18,dark);rect(-20,11,34,15,dog?'#625b66':metal);
    rect(10,18,19,15,dark);rect(13,21,14,10,armor);rect(19,18,12,7,edge);
    rect(21,25,4,3,'#f8b56c');rect(-27,24,10,5,metal);
    for(const [a,b] of [[-17,stride],[8,-stride]]){rect(a,1+b,6,13,dark);rect(a+1,2+b,8,5,armor);}
    for(const a of [-16,-5,6])rect(a,27,5,6,edge);
    if(dog){rect(12,33,5,7,dark);rect(23,32,4,7,dark);rect(22,17,3,5,'#f3eee2');}
  }
  if(!dog){
    const lift=rider?17:0;
    if(!rider){rect(-13,1+stride,9,17,dark);rect(4,1-stride,9,17,dark);rect(-15,1+stride,12,5,metal);rect(4,1-stride,12,5,metal);}
    rect(-18,15+lift,36,26,dark);rect(-15,18+lift,30,20,metal);rect(-11,23+lift,22,14,armor);
    rect(-19,33+lift,13,11,armor);rect(7,33+lift,13,11,armor);rect(-11,17+lift,22,5,cloth);rect(-3,18+lift,6,5,edge);
    rect(-10,39+lift,21,19,dark);rect(-8,41+lift,17,14,armor);rect(-7,44+lift,15,4,dark);rect(0,44+lift,7,3,'#ffc17c');
    rect(-5,55+lift,10,8,cloth);
    if(e.kind==='thornshield'){
      rect(10,9,22,37,dark);rect(13,12,16,31,edge);rect(16,15,10,25,metal);rect(19,18,4,20,armor);
      for(const b of [13,25,37])rect(31,b,5,5,edge);
    }else if(e.kind==='siegebow'){
      rect(8,25,28,6,dark);rect(19,17,5,23,edge);rect(29,18,4,20,metal);rect(10,27,28,2,armor);rect(-14,7,5,15,cloth);
    }else{
      rect(20,5+lift,4,66,edge);rect(17,65+lift,10,13,armor);rect(14,67+lift,6,7,dark);
      if(boss){rect(-25,22,14,17,metal);rect(-34,27,25,7,edge);for(const a of [-17,13])rect(a,43,6,11,edge);}
    }
    if(e.kind==='siegeflag'){
      rect(-26,10,4,75,edge);rect(-56,58,30,25,dark);rect(-53,61,25,18,cloth);rect(-44,64,6,12,edge);
    }
    if(boss){rect(-12,57,25,6,edge);rect(-12,61,5,10,edge);rect(-2,61,5,15,edge);rect(8,61,5,10,edge);}
  }
  if((e.siegeShield??0)>0&&(e.siegeShieldUntil??0)>w.time){
    g.strokeColor=ink('#ffe29b',220);g.lineWidth=3;g.ellipse(x,y+24,24*scale,32*scale);g.stroke();
    g.fillColor=ink('#ffe29b');g.rect(x-18,y+64*scale,36*Math.min(1,e.siegeShield!/(e.maxHp*.15)),3);g.fill();
  }
  if((e.siegeFreezeResist??0)>w.time){g.strokeColor=ink('#8bdfff');g.lineWidth=2;g.moveTo(x-8,y+72*scale);g.lineTo(x+3,y+80*scale);g.lineTo(x-2,y+72*scale);g.lineTo(x+8,y+78*scale);g.stroke();}
  if(e.siegeWall&&e.state==='recover'){g.strokeColor=ink('#ffe2a3');g.lineWidth=3;g.moveTo(x-12,y+75*scale);g.lineTo(x+12,y+64*scale);g.moveTo(x+12,y+75*scale);g.lineTo(x-12,y+64*scale);g.stroke();}
}
export function drawSiegeCharge(g:Graphics,h:Hazard,time:number) {
  const x=h.x*48,y=h.y*48,progress=Math.max(0,Math.min(1,(time-h.created)/(h.due-h.created||1)));
  const active=time>=h.due;
  g.strokeColor=ink(active?'#fff0bd':'#ffbc91',250);g.fillColor=ink('#ed7656',active?130:18+progress*35);g.lineWidth=active?4:2;
  const bx=(h.x+Math.cos(h.angle)*h.radius)*48,by=(h.y+Math.sin(h.angle)*h.radius)*48,a=Math.atan2(by-y,bx-x),r=h.width*48;
  g.moveTo(x-Math.sin(a)*r,y+Math.cos(a)*r);
  for(let i=0;i<=12;i++){const t=a+Math.PI/2-i*Math.PI/12;g.lineTo(bx+Math.cos(t)*r,by+Math.sin(t)*r);}
  for(let i=0;i<=12;i++){const t=a-Math.PI/2-i*Math.PI/12;g.lineTo(x+Math.cos(t)*r,y+Math.sin(t)*r);}g.close();g.fill();g.stroke();
  g.moveTo(x,y);g.lineTo(x+(bx-x)*progress,y+(by-y)*progress);g.stroke();
  g.fillColor=ink('#fff2cf',240);const count=h.sequence||0;for(let i=0;i<count;i++){g.circle(x+(i-(count-1)/2)*8,y+8,3);g.fill();}
}
