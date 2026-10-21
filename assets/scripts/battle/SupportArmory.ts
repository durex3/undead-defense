import { weaponStats, WeaponStats } from "./ArmoryConfig";
import type { SurvivalWorld } from "./SurvivalWorld";
import { Enemy, Point, distance } from "./SurvivalTypes";
export interface SoulLamp extends Point { created: number; until: number; next: number; stats: WeaponStats; }
export interface SoulLink { a: number; b: number; until: number; next: number; budget: number; cap: number; ratio: number; range: number; }
/** One field, one pair, and at most ten short-lived marks. */
export class SupportArmory {
  strike: (Point & {until:number}) | null = null;
  lamp: SoulLamp | null = null;
  link: SoulLink | null = null;
  clearTarget(id:number){this.marks.delete(id);if(this.link&&(this.link.a===id||this.link.b===id))this.link=null;}
  marks = new Map<number, {until: number; factor: number}>();
  constructor(private w: SurvivalWorld) {}
  private eligible(e: Enemy) { return e.hp > 0 && e.state !== "arriving" && !e.sand?.buried; }
  private targets(range: number) {
    return this.w.enemies.filter(e => this.eligible(e) && distance(e,this.w.player) <= range)
      .sort((a,b) => this.w.targetPriority(b)-this.w.targetPriority(a) || distance(a,this.w.player)-distance(b,this.w.player) || a.id-b.id);
  }
  amplification(e: Enemy) {
    const m = this.marks.get(e.id);
    return m && m.until > this.w.time ? m.factor : 1;
  }
  linked() {
    const l = this.link;
    if(!l) return null;
    const a = this.w.enemies.find(e => e.id === l.a), b = this.w.enemies.find(e => e.id === l.b);
    if(this.w.time >= l.until || l.budget <= 0 || !a || !b || !this.eligible(a) || !this.eligible(b) || distance(a,b)>l.range) {
      this.link = null; return null;
    }
    return {a,b,l};
  }
  transfer(from: Enemy, dealt: number) {
    const pair = this.linked();
    if(!pair || !this.w.active || dealt <= 0) return;
    const {a,b,l} = pair;
    if((from.id !== a.id && from.id !== b.id) || this.w.time < l.next) return;
    const amount = Math.min(dealt*l.ratio, l.cap, l.budget);
    if(amount <= 0) return;
    l.next = this.w.time + .25; l.budget -= amount;
    this.w.hit(from.id === a.id ? b : a, amount, "needleEcho", false, from, false);
  }
  prepare() {
    const w=this.w;
    for(const [id,m] of this.marks) if(m.until <= w.time || !w.enemies.some(e=>e.id===id && this.eligible(e))) this.marks.delete(id);
    this.linked();
  }
  step(dt:number) {
    this.prepare();
    for(const skill of ["lamp","needle"] as const)this.castWeapon(skill,dt);
    this.advance(dt);
  }
  castWeapon(skill: "lamp"|"needle",dt:number) {
    const w=this.w;
      if(!w.skills[skill]) return;
      w.cooldowns[skill] = Math.max(0,w.cooldowns[skill]-dt);
      if(w.cooldowns[skill]>0) return;
      const s=weaponStats(w,skill), list=this.targets(s.range);
      if(!list.length) return;
      if(skill === "lamp") {
        if(this.lamp && this.lamp.until>w.time) return;
        // Prefer the densest nearby group, with stable ties.
        const t=[...list].sort((a,b)=>w.targetPriority(b)-w.targetPriority(a)||list.filter(e=>distance(e,b)<=s.radius).length-list.filter(e=>distance(e,a)<=s.radius).length)[0];
        this.lamp={x:t.x,y:t.y,created:w.time,until:w.time+s.duration,next:w.time,stats:s};
      } else {
        if(this.link) return;
        const a=list[0], b=list.find(e=>e.id!==a.id && distance(e,a)<= (s.mods.includes("long")?10.4:8));
        if(b) {
          const base=weaponStats(w,"needle",w.skills.needle).damage;
          // Caps depend on the needle, never on the partner's HP or the triggering weapon.
          const unmodified=base / (s.mods.includes("deep")?.75:1) / (s.mods.includes("long")?.85:1) / (s.mods.includes("barb")?1.4:1);
          this.link={a:a.id,b:b.id,until:w.time+s.duration,next:w.time,budget:unmodified*4*(s.mods.includes("deep")?1.25:1)*(s.mods.includes("barb")?.75:1),cap:unmodified*.7,ratio:s.mods.includes("deep")?.3:.2,range:s.mods.includes("long")?10.4:8};
        }
        this.strike={x:a.x,y:a.y,until:w.time+.2};
        w.hit(a,s.damage,"needle",false,w.player,true,undefined,1,true);
        w.effects.push({type:"cast",...a,skill:"needle"});
      }
      w.cooldowns[skill]=s.cooldown;
      w.castCounts[skill]=(w.castCounts[skill]||0)+1;

  }
  advance(_dt:number) {
    const w=this.w;
    const f=this.lamp;
    if(!f) return;
    if(w.time>=f.until) {this.lamp=null;return;}
    const s=f.stats, max=s.mods.includes("focus")?3:s.mods.includes("wide")?10:6;
    const targets=w.enemies.filter(e=>this.eligible(e)&&distance(e,f)<=s.radius).sort((a,b)=>distance(a,f)-distance(b,f)||a.id-b.id).slice(0,max);
    const activeIds=new Set(targets.map(e=>e.id));
    // Bound total lingering + current targets; do not grow a trail of permanent marks.
    let spare=max-targets.length;
    for(const id of this.marks.keys()) if(!activeIds.has(id)) {if(spare>0) spare--;else this.marks.delete(id);}
    for(const e of targets) this.marks.set(e.id,{until:w.time+(s.mods.includes("linger")?1.2:.6),factor:s.mods.includes("focus")?1.22:1.16});
    if(w.time+1e-8>=f.next) {
      f.next=w.time+(s.mods.includes("pulse")?1:.5);
      for(const e of targets) w.hit(e,s.damage,"lamp",false,f,false);
    }
  }
}
