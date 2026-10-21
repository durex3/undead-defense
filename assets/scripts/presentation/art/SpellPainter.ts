import { drawWaterForm,drawWaterFieldForm,drawBladeForm } from "./WeaponFormArt";
import { gradeOf } from "../../battle/WeaponGrade";
import { Graphics } from "cc";
import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import type { Effect } from "../../battle/SurvivalTypes";
import { ink } from "./Ink";
import { cutTrail } from "./VfxBrush";
import { enemyArt } from "./EnemyCatalog";
import type { Kind } from "../../battle/SurvivalConfig";
import type { StageId } from "../../battle/ProgressionConfig";
import { HitDecorBudget } from "./VisualDensity";

const SPELL: Record<string, { core: string; mid: string; edge: string; glow: string }> = {
  blade: { core: "#fff8dc", mid: "#f4da9b", edge: "#c79a52", glow: "#ffcf6e" },
  fire: { core: "#fff2b4", mid: "#ffb24d", edge: "#ff6a2e", glow: "#ff8a3d" },
  water: { core: "#f0ffff", mid: "#7bdded", edge: "#3a93c4", glow: "#8fefff" },
  frost: { core: "#f2ffff", mid: "#a5e8ff", edge: "#4a9dc9", glow: "#8bdfff" },
  lightning: { core: "#fffbe0", mid: "#ffe36e", edge: "#c69a32", glow: "#9fdcff" },
  ghost: { core: "#effff8", mid: "#9ae6c9", edge: "#3d8b76", glow: "#8fffd1" },
  bone: { core: "#fff8e8", mid: "#ebdcc0", edge: "#a98f6f", glow: "#e6d4b5" },
  mine: { core: "#fff1bf", mid: "#f0b062", edge: "#8c5a2e", glow: "#ffdf9e" },
  void: { core: "#e9d8ff", mid: "#b58cff", edge: "#5b3a8a", glow: "#8c5de0" },
  holy: { core: "#fffde8", mid: "#fff2b0", edge: "#c9a23e", glow: "#ffe98a" },
};

function skillColor(skill: string | undefined) {
  return SPELL[skill ?? ""] ?? SPELL.blade;
}

/* ---------------- ground fields ---------------- */

