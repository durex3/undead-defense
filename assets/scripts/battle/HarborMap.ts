import { rectArena } from "./RectArena";
export const HARBOR_CARGO = [
  { x: -8, y: -8 },
  { x: 8, y: -8 },
  { x: -8, y: 8 },
  { x: 8, y: 8 },
];
const map = rectArena(HARBOR_CARGO, 2, 3);
export const harborBlocked = map.blocked,
  resolveHarbor = map.resolve,
  harborSegment = map.segment,
  harborHeading = map.heading;
