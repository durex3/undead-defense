import type { Graphics } from "cc";
import { ink } from "./Ink";

/** Batched angular strokes: short life and no screen-wide glow wash. */
export function impactCrown(g: Graphics, x: number, y: number, r: number, color: string, phase: number, count = 6) {
  g.strokeColor = ink(color, 220 * (1 - phase)); g.lineWidth = 2;
  for (let i = 0; i < count; i++) {
    const a = i * Math.PI * 2 / count + .25, lo = r * (.25 + phase * .3), hi = r * (.55 + phase * .45);
    g.moveTo(x + Math.cos(a) * lo, y + Math.sin(a) * lo);
    g.lineTo(x + Math.cos(a) * hi, y + Math.sin(a) * hi);
  }
  g.stroke();
}

export function cutTrail(g: Graphics, x: number, y: number, angle: number, length: number, width: number, color: string, alpha = 110) {
  const dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx;
  g.fillColor = ink(color, alpha);
  for (const side of [-1, 1]) {
    const offset = side * width;
    g.moveTo(x + nx * offset, y + ny * offset);
    g.lineTo(x - dx * length + nx * offset * 1.7, y - dy * length + ny * offset * 1.7);
    g.lineTo(x - dx * length * .3 + nx * offset * .5, y - dy * length * .3 + ny * offset * .5);
    g.close();
  }
  g.fill();
}

export function chevrons(g: Graphics,x: number,y: number,angle: number,size: number,color: string,count=2) {
  const dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx;
  g.strokeColor=ink(color,230);g.lineWidth=1.7;
  for(let i=0;i<count;i++) {
    const xx=x-dx*i*size*.7, yy=y-dy*i*size*.7;
    g.moveTo(xx-dx*size*.5+nx*size*.5,yy-dy*size*.5+ny*size*.5);
    g.lineTo(xx,yy);
    g.lineTo(xx-dx*size*.5-nx*size*.5,yy-dy*size*.5-ny*size*.5);
  }
  g.stroke();
}

export type WarningSymbol = "claw" | "sweep" | "landing" | "wall" | "line" | "sector" | "charge";
/** Shape identity supplements colour. Glyphs never imply a larger hit area. */
export function warningGlyph(g: Graphics, x: number, y: number, shape: WarningSymbol, color: string, active = false) {
  g.strokeColor = ink("#10191e", 240); g.lineWidth = active ? 6 : 5;
  const draw = () => {
    if (shape === "claw") {
      for (let i = -1; i <= 1; i++) { g.moveTo(x+i*6-4,y-8); g.lineTo(x+i*6+4,y+8); }
    } else if (shape === "wall") {
      for (const side of [-1,1]) { g.moveTo(x+side*12,y-10); g.lineTo(x+side*12,y+10); }
      g.moveTo(x-4,y); g.lineTo(x+4,y);
    } else if (shape === "line") {
      g.moveTo(x-8,y+10); g.lineTo(x+2,y+1); g.lineTo(x-3,y-1); g.lineTo(x+8,y-10);
    } else if (shape === "sweep") {
      g.moveTo(x-9,y-8); g.quadraticCurveTo(x+13,y-5,x+7,y+10);
    } else if (shape === "sector") {
      g.moveTo(x-10,y+8); g.lineTo(x,y-8); g.lineTo(x+10,y+8);
      g.moveTo(x,y-8); g.lineTo(x,y+7);
    } else if (shape === "landing") {
      for (const s of [-1,1]) { g.moveTo(x+s*11,y+s*11); g.lineTo(x+s*3,y+s*3); }
      g.moveTo(x-10,y+10); g.lineTo(x-3,y+3); g.moveTo(x+10,y-10); g.lineTo(x+3,y-3);
    } else {
      g.moveTo(x-10,y-8); g.lineTo(x,y); g.lineTo(x-10,y+8);
      g.moveTo(x,y-8); g.lineTo(x+10,y); g.lineTo(x,y+8);
    }
    g.stroke();
  };
  draw(); g.strokeColor = ink(color, 250); g.lineWidth = active ? 3 : 2; draw();
}
