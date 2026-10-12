import { Graphics, Color } from "cc";
// Local coordinates: orbit nodes already provide position and rotation.
export function drawBladeForm(g: Graphics, level: number, branch?: string) {
  g.clear();
  const tier = level >= 10 ? 3 : branch || level >= 7 ? 2 : level >= 4 ? 1 : 0;
  if (!tier) return;
  g.fillColor = new Color(240, 222, 170, 255);
  g.strokeColor = new Color(255, 247, 210, 230);
  g.lineWidth = 1.5;
  const blades = tier === 1 ? 2 : tier === 2 ? 3 : 4;
  const r = branch === "ring" ? 13 : branch === "return" ? 19 : 15;
  for (let i = 0; i < blades; i++) {
    const a = i * Math.PI * 2 / blades;
    const point = (dx: number, dy: number) => [Math.round((Math.cos(a)*dx-Math.sin(a)*dy)/2)*2, Math.round((Math.sin(a)*dx+Math.cos(a)*dy)/2)*2];
    const p = point(2,-3), q = point(r,-2), s = point(r*.65,5), t = point(0,4);
    g.moveTo(p[0],p[1]); g.lineTo(q[0],q[1]); g.lineTo(s[0],s[1]); g.lineTo(t[0],t[1]); g.close(); g.fill(); g.stroke();
  }
  g.fillColor = new Color(86, 69, 49, 255); g.circle(0,0,4); g.fill();
  if (tier === 3) { g.circle(0,0,10); g.stroke(); }
}
export function drawGhostForm(g: Graphics, level: number, evolved: boolean, time: number, branch?: string) {
  g.clear();
  const tier = level >= 10 ? 3 : evolved || level >= 7 ? 2 : level >= 4 ? 1 : 0;
  if (!tier) return;
  if (branch === "hunters") {
    g.fillColor = new Color(170, 218, 255, 255);
    for (const side of [-1, 1]) {
      g.rect(side > 0 ? 9 : -18, 3, 9, 6); g.fill();
      g.rect(side > 0 ? 15 : -21, 9, 6, 15); g.fill();
    }
    g.rect(-6, 18, 12, 6); g.fill();
    g.rect(-3, 24, 6, 12); g.fill();
    return;
  }
  // Filled, stepped pixels match the companion sprite instead of thin vector outlines.
  g.fillColor = new Color(154, 199, 230, 255);
  const block = (x:number,y:number,w:number,h:number) => {g.rect(x,y,w,h);g.fill();};
  block(-12,6,3,12); block(9,6,3,12);
  block(-9,18,6,3); block(3,18,6,3); block(-3,21,6,3);
  if (tier >= 2) {
    const flap = Math.sin(time*5)>0 ? 3 : 0;
    for(const side of [-1,1]) {
      for(let i=0;i<3;i++)block(side>0?12+i*3:-15-i*3, 6+flap-i*3, 3, 9);
      block(side>0?9:-12,21,3,6); block(side>0?12:-15,24,3,6);
    }
  }
  if (tier === 3) {
    g.fillColor = new Color(222, 241, 255, 255);
    block(-9,27,18,3); block(-9,30,3,6); block(-3,30,6,3); block(6,30,3,6);
    for(const side of [-1,1]) {
      block(side>0?9:-15,-3,6,6); block(side>0?12:-18,-9,6,6);
      block(side>0?9:-15,-15,6,6);
    }
  }
}
