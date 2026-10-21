import { rectArena } from "./RectArena";
export const GRAVE_BASES = [
  { x: -9, y: -10, halfWidth: 2.8, halfHeight: 1 },
  { x: 9, y: 10, halfWidth: 2.8, halfHeight: 1 },
  { x: -9, y: 10, halfWidth: 1, halfHeight: 2.8 },
  { x: 9, y: -10, halfWidth: 1, halfHeight: 2.8 },
  { x: -17, y: 0, halfWidth: 1, halfHeight: 2.8 },
  { x: 17, y: 0, halfWidth: 1, halfHeight: 2.8 },
];
export const graveMap = rectArena(GRAVE_BASES, 1, 1);
