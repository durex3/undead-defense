import { rectArena } from "./RectArena";
export const SAND_ROCKS = [
  { x: -10, y: 0, halfWidth: 2.5, halfHeight: 3 },
  { x: 10, y: 0, halfWidth: 2.5, halfHeight: 3 },
  { x: 0, y: 15, halfWidth: 3, halfHeight: 2 },
];
export const sandMap = rectArena(SAND_ROCKS, 2.5, 3);
