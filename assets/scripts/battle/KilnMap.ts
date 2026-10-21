import { rectArena } from "./RectArena";
export const KILN_BASES = [
  { x: -13, y: -12, halfWidth: 3.6, halfHeight: 1.1 },
  { x: 11, y: -14, halfWidth: 1.1, halfHeight: 3.6 },
  { x: -11, y: 14, halfWidth: 1.1, halfHeight: 3.6 },
  { x: 13, y: 12, halfWidth: 3.6, halfHeight: 1.1 },
  { x: -5, y: 21, halfWidth: 4, halfHeight: 1 },
  { x: 5, y: -21, halfWidth: 4, halfHeight: 1 },
  { x: -18, y: 1, halfWidth: 1, halfHeight: 3 },
  { x: 18, y: -1, halfWidth: 1, halfHeight: 3 },
];
export const kilnMap = rectArena(KILN_BASES, 1, 1);
