import { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { ExtraAttack } from "../../../battle/ExtraArmory";
import { ink } from "../Ink";
import { weaponStats,replicaStats } from "../../../battle/ArmoryConfig";
import { cutTrail, impactCrown, chevrons } from "../VfxBrush";
import { lightningEnvelope, skyBoltPoints } from "./LightningMotion";

const P = {
  frost: { core: "#f2ffff", mid: "#a5e8ff", edge: "#4a9dc9", glow: "#8bdfff" },
  lightning: { core: "#fffbe0", mid: "#ffe36e", edge: "#c69a32", glow: "#9fdcff" },
  ghost: { core: "#effff8", mid: "#9ae6c9", edge: "#3d8b76", glow: "#8fffd1" },
  bone: { core: "#fff8e8", mid: "#ebdcc0", edge: "#a98f6f", glow: "#e6d4b5" },
  mine: { core: "#fff1bf", mid: "#f0b062", edge: "#8c5a2e", glow: "#ffdf9e" },
  void: { core: "#e9d8ff", mid: "#b58cff", edge: "#5b3a8a", glow: "#8c5de0" },
  holy: { core: "#fffde8", mid: "#fff2b0", edge: "#c9a23e", glow: "#ffe98a" },
} as const;

function has(a: ExtraAttack, id: string) {
  return a.stats.mods.includes(id);
}

function poly(g: Graphics, points: [number, number][], fill: string, alpha = 255, stroke?: string) {
  if (points.length < 3) return;
  g.fillColor = ink(fill, alpha);
  g.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
  g.close();
  g.fill();
  if (stroke) {
    g.strokeColor = ink(stroke, alpha);
    g.lineWidth = 1.5;
    g.stroke();
  }
}

function ring(g: Graphics, x: number, y: number, r: number, color: string, width: number, alpha: number) {
  if (r <= 0) return;
  g.strokeColor = ink(color, alpha);
  g.lineWidth = width;
  g.moveTo(x + r, y);
  g.arc(x, y, r, 0, Math.PI * 2, false);
  g.stroke();
}

function shard(g: Graphics, x: number, y: number, angle: number, len: number, width: number, color: string, alpha = 220) {
  const dx = Math.cos(angle),
    dy = Math.sin(angle),
    nx = -dy,
    ny = dx;
  poly(
    g,
    [
      [x + nx * width, y + ny * width],
      [x + dx * len, y + dy * len],
      [x - nx * width, y - ny * width],
    ],
    color,
    alpha,
    "#1a2b33",
  );
}

/* ---------------- frost ---------------- */

function frostGround(g: Graphics, a: ExtraAttack, reduced: boolean) {
  const c=P.frost,x=a.x*48,y=a.y*48,r=a.stats.radius*48;
  const echo=has(a,"aftershock") && a.age>=.8;
  const outward=has(a,"outward")&&!echo,sectors=has(a,"sectors")&&!echo;
  const age=echo?a.age-.8:a.age;
  const impact=age>=.1 || echo;
  const fade=outward||sectors ? Math.max(.12,1-a.age/.8) : Math.max(0,1-Math.max(0,age-.18)/.32);
  const edge=outward?r*Math.min(1,Math.max(0,(a.age-.1)/.5)):r;
  const sector=Math.max(0,Math.min(2,Math.floor((a.age-.1)/.22)));
  const center=a.angle+sector*Math.PI*2/3;
  // All branches terminate at the true radius. No persistent water-like disc.
  g.strokeColor=ink(c.edge,Math.round(160*fade));g.lineWidth=2;
  const brittle=has(a,"brittle");
  const n=brittle?(reduced?3:6):(reduced?6:12);
  for(let i=0;i<n;i++) {
    const angle=i*Math.PI*2/n;
    if(sectors && Math.abs(Math.atan2(Math.sin(angle-center),Math.cos(angle-center)))>Math.PI/3)continue;
    const dx=Math.cos(angle),dy=Math.sin(angle),len=edge*(impact?.84:.3);
    g.moveTo(x+dx*8,y+dy*8);g.lineTo(x+dx*len,y+dy*len);
    g.moveTo(x+dx*len*.7,y+dy*len*.7);
    g.lineTo(x+dx*len*.52-dy*8,y+dy*len*.52+dx*8);
  }
  g.stroke();
  if(!impact)return;
  const height=(brittle?18:32)+24*Math.max(0,1-(echo?age:age-.1)/.2);
  for(let pass=0;pass<2;pass++) {
    g.fillColor=ink(pass?c.core:c.mid,Math.round((pass?220:200)*fade));
    g.strokeColor=ink("#203e50",Math.round(220*fade));g.lineWidth=1.8;
    for(let i=0;i<n;i++) {
      const angle=i*Math.PI*2/n;
      if(sectors && Math.abs(Math.atan2(Math.sin(angle-center),Math.cos(angle-center)))>Math.PI/3)continue;
      const distance=edge*(i%2?.56:.78);
      const px=x+Math.cos(angle)*distance,py=y+Math.sin(angle)*distance;
      const h=height*(i%2?.7:1),width=pass?3:10;
      g.moveTo(px-width,py);g.lineTo(px-2,py+h);g.lineTo(px+width,py+3);g.close();
    }
    g.fill();if(!pass)g.stroke();
  }
  if(brittle) {
    g.strokeColor=ink("#294b5c",Math.round(240*fade));g.lineWidth=2.2;
    for(let i=0;i<n;i++) {
      const angle=i*Math.PI*2/n,px=x+Math.cos(angle)*edge*.78,py=y+Math.sin(angle)*edge*.78;
      g.moveTo(px-7,py+4);g.lineTo(px+3,py+9);g.lineTo(px-2,py+16);g.lineTo(px+6,py+22);
    }g.stroke();
  }
  if(outward||sectors) {
    g.strokeColor=ink(c.mid,180);g.lineWidth=2;
    const start=sectors?center-Math.PI/3:0,end=sectors?center+Math.PI/3:Math.PI*2;
    g.moveTo(x+Math.cos(start)*edge,y+Math.sin(start)*edge);g.arc(x,y,edge,start,end,false);g.stroke();
  }
}

/* ---------------- mine ---------------- */

function mineGround(g: Graphics, w: SurvivalWorld, a: ExtraAttack, reduced: boolean) {
  const c = P.mine;
  const x = a.x * 48,
    y = a.y * 48,
    r = a.stats.radius * 48;
  const burrow = has(a, "burrow");
  const armed = a.age >= (burrow ? 1.2 : 0.6);
  const trigger = (((burrow ? 0.6 : 0.8) * a.stats.radius) / 1.8) * 48;
  g.fillColor = ink(c.edge, armed ? 55 : 24);
  g.circle(x, y, trigger);
  g.fill();
  ring(g, x, y, trigger, armed ? c.core : c.edge, armed ? 2.4 : 1.4, armed ? 230 : 130);
  const pulse = 1 + Math.sin(w.time * 6 + a.index) * 0.08;
  const body: [number,number][] = burrow ? Array.from({length:6},(_,i)=> {
    const angle=i*Math.PI/3;return [x+Math.cos(angle)*14*pulse,y+Math.sin(angle)*14*pulse] as [number,number];
  }) : [[x,y+11*pulse],[x+11*pulse,y],[x,y-11*pulse],[x-11*pulse,y]];
  poly(
    g,
    body,
    armed ? c.core : c.edge,
    armed ? 235 : 110,
    "#2b1a12",
  );
  // Rune cross.
  g.strokeColor = ink("#2b1a12", 220);
  g.lineWidth = 2;
  if(has(a,"fuse")) {
    g.moveTo(x-4,y+4);g.lineTo(x+4,y+4);g.lineTo(x-4,y-4);g.lineTo(x+4,y-4);
  } else {
    g.moveTo(x - 5, y);g.lineTo(x + 5, y);g.moveTo(x, y - 5);g.lineTo(x, y + 5);
  }
  g.stroke();
  if (has(a, "trip")) {
    const other = w.armory.extra.attacks.find(
      (b) => b !== a && b.active && b.group === a.group && b.phase === 0 && b.index === (a.index + 1) % a.stats.count,
    );
    if (other) {
      g.strokeColor = ink(c.glow, armed ? 190 : 70);
      g.lineWidth = 1.5;
      g.moveTo(x, y);
      g.lineTo(other.x * 48, other.y * 48);
      g.stroke();
    }
  }
  if (a.phase === 2 && has(a, "fuse")) {
    const rr = r * Math.max(0, 1 - (a.next - a.age) / 0.6);
    ring(g, x, y, rr, c.core, 3, 220);
    ring(g, x, y, r, c.mid, 1.2, 130);
  }
  if (a.phase >= 2) {
    // The simulation enters phase 2 in the same step that the mine explodes.
    const wait=has(a,"fuse")&&a.phase===2?.6:.18;
    const elapsed=Math.max(0,a.age-a.next+wait);
    if(elapsed<.18)impactCrown(g,x,y,r,c.core,elapsed/.18,reduced?4:8);
  }
  void reduced;
}

/* ---------------- void ---------------- */

function voidGround(g: Graphics, w: SurvivalWorld, a: ExtraAttack, quiet=false) {
  const c = P.void;
  const x = a.x * 48,
    y = a.y * 48,
    r = a.stats.radius * 48;
  const final = a.phase === 1;
  const repel = final && has(a, "repel");
  const outer = repel ? r * 1.6 : r;
  g.fillColor = ink(c.edge, final ? 60 : quiet ? 18 : 32);
  g.circle(x, y, outer);
  g.fill();
  ring(g, x, y, outer, c.mid, 2.2, 210);
  if (final) {
    if (repel) {
      ring(g, x, y, outer, c.core, 4, 230);
      ring(g, x, y, outer * 0.55, c.mid, 3, 210);
      g.fillColor = ink("#120b1c", 230);
      g.circle(x, y, outer * 0.53);
      g.fill();
    } else {
      ring(g, x, y, outer * 0.58, c.core, 4, 230);
      ring(g, x, y, outer * 0.28, c.core, 2, 160);
    }
  } else {
    for (let i = 0; i < (quiet ? 1 : 3); i++) {
      const theta = w.time * 2 + i * 2.1;
      g.strokeColor = ink(c.glow, 140 - i * 25);
      g.lineWidth = 2.2;
      const rr = r * (0.35 + i * 0.2);
      g.moveTo(x + Math.cos(theta) * rr, y + Math.sin(theta) * rr);
      // Broken spiral arms spiral inward, distinct from water's concentric ripples.
      for (let j = 1; j <= 12; j++) {
        const t = j / 12, a = theta + t * Math.PI * 1.4, radius = rr * (1 - t * .72);
        g.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
      }
      g.stroke();
    }
    g.fillColor = ink("#120b1c", 245);
    g.circle(x, y, 13);
    g.fill();
    ring(g, x, y, 15, c.mid, 1.5, 190);
    // Inward drifting motes.
    for (let i = 0; i < (quiet ? 0 : 4); i++) {
      const q = (w.time * 0.35 + i * 0.2) % 1;
      const ang = i * 2.4 + w.time * 0.6;
      g.fillColor = ink(c.mid, Math.round(170 * (1 - q)));
      g.circle(x + Math.cos(ang) * r * (1 - q), y + Math.sin(ang) * r * (1 - q), 2.2);
      g.fill();
    }
    if(has(a,"drift")) {
      g.strokeColor=ink(c.glow,140);g.lineWidth=2.4;
      const dx=Math.cos(a.angle),dy=Math.sin(a.angle);
      for(const side of [-1,0,1]) {
        g.moveTo(x-dx*18-dy*side*9,y-dy*18+dx*side*9);
        g.quadraticCurveTo(x-dx*35-dy*side*15,y-dy*35+dx*side*15,x-dx*52-dy*side*18,y-dy*52+dx*side*18);
      }g.stroke();
    }
    if(has(a,"collapse")) {
      const tension=Math.max(0,Math.min(1,1-(a.until-w.time)/a.stats.duration));
      const points:[number,number][]=[];
      for(let i=0;i<12;i++){const angle=i*Math.PI/6;const radius=i%2?9:17+tension*9;points.push([x+Math.cos(angle)*radius,y+Math.sin(angle)*radius]);}
      poly(g,points,"#160d22",235,c.mid);
    }
  }
}

/* ---------------- holy ---------------- */

function holyGround(g: Graphics, a: ExtraAttack) {
  const c = P.holy;
  const x = a.x * 48,
    y = a.y * 48,
    r = a.stats.radius * 48;
  const falling = a.phase === 0 || (a.phase === 1 && has(a, "brand"));
  const delay = a.phase === 0 ? (has(a, "execution") ? 0.8 : 0.55) : 0.7;
  const q = falling ? Math.max(0, 1 - (a.next - a.age) / delay) : 1;
  g.fillColor = ink(c.edge, falling ? 22 : 78);
  if (has(a, "cross")) {
    const half = r * 0.28;
    g.rect(x - r * 2, y - half, r * 4, half * 2);
    g.rect(x - half, y - r * 2, half * 2, r * 4);
    g.fill();
    ring(g, x, y, r * Math.max(0.15, q), c.mid, 2, 210);
    g.strokeColor = ink(c.mid, 230);
    g.lineWidth = 2;
    g.moveTo(x - r * 2, y - half);
    g.lineTo(x + r * 2, y - half);
    g.moveTo(x - half, y - r * 2);
    g.lineTo(x - half, y + r * 2);
    g.stroke();
  } else {
    g.circle(x, y, r);
    g.fill();
    ring(g, x, y, r, c.mid, 2.2, 220);
    ring(g, x, y, r * Math.max(0.12, q), c.core, 2.4, 230);
    g.strokeColor = ink(c.core, 200);
    g.lineWidth = 1.5;
    g.moveTo(x - 7, y);
    g.lineTo(x + 7, y);
    g.moveTo(x, y - 7);
    g.lineTo(x, y + 7);
    g.stroke();
  }
}

/* ---------------- ghost ---------------- */

function ghostBody(g: Graphics, x: number, y: number, angle: number, phase: number, time: number, hunter=false) {
  const face=Math.cos(angle)<0?-1:1;
  const attacking=phase===3||phase===1;
  const lean=attacking?7:phase===0?4:0;
  const reach=attacking?13:0;
  const point=(u:number,v:number):[number,number]=>[x+(u+lean*Math.max(0,v)/58)*face,y+v];
  // One tall, ragged cloak. The shoulders slope down instead of spreading like wings.
  poly(g,[point(-12,5),point(-15,-6),point(-5,-1),point(-2,-12),point(4,-1),point(11,-6),
    point(8,12),point(12,28),point(20+reach,22),point(22+reach,29),point(13,39),
    point(10,48),point(hunter?4:0,hunter?64:58),point(-11,48),point(-13,39),point(-20,31),point(-17,21)],
    "#699c8d",245,"#102a2b");
  // Deep hood opening and a large pale mask carry the read at game scale.
  poly(g,[point(-10,43),point(0,54),point(9,44),point(8,33),point(-4,31),point(-10,36)],"#193b3a");
  poly(g,[point(-5,43),point(3,45),point(6,39),point(3,34),point(-3,35)],"#d8e2c6");
  g.strokeColor=ink("#183031");g.lineWidth=2.2;
  g.moveTo(...point(-3,40));g.lineTo(...point(0,39));
  g.moveTo(...point(2,40));g.lineTo(...point(5,41));g.stroke();
  // Broad cloth planes, no tiny glowing dots or circular face.
  poly(g,[point(-13,32),point(-7,39),point(-5,23),point(-8,9),point(-12,2)],"#a8cbb5");
  poly(g,[point(-3,29),point(7,31),point(6,16),point(1,4),point(-2,13)],"#315c54");
  poly(g,[point(-18,30),point(-12,37),point(-7,32),point(-11,26)],"#93b9a4");
  // Three hooked fingers are part of the visible arm, extended during real attack states.
  g.strokeColor=ink("#d6dfbf");g.lineWidth=2.1;
  for(let i=0;i<3;i++) {
    g.moveTo(...point(18+reach,30-i*3));
    g.lineTo(...point(24+reach,26-i*3));g.lineTo(...point(22+reach,23-i*3));
  }g.stroke();
}

function ghostAir(g: Graphics, w: SurvivalWorld, a: ExtraAttack) {
  const x=a.x*48,y=a.y*48;
  cutTrail(g,x,y+8,a.angle,28,5,P.ghost.edge,80);
  ghostBody(g,x,y,a.angle,a.phase,w.time,has(a,"execution"));
  if(has(a,"reap")&&a.phase===2) {
    // The returning partner carries a hooked soul blade, not an arrow icon.
    const dx=Math.cos(a.angle),dy=Math.sin(a.angle),nx=-dy,ny=dx;
    poly(g,[[x+dx*27,y+dy*27],[x+nx*20,y+ny*20],
      [x-dx*18+nx*13,y-dy*18+ny*13],[x+nx*9,y+ny*9]],P.ghost.core,220,"#173b36");
  }
  if(has(a,"haunt")&&a.phase===1) {
    // Lock point remains fixed even when its original enemy leaves.
    g.strokeColor=ink(P.ghost.mid,130);g.lineWidth=2;
    for(let i=0;i<3;i++) {const angle=i*Math.PI*2/3;
      g.moveTo(a.start.x*48+Math.cos(angle)*20,a.start.y*48+Math.sin(angle)*20);
      g.lineTo(a.start.x*48+Math.cos(angle+.5)*25,a.start.y*48+Math.sin(angle+.5)*25);
    }g.stroke();
  }
}
function ghostRoster(g: Graphics,w: SurvivalWorld) {
  if(!w.skills.ghost)return;
  const stats=weaponStats(w,"ghost"),count=w.armory.extra.ghostCount||Math.min(8,stats.count);
  for(let i=0;i<count;i++) {
    if(w.armory.extra.attacks.some(a=>a.active&&a.skill==="ghost"&&a.companion===i))continue;
    const side=i%2?-1:1,row=Math.floor(i/2);
    ghostBody(g,w.player.x*48+side*(45+row*22),w.player.y*48+8+row*12+Math.sin(w.time*3+i)*2,side<0?Math.PI:0,-1,w.time,stats.mods.includes("execution"));
  }
}

/* ---------------- bone ---------------- */

function boneAir(g: Graphics, a: ExtraAttack) {
  const c = P.bone;
  const ready=a.phase===-1;
  const retreat=ready?20*Math.min(1,a.age/.2):0;
  const x = a.x * 48-Math.cos(a.angle)*retreat,
    y = a.y * 48-Math.sin(a.angle)*retreat;
  const dx = Math.cos(a.angle),
    dy = Math.sin(a.angle);
  const length = has(a, "lance") ? 54 : 42;
  if(!ready)cutTrail(g, x - dx * 8, y - dy * 8, a.angle, length * 1.5, 3.5, c.edge, 115);
  g.strokeColor=ink("#302921",230);g.lineWidth=has(a,"lance")?9:7;
  g.moveTo(x-dx*length,y-dy*length);g.lineTo(x+dx*length*.25,y+dy*length*.25);g.stroke();
  // Shaft.
  g.strokeColor = ink(c.mid, 240);
  g.lineWidth = has(a, "lance") ? 6 : 4;
  g.moveTo(x - dx * length, y - dy * length);
  g.lineTo(x + dx * length * 0.25, y + dy * length * 0.25);
  g.stroke();
  // Bone tip.
  poly(
    g,
    [
      [x + dx * length, y + dy * length],
      [x + dy * 7 + dx * (length - 14), y - dx * 7 + dy * (length - 14)],
      [x - dy * 7 + dx * (length - 14), y + dx * 7 + dy * (length - 14)],
    ],
    c.core,
    245,
    "#5a4633",
  );
  // Rib barbs.
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const px = x + dx * length * (t - 0.5),
      py = y + dy * length * (t - 0.5);
    g.strokeColor = ink(c.core, 210);
    g.lineWidth = 2;
    g.moveTo(px + dy * 4, py - dx * 4);
    g.lineTo(px + dy * 9, py - dx * 9);
    g.moveTo(px - dy * 4, py + dx * 4);
    g.lineTo(px - dy * 9, py + dx * 9);
    g.stroke();
  }
  if (has(a, "marrow")) {
    g.strokeColor = ink("#ffa88e", 170);
    g.lineWidth = 2;
    g.moveTo(x - dx * length * 1.7, y - dy * length * 1.7);
    g.lineTo(x, y);
    g.stroke();
    const stacks=Math.min(3,a.hit.size);
    for(let i=0;i<stacks;i++) {
      const px=x-dx*length*(.2+i*.28),py=y-dy*length*(.2+i*.28),nx=-dy,ny=dx;
      poly(g,[[px+nx*8,py+ny*8],[px+dx*7,py+dy*7],[px-nx*8,py-ny*8],[px-dx*5,py-dy*5]],c.core,240,"#5a4633");
    }
  }
}

