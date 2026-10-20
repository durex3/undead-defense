import { rectArena } from "./RectArena";
export const LIBRARY_BASES = [
  { x: -9, y: -10, halfWidth: 3, halfHeight: 0.9 },
  { x: -12, y: -7.5, halfWidth: 0.9, halfHeight: 2.5 },
  { x: 9, y: 10, halfWidth: 3, halfHeight: 0.9 },
  { x: 12, y: 7.5, halfWidth: 0.9, halfHeight: 2.5 },
  { x: -13, y: 13, halfWidth: 1.7, halfHeight: 3.5 },
  { x: 13, y: -13, halfWidth: 1.7, halfHeight: 3.5 },
  { x: -4, y: 20, halfWidth: 3.2, halfHeight: 1.1 },
  { x: 4, y: -20, halfWidth: 3.2, halfHeight: 1.1 },
];
export const libraryMap = rectArena(LIBRARY_BASES, 1, 1);
