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

/** Same narrow spear hitbox; each evolved form changes barbs, hollow joints and trail geometry. */
export function drawBoneForm(g:Graphics,x:number,y:number,angle:number,grade:number,scale=1){
 const dx=Math.cos(angle),dy=Math.sin(angle),p=(a:number,b:number)=>[x+(dx*a-dy*b)*scale,y+(dy*a+dx*b)*scale];
 const line=(a:number[],b:number[],width=2)=>{g.lineWidth=width;g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();};
 g.strokeColor=ink('#24212b');line(p(-37,0),p(23,0),7);g.strokeColor=ink(grade===4?'#e6cefa':'#e7dfcb');line(p(-37,0),p(23,0),3);
 g.fillColor=ink(grade===4?'#d3baef':grade===3?'#d5e6ea':'#dfcda6');g.strokeColor=ink('#332c34');g.lineWidth=1.5;
 polygon(g,[[40,0],[17,8],[23,0],[17,-8]].map(([a,b])=>p(a,b)));
 for(let i=0;i<3;i++){
  const a=-22+i*14;
  if(grade===2)for(const side of [-1,1])polygon(g,[[a,0],[a-9,side*10],[a+3,side*5]].map(([u,v])=>p(u,v)));
  else if(grade===3){g.strokeColor=ink('#eafaff');line(p(a-3,-6),p(a+3,-6));line(p(a-3,6),p(a+3,6));line(p(a-3,-6),p(a-3,6));line(p(a+3,-6),p(a+3,6));}
  else polygon(g,[[a-8,0],[a-2,4],[a,10],[a+3,3],[a+8,0],[a+3,-3],[a,-10],[a-2,-4]].map(([u,v])=>p(u,v)));
 }
 g.strokeColor=ink(grade===4?'#eec9fc':'#d4e4e8',155);
 for(let i=0;i<3;i++){const a=-45-i*12;if(grade===3){const q=p(a,0);g.ellipse(q[0],q[1],3*scale,7*scale);g.stroke();}else if(grade===4){g.fillColor=ink('#e6c6f2',160);polygon(g,[[a+4,0],[a,4],[a-4,0],[a,-4]].map(([u,v])=>p(u,v)));}else line(p(a,3),p(a-5,-3),1.5);}
}

/** Water grade changes bottle/urn silhouette, never the splash hitbox or tick count. */
export function drawWaterForm(g:Graphics,x:number,y:number,angle:number,grade:number,scale=1){
 const dx=Math.cos(angle),dy=Math.sin(angle),p=(a:number,b:number)=>[x+(dx*a-dy*b)*scale,y+(dy*a+dx*b)*scale];
 g.fillColor=ink(grade===3?'#a8dbdf':'#84d9d9');g.strokeColor=ink('#243c4d');g.lineWidth=2;
 if(grade===4){
  g.fillColor=ink('#ccbbea');polygon(g,[[0,20],[16,0],[0,-20],[-16,0]].map(([a,b])=>p(a,b)));
  g.fillColor=ink('#efffe9');polygon(g,[[0,11],[7,0],[0,-11],[-7,0]].map(([a,b])=>p(a,b)));
  g.strokeColor=ink('#f3d9a6');g.lineWidth=3;const pts=[[-11,25],[-7,32],[7,32],[11,25]].map(([a,b])=>p(a,b));pts.forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.stroke();
  for(const side of [-1,1]){const q=p(side*23,0);g.strokeColor=ink('#d0f3e9');g.lineWidth=2;g.ellipse(q[0],q[1],3*scale,9*scale);g.stroke();}return;
 }
 const shape=grade===3?[[-13,-17],[10,-17],[17,-7],[14,9],[6,14],[6,21],[-7,21],[-7,13],[-17,4]]:[[-10,-18],[10,-18],[14,-10],[12,8],[5,14],[5,21],[-5,21],[-5,14],[-12,8],[-14,-10]];
 polygon(g,shape.map(([a,b])=>p(a,b)));
 g.strokeColor=ink('#d6f6ec');g.lineWidth=3;
 for(const side of [-1,1]){const a=p(side*10,8),b=p(side*(grade===3?22:19),12),c=p(side*(grade===3?21:19),-6),d=p(side*12,-9);g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.lineTo(c[0],c[1]);g.lineTo(d[0],d[1]);g.stroke();}
 g.fillColor=ink('#f1ffe4');polygon(g,[[0,8],[5,1],[0,-10],[-5,1]].map(([a,b])=>p(a,b)));
 if(grade===3){g.strokeColor=ink('#f7e4ac');g.lineWidth=2;for(const v of [-3,3]){const a=p(-10,v),b=p(10,v);g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);}g.stroke();}
}
export function drawWaterFieldForm(g:Graphics,x:number,y:number,r:number,grade:number,quiet=false){
 g.strokeColor=ink(grade===3?'#d0f0e3':'#bde4d1',quiet?95:140);g.lineWidth=1.8;
 if(grade===4){for(let i=0;i<6;i++){const a=i*Math.PI/3;
  for(let j=0;j<=8;j++){const q=a+j*.075,rr=r*.73;const px=x+Math.cos(q)*rr,py=y+Math.sin(q)*rr;j?g.lineTo(px,py):g.moveTo(px,py);}g.stroke();
  const px=x+Math.cos(a)*r*.42,py=y+Math.sin(a)*r*.42;g.moveTo(px-4,py-4);g.quadraticCurveTo(px,py+11,px+4,py-4);g.stroke();}return;}
 if(grade===2){for(let i=0;i<8;i++){const a=i*Math.PI/4;g.moveTo(x+Math.cos(a)*r*.82,y+Math.sin(a)*r*.82);g.lineTo(x+Math.cos(a+.12)*r*.9,y+Math.sin(a+.12)*r*.9);}g.stroke();}
 else{g.circle(x,y,r*.72);g.stroke();for(let i=0;i<4;i++){const a=i*Math.PI/2,px=x+Math.cos(a)*r*.55,py=y+Math.sin(a)*r*.55;g.moveTo(px-4,py);g.lineTo(px,py+5);g.lineTo(px+4,py);g.lineTo(px,py-5);g.close();}g.stroke();}
}

