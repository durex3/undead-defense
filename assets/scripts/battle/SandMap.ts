import { rectArena } from './RectArena';
/** Offset islands leave a diagonal crossing and multiple routes around every nest. */
export const SAND_ROCKS = [
 {x:-10,y:3,halfWidth:1.8,halfHeight:2.4},
 {x:10,y:-3,halfWidth:1.8,halfHeight:2.4},
 {x:0,y:15,halfWidth:2.4,halfHeight:1.2},
 {x:-13,y:-15,halfWidth:2,halfHeight:1},
 {x:13,y:15,halfWidth:2,halfHeight:1},
];
// Visual landmarks and legal route targets, not extra spawning or damage objects.
export const SAND_NESTS=[{x:-15,y:8},{x:15,y:-8},{x:0,y:20}];
export const SAND_TRAIL=[{x:-19,y:12},{x:-8,y:8},{x:0,y:0},{x:8,y:-8},{x:19,y:-12}];
export const SAND_ROUTES=[{x:0,y:-8},{x:0,y:0},{x:-15,y:8},{x:15,y:-8},{x:0,y:20}];
export const sandMap = rectArena(SAND_ROCKS,2.5,3);