export function drawGroundFields(g: Graphics, w: SurvivalWorld, reduced: boolean, crowded = false) {
  for (const field of w.armory.fields) {
    if (!field.active) continue;
    const x = field.x * 48,
      y = field.y * 48,
      r = field.radius * 48;
    const mods = field.stats.mods;
    const has = (id: string) => mods.includes(id);
    let overlaps = 0;
    for(const other of w.armory.fields) if(other!==field && other.active && other.skill===field.skill &&
      Math.hypot(other.x-field.x,other.y-field.y)<other.radius+field.radius) overlaps++;
    const quiet = reduced || crowded || overlaps > 0;
    const wash = (crowded ? .65 : 1) / (1 + overlaps * .6);
    if (field.skill === "water") {
      const grade=gradeOf("water",w.weaponGrades);if(grade>1)drawWaterFieldForm(g,x,y,r,grade,quiet);
      g.fillColor = ink("#2f7fb5", 34 * wash);
      g.circle(x, y, r);
      g.fill();
      g.fillColor = ink("#5fd3e8", 26 * wash);
      g.circle(x, y, r * 0.72);
      g.fill();
      g.strokeColor = ink("#8fefff", 135);
      g.lineWidth = 2;
      g.circle(x, y, r);
      g.stroke();
      // Small upright splashes follow the real next damage tick, not a decorative clock.
      const sinceTick=w.time-(field.lastTick ?? -Infinity);
      if(sinceTick>=0 && sinceTick<.12) {
        g.strokeColor=ink("#c5f3ee",Math.round(180*(1-sinceTick/.12)));g.lineWidth=1.8;
        for(let i=0;i<(quiet?3:5);i++) {
          const angle=i*2.4,px=x+Math.cos(angle)*r*.48,py=y+Math.sin(angle)*r*.48;
          g.moveTo(px-3,py);g.quadraticCurveTo(px,py+10,px+3,py);
        }g.stroke();
      }
      for (let i = 0; i < (quiet ? 1 : 2); i++) {
        const q = (w.time * 0.7 + i * 0.33) % 1;
        g.strokeColor = ink("#bff6ff", 90 - i * 20);
        g.lineWidth = 1.4;
        g.circle(x, y, r * (0.25 + q * 0.65));
        g.stroke();
      }
      if (has("wave")) {
        g.strokeColor = ink("#d8ffff", 220);
        g.lineWidth = 4;
        const a0 = field.angle - 1.1,
          a1 = field.angle + 1.1,
          rr = r * 0.92;
        g.moveTo(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr);
        g.arc(x, y, rr, a0, a1, false);
        for(const offset of [.55,.75]) {
          g.moveTo(x+Math.cos(a0)*rr*offset,y+Math.sin(a0)*rr*offset);
          g.arc(x,y,rr*offset,a0,a1,false);
        }
        g.stroke();
      }
      if(has("spring")) {
        g.strokeColor=ink("#d8ffff",210);g.lineWidth=2;
        for(const side of [-1,0,1]) {
          g.moveTo(x,y-6);g.quadraticCurveTo(x+side*10,y+17,x+side*14,y+8);
        }
        g.stroke();
      }
      if (field.returning && field.returnTarget) {
        const tx = field.returnTarget.x * 48,
          ty = field.returnTarget.y * 48;
        g.strokeColor = ink("#bff6ff", 130);
        g.lineWidth = 2;
        g.moveTo(x, y);
        g.lineTo(tx, ty);
        const a=Math.atan2(ty-y,tx-x);
        for(const t of [.35,.65]) {
          const xx=x+(tx-x)*t, yy=y+(ty-y)*t;
          g.moveTo(xx-Math.cos(a-.6)*8,yy-Math.sin(a-.6)*8);g.lineTo(xx,yy);
          g.lineTo(xx-Math.cos(a+.6)*8,yy-Math.sin(a+.6)*8);
        }
        g.stroke();
        g.fillColor = ink("#e9ffff", 190);
        g.circle(tx, ty, 4);
        g.fill();
      }
      if (has("pulse")) {
        const q = w.time % 1;
        g.strokeColor = ink("#e9ffff", 200);
        g.lineWidth = 3;
        g.circle(x, y, r * (0.25 + 0.75 * q));
        g.stroke();
        if(q<.14) {
          g.strokeColor=ink("#e9ffff",230*(1-q/.14));g.lineWidth=2;
          for(let i=0;i<6;i++) {
            const a=i*Math.PI/3;
            g.moveTo(x+Math.cos(a)*r*.4,y+Math.sin(a)*r*.4);
            g.lineTo(x+Math.cos(a)*r*.72,y+Math.sin(a)*r*.72);
          }
          g.stroke();
        }
      }
    } else {
      // Fire field: scorched bed, layered tongues, embers.
      g.fillColor = ink("#251411", 64 * wash);
      g.circle(x, y, r);
      g.fill();
      g.fillColor = ink("#ff6a2e", 30 * wash);
      g.circle(x, y, r * 0.8);
      g.fill();
      g.strokeColor = ink("#ffb35d", 125);
      g.lineWidth = 2;
      g.circle(x, y, r);
      g.stroke();
      const n = quiet ? 4 : 7;
      for(let pass=0;pass<3;pass++) {
        g.fillColor=ink(pass===0?"#ff7435":pass===1?"#ffbb55":"#fff0ac",pass===2?180:165);
        for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n + w.time * 0.5;
        const px = x + Math.cos(a) * r * 0.62,
          py = y + Math.sin(a) * r * 0.62;
        const h = 9 + Math.sin(w.time * 9 + i) * 4;
        if(pass===2) {g.circle(px,py+h*.35,1.8);continue;}
        const width=pass===0?5:2.5, height=pass===0?h:h*.6;
        g.moveTo(px - width, py);
        g.quadraticCurveTo(px, py + height * 1.2, px + width, py);
        g.quadraticCurveTo(px, py + height * 0.4, px - width, py);
        g.close();
        }
        g.fill();
      }
    }
  }
}

