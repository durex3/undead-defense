import { rectArena } from "./RectArena";
export const THUNDER_BASES = [-11, 11].flatMap((x) =>
  [-12, 12].map((y) => ({ x, y, halfWidth: 1.2, halfHeight: 2.2 })),
);
export const thunderMap = rectArena(THUNDER_BASES, 1.2, 2.2);
