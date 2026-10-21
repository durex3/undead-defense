import {rectArena} from './RectArena';
export const LOOM_BASES=[
 {x:-10,y:-9,halfWidth:2.8,halfHeight:1},{x:10,y:9,halfWidth:2.8,halfHeight:1},
 {x:-11,y:9,halfWidth:1,halfHeight:3},{x:11,y:-9,halfWidth:1,halfHeight:3},
 {x:-4,y:19,halfWidth:3,halfHeight:1},{x:4,y:-19,halfWidth:3,halfHeight:1},
];
export const loomMap=rectArena(LOOM_BASES,1,1);