/* ---------------- projectiles ---------------- */

function crescent(g: Graphics, x: number, y: number, angle: number, r: number, color: string, alpha = 240) {
  const a0 = angle - 0.95,
    a1 = angle + 0.95;
  const p = SPELL.blade;
  const outer: [number, number][] = [],
    inner: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const a = a0 + ((a1 - a0) * i) / 8;
    outer.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    inner.push([x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55]);
  }
  inner.reverse();
  g.fillColor = ink(color, alpha);
  g.strokeColor = ink("#2a2118", alpha);
  g.lineWidth = 1.5;
  g.moveTo(outer[0][0], outer[0][1]);
  for (let i = 1; i < outer.length; i++) g.lineTo(outer[i][0], outer[i][1]);
  for (const [px, py] of inner) g.lineTo(px, py);
  g.close();
  g.fill();
  g.stroke();
  g.strokeColor = ink(p.core, alpha);
  g.lineWidth = 1.4;
  g.moveTo(outer[2][0], outer[2][1]);
  g.lineTo(outer[6][0], outer[6][1]);
  g.stroke();
}

function drawBlade(g: Graphics, x: number, y: number, angle: number, p: any, quiet=false, grade=1) {
  const c = SPELL.blade;
  if(!p.orbit) {
    const trail = p.trail || [];
    if(trail.length) {
      for(let i=0;i<trail.length;i++) {
        const a=trail[i],b=trail[i+1]||p;
        g.strokeColor=ink(p.returning?"#98eacb":c.edge,30+100*(i+1)/trail.length);
        g.lineWidth=(p.child?1.2:2.2)*(i+1)/trail.length;
        g.moveTo(a.x*48,a.y*48);g.lineTo(b.x*48,b.y*48);g.stroke();
      }
    } else cutTrail(g,x,y,angle,p.child?10:quiet?16:26,p.child?1.5:3,c.edge,90);
  }
  if(grade>1){drawBladeForm(g,x,y,angle,grade,p.child,quiet);return;}
  const scale=p.child?.58:1;
  const dx=Math.cos(angle)*scale,dy=Math.sin(angle)*scale,nx=-dy,ny=dx;
  // Short steel knife, readable independently of the long bone shaft.
  g.fillColor=ink(c.mid);g.strokeColor=ink("#211d19");g.lineWidth=2;
  g.moveTo(x+dx*20,y+dy*20);g.lineTo(x+nx*5,y+ny*5);
  g.lineTo(x-dx*9,y-dy*9);g.lineTo(x-nx*3,y-ny*3);g.close();g.fill();g.stroke();
  g.strokeColor=ink(c.core);g.lineWidth=1.6;
  g.moveTo(x-dx*4,y-dy*4);g.lineTo(x+dx*12,y+dy*12);g.stroke();
  g.strokeColor=ink("#8d6646");g.lineWidth=4;
  g.moveTo(x-dx*9,y-dy*9);g.lineTo(x-dx*15,y-dy*15);g.stroke();

}

