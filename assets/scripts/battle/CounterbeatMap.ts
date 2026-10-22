import { rectArena } from "./RectArena";
export const COUNTERBEAT_BASES = [
  { x: -11, y: -10, halfWidth: 2.4, halfHeight: 1.1 },
  { x: 11, y: 10, halfWidth: 2.4, halfHeight: 1.1 },
  { x: -11, y: 10, halfWidth: 1.1, halfHeight: 2.4 },
  { x: 11, y: -10, halfWidth: 1.1, halfHeight: 2.4 },
  { x: -17, y: 0, halfWidth: 0.8, halfHeight: 2 },
  { x: 17, y: 0, halfWidth: 0.8, halfHeight: 2 },
];
export const counterbeatMap = rectArena(COUNTERBEAT_BASES, 1, 1);