/** Fire evolution preserves the actual explosion size, shard count and field lifecycle. */
export function drawFireForm(g:Graphics,x:number,y:number,angle:number,grade:number,scale=1){
 const u=Math.cos(angle),v=Math.sin(angle),p=(a:number,b:number)=>[x+(u*a-v*b)*scale,y+(v*a+u*b)*scale];
 if(grade===4){
  g.strokeColor=ink('#3a243d');g.lineWidth=2;g.fillColor=ink('#d8a0cf');
  for(const side of [-1,1])polygon(g,[[side*8+12,0],[side*8,10],[side*8-10,0],[side*8,-10]].map(([a,b])=>p(a,b)));
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;polygon(g,[[Math.cos(a)*25,Math.sin(a)*25],[Math.cos(a+.45)*17,Math.sin(a+.45)*17],[Math.cos(a+.15)*13,Math.sin(a+.15)*13]].map(([a,b])=>p(a,b)));}
  g.strokeColor=ink('#f9dfb4');g.lineWidth=2;for(let i=0;i<3;i++){for(let j=0;j<8;j++){const a=i*Math.PI*2/3+j*.11,q=p(Math.cos(a)*30,Math.sin(a)*30);j?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);}g.stroke();}
  g.strokeColor=ink('#e5b3dc',160);for(let i=0;i<4;i++){const a=p(-35-i*10,i%2?4:-4),b=p(-40-i*10,i%2?7:-7);g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);}g.stroke();return;
 }
 g.fillColor=ink(grade===3?'#e8a967':'#df9c69');g.strokeColor=ink('#35292a');g.lineWidth=2;
 if(grade===2)for(let i=0;i<3;i++){const a=i*Math.PI*2/3;polygon(g,[[Math.cos(a)*18,Math.sin(a)*18],[Math.cos(a+.6)*11,Math.sin(a+.6)*11],[Math.cos(a+.2)*7,Math.sin(a+.2)*7]].map(([a,b])=>p(a,b)));}
 else{polygon(g,Array.from({length:6},(_,i)=>p(Math.cos(i*Math.PI/3)*17,Math.sin(i*Math.PI/3)*17)));g.fillColor=ink('#3b3030');polygon(g,Array.from({length:6},(_,i)=>p(Math.cos(i*Math.PI/3)*10,Math.sin(i*Math.PI/3)*10)));g.strokeColor=ink('#f1d7a6');g.lineWidth=2;for(const side of [-1,1]){const q=p(0,side*24);g.ellipse(q[0],q[1],9*scale,3*scale);g.stroke();}}
 g.fillColor=ink('#fff1b1');g.strokeColor=ink('#e67d4a');polygon(g,[[11,0],[0,7],[-9,0],[0,-7]].map(([a,b])=>p(a,b)));
 g.strokeColor=ink('#ffbb70',170);g.lineWidth=2;for(let i=0;i<(grade===3?4:2);i++){const a=p(-22-i*8,i%2?4:-4),b=p(-28-i*8,i%2?6:-6);g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);}g.stroke();
}
export function drawFireFieldForm(g:Graphics,x:number,y:number,r:number,grade:number,quiet=false){
 if(grade===4){g.strokeColor=ink('#e3b7dd',quiet?90:150);g.lineWidth=1.8;for(let i=0;i<6;i++){const a=i*Math.PI/3;for(let j=0;j<8;j++){const b=a+j*.055,px=x+Math.cos(b)*r*.72,py=y+Math.sin(b)*r*.72;j?g.lineTo(px,py):g.moveTo(px,py);}g.stroke();const px=x+Math.cos(a)*r*.4,py=y+Math.sin(a)*r*.4;g.moveTo(px-5,py);g.lineTo(px-3,py+7);g.lineTo(px,py+2);g.lineTo(px+3,py+7);g.lineTo(px+5,py);g.stroke();}return;}
 g.strokeColor=ink('#d6b786',quiet?90:140);g.lineWidth=1.5;
 const n=grade===3?6:3;for(let i=0;i<n;i++){const a=i*Math.PI*2/n;
  if(grade===2){g.moveTo(x+Math.cos(a-.25)*r*.5,y+Math.sin(a-.25)*r*.5);g.quadraticCurveTo(x+Math.cos(a)*r*.9,y+Math.sin(a)*r*.9,x+Math.cos(a+.25)*r*.5,y+Math.sin(a+.25)*r*.5);}
  else{const q=a+Math.PI/3;g.moveTo(x+Math.cos(a)*r*.72,y+Math.sin(a)*r*.72);g.lineTo(x+Math.cos(q)*r*.72,y+Math.sin(q)*r*.72);g.moveTo(x+Math.cos(a)*r*.3,y+Math.sin(a)*r*.3);g.lineTo(x+Math.cos(a)*r*.55,y+Math.sin(a)*r*.55);}}
 g.stroke();
}
export function drawHolyForm(g:Graphics,x:number,y:number,grade:number,scale=1){
 const p=(a:number,b:number)=>[x+a*scale,y+b*scale];
 if(grade===4){g.fillColor=ink('#f2dfa6');g.strokeColor=ink('#354552');g.lineWidth=2;
 for(let i=0;i<3;i++){const yy=-20+i*17;polygon(g,[p(0,yy-7),p(-10+i*2,yy+7),p(-5,yy+15),p(0,yy+10),p(5,yy+15),p(10-i*2,yy+7)]);}
 g.strokeColor=ink('#fffbe5');g.lineWidth=2;for(const side of [-1,1]){g.moveTo(...p(side*7,24) as [number,number]);g.lineTo(...p(side*21,29) as [number,number]);g.lineTo(...p(side*15,36) as [number,number]);}g.moveTo(...p(0,31) as [number,number]);g.lineTo(...p(0,43) as [number,number]);g.stroke();return;}
g.fillColor=ink(grade===3?'#bedbe6':'#e0d7a2');g.strokeColor=ink('#253139');g.lineWidth=2;
 if(grade===3){polygon(g,[p(0,-24),p(-11,0),p(-7,23),p(0,14),p(7,23),p(11,0)]);g.fillColor=ink('#20333b');polygon(g,[p(0,-10),p(-3,4),p(0,11),p(3,4)]);}
 else {polygon(g,[p(0,-23),p(-8,-5),p(-5,23),p(0,17),p(5,23),p(8,-5)]);g.strokeColor=ink('#fff4c4');g.lineWidth=2;for(const side of [-1,1]){g.moveTo(...p(side*2,-12) as [number,number]);g.lineTo(...p(side*3,14) as [number,number]);}g.stroke();}
 g.strokeColor=ink(grade===3?'#d7f3fc':'#f4eabf');g.lineWidth=3;for(const side of [-1,1]){g.moveTo(...p(side*3,18) as [number,number]);g.lineTo(...p(side*17,22) as [number,number]);g.lineTo(...p(side*12,29) as [number,number]);}g.moveTo(...p(0,22) as [number,number]);g.lineTo(...p(0,34) as [number,number]);g.stroke();
}

