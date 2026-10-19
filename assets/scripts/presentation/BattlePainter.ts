import { drawMoonEnemy, drawMoonHazard } from "./MoonPainter";
import { drawThunderEnemy, drawThunderHazard, drawThunderPreviews } from "./ThunderPainter";
import {drawExtraArmory} from "./ExtraArmoryPainter";
import { drawSandEnemy } from "./SandPainter";
import { sandEnemy } from "../battle/SandSystem";
import { drawSiegeEnemy, drawSiegeCharge } from "./SiegePainter";
import { siegeEnemy } from "../battle/SiegeSystem";
import { bossExposed } from "../battle/BossSystem";
import { Graphics, Color } from "cc";
import { SurvivalWorld, Effect } from "../battle/SurvivalWorld";
import { Card, COLORS, isElite, isLarge, WEAPONS, Skill } from "../battle/SurvivalConfig";
function color(hex: string, alpha = 255) {
  const c = new Color().fromHEX(hex);
  c.a = alpha;
  return c;
}
function polygon(g: Graphics, x: number, y: number, angle: number, points: number[][]) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  points.forEach(([u,v], i) => {
    const px=x+dx*u-dy*v, py=y+dy*u+dx*v;
    if(i===0)g.moveTo(px,py);else g.lineTo(px,py);
  });
  g.close();g.fill();
}
function crystal(g: Graphics,x:number,y:number,r:number,angle=0) {
  polygon(g,x,y,angle,[[r,0],[0,r*.38],[-r,0],[0,-r*.38]]);
}
export function skillGlyph(g:Graphics,key:Card,x:number,y:number,size=32){g.fillColor=color(COLORS[key]||'#d9ceaa');g.strokeColor=g.fillColor;g.lineWidth=3;if(key==='blade')crystal(g,x,y,size,Math.PI/4);else if(key==='fire'){g.circle(x,y,size*.7);g.fill();g.moveTo(x-size*.5,y);g.lineTo(x,y+size);g.lineTo(x+size*.5,y);g.fill();}else if(key==='water'){g.roundRect(x-size*.5,y-size*.7,size,size*1.3,6);g.fill();g.rect(x-size*.2,y+size*.5,size*.4,size*.4);g.fill();}else {g.circle(x,y,size*.75);g.stroke();g.moveTo(x-size*.4,y);g.lineTo(x+size*.4,y);g.moveTo(x,y-size*.4);g.lineTo(x,y+size*.4);g.stroke();}}
export class BattlePainter {
 private particles:{e:Effect;life:number;max:number}[]=[];
 constructor(private g:Graphics){}
 reset(){this.particles=[];}
 draw(w:SurvivalWorld,dt:number,events:Effect[],reduced=false){const g=this.g;g.clear();
 for(const e of events)if(['hit','death','playerHit','explosion','block','modify','ultimate','heal'].includes(e.type)){const max=e.type==='explosion'?.35:e.type==='modify'?.8:.18;this.particles.push({e,life:max,max});}
 this.particles=this.particles.slice(-(reduced?64:120));
 this.ground(w,reduced);
 drawExtraArmory(g,w,true,reduced);
    for (const e of w.enemies) {
      const x = e.x * 48,
        y = e.y * 48;
      g.fillColor = color("#040811", 75);
      g.ellipse(x, y - 7, isLarge(e.kind) ? 27 : 17, 6);
      g.fill();
      if(w.stageId===4)drawMoonEnemy(g,w,e);
      else if(w.stageId===3)drawThunderEnemy(g,w,e);
      if(w.stageId===2&&(e.kind==='boss'||sandEnemy(e.kind)))drawSandEnemy(g,w,e);
      if(w.stageId===1&&(e.kind==='boss'||siegeEnemy(e.kind)))drawSiegeEnemy(g,w,e);
      if (e.hp < e.maxHp || isLarge(e.kind)) {
        g.fillColor = color("#351f2f");
        g.rect(x - 20, y + (isLarge(e.kind) ? 70 : 53), 40, 4);
        g.fill();
        g.fillColor = color(isLarge(e.kind) ? "#eac681" : "#f39a80");
        g.rect(
          x - 20,
          y + (isLarge(e.kind) ? 70 : 53),
          (40 * e.hp) / e.maxHp,
          4,
        );
        g.fill();
      }
      if (e.kind === "boss") {
        const exposed = bossExposed(w, e);
        g.strokeColor = color(
          exposed ? "#f6d886" : e.bossPhase >= 2 ? "#ef8096" : "#b8a3db",
          210,
        );
        g.lineWidth = exposed ? 4 : 2;
        g.circle(
          x,
          y,
          exposed
            ? 37
            : 31 + (e.state === "windup" ? Math.sin(w.time * 8) * 4 : 0),
        );
        g.stroke();
        if (e.state === "windup") {
          g.moveTo(x - 24, y + 64);
          g.lineTo(x, y + 80);
          g.lineTo(x + 24, y + 64);
          g.stroke();
        }
      }
      if (e.burnUntil > w.time) {
        g.strokeColor = color("#ff824f", 150 + Math.round(Math.sin(w.time * 12) * 35));
        g.lineWidth = 3;
        g.circle(x, y + 18, (isLarge(e.kind) ? 34 : 23) + Math.sin(w.time * 8) * 2);
        g.stroke();
      }
      if (e.state === "windup") {
        g.strokeColor = color("#ff6b66", 150);
        g.lineWidth = 2;
        g.arc(x, y + 18, (isLarge(e.kind) ? 42 : 27) + Math.sin(w.time * 10) * 3, 0, Math.PI * 2, false);
        g.stroke();
      }
      if (isElite(e.kind)) {
        g.fillColor = color("#f2c66d", 210);
        g.moveTo(x - 12, y - 34); g.lineTo(x - 6, y - 48); g.lineTo(x, y - 38);
        g.lineTo(x + 7, y - 49); g.lineTo(x + 13, y - 34); g.close(); g.fill();
      }
      if (e.state === "arriving") {
        g.strokeColor = color("#e2b87f", 170);
        g.lineWidth = 2;
        g.circle(x, y, 24 + Math.sin(w.time * 10) * 4);
        g.stroke();
      }
      if (e.freezeUntil > w.time) {
        g.strokeColor = color("#91e9ff");
        g.lineWidth = 2;
        g.roundRect(x - 20, y - 3, 40, 48, 7);
        g.stroke();
      }
    }
    for (const gem of w.gems) {
      const x = gem.x * 48,
        y = gem.y * 48;
      const scale=1+Math.min(.65,Math.log2(1+Math.max(0,gem.value-1))*.12);
      g.fillColor = color("#56dfc2");
      g.moveTo(x, y + 7*scale);
      g.lineTo(x + 5*scale, y);
      g.lineTo(x, y - 7*scale);
      g.lineTo(x - 5*scale, y);
      g.close();
      g.fill();
      g.fillColor = color("#d4ffe9");
      g.rect(x - 1, y, 2, 4);
      g.fill();
    }
    this.projectiles(w);
    drawExtraArmory(g,w,false,reduced);
    for(const p of this.particles){p.life-=dt;if(p.life<=0)continue;const e=p.e,a=p.life/p.max,x=e.x*48,y=e.y*48;g.strokeColor=color(e.type==='playerHit'?'#ff6666':e.skill==='water'?'#9aefff':e.skill==='fire'?'#ffad55':'#fff1bd',Math.round(a*230));g.lineWidth=e.type==='explosion'?4:2;
     const radius=(e.radius||.4)*48;if(e.type==='explosion'){g.circle(x,y,radius);g.stroke();g.circle(x,y,radius*(1-a));g.stroke();if(e.form==='heavy'){g.circle(x,y,radius*.55);g.stroke();}}else {g.circle(x,y,(e.type==='modify'?60:14)*(1-a)+5);g.stroke();}
    }
    this.particles=this.particles.filter(p=>p.life>0);
    if(w.stageId===3)drawThunderPreviews(g,w);
    for (const h of w.hazards) {
      if(h.moon){drawMoonHazard(g,h,w.time);continue;}
      if(h.thunder){drawThunderHazard(g,h,w.time);continue;}
      const x = h.x * 48,
        y = h.y * 48,
        r = h.radius * 48,
        progress = Math.max(
          0,
          Math.min(1, (w.time - h.created) / (h.due - h.created)),
        );
      g.strokeColor = color(h.kind === "pool" ? "#c7e879" : "#ff7694", 230);
      g.fillColor = color(
        h.kind === "pool" ? "#a3bc51" : "#ed6c88",
        h.fired ? 65 : 25 + progress * 35,
      );
      if(h.siegeCharge){drawSiegeCharge(g,h,w.time);continue;}
      if(h.siegeGround){
        g.lineWidth=3;g.strokeColor=color('#e3a1ff',245);g.fillColor=color('#a454ba',h.fired?85:20+progress*35);
        g.circle(x,y,r);g.fill();g.stroke();if(!h.fired){g.circle(x,y,r*progress);g.stroke();}
        if(h.siegeLaunched&&!h.fired){const u=Math.max(0,Math.min(1,(w.time-h.created-(h.sandLaunchDelay??.2))/(h.due-h.created-(h.sandLaunchDelay??.2)))),sx=(h.endX??h.x)*48,sy=(h.endY??h.y)*48;g.fillColor=color('#ffe0a3');g.circle(sx+(x-sx)*u,sy+(y-sy)*u+Math.sin(u*Math.PI)*40,5);g.fill();}
        else{g.moveTo(x-10,y-10);g.lineTo(x+10,y+10);g.moveTo(x+10,y-10);g.lineTo(x-10,y+10);g.stroke();}continue;
      }
      if(h.kind==='frontierLane'||h.kind==='frontierImpact'){drawSiegeCharge(g,h,w.time);continue;}
      if(h.kind==='starTrace'){
        const bx=(h.endX??h.x)*48,by=(h.endY??h.y)*48,a=Math.atan2(by-y,bx-x),r=h.width*48,dx=-Math.sin(a)*r,dy=Math.cos(a)*r;
        g.fillColor=color('#dc9fc9',w.time>=h.due?120:20+progress*35);g.strokeColor=color('#f7b4d9',240);g.lineWidth=2;
        g.moveTo(x+dx,y+dy);for(let i=0;i<=12;i++){const t=a+Math.PI/2-i*Math.PI/12;g.lineTo(bx+Math.cos(t)*r,by+Math.sin(t)*r);}for(let i=0;i<=12;i++){const t=a-Math.PI/2-i*Math.PI/12;g.lineTo(x+Math.cos(t)*r,y+Math.sin(t)*r);}g.close();g.fill();g.stroke();
        crystal(g,x,y,4);crystal(g,bx,by,4);continue;
      }
      if(h.kind==='starLeap'){
        g.strokeColor=color('#ffc3e3',240);g.fillColor=color('#e1a2c7',h.fired?110:20+progress*40);g.circle(x,y,r);g.fill();g.stroke();
        g.circle(x,y,r*progress);g.stroke();crystal(g,x,y,8,Math.PI/4);continue;
      }
      g.lineWidth = 3;
      if (h.kind === "bellRing" || h.kind === "bellPulse") {
        const inner=h.width*48;
        g.strokeColor=color(w.time<h.due?"#ead499":"#b7f3ff",245);
        g.fillColor=color(w.time<h.due?"#d9be75":"#83dff3",w.time<h.due?35+progress*35:145);
        // Smooth wave bands instead of a tessellated, block-like filled ground area.
        if(inner>0){
          g.lineWidth=3;g.circle(x,y,inner);g.stroke();g.circle(x,y,r);g.stroke();
          const wave=inner+(r-inner)*(w.time<h.due?progress:Math.min(1,(w.time-h.due)/.25));
          g.lineWidth=w.time<h.due?2:7;g.circle(x,y,wave);g.stroke();
        }else{g.circle(x,y,r);g.stroke();g.circle(x,y,r*Math.max(.05,progress));g.stroke();}
        if(w.time<h.due){g.fillColor=color("#ffe6ae",180+progress*60);g.circle(x,y,5+progress*7);g.fill();}
      } else if (h.kind === "flameLine") {
        const dx = Math.cos(h.angle), dy = Math.sin(h.angle);
        if (w.time < h.due) {
          if(w.stageId>=6 && h.damageLabel){
            const spread=h.width*48;
            g.strokeColor=color("#ffd49a",245);g.lineWidth=3;
            g.moveTo(x-dy*spread,y+dx*spread);g.lineTo(x+dx*r-dy*spread,y+dy*r+dx*spread);
            g.lineTo(x+dx*r+dy*spread,y+dy*r-dx*spread);g.lineTo(x+dy*spread,y-dx*spread);g.close();g.stroke();
          }
          const pulse = 5 + progress * 8;
          g.fillColor = color("#ffb85a", 180 + progress * 60);
          g.circle(x + dx * 24, y + dy * 24 + 20, pulse); g.fill();
          g.strokeColor = color("#ffe6ad", 230);
          g.arc(x, y + 20, 23, h.angle - .6, h.angle + .6, false); g.stroke();
        } else {
          // Overlapping flame tongues, no rectangular ground fill or outline.
          for (let i = 0; i < 30; i++) {
            const t = (i + .5) / 30, d = t * r;
            const flicker = Math.sin(i * 2.4 + w.time * 40);
            const spread = h.width * 48 * (.55 + .2 * flicker);
            const cx = x + dx * d, cy = y + dy * d;
            g.fillColor = color(i % 2 ? "#ff7435" : "#ffbb55", 220);
            g.moveTo(cx - dy * spread, cy + dx * spread);
            g.quadraticCurveTo(cx + dx * 12 - dy * spread, cy + dy * 12 + dx * spread, cx + dx * 30, cy + dy * 30);
            g.quadraticCurveTo(cx - dx * 14 + dy * spread, cy - dy * 14 - dx * spread, cx - dy * spread, cy + dx * spread);
            g.close(); g.fill();
            g.fillColor = color("#fff0ac", 230);
            g.circle(cx, cy, 5 + 2 * flicker); g.fill();
          }
        }
      } else if (h.kind === "flame") {
        g.strokeColor=color("#ffe1a0",240);g.fillColor=color("#ff713c",w.time>=h.due?100:25+progress*35);
        g.circle(x,y,r);g.fill();g.stroke();
        if(w.time<h.due){g.circle(x,y,r*progress);g.stroke();}
        else for(let i=0;i<12;i++){const a=i*Math.PI/6;g.moveTo(x+Math.cos(a)*r*.6,y+Math.sin(a)*r*.6);g.lineTo(x+Math.cos(a)*r*.75,y+Math.sin(a)*r*.75+12);g.stroke();}
      } else if (h.kind === "arrow") {
        const dx = Math.cos(h.angle),
          dy = Math.sin(h.angle);
        if (w.time < h.due) {
          if(h.fixedDamage){
            g.strokeColor=color('#ffc4a0',180+progress*65);g.lineWidth=2;
            const spread=h.width*48;
            g.moveTo(x-dy*spread,y+dx*spread);g.lineTo(x+dx*r-dy*spread,y+dy*r+dx*spread);
            g.moveTo(x+dy*spread,y-dx*spread);g.lineTo(x+dx*r+dy*spread,y+dy*r-dx*spread);g.stroke();
          }
          // A local bow glint replaces the screen-spanning aiming ray.
          const flash = Math.sin(progress * Math.PI);
          g.strokeColor = color("#ffe6a5", 100 + flash * 155);
          g.lineWidth = 2 + flash;
          g.arc(x + 18, y + 23, 16, -Math.PI / 2, Math.PI / 2, false);
          g.stroke();
          g.fillColor = color("#fff4cc", 100 + flash * 155);
          g.circle(x + 31, y + 23, 2 + flash * 2);
          g.fill();
        } else {
          const d = (w.time - h.due) * (h.projectileSpeed ?? 4.5) * 48,
            ax = x + dx * d,
            ay = y + dy * d;
          g.lineWidth = 4;
          g.moveTo(ax - dx * 17, ay - dy * 17);
          g.lineTo(ax, ay);
          g.stroke();
          g.moveTo(ax - dx * 8 - dy * 5, ay - dy * 8 + dx * 5);
          g.lineTo(ax, ay);
          g.lineTo(ax - dx * 8 + dy * 5, ay - dy * 8 - dx * 5);
          g.stroke();
        }
      } else if (h.kind === "line") {
        // Show direction near the charging actor, not the full damage corridor.
        if (w.time >= h.due) continue;
        const dx = Math.cos(h.angle),
          dy = Math.sin(h.angle);
        const length = Math.min(h.radius, 1.6) * 48;
        g.strokeColor = color("#ff9aab", 150 + progress * 90);
        g.lineWidth = 3;
        g.moveTo(x + dx * 20, y + dy * 20);
        g.lineTo(x + dx * length, y + dy * length);
        g.moveTo(
          x + dx * (length - 14) - dy * 10,
          y + dy * (length - 14) + dx * 10,
        );
        g.lineTo(x + dx * length, y + dy * length);
        g.lineTo(
          x + dx * (length - 14) + dy * 10,
          y + dy * (length - 14) - dx * 10,
        );
        g.stroke();
      } else if (h.kind === "sector") {
        const start=h.angle-h.width/2,end=h.angle+h.width/2;
        // The danger edge matches the sector hit test; impact is an arcing blade/wail.
        const bladeArc=(radius:number)=>{
          for(let i=0;i<=40;i++){
            const a=start+(end-start)*i/40;
            const px=x+Math.cos(a)*radius,py=y+Math.sin(a)*radius;
            if(i===0)g.moveTo(px,py);else g.lineTo(px,py);
          }
          g.stroke();
        };
        bladeArc(r);
        if(w.time<h.due){
          for(const a of [start,end]){
            g.moveTo(x+Math.cos(a)*r*.84,y+Math.sin(a)*r*.84);
            g.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);g.stroke();
          }
          g.fillColor=color("#ffbd9d",160+progress*90);
          g.circle(x+Math.cos(h.angle)*22,y+Math.sin(h.angle)*22,5+progress*6);g.fill();
        }else{
          for(let i=0;i<4;i++){
            g.strokeColor=color(i===0?"#fff0cb":"#ff997f",240-i*45);
            g.lineWidth=7-i;bladeArc(r*(1-i*.12));
          }
        }
      } else if (h.kind === "burst" && w.time >= h.due) {
        g.fillColor = color("#efaaac");
        for (let i = 0; i < 8; i++) {
          const a = h.angle + (i * Math.PI) / 4,
            d = (w.time - h.due) * 3 * 48;
          g.circle(x + Math.cos(a) * d, y + Math.sin(a) * d, 9);
          g.fill();
        }
      } else {
        g.circle(x, y, h.kind === "burst" ? 38 : r);
        g.fill();
        g.stroke();
        if (!h.fired && h.kind !== "burst") {
          g.circle(x, y, r * progress);
          g.stroke();
          g.moveTo(x - 8, y);
          g.lineTo(x + 8, y);
          g.moveTo(x, y - 8);
          g.lineTo(x, y + 8);
          g.stroke();
        }
      }
    }
  }

 private ground(w:SurvivalWorld,reduced:boolean){const g=this.g;for(const f of w.armory.fields){if(!f.active)continue;const x=f.x*48,y=f.y*48,r=f.radius*48,water=f.skill==='water';g.fillColor=color(water?'#4ac4eb':'#ff752f',water?38:45);g.circle(x,y,r);g.fill();g.strokeColor=color(water?'#8be8ff':'#ffb35d',135);g.lineWidth=2;g.circle(x,y,r);g.stroke();
  if(water&&f.stats.mods.includes('wave')){g.lineWidth=4;g.arc(x,y,r,f.angle-1.1,f.angle+1.1,false);g.stroke();}
  if(water&&f.returning&&f.returnTarget){g.moveTo(x,y);g.lineTo(f.returnTarget.x*48,f.returnTarget.y*48);g.stroke();}
  if(water&&f.stats.mods.includes('pulse')){const q=w.time%1;g.circle(x,y,r*(.25+.75*q));g.stroke();}else if(!reduced){g.circle(x,y,r*(.45+.15*Math.sin(w.time*4)));g.stroke();}
  if(!water)for(let i=0;i<3;i++){const a=i*2.1+w.time;g.moveTo(x+Math.cos(a)*r*.5,y+Math.sin(a)*r*.5);g.lineTo(x+Math.cos(a)*r*.5+5,y+Math.sin(a)*r*.5+18);g.stroke();}
 }}
 private projectiles(w:SurvivalWorld){const g=this.g;
  for(const c of w.armory.pending)if(c.skill==='fire'&&c.stats.mods.includes('heavy')){const q=1-Math.max(0,c.due-w.time)/.35;g.strokeColor=color('#ffb363',220);g.lineWidth=3;g.circle(c.origin.x*48,c.origin.y*48+30,8+18*q);g.stroke();}
  for(const p of w.armory.shots){if(!p.active)continue;const x=p.x*48,y=p.y*48;g.lineWidth=3;g.strokeColor=color(COLORS[p.skill],235);g.fillColor=color(COLORS[p.skill],255);
   if(p.skill==='blade'){const size=p.child?10:19;g.moveTo(x-Math.cos(p.angle)*size*1.6,y-Math.sin(p.angle)*size*1.6);g.lineTo(x,y);g.stroke();crystal(g,x,y,size,p.angle);if(p.stats.mods.includes('hunt')){g.strokeColor=color('#ef9d80');g.circle(x,y,10);g.stroke();}if(p.returning){g.strokeColor=color('#98eacb');g.arc(x,y,15,0,Math.PI*1.5,false);g.stroke();}}
   else if(p.skill==='fire'){const r=p.child?6:p.stats.mods.includes('heavy')?17:10;g.circle(x,y,r);g.fill();g.strokeColor=color('#ef6544',180);g.lineWidth=r;g.moveTo(x,y);g.lineTo(x-Math.cos(p.angle)*r*2,y-Math.sin(p.angle)*r*2);g.stroke();g.fillColor=color('#fff2c9');g.circle(x,y,r*.45);g.fill();}
   else {const q=Math.min(1,p.age/.45),arc=Math.sin(q*Math.PI)*60;g.roundRect(x-7,y+arc-8,14,21,3);g.fill();g.fillColor=color('#e9feff');g.rect(x-3,y+arc+12,6,5);g.fill();}
  }
 }
}
