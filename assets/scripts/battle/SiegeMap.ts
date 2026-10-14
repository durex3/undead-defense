import { rectArena } from './RectArena';
export const SIEGE_WALLS = [{x:-9,y:-8},{x:9,y:-8},{x:-9,y:8},{x:9,y:8}];
export const siegeMap = rectArena(SIEGE_WALLS,2,3);
