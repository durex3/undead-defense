import { rectArena } from "./RectArena";
export const TWINGATE_BASES = [
  { x: -12, y: -12, halfWidth: 2.3, halfHeight: 1.1 },
  { x: 12, y: 12, halfWidth: 2.3, halfHeight: 1.1 },
  { x: -12, y: 12, halfWidth: 1.1, halfHeight: 2.3 },
  { x: 12, y: -12, halfWidth: 1.1, halfHeight: 2.3 },
  { x: -18, y: 0, halfWidth: 0.8, halfHeight: 1.8 },
  { x: 18, y: 0, halfWidth: 0.8, halfHeight: 1.8 },
];
export const twingateMap = rectArena(TWINGATE_BASES, 1, 1);
