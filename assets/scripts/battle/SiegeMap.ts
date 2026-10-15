import { rectArena } from './RectArena';
/** Six short detached walls: central court, two flank loops, open north/south exits. */
export const SIEGE_WALLS = [
 {x:-9,y:-8,halfWidth:1.4,halfHeight:2.5},
 {x:9,y:-10,halfWidth:1.5,halfHeight:2.5},
 {x:-10,y:10,halfWidth:1.4,halfHeight:2.5},
 {x:9,y:7,halfWidth:1.5,halfHeight:2.5},
 {x:0,y:15,halfWidth:3,halfHeight:1},
 {x:0,y:-15,halfWidth:3,halfHeight:1},
];
export const SIEGE_ROUTES=[{x:0,y:0},{x:-15,y:0},{x:15,y:0},{x:0,y:9},{x:0,y:-9}];
export const siegeMap = rectArena(SIEGE_WALLS,2,3);
