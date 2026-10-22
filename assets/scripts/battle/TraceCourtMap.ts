import { rectArena } from "./RectArena";
export const TRACE_BASES = [
  { x: -10, y: -11, halfWidth: 2.6, halfHeight: 1 },
  { x: 10, y: 11, halfWidth: 2.6, halfHeight: 1 },
  { x: -10, y: 11, halfWidth: 1, halfHeight: 2.6 },
  { x: 10, y: -11, halfWidth: 1, halfHeight: 2.6 },
  { x: -17, y: 0, halfWidth: 0.9, halfHeight: 2.3 },
  { x: 17, y: 0, halfWidth: 0.9, halfHeight: 2.3 },
  { x: -5, y: 21, halfWidth: 2.6, halfHeight: 0.8 },
  { x: 5, y: -21, halfWidth: 2.6, halfHeight: 0.8 },
];
export const traceMap = rectArena(TRACE_BASES, 1, 1);
