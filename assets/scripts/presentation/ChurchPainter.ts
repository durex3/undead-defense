import { Graphics, Color } from 'cc';
import { CHURCH_BELLS } from '../battle/ChurchSystem';
import { CHURCH_STONES } from '../battle/GardenMap';
export function drawChurch(g: Graphics) {
 const fill=(hex:string)=>g.fillColor=new Color().fromHEX(hex);
 fill('#202434');g.rect(-1152,-1344,2304,2688);g.fill();
 for(let y=-27;y<28;y++)for(let x=-23;x<24;x++){
  fill(Math.abs(x)<3||Math.abs(y)<2?'#424459':(x+y)%3?'#292d40':'#30354a');
  g.rect(x*48+2,y*48+2,44,44);g.fill();
  if(Math.abs(x)===17 && y%5===0){fill('#516980');g.rect(x*48+12,y*48+8,24,30);g.fill();}
 }
 for(const p of CHURCH_BELLS){
  const x=p.x*48,y=p.y*48;fill('#303647');g.circle(x,y,65);g.fill();
  g.strokeColor=new Color('#789cae');g.lineWidth=3;g.circle(x,y,68);g.stroke();
  fill('#a6bec7');g.roundRect(x-24,y-10,48,57,20);g.fill();
  g.rect(x-33,y-16,66,10);g.fill();fill('#dec785');g.circle(x,y-20,7);g.fill();
  g.strokeColor=new Color('#d9d9ba');g.circle(x,y+47,8);g.stroke();
 }
 for(const p of CHURCH_STONES){
  const x=p.x*48,y=p.y*48;fill('#1a2030');g.circle(x,y,50);g.fill();
  fill('#8292a5');g.rect(x-16,y-18,32,75);g.rect(x-24,y-23,48,12);g.rect(x-24,y+52,48,12);g.fill();
 }
 // Benches are decorative, keeping broad routes free.
 for(const x of [-17,17])for(const y of [-16,-10,0,6,18]){
  fill('#534755');g.roundRect(x*48-60,y*48,120,18,3);g.fill();
 }
}