/* ---------------- lightning ---------------- */

function lightningAir(g: Graphics, w: SurvivalWorld, a: ExtraAttack, reduced: boolean) {
  const c = P.lightning;
  const n = Math.max(0, a.index);
  const storm = has(a, "storm");
  for (let i = 0; i < Math.min(n, a.points.length); i++) {
    const r=replicaStats(a.stats,i).radius*48;
    const p = a.points[i],
      px = p.x * 48,
      py = p.y * 48;
    const envelope = lightningEnvelope(a, i), opacity = envelope.opacity;
    // The first contact is hot and wide; the remaining trace quickly settles.
    const points=skyBoltPoints(px,py,(w.camera.y+Math.min(w.viewport.y,9))*48+24,a.age,i);
    for(let pass=0;pass<3;pass++) {
      g.strokeColor=ink(pass===0?"#152a37":pass===1?c.mid:c.core,(pass===0?235:255)*opacity);
      g.lineWidth=pass===0?4+8*envelope.width:pass===1?7*envelope.width:Math.max(1,2.2*envelope.width);
      g.moveTo(points[0][0],points[0][1]);
      for(let j=1;j<points.length;j++)g.lineTo(points[j][0],points[j][1]);
      g.stroke();
    }
    if (envelope.contact) {
      impactCrown(g, px, py, storm ? Math.min(r, 28) : 18, c.core, envelope.age / .12, reduced ? 4 : 6);
      if (!reduced) {
        g.strokeColor=ink(c.mid,210*opacity);g.lineWidth=1.6;
        const fork=points[3];
        g.moveTo(fork[0],fork[1]);g.lineTo(fork[0]+23,fork[1]-29);g.lineTo(fork[0]+14,fork[1]-49);g.stroke();
      }
      g.fillColor=ink(c.core,150*(1-envelope.age/.12));
      g.ellipse(px,py,storm?Math.min(r,26):17,5);g.fill();
    }
    if (storm) {
      ring(g, px, py, r, c.mid, 2, 110 + 110 * opacity);
      g.fillColor = ink(c.mid, 10 + 26 * opacity);
      g.circle(px, py, r);
      g.fill();
    }
    if (has(a, "bridge") && i > 0) {
      const prev = a.points[i - 1],
        sx = prev.x * 48,
        sy = prev.y * 48;
      const jx=Math.sin(a.age*38+i)*7,jy=Math.cos(a.age*34+i)*6;
      g.strokeColor = ink(c.glow, 170 * opacity);
      g.lineWidth = 2 + 2 * envelope.width;
      g.moveTo(sx, sy);
      g.lineTo(sx+(px-sx)*.28+jx,sy+(py-sy)*.28-jy);
      g.lineTo((sx + px) / 2 - jx, (sy + py) / 2 + jy);
      g.lineTo(sx+(px-sx)*.76+jx,sy+(py-sy)*.76-jy);
      g.lineTo(px, py);
      g.stroke();
      g.strokeColor = ink(c.core, 235 * opacity);
      g.lineWidth = 1.4;
      g.moveTo(sx, sy);
      g.lineTo(sx+(px-sx)*.28+jx,sy+(py-sy)*.28-jy);
      g.lineTo((sx + px) / 2 - jx, (sy + py) / 2 + jy);
      g.lineTo(sx+(px-sx)*.76+jx,sy+(py-sy)*.76-jy);
      g.lineTo(px, py);
      g.stroke();
    }
  }
}

