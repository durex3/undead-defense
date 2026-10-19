import type { ExtraAttack } from "../../../battle/ExtraArmory";

/** Read strike timings already owned by ExtraArmory; never advance them here. */
export function lightningEnvelope(a: ExtraAttack, index: number) {
  const echo = a.phase === 2 && a.stats.mods.includes("echo");
  const strikeAt = echo ? a.next - .18 : a.stats.mods.includes("storm") ? index * .18 : 0;
  const age = Math.max(0, a.age - strikeAt);
  const decay = Math.max(0, 1 - age / .28);
  return { age, opacity: .08 + .92 * decay * decay, width: .35 + .65 * decay,
    contact: age < .12, echo };
}

/** World-pixel path from above the camera to the exact locked impact point. */
export function skyBoltPoints(x: number,y: number,skyY: number,age: number,index: number): [number,number][] {
  const top=Math.max(y+180,skyY),height=top-y;
  const sway=Math.sin(age*48+index*2.4)*6,side=index%2?1:-1;
  return [[x+side*22,top],[x+side*12,y+height*.78],
    [x-side*14+sway,y+height*.62],[x+side*10,y+height*.43],
    [x-side*8+sway,y+height*.28],[x+side*3,y+height*.12],[x,y]];
}