function drawFire(g: Graphics, x: number, y: number, angle: number, p: any, quiet=false) {
  const c = SPELL.fire;
  const r = p.child ? 6 : p.stats.mods.includes("heavy") ? 17 : 10;
  cutTrail(g, x, y, angle, r * 3.8, r * .65, c.edge, 100);
  const flick = 1 + Math.sin((p.age || 0) * 30 + (p.index || 0)) * 0.14;
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  const nx = -dy,
    ny = dx;
  const tip = [x + dx * r * 1.35, y + dy * r * 1.35];
  const back = [x - dx * r * 2.2, y - dy * r * 2.2];
  const sideA = [x + nx * r * 0.9 * flick, y + ny * r * 0.9 * flick];
  const sideB = [x - nx * r * 0.9 * flick, y - ny * r * 0.9 * flick];
  // Outer flame tongue.
  g.fillColor = ink(c.edge, 240);
  g.strokeColor = ink("#3a1710", 220);
  g.lineWidth = 1.4;
  g.moveTo(tip[0], tip[1]);
  g.quadraticCurveTo(sideA[0], sideA[1], back[0], back[1]);
  g.quadraticCurveTo(sideB[0], sideB[1], tip[0], tip[1]);
  g.close();
  g.fill();
  g.stroke();
  // Inner flame.
  g.fillColor = ink(c.mid, 250);
  g.moveTo(x + dx * r * 0.9, y + dy * r * 0.9);
  g.quadraticCurveTo(x + nx * r * 0.5, y + ny * r * 0.5, x - dx * r * 1.2, y - dy * r * 1.2);
  g.quadraticCurveTo(x - nx * r * 0.5, y - ny * r * 0.5, x + dx * r * 0.9, y + dy * r * 0.9);
  g.close();
  g.fill();
  g.fillColor = ink(c.core, 255);
  if(p.stats.mods.includes("heavy") && !p.child) {
    for(let i=0;i<6;i++) {
      const a=angle+i*Math.PI/3,px=x+Math.cos(a)*r*.56,py=y+Math.sin(a)*r*.56;
      if(i===0)g.moveTo(px,py);else g.lineTo(px,py);
    }
    g.close();
  } else if(p.stats.mods.includes("salvo") && !p.child) {
    for(let i=0;i<=p.index%3;i++) g.circle(x-dx*i*5,y-dy*i*5,2.6);
  } else if(p.child) {
    g.moveTo(x+dx*r,y+dy*r);g.lineTo(x+nx*r*.4,y+ny*r*.4);g.lineTo(x-dx*r*.5,y-dy*r*.5);g.close();
  } else g.circle(x + dx * r * 0.2, y + dy * r * 0.2, r * 0.42);
  g.fill();
  // Ember trail.
  for (let i = 1; i <= (quiet ? 1 : 3); i++) {
    const tx = x - dx * r * (1.3 + i * 0.8),
      ty = y - dy * r * (1.3 + i * 0.8) + Math.sin((p.age || 0) * 20 + i) * 2;
    g.fillColor = ink(i % 2 ? c.mid : c.edge, 170 - i * 35);
    g.circle(tx, ty, (r * 0.22) * (1 - i * 0.18));
    g.fill();
  }
  g.fillColor = ink("#3a2b27", 90);
  g.circle(x - dx * r * 2.8, y - dy * r * 2.8, r * 0.45);
  g.fill();
}