/* ---------------- holy air ---------------- */

function holyAir(g: Graphics, a: ExtraAttack) {
  const c = P.holy;
  const x = a.x * 48,
    y = a.y * 48;
  const waiting = a.phase === 0 || (a.phase === 1 && has(a, "brand") && a.age-(a.impactAt ?? -1)>.12);
  const delay = a.phase === 0 ? (has(a, "execution") ? 0.8 : 0.55) : 0.7;
  const remain = waiting ? Math.max(0, a.next - a.age) : 0;
  const height = waiting ? Math.min(125, (remain / delay) * 160) : 0;
  const sy = y + height + 12;
  const size = has(a, "execution") ? 48 : 32;
  if(has(a,"brand")&&waiting) chevrons(g,x,sy+size+8,-Math.PI/2,8,c.mid,2);
  if (!waiting) {
    const age=Math.max(0,a.age-(a.impactAt ?? a.next-.25));
    impactCrown(g,x,y,Math.min(a.stats.radius*48,38),c.mid,Math.min(.95,age/.25),6);
    g.strokeColor=ink(c.edge,Math.max(0,200-age*600));g.lineWidth=2.4;
    for(let i=0;i<4;i++) {const angle=i*Math.PI/2+.2;
      g.moveTo(x,y);g.lineTo(x+Math.cos(angle)*a.stats.radius*35,y+Math.sin(angle)*a.stats.radius*35);
    }g.stroke();
  }
  // Blade.
  g.fillColor = ink(c.mid, 245);
  g.strokeColor = ink(c.edge, 240);
  g.lineWidth = 2;
  g.moveTo(x,sy-8);
  g.lineTo(x-10,sy+12);
  g.lineTo(x-8,sy+size);
  g.lineTo(x+8,sy+size);
  g.lineTo(x+10,sy+12);
  g.close();
  g.fill();
  g.stroke();
  poly(g, [[x,sy-3],[x-6,sy+14],[x-4,sy+size-2],[x,sy+size-2]], c.core, 255);
  // Guard and hilt.
  g.strokeColor = ink(c.core, 250);
  g.lineWidth = 3;
  g.moveTo(x-17,sy+size);
  g.lineTo(x+17,sy+size);
  g.moveTo(x,sy+size);
  g.lineTo(x,sy+size+13);
  g.stroke();
  g.fillColor = ink(c.core, 230);
  g.circle(x,sy+size+15,3);
  g.fill();
}

/* ---------------- dispatch ---------------- */

export function drawExtraSpell(g: Graphics, w: SurvivalWorld, ground: boolean, reduced: boolean, crowded=false) {
  if(!ground)ghostRoster(g,w);
  for (const a of w.armory.extra.attacks) {
    if (!a.active || a.age < 0) continue;
    if (ground) {
      if (a.skill === "frost") frostGround(g, a, reduced||crowded);
      else if (a.skill === "mine") mineGround(g, w, a, reduced);
      else if (a.skill === "void") voidGround(g, w, a, reduced||crowded);
      else if (a.skill === "holy") holyGround(g, a);
    } else {
      if (a.skill === "ghost") ghostAir(g, w, a);
      else if (a.skill === "bone" && (a.phase === 0 || a.phase === -1)) boneAir(g, a);
      else if (a.skill === "lightning") lightningAir(g, w, a, reduced||crowded);
      else if (a.skill === "holy") holyAir(g, a);
    }
  }
}
