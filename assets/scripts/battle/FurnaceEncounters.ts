import type { Kind } from './SurvivalConfig';
import type { Point } from './SurvivalTypes';

// A 9.3-unit open central lane, with 1.9-unit gaps between workshop pillars.
// Player diameter is .6; both workshops remain accessible from all four sides.
export const FURNACE_STONES: Point[] = [
  {x:-12,y:-12},{x:12,y:-12},{x:12,y:12},{x:-12,y:12},
  {x:-10,y:-3},{x:-6,y:-3},{x:-10,y:3},{x:-6,y:3},
  {x:6,y:-3},{x:10,y:-3},{x:6,y:3},{x:10,y:3},
];
export const FURNACE_ENCOUNTERS = [
  {id:'formation',name:'护阵推进',enemies:['shield','archer'] as Kind[],hint:'绕到盾阵侧后方；持续伤害也能处理护阵'},
  {id:'pursuit',name:'双翼追猎',enemies:['boar','bloater'] as Kind[],hint:'引冲锋撞炉柱，再绕行反击；不要停在毒池里'},
  {id:'summoning',name:'后排唤潮',enemies:['shield','summoner'] as Kind[],hint:'绕过护卫处理召唤师，或用范围伤害清理增援'},
] as const;
export const FURNACE_WINDOWS = [{start:220,end:250},{start:280,end:310},{start:380,end:410}];
/** Uses the original run seed without consuming the weapon/card random stream. */
export function furnaceRoute(seed: number) {return ((Math.imul(seed,1103515245)>>>0)%3);}
export function furnaceEncounter(time: number, route: number) {
  const index=FURNACE_WINDOWS.findIndex(window=>time>=window.start && time<window.end);
  return index<0 ? null : FURNACE_ENCOUNTERS[(index+route)%3];
}
export function furnaceRest(time: number) {return FURNACE_WINDOWS.some(window=>time>=window.end&&time<window.end+10);}
export function furnaceForecast(time: number, route: number) {
  const active=furnaceEncounter(time,route);
  if(active)return `${active.name} · ${active.hint}`;
  const next=FURNACE_WINDOWS.findIndex(window=>time<window.start);
  if(next>=0 && FURNACE_WINDOWS[next].start-time<=20) return `下一段：${FURNACE_ENCOUNTERS[(next+route)%3].name} · ${Math.ceil(FURNACE_WINDOWS[next].start-time)}秒后`;
  if(furnaceRest(time))return '炉火暂歇 · 拾取补给；暂停可进商店调整配装';
  return time<120 ? '中央开阔区便于绕行 · 两侧炉柱可引怪、反击' : null;
}