function drawWater(g: Graphics, x: number, y: number, angle: number, p: any, quiet=false,grade=1) {
  const c = SPELL.water;
  const q = Math.min(1, (p.age || 0) / 0.45);
  const arc = Math.sin(q * Math.PI) * 60;
  cutTrail(g, x, y + arc, angle, 27, 4, c.mid, 90);
  const rotate = (u: number, v: number): [number, number] => [
    x + u * Math.cos(angle) - v * Math.sin(angle),
    y + arc + u * Math.sin(angle) + v * Math.cos(angle),
  ];
  if(grade>1){drawWaterForm(g,x,y+arc,angle,grade,.7);return;}
  // Bottle body.
  const body: [number, number][] = [
    [-6, -10],
    [6, -10],
    [7, 6],
    [4, 12],
    [-4, 12],
    [-7, 6],
  ];
  g.fillColor = ink(c.mid, 240);
  g.strokeColor = ink("#1e4a5a", 240);
  g.lineWidth = 1.6;
  body.forEach(([u, v], i) => {
    const [px, py] = rotate(u, v);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  });
  g.close();
  g.fill();
  g.stroke();
  // Glass highlight.
  const [hx, hy] = rotate(-3, 2);
  g.strokeColor = ink(c.core, 220);
  g.lineWidth = 1.4;
  g.moveTo(hx, hy);
  g.lineTo(hx + Math.cos(angle) * 2, hy + Math.sin(angle) * 2);
  g.stroke();
  // Neck and cork.
  const [nx, ny] = rotate(0, -13);
  g.fillColor = ink(c.core, 245);
  g.circle(nx, ny, 3.6);
  g.fill();
  // Water trail droplets.
  for (let i = 1; i <= (quiet ? 1 : 3); i++) {
    const [tx, ty] = rotate(-i * 8, Math.sin(q * Math.PI + i) * 3);
    g.fillColor = ink(c.glow, 160 - i * 30);
    g.circle(tx, ty, 2.2 - i * 0.4);
    g.fill();
  }
}

export function drawProjectiles(g: Graphics, w: SurvivalWorld, reduced: boolean, crowded=false) {
  for (const pending of w.armory.pending) {
    if (pending.skill !== "fire" || !pending.stats.mods.includes("heavy")) continue;
    const q = 1 - Math.max(0, pending.due - w.time) / 0.35;
    const x = pending.origin.x * 48,
      y = pending.origin.y * 48 + 30;
    g.strokeColor = ink("#ffb363", 220);
    g.lineWidth = 3;
    g.circle(x, y, 8 + 18 * q);
    g.stroke();
    g.strokeColor = ink("#fff1c0", 180);
    g.lineWidth = 1.5;
    g.circle(x, y, 5 + 8 * q);
    g.stroke();
  }
  for (const p of w.armory.shots) {
    if (!p.active) continue;
    const x = p.x * 48,
      y = p.y * 48;
    if (!w.visible(p, 1)) continue;
    if (p.skill === "blade") drawBlade(g, x, y, p.angle, p,reduced||crowded,gradeOf("blade",w.weaponGrades));
    else if (p.skill === "fire") drawFire(g, x, y, p.angle, p,reduced||crowded);
    else drawWater(g, x, y, p.angle, p,reduced||crowded,gradeOf("water",w.weaponGrades));
  }
}

/* ---------------- particles ---------------- */

type ParticleKind = "paper" | "spark" | "ember" | "shard" | "smoke" | "ring" | "rune" | "fracture" | "crest" | "claw";
interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  rot: number;
  spin: number;
  gravity: number;
  color: string;
  ring: number;
}

const NORMAL_CAP = 128;
const particles: Particle[] = Array.from({ length: NORMAL_CAP }, () => ({
  active: false,
  kind: "spark",
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 0,
  max: 1,
  size: 2,
  rot: 0,
  spin: 0,
  gravity: 0,
  color: "#ffffff",
  ring: 0,
}));
const cursors = [0,0,0];
const starts = [0,80,112];
const normalSizes = [80,32,16], reducedSizes = [32,16,16];
let priority = 0, compactParticles = false;
const hitDecor = new HitDecorBudget();
let seed = 0x9e3779b9;
let particleTime = 0, heavyAccentAt = -Infinity;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed >>> 8) / 16777216;
}
function spawn(kind: ParticleKind, x: number, y: number, color: string, speed: number, life: number, size: number, gravity = 0, ring = 0) {
  const poolSize=(compactParticles?reducedSizes:normalSizes)[priority];
  const p = particles[starts[priority] + cursors[priority] % poolSize];
  cursors[priority] = (cursors[priority] + 1) % poolSize;
  const a = rand() * Math.PI * 2;
  const s = speed * (0.45 + rand() * 0.8);
  p.active = true;
  p.kind = kind;
  p.x = x;
  p.y = y;
  p.vx = Math.cos(a) * s;
  p.vy = Math.sin(a) * s;
  p.life = life;
  p.max = life;
  p.size = size;
  p.rot = rand() * Math.PI * 2;
  p.spin = (rand() - 0.5) * 8;
  p.gravity = gravity;
  p.color = color;
  p.ring = ring;
}

