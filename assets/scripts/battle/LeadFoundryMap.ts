import { rectArena } from "./RectArena";
export const LEAD_BASES = [
  { x: -11, y: -12, halfWidth: 3, halfHeight: 1.1 },
  { x: 11, y: 12, halfWidth: 3, halfHeight: 1.1 },
  { x: -11, y: 12, halfWidth: 1.1, halfHeight: 3 },
  { x: 11, y: -12, halfWidth: 1.1, halfHeight: 3 },
  { x: -18, y: 0, halfWidth: 0.8, halfHeight: 2.6 },
  { x: 18, y: 0, halfWidth: 0.8, halfHeight: 2.6 },
];
export const leadMap = rectArena(LEAD_BASES, 1, 1);
