import type { SurvivalWorld } from "../../battle/SurvivalWorld";

/** Only reduces friendly decoration. Never feeds combat or enemy warnings. */
export function crowdedEffects(w: SurvivalWorld) {
  let load = 0;
  for (const p of w.armory.shots) if (p.active) load++;
  for (const f of w.armory.fields) if (f.active) load += 3;
  for (const a of w.armory.extra.attacks) if (a.active && a.age >= 0) load += 2;
  for(const a of w.armory.unlocked.attacks)if(a.active&&a.created<=w.time)load+=2;
  return load > 16;
}

/** Per-batch spatial coalescing for ordinary hit sparks; importance is handled
 * separately by the particle pool, so crowds cannot evict player/phase cues. */
export class HitDecorBudget {
  private count = 0;
  private limit = 8;
  private xs = new Int32Array(8);
  private ys = new Int32Array(8);
  private skills: (string | undefined)[] = Array(8);
  begin(reduced: boolean) { this.count = 0; this.limit = reduced ? 4 : 8; }
  allow(x: number, y: number, skill: string | undefined) {
    const cx = Math.floor(x / 32), cy = Math.floor(y / 32);
    for(let i=0;i<this.count;i++) if(this.xs[i]===cx && this.ys[i]===cy && this.skills[i]===skill) return false;
    if(this.count>=this.limit) return false;
    this.xs[this.count]=cx; this.ys[this.count]=cy; this.skills[this.count]=skill; this.count++;
    return true;
  }
}
