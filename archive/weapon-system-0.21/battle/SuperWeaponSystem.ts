import type { SurvivalWorld } from "./SurvivalWorld";
import type { Enemy, Point } from "./SurvivalTypes";
import { distance, segmentDistance } from "./SurvivalTypes";
import { isLarge } from "./SurvivalConfig";

export interface PurificationSeal extends Point { radius:number; water:number; poison:number; }
export interface SoulEcho extends Point { id:number; target:number; ttl:number; vx:number; vy:number; }

/** Bounded cooperation attacks. Base weapons and their selected branches remain intact. */
export class SuperWeaponSystem {
  seals: PurificationSeal[] = [];
  souls: SoulEcho[] = [];
  private nextSealScan = 0;
  private nextPulse = 0;
  private nextSoulRelease = 0;
  private resolvingSoul = false;
  constructor(private w:SurvivalWorld) {}

  stepPurification() {
    const w=this.w;
    if(!w.combinations.ready("water")){this.seals=[];this.nextPulse=w.time;return;}
    const fields=w.expansion.fields;
    // Source expiry/removal invalidates a seal immediately, including between scans.
    this.seals=this.seals.filter(s=>{
      const a=fields.find(f=>f.id===s.water&&f.due<=w.time&&f.until>w.time),b=fields.find(f=>f.id===s.poison&&f.due<=w.time&&f.until>w.time);
      if(a?.follow){a.x=w.player.x;a.y=w.player.y;}
      return !!a&&!!b&&distance(s,a)+s.radius<=a.radius+.001&&distance(s,b)+s.radius<=b.radius+.001;
    });
    if(w.time>=this.nextSealScan){
      this.nextSealScan=w.time+.25;
      this.seals=[];
      const water=fields.filter(f=>f.skill==="water"&&f.due<=w.time&&f.until>w.time);
      const poison=fields.filter(f=>f.skill==="poison"&&f.due<=w.time&&f.until>w.time);
      for(const a of water){
        if(a.follow){a.x=w.player.x;a.y=w.player.y;}
        for(const b of poison){
          const d=distance(a,b),along=Math.max(0,Math.min(d,(d+a.radius-b.radius)/2));
          const radius=Math.min(1.5,a.radius-along,b.radius-(d-along));
          if(radius<.45)continue;
          const x=a.x+(b.x-a.x)*along/Math.max(.001,d),y=a.y+(b.y-a.y)*along/Math.max(.001,d);
          if(this.seals.some(s=>Math.hypot(s.x-x,s.y-y)<1.25))continue;
          this.seals.push({x,y,radius,water:a.id,poison:b.id});
          if(this.seals.length===3)break;
        }
        if(this.seals.length===3)break;
      }
    }
    if(!this.seals.length || w.time<this.nextPulse)return;
    this.nextPulse=w.time+1.2;
    const hit=new Set<number>();
    for(const s of this.seals){
      const a=fields.find(f=>f.id===s.water)!,b=fields.find(f=>f.id===s.poison)!;
      w.combinations.trigger("water","comboPurify",s,s.radius);
      for(const e of w.near(s,s.radius)){
        if(e.state==="arriving"||hit.has(e.id)||distance(e,a)>a.radius||distance(e,b)>b.radius)continue;
        hit.add(e.id);
        w.hit(e,w.attack*.8,"water",false,s,false,"water");
      }
    }
  }

  releaseSouls(enemy:Enemy) {
    const w=this.w;
    if(this.resolvingSoul||!w.combinations.ready("ghost")||w.time<this.nextSoulRelease||this.souls.length>=12)return;
    const targets=w.near(enemy,6).filter(e=>e.id!==enemy.id&&e.state!=="arriving")
      .sort((a,b)=>Number(b.kind==="boss")-Number(a.kind==="boss")||distance(a,enemy)-distance(b,enemy));
    if(!targets.length)return;
    this.nextSoulRelease=w.time+.25;
    for(const target of targets.slice(0,Math.min(2,12-this.souls.length))){
      this.souls.push({id:w.id(),x:enemy.x,y:enemy.y,target:target.id,ttl:2,vx:0,vy:0});
    }
    w.combinations.trigger("ghost","comboGhost",enemy,.7);
  }

  stepSouls(dt:number) {
    const w=this.w;
    if(!w.combinations.ready("ghost")){this.souls=[];return;}
    for(const s of this.souls){
      s.ttl-=dt;if(s.ttl<=0)continue;
      let target=w.enemies.find(e=>e.id===s.target&&e.hp>0&&e.state!=="arriving");
      if(!target){target=w.target(s,6);if(target)s.target=target.id;else{s.ttl=0;continue;}}
      const old={x:s.x,y:s.y},d=distance(s,target),move=Math.min(d,11*dt);
      s.vx=(target.x-s.x)/Math.max(.001,d);s.vy=(target.y-s.y)/Math.max(.001,d);
      s.x+=s.vx*move;s.y+=s.vy*move;
      if(segmentDistance(target,old,s)<(isLarge(target.kind)?.65:.3)){
        s.ttl=0;this.resolvingSoul=true;
        try{w.hit(target,w.attack*.55,"ghost",false,old,true,"ghost");}
        finally{this.resolvingSoul=false;}
      }
    }
    this.souls=this.souls.filter(s=>s.ttl>0);
  }

  remove(skill:string) {
    if(skill==="water"||skill==="poison"){this.seals=[];this.nextSealScan=0;this.nextPulse=0;}
    if(skill==="ghost"||skill==="bat"){this.souls=[];this.nextSoulRelease=0;}
  }
}
