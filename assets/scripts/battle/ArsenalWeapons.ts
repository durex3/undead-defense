import type { SurvivalWorld } from './SurvivalWorld';
import { Skill, isLarge } from './SurvivalConfig';
import { Point, Enemy, distance, segmentDistance } from './SurvivalTypes';
export const ARSENAL_SKILLS: Skill[] = ['chain', 'pillar', 'totem', 'soul', 'meteor'];
export interface ArsenalEntity extends Point {
  active: boolean; skill: Skill; a: number; b: number; until: number; next: number;
  due: number; created: number; radius: number; damage: number; remaining: number;
  evolved: boolean; level: number; endX: number; endY: number;
}
// Simulation and drawing share preallocated records; no Cocos node is created per cast.
const entity = (): ArsenalEntity => ({active:false,skill:'chain',x:0,y:0,a:0,b:0,until:0,next:0,due:0,created:0,radius:0,damage:0,remaining:0,evolved:false,level:0,endX:0,endY:0});
export class ArsenalWeapons {
  readonly links = Array.from({length:12}, entity);
  readonly markers = Array.from({length:12}, entity);
  readonly totems = Array.from({length:6}, entity);
  readonly bolts = Array.from({length:48}, entity);
  private chainMarks = new Map<number, number>();
  private soulMarks = new Map<number, number>();
  private comboReady = new Map<string, number>();
  constructor(private w: SurvivalWorld) {}
  remove(skill: Skill) {
    if (skill === "chain") this.chainMarks.clear();
    if (skill === "soul") this.soulMarks.clear();
    for (const pool of [this.links,this.markers,this.totems,this.bolts])
      for (const p of pool) if (p.skill === skill) p.active = false;
  }
  private acquire(pool: ArsenalEntity[], skill: Skill): ArsenalEntity | undefined {
    const p = pool.find(p=>!p.active);
    if (!p) return undefined; // defer casts until a slot is free; never evict pending damage
    Object.assign(p, {active:true,skill,x:0,y:0,a:0,b:0,created:this.w.time,due:this.w.time,next:this.w.time,until:this.w.time,remaining:0,level:this.w.skills[skill],evolved:!!this.w.weaponEvolution(skill),damage:0,radius:0,endX:0,endY:0});
    return p;
  }
  private enemies() { return this.w.enemies.filter(e=>e.hp>0 && e.state!=='arriving'); }
  private dense(): Enemy | undefined {
    return this.enemies().filter(e=>distance(e,this.w.player)<14).sort((a,b)=>this.w.near(b,2).length-this.w.near(a,2).length || Number(b.kind==='boss')-Number(a.kind==='boss'))[0];
  }
  cast(skill: Skill): boolean {
    const w=this.w, level=w.skills[skill], evolved=!!w.weaponEvolution(skill);
    const target=skill==='pillar'||skill==='meteor'?this.dense():w.target(w.player,14);
    if (!target) return false;
    let made=0;
    if(skill==='chain'||skill==='soul') {
      const used:number[]=[];
      let a=target;
      const count=skill==='chain'?(level>=2?3:2):(level>=2?2:1);
      for(let i=0;i<count;i++) {
        if(!used.includes(a.id))used.push(a.id);
        const b=w.target(a,level>=3?4:3,used);
        if(!b)break;
        const p=this.acquire(this.links,skill); if(!p)break;
        p.a=a.id;p.b=b.id;p.x=a.x;p.y=a.y;p.endX=b.x;p.endY=b.y;
        p.radius=level>=3?6:4.8;p.until=w.time+(level>=4?3.6:2.4);p.damage=w.attack*(skill==='chain'?.22:.15);made++;
        used.push(b.id);a=b;
      }
      // Keep a tether on lone targets; a completed totem recipe also enables a solo soul tether.
      if(!made && (skill==='chain' || (skill==='soul' && w.evolutions.totem && w.skills.totem>=10 && w.skills.soul>=10))) {
        const p=this.acquire(this.links,skill);if(p){p.a=target.id;p.b=target.id;p.until=w.time+2.4;p.damage=w.attack*(skill==='chain'?.22:.15);p.radius=6;made++;}
      }
    } else if(skill==='totem') {
      const count=evolved?3:level>=2?2:1;
      if(this.totems.filter(p=>!p.active).length<count)return false;
      for(let i=0;i<count;i++) {
        const p=this.acquire(this.totems,skill)!;const angle=w.time+i*Math.PI*2/count;
        p.x=Math.max(-22,Math.min(22,w.player.x+Math.cos(angle)*1.4));p.y=Math.max(-26,Math.min(26,w.player.y+Math.sin(angle)*1.4));
        p.until=w.time+(level>=4?7:5);p.damage=w.attack*(evolved?.42:.5);made++;
      }
    } else {
      const count=level>=2?2:1;
      const targets=this.enemies().filter(e=>distance(e,w.player)<14).sort((a,b)=>w.near(b,2).length-w.near(a,2).length);
      const chosen:Point[]=[];
      for(let i=0;i<count;i++) {
        const t=targets.find(e=>chosen.every(p=>distance(p,e)>2)) || (i===0?target:undefined);if(!t)break;
        const p=this.acquire(this.markers,skill);if(!p)break;
        chosen.push(t);p.x=t.x;p.y=t.y;p.due=w.time+(skill==='meteor'?1.2:skill==='pillar'&&w.evolutions.chain&&w.skills.chain>=10&&w.skills.pillar>=10?.35:.8);p.next=p.due;
        p.radius=(skill==='meteor'?2:1.5)*(level>=3?1.25:1);p.damage=w.attack*(skill==='meteor'?2.8:1.8);
        p.remaining=skill==='pillar'&&evolved?3:1;p.until=p.due+(evolved&&skill==='meteor'?2:.8);made++;
      }
    }
    if(made){w.castCounts[skill]=(w.castCounts[skill]||0)+1;w.effects.push({type:'cast',...w.player,skill});}
    return made>0;
  }
  step(dt:number) {
    const w=this.w;
    for (const marks of [this.chainMarks, this.soulMarks])
      for (const [id, until] of marks) if (until <= w.time || !w.enemies.some(e=>e.id===id&&e.hp>0)) marks.delete(id);
    for (const [key, until] of this.comboReady) if (until <= w.time) this.comboReady.delete(key);
    for(const skill of ARSENAL_SKILLS) {
      w.cooldowns[skill]=Math.max(0,w.cooldowns[skill]-dt);
      if(w.skills[skill] && w.cooldowns[skill]<=0 && this.cast(skill)) {
        const base=skill==='chain'?4:skill==='soul'?4.5:skill==='totem'?6:skill==='pillar'?4.2:6;
        w.cooldowns[skill]=base*(w.skills[skill]>=4 && (skill==='pillar'||skill==='meteor')?.8:1)*w.cooldownFactor(skill);
      }
    }
    for(const p of this.links)if(p.active) {
      let a=w.enemies.find(e=>e.id===p.a&&e.hp>0),b=w.enemies.find(e=>e.id===p.b&&e.hp>0);
      if(p.evolved&&p.skill==='chain'&&a&&!b) {b=w.target(a,4,[a.id]);if(b)p.b=b.id;}
      if(a){p.x=a.x;p.y=a.y;}if(b){p.endX=b.x;p.endY=b.y;}
      if(!a||!b||w.time>=p.until||distance(a,b)>p.radius) {
        if(p.evolved&&p.skill==='soul')this.burst(p,w.attack*.8,1.3);
        p.active=false;continue;
      }
      if(w.time>=p.next) {
        p.next=w.time+.5;
        const targets=a===b?[a]:[a,b];
        for(const e of targets) {
          if(p.skill==='soul'&&e.kind!=='boss'){e.slow=Math.max(e.slow,p.level>=3?.4:.25);e.slowUntil=w.time+.6;}
          if (p.skill === "chain") this.chainMarks.set(e.id, w.time + 0.8);
          if (p.skill === "soul") this.soulMarks.set(e.id, w.time + 0.8);
          w.hit(e,p.damage,p.skill,false,p);
        }
      }
    }
    for(const p of this.markers)if(p.active && w.time>=p.next) {
      if(p.remaining>0) {
        this.burst(p,p.damage,p.radius);p.remaining--;p.next=w.time+.28;
        if(!p.remaining)p.next=w.time+.5;
      } else if(p.skill==='meteor'&&p.evolved&&w.time<p.until) {
        this.burst(p,w.attack*.18,p.radius,false);p.next=w.time+.5;
      } else p.active=false;
    }
    for(const p of this.totems)if(p.active) {
      if(w.time>=p.until){p.active=false;continue;}
      if(w.time<p.next)continue;
      const target=this.enemies().filter(e=>distance(e,p)<8).sort((a,b)=>distance(a,p)-distance(b,p))[0];
      if(!target)continue;
      const bolt=this.acquire(this.bolts,'totem');if(!bolt)continue;
      p.next=w.time+(p.level>=3?.75:1);bolt.x=p.x;bolt.y=p.y;bolt.endX=target.x;bolt.endY=target.y;bolt.until=w.time+.16;
      if(p.evolved) {for(const e of this.enemies())if(segmentDistance(e,p,target)<.35){this.soulStrike(e,p);w.hit(e,p.damage,'totem',false,p);}}
      else {this.soulStrike(target,p);w.hit(target,p.damage,'totem',false,p);}
    }
    for(const p of this.bolts)if(p.active&&w.time>=p.until)p.active=false;
  }
  private combo(main: Skill, partner: Skill, e: Enemy, marks: Map<number, number>, cooldown: number) {
    const w = this.w, key = main + ":" + e.id;
    if (!w.evolutions[main] || w.skills[main] < 10 || w.skills[partner] < 10 || e.hp <= 0 ||
        (marks.get(e.id) ?? -Infinity) <= w.time || (this.comboReady.get(key) ?? -Infinity) > w.time) return false;
    this.comboReady.set(key, w.time + cooldown);
    return true;
  }
  private soulStrike(e: Enemy, origin: Point) {
    const w = this.w;
    if (!this.combo('totem', 'soul', e, this.soulMarks, 0.5)) return;
    w.hit(e, w.attack * 0.35, 'totem', false, origin, true, 'totem');
    w.combinations.trigger('totem','comboSoul',e,0.6);
  }
  private burst(p:ArsenalEntity,amount:number,radius:number,impact=true) {
    const w=this.w;
    if(impact)w.effects.push({type:'explosion',x:p.x,y:p.y,radius,skill:p.skill});
    if (impact && p.skill === 'meteor' && w.combinations.ready('meteor') &&
        w.expansion.fields.some(f=>f.skill==='void' && f.due<=w.time && f.until>w.time && distance(p,f)<=f.radius)) {
      for (const e of w.near(p, radius)) w.hit(e,w.attack*.8,'meteor',false,p,true,'meteor');
      w.combinations.trigger('meteor','comboCollapse',p,radius);
    }
    for(const e of w.near(p,radius)) {
      if (impact && p.skill === 'pillar' && this.combo('chain', 'pillar', e, this.chainMarks, 1)) {
        w.hit(e, w.attack * 0.65, 'chain', false, p, true, 'chain');
        w.combinations.trigger('chain','comboJudgment',e,0.8);
      }
      w.hit(e,amount*(p.skill==='pillar'&&p.evolved&&distance(e,p)<radius*.4?1.4:1),p.skill,false,p);
      if(impact&&p.skill==='meteor'&&!isLarge(e.kind)) {
        const d=Math.max(.01,distance(e,p));e.x=Math.max(-22,Math.min(22,e.x+(e.x-p.x)/d*.7));e.y=Math.max(-26,Math.min(26,e.y+(e.y-p.y)/d*.7));
      }
    }
  }
}
