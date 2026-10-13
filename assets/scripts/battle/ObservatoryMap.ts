import { rectArena } from "./RectArena";
export const OBSERVATORY_BASES = [
  { x: -10, y: 0 },
  { x: 10, y: 0 },
];
const map = rectArena(OBSERVATORY_BASES, 2, 5);
export const observatoryBlocked = map.blocked,
  resolveObservatory = map.resolve,
  observatoryHeading = map.heading,
  observatorySegment = map.segment;
