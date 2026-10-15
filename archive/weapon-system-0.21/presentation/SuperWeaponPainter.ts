import {Color, Graphics} from 'cc';
import type {Effect} from '../battle/SurvivalTypes';

/** Impact-only graphics; world coordinates and radii come from the damage event. */
export const SUPER_EFFECT_LIFETIMES: Readonly<Partial<Record<Effect['type'],number>>> = {
  comboFire:.75,comboIce:.6,comboReap:.65,comboCollapse:.85,
  comboBone:.65,comboJudgment:.75,comboSoul:.8,
};
function color(hex:string,alpha:number){const c=new Color().fromHEX(hex);c.a=Math.round(Math.max(0,Math.min(255,alpha)));return c;}
function shape(g:Graphics,x:number,y:number,angle:number,points:number[][]){
  const c=Math.cos(angle),s=Math.sin(angle);
  points.forEach(([u,v],i)=>{const px=x+u*c-v*s,py=y+u*s+v*c;if(i)g.lineTo(px,py);else g.moveTo(px,py);});g.close();g.fill();
}
function line(g:Graphics,x:number,y:number,tx:number,ty:number){g.moveTo(x,y);g.lineTo(tx,ty);g.stroke();}
export function drawSuperWeaponEffect(g:Graphics,e:Effect,remaining:number,reduced=false):boolean {
  if(!SUPER_EFFECT_LIFETIMES[e.type])return false;
  const a=Math.max(0,Math.min(1,remaining)),t=1-a,ease=1-a*a*a;
  const x=e.x*48,y=e.y*48,r=Math.max(0,e.radius??1)*48;
  const ring=(radius:number)=>{g.circle(x,y,radius);g.stroke();};
  g.lineWidth=2;
  if(e.type==='comboFire'){
    // A toothed wheel of flame, rather than ordinary fireball splash.
    const orbit=r*(.35+.65*ease),spin=t*1.8;
    g.strokeColor=color('#ffad4d',a*210);g.lineWidth=3;ring(orbit);ring(orbit*.7);
    g.fillColor=color('#ffe0a0',a*220);
    for(let i=0;i<(reduced?4:8);i++){
      const angle=i*Math.PI*2/(reduced?4:8)+spin,cx=x+Math.cos(angle)*orbit*.84,cy=y+Math.sin(angle)*orbit*.84;
      shape(g,cx,cy,angle,[[r*.15,0],[-r*.04,r*.065],[-r*.11,0],[-r*.03,-r*.035]]);
      g.strokeColor=color('#ff7748',a*190);g.arc(x,y,orbit*.85,angle-.35,angle,false);g.stroke();
    }
    g.fillColor=color('#ff974d',a*160);shape(g,x,y,spin,[[0,r*.24],[-r*.13,-r*.15],[0,-r*.08],[r*.13,-r*.15]]);
  }else if(e.type==='comboIce'){
    // Frozen fracture and a violet forked thunderbolt; a single-target cue, not an AOE ring.
    g.strokeColor=color('#d3b4ff',a*230);g.lineWidth=3;
    const top=y+r*(1.8-.8*ease);
    g.moveTo(x-r*.15,top);g.lineTo(x+r*.12,y+r*.3);g.lineTo(x-r*.1,y+r*.3);g.lineTo(x,y);g.stroke();
    g.fillColor=color('#c9fbff',a*230);g.strokeColor=color('#9be6f2',a*170);g.lineWidth=2;
    for(let i=0;i<(reduced?3:6);i++){
      const angle=i*Math.PI*2/(reduced?3:6),cx=x+Math.cos(angle)*r*.68*ease,cy=y+Math.sin(angle)*r*.68*ease;
      line(g,x,y,cx,cy);shape(g,cx,cy,angle,[[r*.22,0],[0,r*.08],[-r*.1,0],[0,-r*.08]]);
    }
  }else if(e.type==='comboReap'){
    // Two opposing crescents cross inside the actual harvesting radius.
    const size=r*(.5+.5*ease),spin=t*1.3;
    for(const offset of [0,Math.PI]){
      g.strokeColor=color(offset?'#e4e1b7':'#a9f0c2',a*230);g.lineWidth=4;
      g.arc(x,y,size,offset+spin,offset+spin+2.3,false);g.stroke();
      g.lineWidth=2;g.arc(x,y,size*.76,offset+spin+.2,offset+spin+2.1,false);g.stroke();
      g.fillColor=color('#e9ffda',a*220);const angle=offset+spin+2.3;
      shape(g,x+Math.cos(angle)*size*.88,y+Math.sin(angle)*size*.88,angle+Math.PI/2,[[r*.17,0],[-r*.06,r*.06],[-r*.1,-r*.04]]);
    }
    g.strokeColor=color('#e7ffdb',a*180);line(g,x-r*.24,y-r*.24,x+r*.24,y+r*.24);
  }else if(e.type==='comboCollapse'){
    // Orange meteor fragments fold into a purple gravitational lens.
    g.strokeColor=color('#be8aff',a*210);g.lineWidth=3;ring(r*(.25+.75*a));
    g.ellipse(x,y,r*(.25+.65*a),r*.22);g.stroke();
    g.fillColor=color('#f4b97c',a*220);
    for(let i=0;i<(reduced?3:6);i++){
      const angle=i*Math.PI*2/(reduced?3:6)+t*.6,d=r*(.18+.65*a),cx=x+Math.cos(angle)*d,cy=y+Math.sin(angle)*d;
      shape(g,cx,cy,angle,[[r*.09,0],[0,r*.055],[-r*.08,r*.02],[-r*.04,-r*.06]]);
      g.strokeColor=color('#ad87e7',a*140);line(g,cx,cy,x+Math.cos(angle)*r*.12,y+Math.sin(angle)*r*.12);
    }
    g.fillColor=color('#d3b7ff',a*170);g.circle(x,y,r*.12);g.fill();
  }else if(e.type==='comboBone'){
    // Radial bone spears emerge from a fractured mine core.
    g.strokeColor=color('#d7c99f',a*150);ring(r*ease);
    g.fillColor=color('#f3e6c6',a*230);
    for(let i=0;i<(reduced?4:8);i++){
      const angle=i*Math.PI*2/(reduced?4:8),d=r*(.15+.7*ease),cx=x+Math.cos(angle)*d,cy=y+Math.sin(angle)*d;
      shape(g,cx,cy,angle,[[r*.13,0],[r*.02,r*.045],[-r*.1,r*.025],[-r*.1,-r*.025],[r*.02,-r*.045]]);
      g.strokeColor=color('#b5ddab',a*150);line(g,x+Math.cos(angle)*d*.55,y+Math.sin(angle)*d*.55,cx,cy);
    }
    g.strokeColor=color('#f6d39c',a*190);g.moveTo(x-r*.15,y+r*.12);g.lineTo(x,y-r*.08);g.lineTo(x+r*.15,y+r*.12);g.stroke();
  }else if(e.type==='comboJudgment'){
    // A falling execution blade and fire-chain brackets, anchored to the marked enemy.
    const h=r*(1.5+(1-ease)*2),tip=y+r*(1-ease);
    g.fillColor=color('#fff0bf',a*215);
    shape(g,x,tip,0,[[0,-r*.22],[-r*.13,r*.05],[-r*.08,h],[r*.08,h],[r*.13,r*.05]]);
    g.strokeColor=color('#ffbb6a',a*210);g.lineWidth=3;line(g,x-r*.38,tip+h*.7,x+r*.38,tip+h*.7);
    for(const side of [-1,1])for(let i=0;i<3;i++){g.ellipse(x+side*r*.63,y+(i-1)*r*.3,r*.12,r*.2);g.stroke();}
    g.strokeColor=color('#ffb078',a*170);g.lineWidth=2;g.ellipse(x,y,r*ease,r*.45*ease);g.stroke();
  }else if(e.type==='comboSoul'){
    // Ritual pedestal, three rising souls and an actual source-to-target soul ray.
    g.strokeColor=color('#bf9ef6',a*190);g.lineWidth=2;
    if(e.endX!==undefined&&e.endY!==undefined)line(g,e.endX*48,e.endY*48,x,y);
    g.ellipse(x,y,r,r*.5);g.stroke();
    line(g,x-r*.7,y-r*.25,x+r*.7,y-r*.25);line(g,x-r*.5,y-r*.42,x+r*.5,y-r*.42);
    for(let i=0;i<3;i++){
      const cx=x+(i-1)*r*.5,cy=y+r*(.15+ease*.7)+(i===1?r*.2:0),size=r*.13;
      g.fillColor=color('#e0d8ff',a*220);
      shape(g,cx,cy,0,[[0,size*1.8],[-size,size*.2],[-size,-size],[0,-size*.45],[size,-size],[size,size*.2]]);
    }
  }
  return true;
}
