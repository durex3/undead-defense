import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import { ink } from "./Ink";
export function drawSupportSpells(g:Graphics,w:SurvivalWorld) {
  const a=w.armory.support, f=a.lamp;
  if(f) {
    const x=f.x*48,y=f.y*48,r=f.stats.radius*48;
    g.strokeColor=ink("#83d7bb",100);g.lineWidth=2;
    for(let i=0;i<24;i++){const b=i*Math.PI/12;g.moveTo(x+Math.cos(b)*r,y+Math.sin(b)*r);g.lineTo(x+Math.cos(b+.12)*r,y+Math.sin(b+.12)*r);}g.stroke();
    g.strokeColor=ink("#223d3c");g.fillColor=ink("#bdab74");g.lineWidth=3;
    g.moveTo(x-13,y-14);g.lineTo(x-10,y+12);g.lineTo(x,y+22);g.lineTo(x+10,y+12);g.lineTo(x+13,y-14);g.close();g.fill();g.stroke();
    g.fillColor=ink("#75cdb5");g.moveTo(x-7,y-9);g.lineTo(x-5,y+9);g.lineTo(x,y+16);g.lineTo(x+6,y+3);g.lineTo(x+5,y-9);g.close();g.fill();
    g.fillColor=ink("#e5fff0");g.ellipse(x,y+1,3,8+Math.sin(w.time*8)*2);g.fill();
    const mods=f.stats.mods;
    if(mods.includes("focus")){g.strokeColor=ink("#e6ffe7",180);g.lineWidth=2;g.moveTo(x-4,y+17);g.lineTo(x,y+31);g.lineTo(x+4,y+17);g.stroke();}
    if(mods.includes("linger")){g.fillColor=ink("#bceecb",150);for(let i=0;i<4;i++){const a=w.time+i*Math.PI/2;g.circle(x+Math.cos(a)*23,y+Math.sin(a)*13,2);g.fill();}}
    if(mods.includes("pulse")){g.strokeColor=ink("#dcffe3",130);g.lineWidth=2;const q=1-Math.min(1,Math.max(0,f.next-w.time));g.circle(x,y,r*(.35+.6*q));g.stroke();}
  }
  for(const [id]of a.marks){const e=w.enemies.find(v=>v.id===id && v.hp>0);if(!e||a.amplification(e)<=1)continue;const x=e.x*48,y=e.y*48+23;g.strokeColor=ink("#acf1ce");g.lineWidth=2;g.moveTo(x-4,y);g.lineTo(x,y+7);g.lineTo(x+4,y);g.stroke();}
  const strike=a.strike;
  if(strike && strike.until>w.time){const x=strike.x*48,y=strike.y*48;g.strokeColor=ink("#e9d2ff");g.lineWidth=3;g.moveTo(x-8,y-17);g.lineTo(x+8,y+20);g.stroke();g.lineWidth=1.5;g.ellipse(x+6,y+13,3,6);g.stroke();}
  const pair=a.linked();
  if(pair) {
    const {a,b,l}=pair,x=a.x*48,y=a.y*48,xx=b.x*48,yy=b.y*48;
    g.strokeColor=ink("#2a203e",200);g.lineWidth=4;g.moveTo(x,y);g.lineTo(xx,yy);g.stroke();
    g.strokeColor=ink("#d2b3ee",185);g.lineWidth=1.8;g.moveTo(x,y);g.lineTo(xx,yy);g.stroke();
    const mods=w.mods.needle,dx=xx-x,dy=yy-y,length=Math.max(1,Math.hypot(dx,dy)),nx=-dy/length,ny=dx/length;
    if(mods.includes("deep")){g.strokeColor=ink("#a886cd");g.moveTo(x+nx*4,y+ny*4);g.lineTo(xx+nx*4,yy+ny*4);g.stroke();}
    if(mods.includes("swift")){g.fillColor=ink("#f2dcff");for(const q of [.3,.6]){g.circle(x+dx*q,y+dy*q,2);g.fill();}}
    if(mods.includes("long")){g.strokeColor=ink("#d5c6eb");for(const q of [.12,.88]){g.ellipse(x+dx*q,y+dy*q,4,4);g.stroke();}}
    if(mods.includes("barb")){g.strokeColor=ink("#efd7ff");for(const q of [.25,.5,.75]){g.moveTo(x+dx*q-nx*5,y+dy*q-ny*5);g.lineTo(x+dx*q+dx/length*4,y+dy*q+dy/length*4);g.lineTo(x+dx*q+nx*5,y+dy*q+ny*5);}g.stroke();}
    const q=(w.time*2)%1;g.fillColor=ink(w.time<l.next?"#fff0ff":"#bf98e0");g.circle(x+(xx-x)*q,y+(yy-y)*q,3);g.fill();
    for(const p of [a,b]) {g.strokeColor=ink("#f0dafa");g.lineWidth=2;g.moveTo(p.x*48-5,p.y*48-10);g.lineTo(p.x*48+5,p.y*48+13);g.stroke();g.ellipse(p.x*48+4,p.y*48+9,3,5);g.stroke();}
  }
}
