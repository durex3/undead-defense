import { rectArena } from "./RectArena";
export const ECLIPSE_PILLARS = [-1, 1]
  .flatMap((x) =>
    [-1, 1].map((y) => ({ x: x * 7, y: y * 8, halfWidth: 1, halfHeight: 1.6 })),
  )
  .concat(
    [-1, 1].map((x) => ({ x: x * 14, y: 0, halfWidth: 1.2, halfHeight: 2.5 })),
  );
export const eclipseMap = rectArena(ECLIPSE_PILLARS, 1, 1);
