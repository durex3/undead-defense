import {mapApproach,mapPackOffset} from './MapEncounters';
import type { SurvivalWorld } from './SurvivalWorld';
import { Enemy, Hazard, Point, distance, angleDelta, segmentDistance } from './SurvivalTypes';
import { ENEMIES, Kind, isElite } from './SurvivalConfig';
import { siegeMap } from './SiegeMap';
import { crownEscape } from './CrownSystem';
import { hordePressure } from './HordePressure';

export const SIEGE_KINDS: readonly Kind[] = ['siegebone','thornshield','siegebow','flanker','siegeflag','siegerider'];
export const siegeEnemy = (kind:Kind) => SIEGE_KINDS.includes(kind);
export const siegeRest = (t:number) => (t>=170&&t<178)||(t>=285&&t<293)||(t>=472&&t<480);
export function siegeHint(t:number) {
  return siegeRest(t)?'暂歇 · 清理后排、回收经验':t<60?'盾卫正面减伤 · 绕侧或等收盾':t<100?'弩手预判方向 · 看预警后变向':t<130?'侧翼截击点已锁定 · 换方向突破':'先拆盾弩后排 · 留意两侧猎手';
}
function move(w:SurvivalWorld,e:Enemy,p:Point,dt:number,speed=ENEMIES[e.kind].speed) {
  if(distance(e,p)<.15)return;
  const a=siegeMap.heading(e,p),s=speed*(e.slowUntil>w.time?1-e.slow:1);
  e.x=Math.max(-22,Math.min(22,e.x+Math.cos(a)*s*dt));e.y=Math.max(-26,Math.min(26,e.y+Math.sin(a)*s*dt));
}
function recover(e:Enemy,t:number){e.state='recover';e.timer=t;}
export function shieldRaised(w:SurvivalWorld,e:Enemy) {
  return e.kind==='thornshield'&&e.hp>0&&e.state!=='arriving'&&e.freezeUntil<=w.time&&(e.shieldClock??0)<3;
}
function inFront(e:Enemy,p:Point){return Math.abs(angleDelta(Math.atan2(p.y-e.y,p.x-e.x),e.facing))<Math.PI/3;}
/** Only actual travelling projectiles call this; area/chain/melee attacks bypass it. */
export function siegeProjectileFactor(w:SurvivalWorld,e:Enemy,origin:Point) {
  if(w.stageId!==14)return 1;
  if(shieldRaised(w,e)&&inFront(e,origin))return .45;
  if(e.kind!=='siegebow')return 1;
  const guard=w.enemies.find(g=>shieldRaised(w,g)&&g.shieldPartner===e.id&&distance(g,e)<=2&& !inFront(g,e)&&inFront(g,origin));
  return guard?.hp ? .65 : 1;
}
function canPublish(w:SurvivalWorld,h:Hazard[]) {
  const reject=(reason:string)=>{w.siege.stats.rejections[reason]=(w.siege.stats.rejections[reason]??0)+1;return false;};
  if(w.hazards.length+h.length+w.siege.reserved(h[0]?.source)>2)return reject('slots');
  // Attacks must be visible and contained; arrows can end beyond the visible frame but start on screen.
  if(h.some(p=>!w.visible(p,.3)||Math.abs(p.x)>22||Math.abs(p.y)>26))return reject('origin');
  if(h.some(p=>p.kind==='frontierImpact'&&(Math.abs(p.x)+p.radius>22||Math.abs(p.y)+p.radius>26||!w.visible(p,p.radius))))return false;
  if(h.some(p=>p.kind==='frontierLane'&&(Math.abs(p.x)+p.width>22||Math.abs(p.y)+p.width>26)))return false;
  // Every freshly locked segment is checked against active dangers and nearby bodies.
  // A fresh lock cannot know the player's future input; reject unsafe follow-ups at that lock.
  if(!crownEscape(w,h,true))return reject('escape');
  w.hazards.push(...h);return true;
}
function base(w:SurvivalWorld,e:Enemy,kind:Hazard['kind'],delay:number,duration:number,damage:number):Hazard {
  return {id:w.id(),source:e.id,kind,x:e.x,y:e.y,angle:e.facing,radius:0,width:0,created:w.time,due:w.time+delay,until:w.time+delay+duration,damage,fixedDamage:true,fired:false,next:0};
}
export class SiegeSystem {
  readonly stats={packs:0,bow:0,ground:0,boss:0,blockedBow:0,blockedBoss:0,sequence:0,degraded:0,dog:0,elite:0,rejections:{} as Record<string,number>};
  private reservations=new Map<number,number>();
  reserved(except=0) {let n=0;for(const [id,slots] of this.reservations)if(id!==except)n+=slots;return n;}
  private reserve(e:Enemy,slots=2) {
    if(this.w.hazards.filter(h=>h.source!==e.id).length+this.reserved(e.id)+slots>2)return false;
    this.reservations.set(e.id,slots);return true;
  }
  release(e:Enemy) {this.reservations.delete(e.id);}
  private clean() {
    const w=this.w;
    for(const id of this.reservations.keys())if(!w.enemies.some(e=>e.id===id&&e.hp>0))this.reservations.delete(id);
    for(const e of w.enemies)if(e.siegeShieldOwner&&(!w.enemies.some(o=>o.id===e.siegeShieldOwner&&o.hp>0)||w.time>=(e.siegeShieldUntil??0)))e.siegeShield=0;
  }
  private group=0;
  private mapWave=0;
  private special=30;
  private flank=100;
  private bossCycle=-1;
  private bowDeployments=0;
  private history:{x:number;y:number;t:number}[]=[];
  constructor(private w:SurvivalWorld){}
  sample() {
    const w=this.w;if(w.stageId!==14)return;
    this.clean();
    this.history.push({...w.player,t:w.time});
    while(this.history.length>1&&this.history[1].t<=w.time-.35)this.history.shift();
    if(this.history.length>32)this.history.shift();
  }
  prediction():Point {
    const w=this.w,old=this.history[0],age=old?w.time-old.t:0;
    if(age<.1)return {...w.player};
    let x=(w.player.x-old.x)*.45/age,y=(w.player.y-old.y)*.45/age;
    const scale=Math.min(1,2/Math.max(.01,Math.hypot(x,y)));
    return {x:Math.max(-22,Math.min(22,w.player.x+x*scale)),y:Math.max(-26,Math.min(26,w.player.y+y*scale))};
  }
  private location(angle:number,radius=7,clearance=0):Point|null {
    const w=this.w;
    for(let i=0;i<24;i++){
      const a=angle+i*Math.PI/12,r=Math.min(radius,(w.viewport.x-.7-clearance)/Math.max(.01,Math.abs(Math.cos(a))),(w.viewport.y-.7-clearance)/Math.max(.01,Math.abs(Math.sin(a))));
      const p={x:w.camera.x+Math.cos(a)*r,y:w.camera.y+Math.sin(a)*r};
      if(Math.abs(p.x)<21.5&&Math.abs(p.y)<25.5&&distance(p,w.player)>=6&&!siegeMap.blocked(p,.4)&&w.visible(p,.3))return p;
    }
    return null;
  }
  private budget(kinds:readonly Kind[]) {
    const w=this.w,used=w.enemies.reduce((n,e)=>n+(e.hp>0?ENEMIES[e.kind].threat:0),0);
    return w.enemies.filter(e=>e.hp>0).length+kinds.length<=100&&used+kinds.reduce((n,k)=>n+ENEMIES[k].threat,0)<=6&&kinds.every(k=>w.enemies.filter(e=>e.hp>0&&e.kind===k).length+kinds.filter(x=>x===k).length<=ENEMIES[k].cap);
  }
  spawnPack(kinds:readonly Kind[],angle=this.w.random()*Math.PI*2,reinforcement=false) {
    const w=this.w;if(!this.budget(kinds))return false;
    if(kinds.some(k=>!isElite(k)&&w.enemies.some(e=>e.hp>0&&e.kind===k)))return false;
    const p=this.location(angle,8,kinds.includes('siegebow')&&kinds.includes('thornshield')?1.4:0);if(!p)return false;
    const a=Math.atan2(p.y-w.player.y,p.x-w.player.x);
    const positions=kinds.map((kind,i)=>kind==='siegebow'&&kinds.includes('thornshield')?{x:p.x+Math.cos(a)*1.4,y:p.y+Math.sin(a)*1.4}:kind==='flanker'?this.location(angle+(i?Math.PI:0),8):{...p});
    if(positions.some(q=>!q||!w.visible(q,.3)||Math.abs(q.x)>22||Math.abs(q.y)>26||siegeMap.blocked(q,.4)||distance(q,w.player)<6))return false;
    this.stats.packs++;
    const made:Enemy[]=[];
    kinds.forEach((kind,i)=>{
      const q=positions[i]!;const e=w.addEnemy(kind,q.x,q.y,reinforcement)!;
      e.state='arriving';e.timer=1;e.attack=1;e.bossReinforcement=reinforcement;e.facing=Math.atan2(w.player.y-q.y,w.player.x-q.x);
      if(kind==='siegebow'){this.bowDeployments++;if(w.time>=130&&this.bowDeployments%3===0)e.pattern=2;}
      if(kind==='flanker'){
        const direction=Math.hypot(w.move.x,w.move.y)>.1?Math.atan2(w.move.y,w.move.x):angle,side=i?1:-1;
        e.siegeTarget={x:w.player.x+Math.cos(direction)*2-Math.sin(direction)*3*side,y:w.player.y+Math.sin(direction)*2+Math.cos(direction)*3*side};
        e.siegeTarget.x=Math.max(-21,Math.min(21,e.siegeTarget.x));e.siegeTarget.y=Math.max(-25,Math.min(25,e.siegeTarget.y));siegeMap.resolve(e.siegeTarget,.4);e.siegeRouteTime=2.5;
      }
      made.push(e);
    });
    const shield=made.find(e=>e.kind==='thornshield'),bow=made.find(e=>e.kind==='siegebow');if(shield&&bow)shield.shieldPartner=bow.id;
    return true;
  }
  director(dt:number,position:(a:number,r?:number)=>Point,suppressSpecial=false) {
    const w=this.w,t=w.time;if(siegeRest(t)||t<w.reinforcementRestUntil)return;
    const elite=w.enemies.some(e=>e.hp>0&&isElite(e.kind));
    this.group-=dt;
    if(this.group<=0){
      const pressure=hordePressure(w),count=t<.1?6:Math.min(22,5+Math.floor(t/55)+(elite?0:pressure.extra)),a=mapApproach(14,t,this.mapWave,w.random());
      for(let i=0;i<count;i++){
        const p=position(a+mapPackOffset(14,t,this.mapWave,i,count));
        if(siegeMap.blocked(p,.4)||distance(p,w.player)<3)continue;
        const e=w.addEnemy('siegebone',p.x,p.y);if(!e)break;e.state='arriving';e.timer=1;
        if(t>=30&&i%3===0&&w.enemies.filter(o=>o.kind==='siegebone'&&(o.siegeRouteTime??0)>0).length<8){
          const a=Math.atan2(w.player.y-p.y,w.player.x-p.x)+(i%2?1:-1)*Math.PI/2;
          e.siegeTarget={x:Math.max(-21,Math.min(21,w.player.x+Math.cos(a)*3)),y:Math.max(-25,Math.min(25,w.player.y+Math.sin(a)*3))};siegeMap.resolve(e.siegeTarget,.35);e.siegeRouteTime=2;
        }
      }
      this.mapWave++;
      this.group=Math.max(.9,2.7-t/250)/(elite?.6:pressure.rate)/(t>=395&&t<460?1.1:1);
    }
    if(t>=472||suppressSpecial)return;
    if(t>=this.special){
      this.special=t+(t>=395?10:12);
      if(t<60)this.spawnPack(['thornshield']);
      else if(t<100)this.spawnPack(['siegebow']);
      else if(t<130){} // first flanker lesson has no newly added back row
      else if(!elite&&!(t>=178&&t<225)){this.spawnPack(t>=460?['siegebow']:['thornshield','siegebow']);if(t>=225&&t<460)this.flank=Math.max(this.flank,t+6);}
      else if(t>=350&&t<395)this.spawnPack(['siegebow']);
    }
    if(t>=100&&t>=this.flank){
      this.flank=t+(t>=395?10:12);
      if((t<130)||(t>=225&&t<285)||(t>=293&&t<350)||(t>=395&&t<460))this.spawnPack(['flanker','flanker'],Math.atan2(w.lastMove.y,w.lastMove.x)+Math.PI/2);
      else if(elite&&t<225)this.spawnPack(['flanker']);
    }
  }
  bossReinforcements() {
    const w=this.w,b=w.enemies.find(e=>e.kind==='boss'&&e.hp>0),cycle=Math.floor((w.time-480)/14);
    if(!b||b.state==='arriving'||(b.state==='windup'&&b.bossAction==='transition')||(w.time-480)%14>=9||cycle%2||cycle===this.bossCycle||w.enemies.some(e=>e.hp>0&&siegeEnemy(e.kind)&&e.kind!=='siegebone'))return;
    this.bossCycle=cycle;
    this.spawnPack(b.bossPhase===2?['thornshield','siegebow']:['flanker','flanker'],Math.atan2(w.lastMove.y,w.lastMove.x)+Math.PI/2,true);
  }
  castBow(e:Enemy,boss=false) {
    if(!boss&&(e.pattern+1)%3===0)return this.castGround(e,1.2,1.1,14,2,'钉地爆裂箭');
    const w=this.w,p=boss?{...w.player}:this.prediction(),angle=Math.atan2(p.y-e.y,p.x-e.x),h=base(w,e,'arrow',boss?1:.675,boss?1:2,boss?22:20);
    Object.assign(h,{angle,radius:boss?9:18,width:boss?.45:.4,projectileSpeed:9,damageLabel:boss?'督军追击补射':'预判贯阵箭'});
    if(!canPublish(w,[h])){this.stats.blockedBow++;return false;}
    this.stats.bow++;
    e.lockedAngle=angle;e.state='windup';e.timer=h.until-w.time;e.pattern++;e.bossAction=boss?'siegeShot':e.bossAction;return true;
  }
  castGround(e:Enemy,radius:number,delay:number,damage:number,residue=0,label='督军钉位') {
    const w=this.w,h=base(w,e,'circle',delay,.15+residue,damage);
    Object.assign(h,{...w.player,radius,siegeGround:true,siegeTick:residue?8:0,damageLabel:label,siegeBallistic:e.kind==='siegebow',endX:e.x,endY:e.y});
    if(!canPublish(w,[h]))return false;
    this.stats.ground++;e.state='windup';e.timer=h.until-w.time;e.pattern+=e.kind==='siegebow'?1:0;return true;
  }
  castRush(e:Enemy,delay=.85,length=4,speed=6,width=.4,damage=16) {
    const w=this.w,angle=Math.atan2(w.player.y-e.y,w.player.x-e.x),h=base(w,e,'line',delay,length/speed,damage);
    Object.assign(h,{angle,radius:length,width,siegeCharge:true,damageLabel:e.kind==='flanker'?'战犬突袭':'骑将破阵冲锋'});
    if(!canPublish(w,[h]))return false;
    e.lockedAngle=angle;e.state='windup';e.timer=delay;e.combo=0;return true;
  }
  private rush(e:Enemy,dt:number,length:number,speed:number,width:number,damage:number) {
    const w=this.w,old={...e},p={x:e.x+Math.cos(e.lockedAngle)*speed*Math.min(dt,e.timer),y:e.y+Math.sin(e.lockedAngle)*speed*Math.min(dt,e.timer)};
    const wall=siegeMap.segment(old,p,width)||siegeMap.blocked(p,width)||Math.abs(p.x)>22||Math.abs(p.y)>26;
    if(!wall){e.x=p.x;e.y=p.y;if(!e.combo&&segmentDistance(w.player,old,e)<width){w.hurt(damage,e.kind==='flanker'?'战犬突袭':'骑将破阵冲锋',false);e.combo=1;}}
    e.timer-=dt;
    if(wall||e.timer<=0){w.hazards=w.hazards.filter(h=>h.source!==e.id);e.siegeWall=!!wall;recover(e,e.kind==='flanker'?1.2:wall?2.8:1.8);this.release(e);return true;}return false;
  }
  stepEnemy(e:Enemy,dt:number) {
    const w=this.w,d=distance(e,w.player);
    if(isElite(e.kind)){this.stepElite(e,dt);return;}
    if(e.kind==='thornshield'){
      e.shieldClock=((e.shieldClock??0)+dt)%4.8;
      const delta=angleDelta(Math.atan2(w.player.y-e.y,w.player.x-e.x),e.facing);e.facing+=Math.max(-Math.PI/2*dt,Math.min(Math.PI/2*dt,delta));
      if(!e.shieldPartner){const bow=w.enemies.find(o=>o.kind==='siegebow'&&o.hp>0&&distance(o,e)<=2);if(bow)e.shieldPartner=bow.id;}
    }else e.facing=Math.atan2(w.player.y-e.y,w.player.x-e.x);
    if(e.kind==='siegebow'){
      if(e.state==='windup'){
        if(d<1.5||!w.visible(e,.3)){w.hazards=w.hazards.filter(h=>h.source!==e.id||h.fired);recover(e,.8);return;}
        e.timer-=dt;if(e.timer<=0)recover(e,.8);return;
      }
      if(e.state==='recover'){e.timer-=dt;if(e.timer<=0){e.state='seek';e.attack=2.5;}return;}
      e.attack-=dt;
      if(d>16)move(w,e,w.player,dt);
      if(d<1.5&&w.time>=(e.siegeDodgeReady??0)){e.siegeDodgeReady=w.time+4;e.siegeTarget={x:e.x+Math.cos(e.facing+Math.PI)*1.5,y:e.y+Math.sin(e.facing+Math.PI)*1.5};siegeMap.resolve(e.siegeTarget,.35);e.siegeRouteTime=1;}
      if((e.siegeRouteTime??0)>0&&e.siegeTarget){move(w,e,e.siegeTarget,dt,1.5);e.siegeRouteTime!-=dt;}
      if(d<.65)w.hurt(16,e.kind);
      if(e.attack<=0&&d>=2&&d<=18&&e.visibleSince>=0&&w.time-e.visibleSince>=1&&w.visible(e,.3)&&!this.castBow(e))e.attack=.35;
      return;
    }
    if(e.kind==='flanker'){
      if(e.state==='windup'){e.timer-=dt;if(e.timer<=0){e.state='charge';e.timer=4/6;}return;}
      if(e.state==='charge'){this.rush(e,dt,4,6,.4,16);return;}
      if(e.state==='recover'){e.timer-=dt;if(e.timer<=0)e.state='seek';return;}
      if(e.pattern===0&&(e.siegeRouteTime??0)<=0&&d>=2&&d<=5&&e.visibleSince>=0&&w.time-e.visibleSince>=1&&this.castRush(e)){e.pattern=1;this.stats.dog++;return;}
    }
    let target=w.player;
    if(e.kind==='thornshield'&&e.shieldPartner){
      const bow=w.enemies.find(o=>o.id===e.shieldPartner&&o.hp>0);
      if(bow){const a=Math.atan2(w.player.y-bow.y,w.player.x-bow.x);target={x:bow.x+Math.cos(a)*1.4,y:bow.y+Math.sin(a)*1.4};siegeMap.resolve(target,.35);}
      else e.shieldPartner=undefined;
    }
    if((e.kind==='flanker'||e.kind==='siegebone')&&e.siegeTarget&&(e.siegeRouteTime??0)>0){target=e.siegeTarget;e.siegeRouteTime!-=dt;if(distance(e,target)<.4)e.siegeRouteTime=0;}
    if(e.kind==='thornshield'){
      const ground=w.armory.fields.some(f=>f.active&&f.until>w.time&&distance(f,e)<f.radius);
      e.siegeGroundTime=ground?(e.siegeGroundTime??0)+dt:0;
      if((e.siegeGroundTime??0)>=.6&&w.time>=(e.siegeDodgeReady??0)){
        e.siegeDodgeReady=w.time+5;e.siegeRouteTime=1;const a=e.facing+Math.PI/2*(e.id%2?1:-1);e.siegeTarget={x:e.x+Math.cos(a)*2,y:e.y+Math.sin(a)*2};siegeMap.resolve(e.siegeTarget,.35);
      }
      if(e.siegeTarget&&(e.siegeRouteTime??0)>0){target=e.siegeTarget;e.siegeRouteTime!-=dt;}
    }
    if(d>.6||target!==w.player)move(w,e,target,dt,e.kind==='thornshield'&&(e.siegeRouteTime??0)>0?1.6:ENEMIES[e.kind].speed);
    if(d<.65)w.hurt(ENEMIES[e.kind].contact,e.kind);
  }
  private castSweep(e:Enemy,ring=false) {
    const w=this.w,h=base(w,e,ring?'bellRing':'circle',1.1,.15,24);
    Object.assign(h,{radius:ring?5:3,width:ring?3:0,siegeRing:ring,damageLabel:ring?'棘甲外环':'棘甲内扫'});
    if(!canPublish(w,[h]))return false;
    e.state='windup';e.timer=h.until-w.time;return true;
  }
  private finish(e:Enemy,time:number) {this.release(e);e.siegeStep=undefined;e.siegeNext=undefined;recover(e,time);}
  private waitNext(e:Enemy,step:number,delay=.35) {e.siegeStep=step;e.siegeNext=this.w.time;e.state='windup';e.timer=delay;}
  castBoss(e:Enemy,action:number) {
    if(!this.reserve(e))return false;
    const w=this.w;
    let ok=false;
    if(action===0){ok=this.castGround(e,1.6,1.1,26);e.bossAction='siegePincer';}
    else if(action===1&&distance(e,w.player)>=2.5&&distance(e,w.player)<=8){
      const h=base(w,e,'line',1.2,6/7,24),angle=Math.atan2(w.player.y-e.y,w.player.x-e.x);
      Object.assign(h,{angle,radius:6,width:.65,siegeCharge:true,damageLabel:'督军贯阵冲锋'});
      ok=canPublish(w,[h]);if(ok){e.lockedAngle=angle;e.state='windup';e.timer=1.2;e.combo=0;}e.bossAction='siegeCharge';
    }else{ok=this.castSweep(e);e.bossAction='siegeSweep';}
    if(!ok){this.release(e);this.stats.blockedBoss++;return false;}
    e.siegeStep=0;e.siegeWall=false;this.stats.boss++;return true;
  }
  private bossFollow(e:Enemy) {
    const w=this.w;
    let ok=false;
    if(e.bossAction==='siegePincer')ok=this.castGround(e,1.6,1,26,e.bossPhase===2?1.5:0,'督军追击钉位');
    else if(e.bossAction==='siegeSweep')ok=this.castSweep(e,true);
    else {const h=base(w,e,'circle',1,.15,24);Object.assign(h,{radius:2.8,damageLabel:'冲锋接横扫'});ok=canPublish(w,[h]);if(ok){e.state='windup';e.timer=1.15;}}
    if(ok){e.siegeStep=2;e.siegeNext=undefined;this.stats.sequence++;return;}
    if(w.time-(e.siegeNext??w.time)>=2){this.stats.degraded++;this.finish(e,2);}
    else{e.state='windup';e.timer=.2;}
  }
  stepBoss(e:Enemy,dt:number) {
    const w=this.w;
    if(e.bossPhase===1&&e.hp<=e.maxHp*.5){
      this.release(e);e.siegeStep=undefined;e.siegeNext=undefined;e.bossPhase=2;e.state='windup';e.timer=1.5;e.bossAction='transition';e.pattern=0;
      w.hazards=w.hazards.filter(h=>h.source!==e.id||h.fired);w.effects.push({type:'bossPhase',...e,value:2});return;
    }
    if(e.freezeUntil>w.time){for(const h of w.hazards)if(h.source===e.id&&!h.fired){h.created+=dt;h.due+=dt;h.until+=dt;}if(e.siegeNext!==undefined)e.siegeNext+=dt;return;}
    if(e.state==='arriving'){e.timer-=dt;if(e.timer<=0){e.state='seek';e.attack=0;}return;}
    if(e.state==='windup'){
      e.timer-=dt;if(e.timer>1e-6)return;
      if(e.bossAction==='transition'){this.finish(e,.2);return;}
      if(e.siegeStep===1){this.bossFollow(e);return;}
      if(e.bossAction==='siegeCharge'&&e.siegeStep===0){e.state='charge';e.timer=6/7;return;}
      if(e.siegeStep===0){this.waitNext(e,1);return;}
      this.finish(e,e.bossAction==='siegePincer'?2:e.bossAction==='siegeCharge'?(e.siegeWall?3.4:2.8):2);return;
    }
    if(e.state==='charge'){
      const old={...e},p={x:e.x+Math.cos(e.lockedAngle)*7*Math.min(dt,e.timer),y:e.y+Math.sin(e.lockedAngle)*7*Math.min(dt,e.timer)};
      const wall=siegeMap.segment(old,p,.65)||siegeMap.blocked(p,.65)||Math.abs(p.x)>22||Math.abs(p.y)>26;
      if(!wall){e.x=p.x;e.y=p.y;if(!e.combo&&segmentDistance(w.player,old,e)<.65){w.hurt(24,'督军贯阵冲锋',false);e.combo=1;}}
      e.timer-=dt;
      if(wall||e.timer<=0){e.siegeWall=!!wall;w.hazards=w.hazards.filter(h=>h.source!==e.id);this.waitNext(e,1,0);}return;
    }
    if(e.state==='recover'){e.timer-=dt;if(e.timer<=0){e.siegeWall=false;e.state='seek';e.attack=.2;}return;}
    e.attack-=dt;e.facing=Math.atan2(w.player.y-e.y,w.player.x-e.x);
    if(distance(e,w.player)>.85)move(w,e,w.player,dt,1.9);
    if(distance(e,w.player)<1)w.hurt(18,'boss',false);
    if(e.attack>0||e.visibleSince<0||w.time-e.visibleSince<1||!w.visible(e,.3))return;
    const action=e.bossPhase===2?[0,2,1][e.pattern%3]:e.pattern%3;
    if(this.castBoss(e,action)){e.pattern++;e.siegeRetry=0;}else e.attack=.35;
  }
  private stepElite(e:Enemy,dt:number) {
    const w=this.w,d=distance(e,w.player);
    if(e.state==='windup'){
      e.timer-=dt;if(e.timer>1e-6)return;
      if(e.kind==='siegerider'&&e.siegeStep===0){e.state='charge';e.timer=6/6.5;return;}
      if(e.kind==='siegeflag'&&e.siegeStep===0){this.waitNext(e,1,.4);return;}
      if(e.kind==='siegeflag'&&e.siegeStep===1){
        const dog=w.enemies.find(o=>o.kind==='flanker'&&o.hp>0&&o.state==='seek'&&distance(o,w.player)>=2&&distance(o,w.player)<=5&&o.visibleSince>=0&&w.time-o.visibleSince>=1&&o.freezeUntil<=w.time);
        this.release(e);if(dog&&this.castRush(dog)){dog.pattern=1;this.stats.dog++;}this.finish(e,2.5);return;
      }
      this.finish(e,2.5);return;
    }
    if(e.state==='charge'){this.rush(e,dt,6,6.5,.65,26);return;}
    if(e.state==='recover'){e.timer-=dt;if(e.timer<=0){e.siegeWall=false;e.state='seek';e.attack=e.kind==='siegeflag'?4:1;}return;}
    if(d>1)move(w,e,w.player,dt);
    if(d<1)w.hurt(e.kind==='siegeflag'?18:20,e.kind,false);
    e.attack-=dt;
    if(e.attack>0||e.visibleSince<0||w.time-e.visibleSince<1||!w.visible(e,.3))return;
    if(!this.reserve(e)){e.attack=.35;return;}
    if(e.kind==='siegeflag'){
      if(!this.castGround(e,1.5,1.2,20,0,'军旗镇地')){this.release(e);e.attack=.35;return;}
      const nearby=w.enemies.filter(o=>o.hp>0&&o.kind!=='siegebone'&&siegeEnemy(o.kind)&&!isElite(o.kind)&&distance(o,e)<=5&&w.time>=(o.siegeShieldReady??0)).sort((a,b)=>distance(a,e)-distance(b,e)).slice(0,2);
      for(const o of nearby){o.siegeShield=o.maxHp*.15;o.siegeShieldOwner=e.id;o.siegeShieldUntil=w.time+4;o.siegeShieldReady=w.time+8;}
      e.siegeStep=0;this.stats.elite++;return;
    }
    if(d<2.5||d>7){this.release(e);e.attack=.2;return;}
    // The second rush reserves a delayed fragment explosion before the locked charge.
    if(e.pattern%2===1){
      const h=base(w,e,'circle',1.2,.15,18);Object.assign(h,{...w.player,radius:1.2,damageLabel:'骑将碎甲落点'});
      if(!canPublish(w,[h])){this.release(e);e.attack=.35;return;}
      if(!this.castRush(e,1.85,6,6.5,.65,26)){w.hazards=w.hazards.filter(o=>o.id!==h.id);this.release(e);e.attack=.35;return;}
    }else if(!this.castRush(e,1.1,6,6.5,.65,26)){this.release(e);e.attack=.35;return;}
    e.pattern++;e.siegeStep=0;this.stats.elite++;
  }
}
