import type { SurvivalWorld } from './SurvivalWorld';
import { Enemy, Hazard, distance } from './SurvivalTypes';
import { crownEscape } from './CrownSystem';
export const KING_PHASES=['','王刃','王域','碎冠'];
export function kingCast(w: SurvivalWorld,e: Enemy,action: 'sweep'|'lance'|'tombstone'|'bellRing'|'bellPulse') {
 if(w.hazards.length>=2)return false;
 const far=distance(e,w.player)>5;
 const center=action==='tombstone'||((action==='bellRing'||action==='bellPulse')&&far)?w.player:e;
 const delay=action==='bellRing'?1.4:action==='sweep'||action==='bellPulse'?1.1:1.2;
 const h:Hazard={id:w.id(),source:e.id,x:center.x,y:center.y,kind:action==='sweep'?'sector':action==='lance'?'flameLine':action==='tombstone'?'circle':action,
  radius:action==='sweep'?3.4:action==='lance'?12:action==='tombstone'?1.35:action==='bellRing'?4.2:2,
  width:action==='sweep'?Math.PI*130/180:action==='lance'?.65:action==='bellRing'?2.2:0,
  angle:Math.atan2(w.player.y-e.y,w.player.x-e.x),created:w.time,due:w.time+delay,until:w.time+delay+.25,
  damage:action==='sweep'||action==='lance'?22:action==='bellPulse'?20:18,
  fixedDamage:true,damageLabel:({sweep:'王刃横扫',lance:'裂魂焰',tombstone:'王印落击',bellRing:'空心王震',bellPulse:'近身王震'})[action],fired:false,next:0};
 let attack=[h];
 if(action==='tombstone'&&e.bossPhase===2 && w.hazards.length===0){
  const a=Math.hypot(w.move.x,w.move.y)>.1?Math.atan2(w.move.y,w.move.x):h.angle+Math.PI/2;
  const cut={...h,id:w.id(),x:w.player.x+Math.cos(a)*2.8,y:w.player.y+Math.sin(a)*2.8,due:w.time+1.65,until:w.time+1.9,damageLabel:'王印封路'};
  if(Math.abs(cut.x)<20.5&&Math.abs(cut.y)<24.5&&crownEscape(w,[h,cut]))attack.push(cut);
 }
 if(!crownEscape(w,attack))return false;
 w.hazards.push(...attack);e.bossAction=action;e.state='windup';e.timer=Math.max(...attack.map(h=>h.until))-w.time;
 return true;
}
export function stepKing(w: SurvivalWorld,e: Enemy,dt:number){
 if(e.hp<=0 || w.state==='won')return;
 const phase=e.hp/e.maxHp<=.30?3:e.hp/e.maxHp<=.65?2:1;
 if(phase>e.bossPhase){
  e.bossPhase=phase;e.bossAction='transition';e.state='windup';e.timer=1.5;e.pattern=0;e.combo=0;
  w.hazards=[];w.effects.push({type:'bossPhase',x:e.x,y:e.y,value:phase});return;
 }
 if(e.state==='windup'){
  e.timer-=dt;if(e.timer>0)return;
  if(e.bossPhase===3&&e.combo===0&&(e.bossAction==='bellRing'||e.bossAction==='lance')){
   e.combo=1;if(kingCast(w,e,e.bossAction==='bellRing'?'bellPulse':'lance'))return;
  }
  e.state='recover';e.timer=e.bossPhase===3?2.5:2.2;return;
 }
 if(e.state==='recover'){e.timer-=dt;if(e.timer<=0){e.state='seek';e.attack=.65;}return;}
 const d=distance(e,w.player),a=Math.atan2(w.player.y-e.y,w.player.x-e.x);e.facing=a;e.attack-=dt;
 if(d>.75){const speed=([0,1.7,1.9,2.1][e.bossPhase])*(e.slowUntil>w.time?1-e.slow:1);e.x+=Math.cos(a)*speed*dt;e.y+=Math.sin(a)*speed*dt;}
 if(d<1)w.hurt(18,'boss',false);
 if(e.attack>0||e.visibleSince<0||w.time-e.visibleSince<.8||!w.visible(e,.3)||w.hazards.length>=2)return;
 const sequence=e.bossPhase===1?['sweep','tombstone','summon']:e.bossPhase===2?['bellRing','tombstone','lance','summon']:['bellRing','lance'];
 let action=sequence[e.pattern%sequence.length];if(action==='sweep'&&d>4.5)action='lance';
 if(action==='summon'){
  let owned=w.enemies.filter(o=>o.hp>0&&o.owner===e.id).length;const count=e.bossPhase===1?4:6;
  for(let i=0;i<count&&owned<8;i++){
   const angle=a+i*Math.PI*2/count,p={x:Math.max(-22,Math.min(22,w.player.x+Math.cos(angle)*5)),y:Math.max(-26,Math.min(26,w.player.y+Math.sin(angle)*5))};
   if(distance(p,w.player)<4)continue;const child=w.addEnemy('minion',p.x,p.y,true);
   if(child){child.owner=e.id;child.state='arriving';child.timer=1.2;owned++;}
  }
  e.state='recover';e.timer=2.2;e.bossAction='summon';e.pattern++;return;
 }
 e.combo=0;
 if(kingCast(w,e,action as Parameters<typeof kingCast>[2]))e.pattern++;
 else e.attack=.3;
}
