/** Later stages shorten recovery exponentially; warning/escape geometry is unchanged. */
export function stageRecoveryFactor(stage: number) {
  return Math.pow(.9, Math.max(0, Math.min(10,stage)-4));
}
