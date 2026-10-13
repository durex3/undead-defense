import { rectArena } from "./RectArena";
export const ARSENAL_RACKS = [
  { x: -9, y: -7 },
  { x: 9, y: -7 },
  { x: -9, y: 7 },
  { x: 9, y: 7 },
];
const map = rectArena(ARSENAL_RACKS, 2.5, 1.5);
export const arsenalBlocked = map.blocked,
  resolveArsenal = map.resolve,
  arsenalHeading = map.heading,
  arsenalSegment = map.segment;
