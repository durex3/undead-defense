/** Later stages shorten recovery exponentially; warning/escape geometry is unchanged. */
export function stageRecoveryFactor(stage: number) {
  return Math.max(.35,Math.pow(.9,Math.max(0,stage-4)));
}
