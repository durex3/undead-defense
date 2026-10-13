import { rectArena } from './RectArena';
export const FRONTIER_MAPS = {
  11: { boxes: [{x:-9,y:-9},{x:9,y:-9},{x:-9,y:9},{x:9,y:9}], width:1.8, height:1.8, floor:'#30272a', tile:'#41363a', edge:'#b98a64' },
  12: { boxes: [{x:0,y:-10},{x:0,y:10}], width:5, height:1.6, floor:'#222638', tile:'#32394e', edge:'#9db9d1' },
  13: { boxes: [{x:-11,y:-7},{x:11,y:-7},{x:-11,y:7},{x:11,y:7}], width:1.5, height:2.4, floor:'#1d3037', tile:'#30454b', edge:'#8ebcb9' },
};
export type FrontierStage = keyof typeof FRONTIER_MAPS;
const arenas = Object.fromEntries(Object.entries(FRONTIER_MAPS).map(([id,m])=>[id,rectArena(m.boxes,m.width,m.height)])) as Record<FrontierStage, ReturnType<typeof rectArena>>;
export const isFrontier = (stage:number):stage is FrontierStage => stage===11||stage===12||stage===13;
export const frontierMap = (stage:number) => arenas[stage as FrontierStage];
