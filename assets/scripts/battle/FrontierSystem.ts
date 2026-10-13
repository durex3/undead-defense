import type { SurvivalWorld } from './SurvivalWorld';
import { Enemy, Hazard, Point, distance } from './SurvivalTypes';
import { Kind, ENEMIES, isElite } from './SurvivalConfig';
import { crownEscape } from './CrownSystem';
import { frontierMap } from './FrontierMaps';
import { hordePressure } from './HordePressure';

export const FRONTIER_ROLES:Record<number,readonly [Kind,Kind,Kind]> = {
  11:['forgeguard','lineworker','hammerer'],
  12:['mirrorguard','prismarcher','mirrorpriest'],
  13:['ferryguard','tidecaller','echoferryman'],
};
const FRONTIER_ENEMIES=new Set<Kind>(Object.values(FRONTIER_ROLES).flat());
export function frontierEnemy(kind:Kind) {
  return FRONTIER_ENEMIES.has(kind);
}
export function frontierRest(t:number) {
  return (t>=164&&t<172)||(t>=250&&t<260)||(t>=330&&t<340)||(t>=468&&t<480);
}
export function frontierHint(stage:number,t:number) {
  if(frontierRest(t))return '暂歇窗口 · 拾取经验与补给';
  return stage===11 ? '熔线锁定后横移 · 绕冷却砧换侧，落锤后反击'
    : stage===12 ? '看清两线交点 · 向夹角空区移动，镜座不挡光线'
    : '两处潮印提前锁定 · 看先后顺序，侧移后抓住恢复期';
}
export class FrontierDirector {
  private group=0;
  private special=75;
  private wave=0;
  step(w:SurvivalWorld,dt:number,position:(a:number,r?:number)=>Point) {
    if(frontierRest(w.time)||w.time<w.reinforcementRestUntil)return;
    const [guard,a,b]=FRONTIER_ROLES[w.stageId], map=frontierMap(w.stageId);
    const elite=w.enemies.some(e=>e.hp>0&&isElite(e.kind));
    const reduced=(w.time>=75&&w.time<150)||(w.time>=172&&w.time<210)||(w.time>=340&&w.time<380);
    this.group-=dt;
    if(this.group<=0){
      const pressure=hordePressure(w),count=w.time<.1?6:Math.min(22,5+Math.floor(w.time/55)+(elite||reduced?0:pressure.extra));
      const angle=w.random()*Math.PI*2;this.wave++;
      let guards=w.enemies.filter(e=>e.hp>0&&e.kind===guard).length;
      for(let i=0;i<count;i++){
        const p=position(angle+(i>=count/2?Math.PI*.85:0)+i*.12);
        if(map.blocked(p,.4)||distance(p,w.player)<3)continue;
        const variant=w.time>=30&&w.time<460&&!elite&&this.wave%2===0&&i<2&&guards<12;
        const e=w.addEnemy(variant?guard:'minion',p.x,p.y);if(!e)break;
        e.state='arriving';e.timer=1;
        if(variant){
          guards++;
          const aim=Math.atan2(w.player.y-e.y,w.player.x-e.x),side=e.id%2?1:-1;
          const offset=w.stageId===11?0:w.stageId===12?3:2;
          e.frontierTarget={x:Math.max(-21,Math.min(21,w.player.x-Math.sin(aim)*offset*side+(w.stageId===13?Math.cos(aim)*2:0))),y:Math.max(-25,Math.min(25,w.player.y+Math.cos(aim)*offset*side+(w.stageId===13?Math.sin(aim)*2:0)))};
          map.resolve(e.frontierTarget,.4);e.frontierUntil=w.time+3.2;
        }
      }
      this.group=Math.max(.9,2.7-w.time/250)/(elite||reduced?.6:pressure.rate);
    }
    if(w.time<this.special||w.time>=460||elite)return;
    this.special=w.time+14;
    if((w.time>=150&&w.time<210)||(w.time>=250&&w.time<260)||(w.time>=300&&w.time<380))return;
    const kind=w.time<125?a:w.time<150?b:w.time<250?a:w.time<300?b:Math.floor(w.time/14)%2?a:b;
    const cap=w.time<150||w.time>=420?1:2;
    if(w.enemies.filter(e=>e.hp>0&&e.kind===kind).length>=cap||w.enemies.reduce((n,e)=>n+(e.hp>0?ENEMIES[e.kind].threat:0),0)+2>6)return;
    const start=w.random()*Math.PI*2;
    for(let i=0;i<32;i++){
      const angle=start+i*Math.PI/16,r=Math.min(9,(w.viewport.x-1)/Math.max(.01,Math.abs(Math.cos(angle))),(w.viewport.y-1)/Math.max(.01,Math.abs(Math.sin(angle))));
      const p={x:w.camera.x+Math.cos(angle)*r,y:w.camera.y+Math.sin(angle)*r};
      if(Math.abs(p.x)>22||Math.abs(p.y)>26||distance(p,w.player)<6||!w.visible(p,.6)||map.blocked(p,.4))continue;
      const e=w.addEnemy(kind,p.x,p.y);if(e){e.state='arriving';e.timer=1;}break;
    }
  }
}
function base(w:SurvivalWorld,e:Enemy,delay:number):Hazard {
  return {id:w.id(),source:e.id,kind:'frontierImpact',x:0,y:0,angle:0,radius:0,width:0,created:w.time,due:w.time+delay,until:w.time+delay+.3,damage:e.kind==='boss'?18:10,fixedDamage:true,fired:false,next:0};
}
function circle(w:SurvivalWorld,e:Enemy,p:Point,radius:number,delay:number,label:string):Hazard {
  return {...base(w,e,delay),x:p.x,y:p.y,radius,damageLabel:label};
}
function lane(w:SurvivalWorld,e:Enemy,p:Point,angle:number,length:number,width:number,delay:number,label:string):Hazard {
  const dx=Math.cos(angle)*length/2,dy=Math.sin(angle)*length/2;
  return {...base(w,e,delay),kind:'frontierLane',x:p.x-dx,y:p.y-dy,endX:p.x+dx,endY:p.y+dy,angle,width,damageLabel:label};
}
function offset(p:Point,angle:number,r:number):Point {return {x:p.x+Math.cos(angle)*r,y:p.y+Math.sin(angle)*r};}
function movement(w:SurvivalWorld,e:Enemy) {
  return Math.hypot(w.move.x,w.move.y)>.1?Math.atan2(w.move.y,w.move.x):Math.atan2(w.player.y-e.y,w.player.x-e.x)+Math.PI/2;
}
/** Snapshot both shapes and their timings before publishing any hazard. */
export function castFrontier(w:SurvivalWorld,e:Enemy,action=0) {
  const boss=e.kind==='boss',p={...w.player},angle=Math.atan2(p.y-e.y,p.x-e.x),second=e.bossPhase===2;
  let shapes:Hazard[]=[];
  if(!boss){
    switch(e.kind){
      case 'lineworker':shapes=[lane(w,e,offset(e,angle,3),angle,6,.5,1.5,'熔线喷发')];break;
      case 'hammerer':shapes=[circle(w,e,p,1.15,1.5,'落锤')];break;
      case 'prismarcher':shapes=[lane(w,e,offset(e,angle,3.5),angle,7,.4,1.5,'棱光射线')];break;
      case 'mirrorpriest':shapes=[lane(w,e,p,angle+Math.PI/4,5,.4,1.7,'分镜交叉'),lane(w,e,p,angle-Math.PI/4,5,.4,1.7,'分镜交叉')];break;
      case 'tidecaller':shapes=[circle(w,e,p,1.2,1.6,'引潮印')];break;
      case 'echoferryman':shapes=[circle(w,e,p,1.05,1.6,'双潮回响'),circle(w,e,offset(p,movement(w,e),3),1.05,2.4,'双潮回响')];break;
      default:return false;
    }
  } else if(w.stageId===11){
    shapes=action===0?[lane(w,e,p,angle,7,.65,1.6,'锻炉贯线')]:action===1
      ? (second?[-1.5,1.5]:[0]).map(n=>lane(w,e,offset(p,angle,n),angle+Math.PI/2,5,.55,1.6,'横砧锤击'))
      : [circle(w,e,e,2.2,1.5,'近身震锤')];
  } else if(w.stageId===12){
    shapes=action===0?[lane(w,e,p,angle+Math.PI/4,6,.45,1.8,'折光十字'),lane(w,e,p,angle-Math.PI/4,6,.45,1.8,'折光十字')]:action===1
      ? [-1.6,1.6].map(n=>lane(w,e,offset(p,angle+Math.PI/2,n),angle,6,.5,1.6,'双镜夹道'))
      : [circle(w,e,p,1.3,1.5,'碎镜坠落'),...(second?[circle(w,e,offset(p,movement(w,e),3.2),1.3,2.3,'碎镜坠落')]:[])];
  } else {
    shapes=action===0?[circle(w,e,p,1.35,1.6,'终渡回响'),circle(w,e,offset(p,movement(w,e),3.2),second?1.65:1.35,2.5,'终渡回响')]:action===1
      ? [-1.7,1.7].map((n,i)=>lane(w,e,offset(p,angle+Math.PI/2,n),angle,6,.5,1.6+i*.8,'渡桥截流'))
      : [circle(w,e,e,2.3,1.6,'泊岸震击')];
  }
  if(w.hazards.length+shapes.length>2)return false;
  // Keep every telegraph fully on the playable floor and visible when cast.
  if(shapes.some(h=>!legal(w,h)))return false;
  const group=w.id(),staggered=shapes.some(h=>h.due!==shapes[0].due);
  shapes.forEach((h,i)=>{h.group=group;if(staggered)h.sequence=i+1;});
  if(!crownEscape(w,shapes))return false;
  w.hazards.push(...shapes);
  e.state='windup';e.timer=Math.max(...shapes.map(h=>h.until-w.time));
  e.frontierRecovery=boss?(action===2?w.stageId===13?3.4:3.2:action===0&&w.stageId===11?2.8:3):e.kind==='mirrorpriest'||e.kind==='echoferryman'?2.2:1.8;
  if(boss)e.bossAction='frontier';
  return true;
}
function legal(w:SurvivalWorld,h:Hazard) {
  const points:Point[]=[h];if(h.kind==='frontierLane')points.push({x:h.endX!,y:h.endY!});
  const r=h.kind==='frontierLane'?h.width:h.radius;
  return points.every(p=>Math.abs(p.x)+r<=22&&Math.abs(p.y)+r<=26&&w.visible(p,r));
}
function recover(e:Enemy,duration:number){e.state='recover';e.timer=duration;}
export function stepFrontierEnemy(w:SurvivalWorld,e:Enemy,dt:number) {
  const d=distance(e,w.player),roles=FRONTIER_ROLES[w.stageId],guard=e.kind===roles[0],map=frontierMap(w.stageId);
  if(e.state==='windup'){
    if(d<1.5||!w.visible(e,.3)){w.hazards=w.hazards.filter(h=>h.source!==e.id||h.fired);recover(e,1.8);return;}
    e.timer-=dt;if(e.timer<=1e-6)recover(e,e.frontierRecovery||1.8);return;
  }
  if(e.state==='recover'){e.timer-=dt;if(e.timer<=0){e.state='seek';e.attack=6;}return;}
  e.attack-=dt;e.facing=Math.atan2(w.player.y-e.y,w.player.x-e.x);
  const target=guard&&e.frontierTarget&&(e.frontierUntil||0)>w.time?e.frontierTarget:w.player;
  if(d>(guard?.6:5.5)&&distance(e,target)>.15){const a=map.heading(e,target),s=ENEMIES[e.kind].speed*(e.slowUntil>w.time?1-e.slow:1);e.x+=Math.cos(a)*s*dt;e.y+=Math.sin(a)*s*dt;}
  if(d<.65)w.hurt(8,e.kind);
  if(guard||e.attack>0||e.visibleSince<0||w.time-e.visibleSince<1||!w.visible(e,.3)||d<1.5||d>8)return;
  if(!castFrontier(w,e))e.attack=.5;
}
export function stepFrontierBoss(w:SurvivalWorld,e:Enemy,dt:number) {
  if(e.bossPhase===1&&e.hp<=e.maxHp*.5){e.bossPhase=2;e.state='windup';e.bossAction='transition';e.timer=1.5;e.pattern=0;e.frontierRetry=0;w.hazards=[];w.effects.push({type:'bossPhase',x:e.x,y:e.y,value:2});return;}
  if(e.state==='windup'){e.timer-=dt;if(e.timer<=1e-6)recover(e,e.bossAction==='transition'?1.5:e.frontierRecovery||3);return;}
  if(e.state==='recover'){e.timer-=dt;if(e.timer<=0){e.state='seek';e.attack=.65;}return;}
  const d=distance(e,w.player),a=frontierMap(w.stageId).heading(e,w.player),s=(w.stageId===13?1.75:1.7)*(e.slowUntil>w.time?1-e.slow:1);
  e.facing=Math.atan2(w.player.y-e.y,w.player.x-e.x);e.attack-=dt;
  if(d>.85){e.x+=Math.cos(a)*s*dt;e.y+=Math.sin(a)*s*dt;}
  if(d<1)w.hurt(18,'boss',false);
  if(e.visibleSince<0||w.time-e.visibleSince<1||!w.visible(e,.3))return;
  if((e.frontierRetry||0)>0)e.frontierRetry!+=dt;
  if(e.attack>0)return;
  if(castFrontier(w,e,e.pattern%3)){e.pattern++;e.frontierRetry=0;return;}
  e.frontierRetry=(e.frontierRetry||0)+dt;
  if(e.frontierRetry>=2){e.pattern++;e.frontierRetry=0;recover(e,1.5);}else e.attack=.35;
}
