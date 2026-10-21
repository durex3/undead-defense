import { rectArena } from "./RectArena";
export const EDGE_BASES = [
  { x: -10, y: -11, halfWidth: 1.2, halfHeight: 2.6 },
  { x: 10, y: -11, halfWidth: 1.2, halfHeight: 2.6 },
  { x: -10, y: 11, halfWidth: 1.2, halfHeight: 2.6 },
  { x: 10, y: 11, halfWidth: 1.2, halfHeight: 2.6 },
  { x: -5, y: 20, halfWidth: 3.6, halfHeight: 1 },
  { x: 5, y: -20, halfWidth: 3.6, halfHeight: 1 },
  { x: -18, y: 0, halfWidth: 1, halfHeight: 3 },
  { x: 18, y: 0, halfWidth: 1, halfHeight: 3 },
];
export const edgeMap = rectArena(EDGE_BASES, 1, 1);
