import { rectArena } from "./RectArena";
export const MOON_BASES = [
  [-11, -13],
  [-13, 0],
  [-9, 13],
  [9, -13],
  [13, 0],
  [11, 13],
].map(([x, y]) => ({ x, y, halfWidth: 1.1, halfHeight: 1.4 }));
export const moonMap = rectArena(MOON_BASES, 1.1, 1.4);
