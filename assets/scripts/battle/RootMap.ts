import { rectArena } from "./RectArena";
export const ROOT_BASES = [
  { x: -9, y: 9, halfWidth: 2.8, halfHeight: 1.3 },
  { x: 9, y: -9, halfWidth: 2.8, halfHeight: 1.3 },
  { x: -10, y: -9, halfWidth: 1.4, halfHeight: 3 },
  { x: 10, y: 9, halfWidth: 1.4, halfHeight: 3 },
  { x: -3, y: 19, halfWidth: 3.5, halfHeight: 1.2 },
  { x: 3, y: -19, halfWidth: 3.5, halfHeight: 1.2 },
];
export const ROOT_ROUTES = [
  { x: 0, y: -8 },
  { x: 0, y: 0 },
  { x: -15, y: 0 },
  { x: 15, y: 0 },
  { x: 0, y: 12 },
  { x: 0, y: -12 },
];
export const rootMap = rectArena(ROOT_BASES, 1.6, 3);
