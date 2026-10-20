import { rectArena } from "./RectArena";
export const WIND_BASES = [
  { x: -9, y: 5.5, halfWidth: 1.2, halfHeight: 2.5 },
  { x: 9, y: -5.5, halfWidth: 1.2, halfHeight: 2.5 },
  { x: -12, y: 15, halfWidth: 2.5, halfHeight: 1.1 },
  { x: 12, y: -15, halfWidth: 2.5, halfHeight: 1.1 },
  { x: 10, y: 15, halfWidth: 1.1, halfHeight: 2.4 },
  { x: -10, y: -15, halfWidth: 1.1, halfHeight: 2.4 },
  { x: 0, y: 22, halfWidth: 2, halfHeight: 1 },
  { x: 0, y: -22, halfWidth: 2, halfHeight: 1 },
];
export const windMap = rectArena(WIND_BASES, 1, 1);