function enemyBurstColor(kind: string | undefined, stage: StageId) {
  return enemyArt(stage, (kind ?? "minion") as Kind).palette.light;
}

export function spawnParticles(events: readonly Effect[], reduced: boolean, stage: StageId = 1) {
  compactParticles = reduced;
  hitDecor.begin(reduced);
  const scale = reduced ? 0.55 : 1;
  for (const e of events) {
    priority = e.type==="playerHit" || e.type==="bossPhase" || e.type==="modify" || e.type==="heal" ? 2 :
      e.type==="eliteDown" || (e.type==="explosion" && e.form==="heavy") ? 1 : 0;
    const x = e.x * 48,
      y = e.y * 48;
    if (e.type === "hit") {
      if(!hitDecor.allow(x,y,e.skill)) continue;
      const c = skillColor(e.skill);
      if(e.skill==="bone"&&(e.grade??1)>1){
        const grade=e.grade!;
        spawn(grade===4?"crest":grade===3?"ring":"shard",x,y,c.core,grade===2?90:0,.19,grade===2?3.5:2,0,grade===4?11:grade===3?8:0);
      }
      if(e.skill==="ghost") {spawn("claw",x,y,c.core,0,.16,12);continue;}
      const n = Math.max(1, Math.round(3 * scale));
      const kind: ParticleKind = e.skill === "fire" ? "ember" : e.skill === "frost" || e.skill === "bone" ? "shard" :
        e.skill === "ghost" || e.skill === "void" ? "rune" : "spark";
      for (let i = 0; i < n; i++) spawn(kind, x, y, i === 0 ? c.core : c.mid, 110, 0.14 + rand() * 0.08, 2.6);
      if (e.skill === "water") {spawn("ember", x, y, "#bff6ff", 40, 0.2, 2.4);if((e.grade??1)>1)spawn(e.grade===3?"ring":"crest",x,y,"#d2f2e6",0,.2,2,0,9);}
    } else if (e.type === "death" || e.type === "eliteDown") {
      const c = enemyBurstColor(e.skill, stage);
      const elite = e.type === "eliteDown";
      const n = Math.max(4, Math.round((elite ? 10 : 6) * scale));
      for (let i = 0; i < n; i++) spawn("shard", x, y, c, elite ? 125 : 75, 0.24 + rand() * 0.18, elite ? 4 : 2.6, 95);
      if (elite) spawn("crest", x, y + 20, "#f2c66d", 0, .34, 3, 0, 22);
    } else if (e.type === "explosion") {
      const c = skillColor(e.skill);
      if(e.form==='waterSplash'){
        const r=(e.radius??1)*48;if(e.grade===4){for(let i=0;i<3;i++){const a=i*Math.PI*2/3;spawn('crest',x+Math.cos(a)*r*.25,y+Math.sin(a)*r*.25,'#e7d1fa',0,.24,2,0,r*.2);}}else if(e.grade===2){for(const side of [-1,1])spawn('crest',x+side*r*.18,y,'#d7f4df',0,.2,3,0,r*.22);}else for(const v of [.35,.6])spawn('ring',x,y,'#c2ede4',0,.24,2,0,r*v);continue;
      }
      if(e.form?.startsWith("boneBurst")) {
        const grade=e.grade??1;
        if(grade>=3)spawn(grade===4?"crest":"ring",x,y,grade===4?"#e2c3f4":"#d9f0f1",0,.22,2,0,(e.radius||.9)*32);

        spawn("fracture",x,y,c.mid,0,.2,3,0,(e.radius||.9)*48);
        for(let i=0;i<Math.round(6*scale);i++)spawn("shard",x,y,i%2?c.core:c.edge,100,.18+rand()*.08,2.5);
        continue;
      }
      const heavy = e.form === "heavy";
      // Repeated heavy contacts share a short presentation gate, without delaying damage.
      if (heavy && particleTime < heavyAccentAt) continue;
      if (heavy) heavyAccentAt = particleTime + .12;
      spawn(heavy || e.skill==="fire" || e.skill==="mine" ? "fracture" : "ring", x, y, c.mid, 0, heavy ? .24 : .32, heavy ? 5 : 3.5, 0, (e.radius || 0.5) * 48);
      for (let i = 0; i < Math.round(9 * scale); i++) spawn("ember", x, y, i % 2 ? c.mid : c.edge, 130, 0.22 + rand() * 0.2, 2.2 + rand() * 1.5, 30);
      for (let i = 0; i < Math.round(2 * scale); i++) spawn("smoke", x, y, "#3a2b27", 24, 0.5, 8);
    } else if (e.type === "playerHit") {
      for (let i = 0; i < Math.round(7 * scale); i++) spawn("shard", x, y, "#ff6666", 120, 0.24 + rand() * 0.16, 2.6, 40);
      spawn("ring", x, y, "#ff7a7a", 0, 0.28, 3, 0, 20);
      if (e.endX !== undefined && e.endY !== undefined) {
        const ax = e.endX * 48,
          ay = e.endY * 48;
        const a = Math.atan2(y - ay, x - ax);
        spawn("spark", x - Math.cos(a) * 12, y - Math.sin(a) * 12, "#ff9a9a", 0, 0.24, 2.6);
      }
    } else if (e.type === "sealBreak") {
      for(let i=0;i<(reduced?3:5);i++)spawn("paper",x,y,i%2?"#c9b88c":"#f1e5c7",65,.28,5,45);
    } else if (e.type === "block") {
      for (let i = 0; i < 3; i++) spawn("spark", x, y, "#a9d8e8", 80, 0.16, 2);
    } else if (e.type === "modify") {
      for (let i = 0; i < 5; i++) spawn("rune", x, y, skillColor(e.skill).glow, 36, 0.6, 4, 0, 60);
    } else if (e.type === "heal") {
      for (let i = 0; i < 4; i++) spawn("ember", x, y, "#9be8a8", 45, 0.35, 2.6, -20);
    } else if (e.type === "pickup") {
      spawn("ember", x, y, "#8fe8c8", 30, 0.22, 2);
    } else if (e.type === "bossPhase") {
      spawn("ring", x, y, "#ffb35d", 0, 0.5, 5, 0, 44);
      for (let i = 0; i < 10; i++) spawn("spark", x, y, "#ffd27f", 150, 0.3, 2.4);
    }
  }
}

