export const PLAY_SPEEDS = [1, 1.5, 2, 3] as const;
export type PlaySpeed = (typeof PLAY_SPEEDS)[number];
export function nextPlaySpeed(current: PlaySpeed): PlaySpeed {
  return PLAY_SPEEDS[(PLAY_SPEEDS.indexOf(current) + 1) % PLAY_SPEEDS.length];
}