/** One partner silhouette; evolving armor never increases companion count. */
export function drawGhostForm(g:Graphics,x:number,y:number,grade:number,scale=1){
 const p=(a:number,b:number)=>[x+a*scale,y+b*scale];g.fillColor=ink(grade===3?'#d6d6b4':'#a9cdb7');g.strokeColor=ink('#17312e');g.lineWidth=2;
 polygon(g,[[0,30],[-12,17],[-17,-19],[-7,-12],[0,-30],[7,-12],[17,-19],[12,17]].map(([a,b])=>p(a,b)));
 g.fillColor=ink('#294d48');polygon(g,[[-6,12],[0,20],[6,12],[4,-2],[-4,-2]].map(([a,b])=>p(a,b)));
 for(const side of[-1,1]){g.strokeColor=ink('#e5e7ca');g.lineWidth=3;const a=p(side*8,7),b=p(side*22,-1),c=p(side*25,-10);g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.lineTo(c[0],c[1]);g.stroke();}
 if(grade===3){g.strokeColor=ink('#d8c291');g.lineWidth=2;for(const side of[-1,1]){const a=p(side*13,29),b=p(side*8,39),c=p(side*3,31);g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.lineTo(c[0],c[1]);}g.stroke();g.fillColor=ink('#19342d');polygon(g,[[0,-1],[-4,-8],[0,-16],[4,-8]].map(([a,b])=>p(a,b)));}
}