function drawParticle(g: Graphics, p: Particle) {
  const a = Math.max(0, p.life / p.max);
  const alpha = Math.round(240 * a);
  if(p.kind==="claw") {
    g.strokeColor=ink(p.color,alpha);g.lineWidth=2;
    for(let i=0;i<3;i++) {
      const x=p.x+(i-1)*6;
      g.moveTo(x-5,p.y-8);g.quadraticCurveTo(x+8,p.y,x+4,p.y+10);
    }g.stroke();
  } else if (p.kind === "fracture") {
    const phase = 1 - a, eased = 1 - a * a;
    const r = Math.min(42, p.ring) * (.25 + eased * .6);
    g.fillColor = ink(p.color, alpha);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3 + p.rot;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const x = p.x + dx * r, y = p.y + dy * r;
      const length = 9 * (1 - phase * .65);
      g.moveTo(x - dy * 3, y + dx * 3);
      g.lineTo(x + dx * length, y + dy * length);
      g.lineTo(x + dy * 3, y - dx * 3);
      g.close();
    }
    g.fill();
  } else if (p.kind === "crest") {
    const y = p.y - (1-a) * (1-a) * 14, r = p.ring;
    const path = () => {
      for (const side of [-1, 1]) {
        g.moveTo(p.x + side * 3, y - 4);
        g.lineTo(p.x + side * r * .75, y - 4);
        g.lineTo(p.x + side * r, y + 8 * a);
        g.lineTo(p.x + side * r * .45, y + 3 * a);
      }
    };
    g.strokeColor = ink("#211c20", alpha); g.lineWidth = 5 * a + 1;
    path(); g.stroke();
    g.strokeColor = ink(p.color, alpha); g.lineWidth = 2 * a + 1;
    path(); g.stroke();
  } else if (p.kind === "spark") {
    g.strokeColor = ink(p.color, alpha);
    g.lineWidth = Math.max(1, p.size * a);
    g.moveTo(p.x, p.y);
    g.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
    g.stroke();
  } else if (p.kind === "ember") {
    g.fillColor = ink(p.color, alpha);
    g.circle(p.x, p.y, Math.max(0.8, p.size * a));
    g.fill();
  } else if(p.kind==="paper") {
    const size=p.size*a,c=Math.cos(p.rot),s=Math.sin(p.rot);
    const local=(x:number,y:number)=>[p.x+x*c-y*s,p.y+x*s+y*c];
    const pts=[local(-size,-size*.6),local(size,-size*.5),local(size*.8,size*.6),local(-size*.7,size*.45)];
    g.fillColor=ink(p.color,alpha);g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.close();g.fill();
  } else if (p.kind === "shard") {
    const s = p.size * a;
    const c = Math.cos(p.rot),
      si = Math.sin(p.rot);
    g.fillColor = ink(p.color, alpha);
    g.moveTo(p.x + c * s, p.y + si * s);
    g.lineTo(p.x - si * s * 0.6, p.y + c * s * 0.6);
    g.lineTo(p.x - c * s * 0.5, p.y - si * s * 0.5);
    g.close();
    g.fill();
  } else if (p.kind === "smoke") {
    g.fillColor = ink(p.color, Math.round(alpha * 0.32));
    g.circle(p.x, p.y, p.size * (1.4 - a * 0.4));
    g.fill();
  } else if (p.kind === "ring") {
    const r = p.ring * (1.05 - a * 0.75);
    g.strokeColor = ink(p.color, alpha);
    g.lineWidth = Math.max(1, p.size * a);
    g.circle(p.x, p.y, Math.max(1, r));
    g.stroke();
  } else {
    const s = p.size * (0.6 + (1 - a) * 0.9);
    g.strokeColor = ink(p.color, alpha);
    g.lineWidth = 1.6;
    g.moveTo(p.x, p.y + s);
    g.lineTo(p.x + s * 0.6, p.y);
    g.lineTo(p.x, p.y - s);
    g.lineTo(p.x - s * 0.6, p.y);
    g.close();
    g.stroke();
  }
}

export function updateParticles(g: Graphics, dt: number, reduced: boolean) {
  particleTime += dt;
  for (let i = 0; i < NORMAL_CAP; i++) {
    const p = particles[i];
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= p.gravity * dt;
    p.rot += p.spin * dt;
    if (p.kind === "smoke") {
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    // Age all slots even after changing quality; hidden old particles cannot
    // come back later. Urgent player/phase cues have reserved visible slots.
    if(!reduced || i<32 || (i>=80 && i<96) || i>=112) drawParticle(g, p);
  }
}

export function resetParticles() {
  for (const p of particles) p.active = false;
  cursors.fill(0);
  hitDecor.begin(false);
  seed = 0x9e3779b9;
  particleTime = 0; heavyAccentAt = -Infinity;
}
