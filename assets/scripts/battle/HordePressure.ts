import type { SurvivalWorld } from './SurvivalWorld';
/** More fodder for developed builds, without scaling enemy health or special attacks. */
export function hordePressure(w: Pick<SurvivalWorld, 'time' | 'skills' | 'evolutions'>) {
  const power = Object.values(w.skills).reduce((n, level) => n + Math.max(0, level - 1), 0)
    + Object.values(w.evolutions).filter(Boolean).length * 2;
  const tier = Math.min(4, Math.floor(power / 4), Math.floor(Math.max(0, w.time - 45) / 30));
  return { extra: tier + (w.time>=240?3:0), rate: w.time < 30 ? 1 : 1.15 + tier * 0.07 + (w.time>=240?.15:0) };
}

/** Total supporting enemies, including boss summons; reserve space under the global cap. */
export function bossCrowdRules(stage: number, phase = 1) {
  const rank=Math.max(1,Math.min(5,stage));
  return { target: Math.min(96, 58 + rank * 7 + (phase - 1) * 3), batch: 16 + rank * 2, interval: 1.8 - rank * .1 };
}
