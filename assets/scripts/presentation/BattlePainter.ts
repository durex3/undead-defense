import { formTier } from "../battle/WeaponForms";
import {arsenalAura} from "../battle/ArsenalSystem";
import {starHeight} from "../battle/ObservatorySystem";
import { bossExposed } from "../battle/BossSystem";
import { expansionGlyph, drawExpansion } from "./ExpansionPainter";
import { Graphics, Color } from "cc";
import { SurvivalWorld, Effect } from "../battle/SurvivalWorld";
import { Card, COLORS, isElite, isLarge, WEAPONS, Skill } from "../battle/SurvivalConfig";
function color(hex: string, alpha = 255) {
  const c = new Color().fromHEX(hex);
  c.a = alpha;
  return c;
}
// Local oriented geometry keeps form silhouettes attached to the actual shot center.
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
export function skillGlyph(
  g: Graphics,
  key: Card,
  x: number,
  y: number,
  size = 32,
) {
  const c = COLORS[key] || "#f0d292";
  g.strokeColor = color(c);
  g.fillColor = color(c);
  g.lineWidth = 3;
  if (expansionGlyph(g, key, x, y, size)) return;
  if (key === "blade") {
    g.moveTo(x - size * 0.7, y - size * 0.7);
    g.lineTo(x + size * 0.4, y + size * 0.5);
    g.lineTo(x + size * 0.7, y + size);
    g.lineTo(x + size * 0.1, y + size * 0.6);
    g.lineTo(x - size * 0.7, y - size * 0.7);
    g.fill();
    g.moveTo(x - size * 0.55, y - size * 0.15);
    g.lineTo(x - size * 0.1, y - size * 0.6);
    g.stroke();
  } else if (key === "scythe") {
    g.lineWidth = Math.max(3, size * .16);
    g.arc(x, y, size * .85, -.9, 1.7, false);
    g.stroke();
    g.moveTo(x - size * .1, y + size * .65);
    g.lineTo(x + size * .5, y - size * .6);
    g.stroke();
  } else if (key === "ice") {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3,
        dx = Math.cos(a),
        dy = Math.sin(a);
      g.moveTo(x, y);
      g.lineTo(x + dx * size, y + dy * size);
      g.stroke();
      for (const b of [-0.5, 0.5]) {
        g.moveTo(x + dx * size * 0.6, y + dy * size * 0.6);
        g.lineTo(
          x + Math.cos(a + b) * size * 0.82,
          y + Math.sin(a + b) * size * 0.82,
        );
        g.stroke();
      }
    }
  } else if (key === "lightning") {
    g.moveTo(x + size * 0.3, y + size);
    g.lineTo(x - size * 0.5, y);
    g.lineTo(x + size * 0.1, y);
    g.lineTo(x - size * 0.3, y - size);
    g.lineTo(x + size * 0.65, y + size * 0.15);
    g.lineTo(x + size * 0.1, y + size * 0.15);
    g.close();
    g.fill();
  } else if (key === "fire") {
    g.moveTo(x, y + size);
    g.bezierCurveTo(
      x - size * 0.1,
      y + size * 0.2,
      x - size,
      y,
      x - size * 0.6,
      y - size * 0.6,
    );
    g.bezierCurveTo(
      x,
      y - size * 1.2,
      x + size,
      y - size * 0.6,
      x + size * 0.45,
      y + size * 0.25,
    );
    g.lineTo(x + size * 0.1, y);
    g.close();
    g.fill();
    g.fillColor = color("#fff2c1");
    g.circle(x, y - size * 0.35, size * 0.25);
    g.fill();
  } else if (key === "ghost") {
    g.roundRect(
      x - size * 0.6,
      y - size * 0.7,
      size * 1.2,
      size * 1.6,
      size * 0.5,
    );
    g.fill();
    g.fillColor = color("#223447");
    g.circle(x - size * 0.22, y + size * 0.2, size * 0.1);
    g.circle(x + size * 0.22, y + size * 0.2, size * 0.1);
    g.fill();
  } else if (key === "repair") {
    g.fillColor = color("#f19b9d");
    g.rect(x - size * 0.2, y - size * 0.7, size * 0.4, size * 1.4);
    g.rect(x - size * 0.7, y - size * 0.2, size * 1.4, size * 0.4);
    g.fill();
  } else {
    g.circle(x, y, size * 0.7);
    g.stroke();
    g.moveTo(x - size * 0.45, y - size * 0.45);
    g.lineTo(x + size * 0.45, y + size * 0.45);
    g.stroke();
  }
}
export class BattlePainter {
  private particles: { e: Effect; life: number; max: number }[] = [];
  private feedbackClock = 0;
  private cueUntil = new Map<string, number>();
  constructor(private g: Graphics) {}
  reset() {
    this.particles = [];
    this.feedbackClock = 0;
    this.cueUntil.clear();
  }
  draw(w: SurvivalWorld, dt: number, events: Effect[]) {
    const g = this.g;
    g.clear();
    this.feedbackClock += dt;
    for (const e of events) {
      if (e.type.startsWith("combo")) {
        if ((this.cueUntil.get(e.type) ?? -Infinity) > this.feedbackClock) continue;
        this.cueUntil.set(e.type, this.feedbackClock + 0.1);
      }
      if (
        [
          "playerHit",
          "hit",
          "death",
          "block",
          "explosion",
          "lightning",
          "ultimate",
          "hazard",
          "learn",
          "evolve",
          "heal",
          "fireImpact",
          "comboFire",
          "comboIce",
          "comboPurify", "comboBone", "comboJudgment", "comboSoul", "comboGhost", "comboReap", "comboCollapse",
        ].includes(e.type)
      ) {
        const max =
          e.final ? 1.1 : e.type === "fireImpact" ? (e.form === "inferno" ? 0.35 : 0.6) : e.type.startsWith("combo") ? 0.45 : e.type === "lightning"
            ? 0.25
            : e.type === "hit"
              ? 0.22
              : e.type === "evolve"
                ? 1
                : 0.5;
        this.particles.push({ e, life: max, max });
      }
    }
    // Reserve room for final evolutions and combination cues before drawing.
    const final = this.particles.filter(p => p.e.final).slice(-6);
    const accents = this.particles.filter(p => !p.e.final && (p.e.type.startsWith("combo") || p.e.type === "fireImpact")).slice(-30);
    const ordinary = this.particles.filter(p => !p.e.final && !p.e.type.startsWith("combo") && p.e.type !== "fireImpact").slice(-144);
    this.particles = [...ordinary, ...accents, ...final];
    drawExpansion(g, w);
    for (const z of w.zones) {
      g.fillColor = color("#e9823f", 45);
      g.circle(z.x * 48, z.y * 48, z.radius * 48);
      g.fill();
      g.strokeColor = color("#efa657", 130);
      g.lineWidth = 2;
      g.circle(z.x * 48, z.y * 48, z.radius * 44);
      g.stroke();
      if (z.form === "inferno") {
        g.fillColor = color("#ffbf62", 100);
        for (let i = 0; i < 5; i++) {
          const angle = i * Math.PI * 2 / 5 + w.time * 0.4;
          const x = (z.x + Math.cos(angle) * z.radius * 0.5) * 48;
          const y = (z.y + Math.sin(angle) * z.radius * 0.5) * 48;
          polygon(g, x, y, Math.PI / 2, [[14 + Math.sin(w.time * 9 + i) * 4, 0], [-5, 5], [-3, -5]]);
        }
      } else if (z.form === "meteor") {
        g.strokeColor = color("#ffd18a", 110);
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          g.moveTo(z.x * 48, z.y * 48);
          g.lineTo((z.x + Math.cos(angle + 0.15) * z.radius * 0.4) * 48, (z.y + Math.sin(angle + 0.15) * z.radius * 0.4) * 48);
          g.lineTo((z.x + Math.cos(angle) * z.radius * 0.75) * 48, (z.y + Math.sin(angle) * z.radius * 0.75) * 48);
        }
        g.stroke();
      }
    }
    if (w.weaponEvolution("ice") === "domain") {
      g.fillColor = color("#7ad9f2", 18);
      g.circle(w.player.x * 48, w.player.y * 48, 3.5 * 48);
      g.fill();
      g.strokeColor = color("#82d9ee", 65);
      g.circle(w.player.x * 48, w.player.y * 48, 3.5 * 48);
      g.stroke();
    }
    for (const e of w.enemies) {
      const x = e.x * 48,
        y = e.y * 48;
      g.fillColor = color("#040811", 75);
      g.ellipse(x, y - 7, isLarge(e.kind) ? 27 : 17, 6);
      g.fill();
      if(e.kind==='sailor'){g.fillColor=color("#bde1db",210);g.rect(x-13,y+24,26,6);g.fill();}
      if(['starpatrol','starweaver','starpuppet'].includes(e.kind)||(e.kind==='boss'&&w.stageId===10)){
        const sy=y+starHeight(e)+(e.kind==='boss'?72:44);
        g.strokeColor=color('#d3c6ef');g.lineWidth=2;g.circle(x,sy,e.kind==='boss'?30:13);g.stroke();
        crystal(g,x,sy,e.kind==='starweaver'?10:6,Math.PI/4);
        if(e.kind==='starpatrol'){g.moveTo(x-22,sy-4);g.lineTo(x-12,sy+5);g.moveTo(x+22,sy-4);g.lineTo(x+12,sy+5);g.stroke();}
        if(e.kind==='starweaver'){g.moveTo(x+20,sy-35);g.lineTo(x+20,sy+15);g.stroke();}
        if(e.kind==='starpuppet'&&e.state==='windup'){g.circle(x,y+6,17);g.stroke();}
        if(e.leapStart&&e.leapEnd){g.strokeColor=color('#cfbdeb',140);g.moveTo(e.leapStart.x*48,e.leapStart.y*48);g.quadraticCurveTo((e.leapStart.x+e.leapEnd.x)*24,(e.leapStart.y+e.leapEnd.y)*24+100,e.leapEnd.x*48,e.leapEnd.y*48);g.stroke();}
      }
      if(e.kind==='boneguard'){
        g.strokeColor=color('#d6c9ac');g.lineWidth=3;g.moveTo(x+19,y+4);g.lineTo(x+19,y+50);g.stroke();
        g.fillColor=color('#e5ded0');g.moveTo(x+19,y+57);g.lineTo(x+13,y+42);g.lineTo(x+25,y+42);g.close();g.fill();
      }
      if(e.kind==='standardbearer'||e.kind==='warflag'||(e.kind==='boss'&&w.stageId===9)){
        const height=e.kind==='boss'?85:55;
        g.strokeColor=color('#ead5a7');g.lineWidth=3;g.moveTo(x+18,y);g.lineTo(x+18,y+height);g.stroke();
        g.fillColor=color('#c26c62');g.moveTo(x+18,y+height);g.lineTo(x+45,y+height-9);g.lineTo(x+18,y+height-20);g.close();g.fill();
        if((e.kind==='standardbearer'&&e.state==='windup'&&e.freezeUntil<=w.time)||e.kind==='warflag'){
          g.strokeColor=color('#dfbf7d',70);g.lineWidth=2;g.circle(x,y,4*48);g.stroke();
          for(const o of w.enemies)if(o.hp>0&&['minion','boneguard'].includes(o.kind)&&Math.hypot(o.x-e.x,o.y-e.y)<=4){g.moveTo(x,y);g.lineTo(o.x*48,o.y*48+12);}g.stroke();
        }
      }
      if(e.kind==='crossbowman'){
        g.strokeColor=color('#e3d5bb');g.lineWidth=3;g.moveTo(x-18,y+24);g.lineTo(x+18,y+24);g.moveTo(x,y+14);g.lineTo(x,y+39);g.stroke();
      }
      if(w.stageId===9&&arsenalAura(w,e)>1){g.fillColor=color('#e8c06c',200);g.moveTo(x-5,y+42);g.lineTo(x,y+49);g.lineTo(x+5,y+42);g.close();g.fill();}
      if(e.kind==='drowned'){g.strokeColor=color("#81c8df",180);g.lineWidth=2;g.moveTo(x-18,y-8);g.lineTo(x+18,y-8);g.stroke();}
      if(e.kind==='anchorhand'||(e.kind==='boss'&&w.stageId===8)){g.strokeColor=color("#d9c597",230);g.lineWidth=3;const sy=y+(e.kind==='boss'?55:28);g.circle(x,sy+12,4);g.moveTo(x,sy+8);g.lineTo(x,sy-10);g.moveTo(x-12,sy);g.quadraticCurveTo(x,sy-20,x+12,sy);g.stroke();}
      const venomStacks=w.expansion.venomStacks(e.id);
      if(venomStacks && e.hp>0){
        g.fillColor=color("#c8ef75",225);
        for(let i=0;i<venomStacks;i++)g.circle(x+(i-(venomStacks-1)/2)*6,y+(isLarge(e.kind)?79:62),2);
        g.fill();
      }
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
      for (const main of ["ghost", "scythe"] as const) if (w.combinations.marked(main,e)) {
        g.strokeColor=color(main === "ghost" ? "#b4d6ff" : "#a8eac0",170);g.lineWidth=2;
        g.arc(x,y+14,18,main === "ghost" ? 0 : Math.PI,main === "ghost" ? Math.PI : Math.PI*2,false);g.stroke();
      }
      if (e.kind === "boss" && w.stageId === 5) {
        g.fillColor=color("#693044",210);
        g.moveTo(x-30,y+60);g.lineTo(x-54,y-15);g.lineTo(x-24,y);g.close();g.fill();
        g.moveTo(x+30,y+60);g.lineTo(x+54,y-15);g.lineTo(x+24,y);g.close();g.fill();
        g.fillColor=color("#f3ce79");
        g.moveTo(x-25,y+67);g.lineTo(x-30,y+97);g.lineTo(x-10,y+84);g.lineTo(x,y+108);g.lineTo(x+10,y+84);g.lineTo(x+30,y+97);g.lineTo(x+25,y+67);g.close();g.fill();
      }
      if (e.kind === "boss" && w.stageId >= 6) {
        g.strokeColor=color(w.stageId===6?"#ffd19a":"#b9c4ff",230);g.lineWidth=4;
        if(w.stageId===6){
          g.moveTo(x-30,y+52);g.lineTo(x-46,y+84);g.lineTo(x-63,y+73);g.lineTo(x-48,y+42);g.stroke();
          g.fillColor=color("#b47b52");g.roundRect(x+25,y+49,38,23,5);g.fill();
        }else{
          g.arc(x,y+42,38,w.time, w.time+Math.PI*1.5,false);g.stroke();
          for(let i=0;i<3;i++){const a=w.time+i*Math.PI*2/3;crystal(g,x+Math.cos(a)*43,y+42+Math.sin(a)*43,8,a);}
        }
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
      if (e.kind === "archer") {
        g.strokeColor = color("#d8b27e");
        g.lineWidth = 3;
        g.arc(x + 18, y + 23, 16, -Math.PI / 2, Math.PI / 2, false);
        g.stroke();
        g.moveTo(x + 18, y + 7);
        g.lineTo(x + 18, y + 39);
        g.stroke();
      }
      if (e.kind === "drummer") {
        g.fillColor = color("#9b5960");
        g.roundRect(x - 16, y + 8, 32, 22, 4);
        g.fill();
        g.strokeColor = color("#f0d79e");
        g.lineWidth = 3;
        g.ellipse(x, y + 30, 16, 5);
        g.stroke();
        g.strokeColor = color("#e9c17e", 50);
        g.circle(x, y, (2.5 + 0.5 * Math.sin(w.time * 4)) * 48);
        g.stroke();
      }
      if (e.kind === "summoner" || (e.kind === "boss" && w.stageId === 2)) {
        g.strokeColor = color("#b19c83");
        g.lineWidth = 4;
        g.moveTo(x + 22, y + 7);
        g.lineTo(x + 22, y + 47);
        g.stroke();
        g.fillColor = color("#a0a4af");
        g.roundRect(x + 15, y + 2, 14, 15, 3);
        g.fill();
      }
      if (e.kind === "banshee" && e.state === "windup") {
        g.strokeColor = color("#d4abea");
        g.lineWidth = 2;
        g.circle(x, y + 26, 12 + Math.sin(w.time * 20) * 3);
        g.stroke();
      }
      if (e.kind === "shield") {
        const dx = Math.cos(e.facing) * 17,
          dy = Math.sin(e.facing) * 17;
        g.fillColor = color("#9fb0ae");
        g.strokeColor = color("#e6d3a3");
        g.lineWidth = 3;
        g.roundRect(x + dx - 10, y + dy + 6, 20, 29, 4);
        g.fill();
        g.stroke();
        g.moveTo(x + dx - 6, y + dy + 22);
        g.lineTo(x + dx + 6, y + dy + 22);
        g.stroke();
      }
      if (e.kind === "executioner") {
        g.strokeColor = color("#d8c3a3");
        g.lineWidth = 4;
        g.moveTo(x - 26, y + 8);
        g.lineTo(x - 26, y + 52);
        g.moveTo(x + 26, y + 8);
        g.lineTo(x + 26, y + 52);
        g.stroke();
        g.fillColor = color("#b9c8cd");
        g.rect(x - 37, y + 36, 17, 13);
        g.rect(x + 20, y + 36, 17, 13);
        g.fill();
      }
      if (e.kind === "charger") {
        g.strokeColor = color("#dab97a");
        g.lineWidth = 4;
        g.arc(x, y + 18, 20, 0, Math.PI, false);
        g.stroke();
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
      g.fillColor = color("#56dfc2");
      g.moveTo(x, y + 7);
      g.lineTo(x + 5, y);
      g.lineTo(x, y - 7);
      g.lineTo(x - 5, y);
      g.close();
      g.fill();
      g.fillColor = color("#d4ffe9");
      g.rect(x - 1, y, 2, 4);
      g.fill();
    }
    for (const r of w.rings) {
      const tier=formTier(w.skills.ice,!!w.evolutions.ice);
      const cx=r.x*48,cy=r.y*48,rr=r.radius*48;
      g.fillColor=color("#bcefff",Math.max(0,190-r.age*190));
      if(tier>0)for(let i=0;i<6;i++) {
        const a=i*Math.PI/3+w.time*.15;
        crystal(g,cx+Math.cos(a)*rr*.87,cy+Math.sin(a)*rr*.87,Math.min(15,rr*.12),a);
      }
      if(tier>=2) {
        g.strokeColor=color("#bcefff",Math.max(0,150-r.age*150));g.lineWidth=2;
        for(let i=0;i<6;i++) {
          const a=i*Math.PI/3+w.time*.15,b=a+Math.PI*2/3;
          g.moveTo(cx+Math.cos(a)*rr*.7,cy+Math.sin(a)*rr*.7);
          g.lineTo(cx+Math.cos(b)*rr*.7,cy+Math.sin(b)*rr*.7);g.stroke();
        }
      }
      if(tier===3)for(let i=0;i<6;i++) {
        const a=i*Math.PI/3;crystal(g,cx+Math.cos(a)*rr*.5,cy+Math.sin(a)*rr*.5,Math.min(22,rr*.16),a+Math.PI/2);
      }
      g.strokeColor = color("#91e9ff", Math.max(0, 255 - r.age * 260));
      g.lineWidth = 5;
      g.circle(r.x * 48, r.y * 48, r.radius * 48);
      g.stroke();
      g.strokeColor = color("#dbffff", 110);
      g.lineWidth = 2;
      g.circle(r.x * 48, r.y * 48, Math.max(0, r.radius * 48 - 7));
      g.stroke();
    }
    for (const p of w.shots) {
      const x = p.x * 48,
        y = p.y * 48 + 12;
      g.fillColor = color(COLORS[p.skill]);
      g.strokeColor = color(COLORS[p.skill]);
      const tier=formTier(w.skills[p.skill],!!w.evolutions[p.skill]);
      const direction=Math.atan2(p.vy,p.vx);
      if (p.skill === "fire") {
        const fireForm = p.form || w.weaponEvolution("fire");
        if (fireForm === "inferno") {
          g.fillColor = color("#ff7148", 160);
          polygon(g, x, y, direction, [[13, 0], [-28, 9], [-17, 0], [-28, -9]]);
          g.fillColor = color("#ffcc6c", 235);
          polygon(g, x, y, direction, [[12, 0], [-16, 5], [-10, 0], [-16, -5]]);
          g.fillColor = color("#fff7d4", 245);
          g.circle(x, y, 5); g.fill();
          continue;
        }
        const r = tier>=2 ? (fireForm === "meteor" ? 19 : 14) : 8;
        for(let i=1;i<=5;i++){
          g.fillColor=color("#ec7448",110-i*15);
          g.circle(x-p.vx*i*.4,y-p.vy*i*.4,r*(1-i*.14));g.fill();
        }
        if(tier>=1) {
          g.fillColor=color("#ff9e4c",190);
          polygon(g,x,y,direction,[[-r*3,0],[-r*.7,r*.8],[r,0],[-r*.7,-r*.8]]);
        }
        g.fillColor=color(COLORS.fire);
        g.circle(x, y, r);
        g.fill();
        g.fillColor = color("#fff0b0");
        g.circle(x + 2, y + 2, r * 0.5);
        g.fill();
        if(tier>=2) {
          g.fillColor=color("#7f372f");
          for(let i=0;i<3;i++)crystal(g,x+Math.cos(i*2.1+p.age)*r*.65,y+Math.sin(i*2.1+p.age)*r*.65,r*.65,i*2.1+p.age);
        }
        if(tier===3) {
          g.strokeColor=color("#ffe9a7",220);g.lineWidth=2;g.circle(x,y,r+5);g.stroke();
          g.fillColor=color("#ffbf67");for(let i=0;i<4;i++)crystal(g,x,y,21,p.age*5+i*Math.PI/2);
          g.fillColor=color("#fff3bc");g.circle(x,y,6);g.fill();
        }
      } else if (p.skill === "ice") {
        g.strokeColor=color("#a3f4ff",240);g.fillColor=color("#dcfcff",235);g.lineWidth=2;
        polygon(g,x,y,direction,[[23,0],[-7,7],[-3,0],[-7,-7]]);
        g.moveTo(x-Math.cos(direction)*25,y-Math.sin(direction)*25);g.lineTo(x,y);g.stroke();
      } else if (p.skill === "bone" && p.form === "ricochet") {
        g.fillColor=color("#fff0cf",235);g.strokeColor=color("#b9a890",200);g.lineWidth=2;
        polygon(g,x,y,p.age*15,[[11,0],[3,6],[-5,8],[-3,0],[-5,-8],[3,-6]]);
      } else if (p.skill === "bone") {
        const dx = p.vx / 13,
          dy = p.vy / 13,
          wide = tier>=2 ? 6 : 3;
        g.lineWidth = wide;
        g.moveTo(x - dx * 30, y - dy * 30);
        g.lineTo(x + dx * 12, y + dy * 12);
        g.stroke();
        g.circle(x + dx * 12 - dy * wide, y + dy * 12 + dx * wide, wide * 0.65);
        g.circle(x + dx * 12 + dy * wide, y + dy * 12 - dx * wide, wide * 0.65);
        g.fill();
        if(tier>=1)for(let i=0;i<(tier===3?4:2);i++) {
          const u=-i*7;
          polygon(g,x,y,direction,[[u+6,0],[u-7,9],[u-4,0],[u-7,-9]]);
        }
        if(tier>=2)polygon(g,x,y,direction,[[20,0],[2,10],[-5,0],[2,-10]]);
      } else if (p.skill === "scythe") {
        const r = p.form === "cross" ? 19 : tier>=2 ? 25 : 16;
        g.lineWidth = tier>=2 ? 7 : 5;
        g.arc(x, y, r, p.age * 16, p.age * 16 + Math.PI * 1.3, false);
        g.stroke();
        g.lineWidth = 3;
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(p.age * 16) * r, y + Math.sin(p.age * 16) * r);
        g.stroke();
        if(tier>=1) {
          g.arc(x,y,r,p.age*16+Math.PI,p.age*16+Math.PI*2.3,false);g.stroke();
        }
        if(tier>=2)polygon(g,x,y,p.age*16,[[r,0],[r*.2,r*.8],[-r*.6,r*.65],[0,r*.3]]);
        if(p.form === "cross") {
          polygon(g,x,y,direction,[[28,0],[8,8],[-16,3],[-20,0],[-16,-3],[8,-8]]);
        } else if(tier===3) {
          g.circle(x,y,r*.65);g.stroke();
          for(let i=0;i<4;i++)polygon(g,x,y,p.age*16+i*Math.PI/2,[[r,0],[r*.6,r*.5],[r*.3,r*.2],[r*.5,-r*.3]]);
        }
      } else if (p.skill === "axe") {
        const r = p.form === "execution" ? 27 : tier>=2 ? 20 : 14;
        const a = p.form === "execution" ? direction : p.age * 14;
        g.strokeColor = color(COLORS.axe, 235);
        g.fillColor = color(COLORS.axe, 235);
        g.lineWidth = 4;
        const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
        g.moveTo(x - dx * r * .75, y - dy * r * .75); g.lineTo(x + dx * r * .75, y + dy * r * .75); g.stroke();
        g.moveTo(x + dx * r * .1 - nx * r * .75, y + dy * r * .1 - ny * r * .75);
        g.lineTo(x + dx * r * .8 - nx * r * .35, y + dy * r * .8 - ny * r * .35);
        g.lineTo(x + dx * r * .55 + nx * r * .35, y + dy * r * .55 + ny * r * .35);
        g.lineTo(x + dx * r * .1 + nx * r * .75, y + dy * r * .1 + ny * r * .75);
        g.close();
        g.fill();
        if(tier===1)polygon(g,x,y,a+Math.PI,[[r*.1,-r*.75],[r*.8,-r*.35],[r*.55,r*.35],[r*.1,r*.75]]);
        if(tier>=2 && p.form !== "execution") {
          g.circle(x,y,r*.65);g.stroke();
          for(let i=0;i<(tier===3?4:8);i++)polygon(g,x,y,a+i*Math.PI*2/(tier===3?4:8),[[r*.5,-3],[r+3,-5],[r*.8,6],[r*.5,3]]);
        }
      } else if (p.skill === "lightning") {
        const dx = p.vx / Math.max(1, Math.hypot(p.vx, p.vy));
        const dy = p.vy / Math.max(1, Math.hypot(p.vx, p.vy));
        const nx = -dy, ny = dx;
        g.strokeColor = color("#e5c8ff", 240);
        g.lineWidth = 4;
        g.moveTo(x - dx * 22, y - dy * 22);
        g.lineTo(x - dx * 8 + nx * 7, y - dy * 8 + ny * 7);
        g.lineTo(x + dx * 2 - nx * 5, y + dy * 2 - ny * 5);
        g.lineTo(x + dx * 22, y + dy * 22);
        g.stroke();
        g.fillColor = color("#fff5ff", 230);
        g.circle(x, y, 4); g.fill();
        if(tier>=1)for(const side of [-1,1]) {
          g.moveTo(x-dx*8,y-dy*8);g.lineTo(x+dx*4+nx*side*14,y+dy*4+ny*side*14);g.lineTo(x+dx*17+nx*side*10,y+dy*17+ny*side*10);g.stroke();
        }
        if(tier>=2){g.fillColor=color("#eedcff",210);crystal(g,x,y,13,direction);}
        if(tier===3){g.circle(x,y,18);g.stroke();for(let i=0;i<4;i++){const a=i*Math.PI/2+p.age*4;crystal(g,x+Math.cos(a)*18,y+Math.sin(a)*18,6,a);}}
      } else if (p.skill === "ghost") {
        const pulse = 5 + Math.sin(p.age * 18) * 1.5;
        g.fillColor = color("#b4d6ff", 210);
        if(p.form === "hunters") {
          polygon(g,x,y,direction,[[28,0],[8,8],[-18,4],[-28,0],[-18,-4],[8,-8]]);
          g.fillColor=color("#f2fbff",235);
          polygon(g,x,y,direction,[[21,0],[4,3],[-17,0],[4,-3]]);
        } else if(tier===0){g.circle(x, y, pulse + 3); g.fill();}
        else {
          polygon(g,x,y,0,[[0,14],[-10,6],[-9,-9],[-3,-5],[0,-12],[4,-5],[10,-9],[9,6]]);
          g.fillColor=color("#344365");polygon(g,x,y,0,[[0,8],[-6,3],[-5,-4],[5,-4],[6,3]]);
          g.fillColor=color("#b4d6ff",210);
          if(tier>=2)for(const side of [-1,1])polygon(g,x,y,0,[[side*4,9],[side*12,18],[side*10,2]]);
          if(tier===3)for(const side of [-1,1])polygon(g,x,y,0,[[side*8,3],[side*24,12],[side*19,-3],[side*9,-7]]);
        }
        g.fillColor = color("#f2fbff", 235);
        g.circle(x - 2, y - 1, 2); g.circle(x + 2, y - 1, 2); g.fill();
      } else {
        g.lineWidth = 5;
        g.moveTo(x - p.vx, y - p.vy);
        g.lineTo(x, y);
        g.stroke();
        g.fillColor = color("#e9f8ff");
        g.circle(x, y, 4);
        g.fill();
      }
    }
    // Arsenal weapons use fixed-capacity simulation entities; draw their
    // telegraphs and persistent links without allocating scene nodes.
    for (const p of w.arsenal.links) if (p.active) {
      const tier=formTier(w.skills[p.skill],!!w.evolutions[p.skill]);
      const x=p.x*48,y=p.y*48,ex=p.endX*48,ey=p.endY*48;
      const angle=Math.atan2(ey-y,ex-x),length=Math.hypot(ex-x,ey-y);
      g.strokeColor=color(COLORS[p.skill],190);g.fillColor=color(COLORS[p.skill],190);
      if(p.form==='brand'||p.form==='torment'){
        g.lineWidth=3;polygon(g,x,y,angle,[[0,23],[17,0],[0,-23],[-17,0]]);g.circle(x,y,12);g.stroke();
      }
      g.lineWidth=2;g.moveTo(x,y);g.lineTo(ex,ey);g.stroke();
      if(tier>=1)for(let d=8;d<length;d+=20) {
        const cx=x+Math.cos(angle)*d,cy=y+Math.sin(angle)*d;
        if(p.skill==="chain") {
          g.ellipse(cx,cy,7,4);g.stroke();
          if(tier>=2)crystal(g,cx,cy,9,angle+Math.PI/2);
        } else {
          g.circle(cx,cy,4);g.fill();
          if(tier>=2)polygon(g,cx,cy,angle,[[0,8],[-5,1],[-3,-8],[0,-4],[3,-8],[5,1]]);
        }
      }
      for(const [cx,cy] of [[x,y],[ex,ey]]) {
        if(tier>=2){g.circle(cx,cy,10);g.stroke();}
        if(tier===3) {
          for(let i=0;i<4;i++)crystal(g,cx,cy,14,angle+i*Math.PI/2);
          g.circle(cx,cy,17);g.stroke();
        }
        g.circle(cx,cy,4);g.fill();
      }
      if(tier===3){g.moveTo(x-Math.sin(angle)*8,y+Math.cos(angle)*8);g.lineTo(ex-Math.sin(angle)*8,ey+Math.cos(angle)*8);g.stroke();}
    }
    for (const p of w.arsenal.markers) if (p.active) {
      const x=p.x*48,y=p.y*48,r=p.radius*48;
      const tier=formTier(w.skills[p.skill],!!w.evolutions[p.skill]);
      const warning=Math.max(0,Math.min(1,(p.due-w.time)/Math.max(.01,p.due-p.created)));
      g.strokeColor=color(COLORS[p.skill],Math.round(90+warning*130));
      g.fillColor=color(COLORS[p.skill],warning>0?35:100);g.lineWidth=2;
      g.circle(x,y,r);g.stroke();
      // Inner motifs stay inside the simulation radius; the outer boundary is unchanged.
      if(p.form==='sunlance'){
        polygon(g,x,y,0,[[0,-r*.85],[-r*.18,0],[0,r*.85],[r*.18,0]]);g.rect(x-r*.4,y+r*.25,r*.8,4);g.fill();
      } else if(p.form==='impact'){
        polygon(g,x,y,warning,[[0,r*.8],[r*.65,0],[0,-r*.8],[-r*.65,0]]);g.circle(x,y,r*.35);g.fill();
      } else if(p.skill==="pillar") {
        if(tier<=1){g.rect(x-3,y-r*.55,6,r*1.1);g.fill();if(tier===1){g.rect(x-r*.35,y+r*.15,r*.7,6);g.fill();}}
        else {
          const sword=(cx:number,cy:number,rr:number)=>{
            polygon(g,cx,cy,0,[[0,-rr],[-rr*.17,-rr*.5],[-rr*.1,rr*.3],[rr*.1,rr*.3],[rr*.17,-rr*.5]]);
            g.rect(cx-rr*.35,cy+rr*.3,rr*.7,4);g.fill();g.rect(cx-2,cy+rr*.3,4,rr*.3);g.fill();
          };
          sword(x,y,r*.7);
          if(tier===3){sword(x-r*.45,y,r*.4);sword(x+r*.45,y,r*.4);g.circle(x,y,r*.82);g.stroke();}
        }
      } else {
        const rr=r*.45;
        polygon(g,x,y,warning*.8,[[rr,0],[rr*.5,rr*.8],[-rr*.5,rr*.9],[-rr,0],[-rr*.6,-rr*.8],[rr*.6,-rr*.7]]);
        if(tier>=1){g.strokeColor=color("#fff0bd",200);g.moveTo(x-rr*.6,y+rr*.4);g.lineTo(x,y);g.lineTo(x+rr*.2,y-rr*.7);g.moveTo(x,y);g.lineTo(x+rr*.7,y+rr*.3);g.stroke();}
        if(tier>=2){g.fillColor=color("#ffe3a0",220);crystal(g,x,y,rr*.6);}
        if(tier===3){g.strokeColor=color(COLORS[p.skill],180);g.ellipse(x,y,r*.8,r*.3);g.stroke();g.fillColor=color(COLORS[p.skill],180);for(let i=0;i<4;i++)crystal(g,x+Math.cos(i*Math.PI/2)*r*.7,y+Math.sin(i*Math.PI/2)*r*.7,r*.18,i*Math.PI/2);}
      }
    }
    for (const p of w.arsenal.totems) if (p.active) {
      const x=p.x*48,y=p.y*48,tier=formTier(w.skills.totem,!!w.evolutions.totem);
      g.fillColor=color(COLORS.totem,210);g.strokeColor=color(COLORS.totem,220);g.lineWidth=2;
      if(p.form==='obelisk'){g.circle(x,y,30);g.stroke();polygon(g,x,y,0,[[0,42],[-11,25],[11,25]]);}
      if(tier===3){polygon(g,x,y,0,[[-23,-18],[23,-18],[17,-9],[-17,-9]]);g.rect(x-16,y-9,32,5);g.fill();}
      g.rect(x-7,y-18,14,36);g.fill();
      if(tier>=1) {
        g.roundRect(x-11,y+5,22,19,7);g.fill();g.fillColor=color("#263647");g.circle(x-4,y+15,3);g.circle(x+4,y+15,3);g.fill();
        g.fillColor=color(COLORS.totem,210);polygon(g,x,y,0,[[-5,6],[0,1],[5,6]]);
      }
      if(tier>=2)for(const side of [-1,1])polygon(g,x,y,0,[[side*7,20],[side*17,33],[side*14,12]]);
      if(tier===3){g.circle(x,y,25);g.stroke();for(const side of [-1,1]){g.rect(x+side*22-3,y-12,6,21);g.fill();}}
    }
    for (const p of w.arsenal.bolts) if (p.active) {
      g.strokeColor = color(COLORS.totem, 180); g.lineWidth = 2;
      g.moveTo(p.x * 48, p.y * 48); g.lineTo(p.endX * 48, p.endY * 48); g.stroke();
    }
    for (const p of this.particles) {
      if (w.active || p.e.final) p.life -= dt;
      if (p.life <= 0) continue;
      const e = p.e,
        a = Math.max(0, p.life / p.max),
        x = e.x * 48,
        y = e.y * 48 + 12;
      const c = e.type === "playerHit" ? "#ff8e98" : COLORS[e.skill || "blade"] || "#efa783";
      g.strokeColor = color(c, Math.round(a * 255));
      g.fillColor = color(c, Math.round(a * 50));
      g.lineWidth = e.type === "lightning" ? 4 : 3;
      if (e.type === "evolve" && e.final) {
        const radius = 145 * (1 - a * a * a);
        g.fillColor = color(c, Math.round(a * 18));
        g.circle(x, y, radius); g.fill();
        g.strokeColor = color(c, Math.round(a * 195)); g.lineWidth = 2 + a * 2;
        g.circle(x, y, radius); g.stroke();
        g.circle(x, y, radius * 0.7); g.stroke();
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4 + (1 - a) * 0.3;
          crystal(g, x + Math.cos(angle) * radius * 0.85, y + Math.sin(angle) * radius * 0.85, 5 + a * 8, angle);
        }
        g.fillColor = color("#fff5d3", Math.round(a * 230));
        skillGlyph(g, e.skill as Skill, x, y, 15 + a * 12);
      } else if (e.type === "comboFire") {
        const radius = (e.radius ?? 2) * 48 * (1 - a * a);
        g.fillColor = color(COLORS.blade, Math.round(a * 230));
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4;
          crystal(g, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 7 + a * 8, angle);
        }
        g.strokeColor = color("#ffd78b", Math.round(a * 140));
        g.circle(x, y, radius * 0.75); g.stroke();
      } else if (e.type === "comboIce") {
        const radius = 15 + (1 - a) * 28;
        g.fillColor = color("#b9f8ff", Math.round(a * 230));
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          crystal(g, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 4 + a * 7, angle);
        }
        g.strokeColor = color("#c6a1ff", Math.round(a * 210));
        g.moveTo(x - 5, y + radius); g.lineTo(x + 5, y + 3); g.lineTo(x - 5, y - 3); g.lineTo(x + 5, y - radius); g.stroke();
      } else if (e.type === "comboPurify") {
        const radius = 8 + (1 - a) * 26;
        g.strokeColor = color("#a8ffce", Math.round(a * 210)); g.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const angle = i * Math.PI * 2 / 3 + (1 - a);
          g.arc(x, y, radius, angle, angle + 1.2, false); g.stroke();
          g.fillColor = color("#e5ffd2", Math.round(a * 210));
          crystal(g, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 5 + a * 3, angle + Math.PI / 2);
        }
        g.moveTo(x - 6 * a, y); g.lineTo(x + 6 * a, y); g.moveTo(x, y - 6 * a); g.lineTo(x, y + 6 * a); g.stroke();
      } else if (e.type === "comboGhost") {
        const r = 8 + (1-a)*23;
        g.fillColor=color("#b4d6ff",Math.round(a*230));
        for(const side of [-1,1])polygon(g,x,y,side*Math.PI/2,[[r,0],[3,8],[-r*.5,3],[-r*.2,0],[-r*.5,-3],[3,-8]]);
      } else if (e.type === "comboReap") {
        const r = (e.radius ?? 1.25)*48*(1-a*a);
        g.strokeColor=color("#b9f8c9",Math.round(a*220));g.lineWidth=3;
        for(const offset of [0,Math.PI]){g.arc(x,y,r,offset+(1-a),offset+(1-a)+2,false);g.stroke();}
        g.fillColor=color("#efffe3",Math.round(a*210));crystal(g,x,y,5+8*a,Math.PI/4);
      } else if (e.type === "comboCollapse") {
        const r = (e.radius ?? 2)*48*a;
        g.strokeColor=color("#cbaaff",Math.round(a*210));g.lineWidth=3;g.circle(x,y,r);g.stroke();
        g.fillColor=color("#f5bd86",Math.round(a*220));
        for(let i=0;i<5;i++){const angle=i*Math.PI*2/5;crystal(g,x+Math.cos(angle)*r,y+Math.sin(angle)*r,6,angle);}
      } else if (e.type === "comboBone") {
        const radius = (e.radius ?? 3) * 48 * (1 - a * a);
        g.fillColor = color("#f4ead3", Math.round(a * 210));
        for (let i = 0; i < 7; i++) {
          const angle = i * Math.PI * 2 / 7;
          polygon(g,x+Math.cos(angle)*radius,y+Math.sin(angle)*radius,angle,[[12,0],[-7,4],[-4,0],[-7,-4]]);
        }
      } else if (e.type === "comboJudgment") {
        const r = 12 + (1 - a) * 24;
        g.strokeColor = color("#ffcb89", Math.round(a * 220)); g.lineWidth = 3;
        g.moveTo(x-r,y);g.lineTo(x+r,y);g.moveTo(x,y-r);g.lineTo(x,y+r*2);g.stroke();
        g.fillColor = color("#ff9464", Math.round(a * 200));
        for(let i=0;i<4;i++)crystal(g,x+Math.cos(i*Math.PI/2)*r,y+Math.sin(i*Math.PI/2)*r,5,i*Math.PI/2);
      } else if (e.type === "comboSoul") {
        const r = 8 + (1 - a) * 22;
        g.strokeColor = color("#c9aeff", Math.round(a * 210));g.lineWidth=2;
        g.ellipse(x,y,r,r*.55);g.stroke();
        g.fillColor=color("#e9dfff",Math.round(a*220));
        for(const side of [-1,1])crystal(g,x+side*r,y,6+4*a,side*Math.PI);
        g.moveTo(x-r,y);g.lineTo(x+r,y);g.stroke();
      } else if (e.type === "fireImpact") {
        const radius = (e.radius ?? 1.5) * 48 * (1 - a * a);
        g.strokeColor = color(e.form === "inferno" ? "#ffb567" : "#ffe6ac", Math.round(a * 210));
        g.lineWidth = e.form === "inferno" ? 2 : 5 * a + 1;
        g.circle(x, y, radius); g.stroke();
        g.circle(x, y, radius * 0.55); g.stroke();
        g.fillColor = color(e.form === "inferno" ? "#ff9154" : "#e9bd8b", Math.round(a * 190));
        for (let i = 0; i < (e.form === "inferno" ? 5 : 8); i++) {
          const angle = i * Math.PI * 2 / (e.form === "inferno" ? 5 : 8);
          crystal(g, x + Math.cos(angle) * radius * 0.7, y + Math.sin(angle) * radius * 0.7, (e.form === "inferno" ? 8 : 13) * a, angle);
        }
      } else if (e.type === "playerHit") {
        g.lineWidth = 3;
        const angle = Math.atan2((e.endY ?? e.y+1)-e.y, (e.endX ?? e.x)-e.x);
        const dx=Math.cos(angle),dy=Math.sin(angle),r=24+(1-a)*12;
        g.moveTo(x+dx*r-dy*9,y+dy*r+dx*9);
        g.lineTo(x+dx*(r+9),y+dy*(r+9));
        g.lineTo(x+dx*r+dy*9,y+dy*r-dx*9);g.stroke();
      } else if (e.type === "lightning") {
        const ex = (e.endX ?? e.x) * 48,
          ey = (e.endY ?? e.y) * 48 + 12;
        g.moveTo(x, y);
        for (let i = 1; i < 5; i++) {
          const t = i / 4;
          g.lineTo(
            x + (ex - x) * t + (i < 4 ? (i % 2 ? 10 : -10) : 0),
            y + (ey - y) * t,
          );
        }
        g.stroke();
      } else if (e.type === "hit" || e.type === "death" || e.type === "block") {
        const skill = e.skill as Skill;
        const tier = WEAPONS.includes(skill) ? formTier(w.skills[skill], !!w.evolutions[skill]) : 0;
        if(tier>=1 && e.type==="hit") {
          g.fillColor=color(c,Math.round(a*200));
          for(let i=0;i<4;i++) {
            const angle=i*Math.PI/2+(1-a),r=(1-a)*16;
            crystal(g,x+Math.cos(angle)*r,y+Math.sin(angle)*r,4+a*4,angle);
          }
          if(tier>=2){g.lineWidth=2;g.circle(x,y,(1-a)*22+4);g.stroke();}
          if(tier===3){g.moveTo(x-16*a,y);g.lineTo(x+16*a,y);g.moveTo(x,y-16*a);g.lineTo(x,y+16*a);g.stroke();}
        }
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5,
            r = (1 - a) * 22;
          g.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
          g.lineTo(
            x + Math.cos(angle) * (r + 7 * a),
            y + Math.sin(angle) * (r + 7 * a),
          );
          g.stroke();
        }
      } else {
        const max =
          (e.radius ?? (e.type === "learn" || e.type === "evolve" ? 2 : 1)) *
          48;
        g.circle(x, y, max * (1 - a * 0.55));
        g.fill();
        g.stroke();
        if (e.type === "explosion") {
          g.strokeColor = color("#fff0c8", Math.round(a * 200));
          g.circle(x, y, max * (1 - a * 0.7) * 0.7);
          g.stroke();
        }
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    // Enemy telegraphs render last so player VFX never conceals a danger boundary.
    for (const h of w.hazards) {
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
          const d = (w.time - h.due) * 4.5 * 48,
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
}
