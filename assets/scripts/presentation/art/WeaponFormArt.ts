import type { Graphics } from "cc";
import { ink } from "./Ink";
const polygon = (g: Graphics, points: number[][]) => {
  points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.close();g.fill();g.stroke();
};
export function drawBladeForm(g: Graphics,x:number,y:number,angle:number,grade:number,child=false,quiet=false) {
  const c=grade===4?["#bbb0eb","#f8eaff","#706caa"]:grade===3?["#b4d4ec","#f3fbff","#678fae"]:["#d4c386","#fff0bf","#8b8966"];
  const dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx, scale=child?.55:1;
  const p=(a:number,b:number)=>[x+(dx*a+nx*b)*scale,y+(dy*a+ny*b)*scale];
  g.fillColor=ink(c[0]);g.strokeColor=ink("#17212c");g.lineWidth=2;
  if(grade===4) polygon(g,[[25,0],[9,4],[5,11],[0,6],[-9,5],[-5,0],[-9,-5],[0,-6],[5,-11],[9,-4]].map(([a,b])=>p(a,b)));
  else if(grade===3) polygon(g,[[23,1],[13,9],[-5,11],[0,5],[10,2],[-8,-4],[6,-6],[17,-3]].map(([a,b])=>p(a,b)));
  else polygon(g,[[23,0],[8,7],[-9,5],[-6,-5],[8,-6]].map(([a,b])=>p(a,b)));
  g.strokeColor=ink(c[1]);g.lineWidth=1.8;
  const a=p(-3,0),b=p(15,1);g.moveTo(...a as [number,number]);g.lineTo(...b as [number,number]);g.stroke();
  g.strokeColor=ink(c[2]);g.lineWidth=4;const h=p(-8,0),t=p(-15,0);g.moveTo(...h as [number,number]);g.lineTo(...t as [number,number]);g.stroke();
  g.strokeColor=ink(c[1],quiet?115:175);g.lineWidth=grade===4?2.2:1.6;
  for(let i=0;i<(grade===4?3:grade===3?2:1);i++) {
    const a=p(-18-i*7,3+i*2),b=p(-10-i*7,5+i*2);g.moveTo(...a as [number,number]);g.lineTo(...b as [number,number]);
  }g.stroke();
  if(grade===2) {g.strokeColor=ink(c[2]);g.lineWidth=1;for(let i=0;i<3;i++){const a=p(i*4,2),b=p(i*4+3,-2);g.moveTo(...a as [number,number]);g.lineTo(...b as [number,number]);}g.stroke();}
  if(grade===4 && !child) {g.fillColor=ink(c[1]);polygon(g,[[-22,0],[-25,3],[-28,0],[-25,-3]].map(([a,b])=>p(a,b)));}
}
export function drawHammerForm(g:Graphics,x:number,y:number,angle:number,grade:number,scale=1) {
  const dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx;
  const p=(a:number,b:number)=>[x+(dx*a+nx*b)*scale,y+(dy*a+ny*b)*scale];
  g.fillColor=ink(grade===4?"#c4b1df":"#b7a17a");g.strokeColor=ink("#20202b");g.lineWidth=3;
  polygon(g,[[-12,-22],[10,-24],[18,-17],[18,17],[10,24],[-12,22],[-16,13],[-16,-13]].map(([a,b])=>p(a,b)));
  g.fillColor=ink("#424059");polygon(g,[[-7,-16],[9,-16],[9,16],[-7,16]].map(([a,b])=>p(a,b)));
  g.strokeColor=ink(grade===4?"#eee0ff":"#e9daa8");g.lineWidth=3;
  for(const side of [-1,1]) {const a=p(-14,side*13),b=p(13,side*13);g.moveTo(...a as [number,number]);g.lineTo(...b as [number,number]);}g.stroke();
  g.fillColor=ink(grade===4?"#f0d6ff":"#dfd89f");polygon(g,[[0,-7],[6,0],[0,7],[-5,0]].map(([a,b])=>p(a,b)));
  if(grade===3) {g.strokeColor=ink("#f2e5ad");g.lineWidth=1.5;const v=[[-14,-4],[-4,2],[-9,7],[10,10]].map(([a,b])=>p(a,b));v.forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.stroke();}
  else {g.strokeColor=ink("#d6baf4",150);g.lineWidth=2;for(const r of [29,35]){for(let i=0;i<=20;i++){const a=-1+i/10;const xx=x+Math.cos(angle+a)*r*scale,yy=y+Math.sin(angle+a)*r*scale;i?g.lineTo(xx,yy):g.moveTo(xx,yy);}g.stroke();}}
}

/** Rare double staggered teeth / epic open double rim; collision size unchanged. */
export function drawWheelForm(g:Graphics,x:number,y:number,angle:number,grade:number,scale=1,returning=false){
 const epic=grade===4,r=23*scale;
 for(let layer=0;layer<2;layer++){
  const rr=r*(layer? .7:1),turn=angle+(layer?.16:0),points=Array.from({length:32},(_,i)=>{const a=turn+i*Math.PI/16,v=rr*(i%2?1:.82);return [x+Math.cos(a)*v,y+Math.sin(a)*v];});
  g.fillColor=ink(layer?epic?"#ead7b4":"#d9e8e7":epic?"#a99bd0":"#9dc3ce");g.strokeColor=ink("#242331");g.lineWidth=2;polygon(g,points);
 }
 g.fillColor=ink("#262731");g.circle(x,y,r*(epic?.41:.22));g.fill();
 g.strokeColor=ink(epic?"#f4dfb8":"#effcff");g.lineWidth=2;
 for(let i=0;i<(epic?6:4);i++){const a=angle+i*Math.PI*2/(epic?6:4);g.moveTo(x+Math.cos(a)*r*.45,y+Math.sin(a)*r*.45);g.lineTo(x+Math.cos(a+.2)*r*.8,y+Math.sin(a+.2)*r*.8);}g.stroke();
 if(returning){g.strokeColor=ink(epic?"#d6b4ef":"#bce4ed",150);g.lineWidth=3;g.moveTo(x-r*1.4,y);g.quadraticCurveTo(x-r,y+r*.9,x,y+r*.85);g.stroke();}
}
