import type { SurvivalWorld } from './SurvivalWorld';
/** More fodder for developed builds, without scaling enemy health or special attacks. */
export function hordePressure(w: Pick<SurvivalWorld, 'time' | 'skills' | 'evolutions'>) {
  const power = Object.values(w.skills).reduce((n, level) => n + Math.max(0, level - 1), 0)
    + Object.values(w.evolutions).filter(Boolean).length * 2;
  const tier = Math.min(4, Math.floor(power / 4), Math.floor(Math.max(0, w.time - 45) / 30));
  return { extra: tier, rate: w.time < 30 ? 1 : 1.1 + tier * 0.05 };
}

/** Total supporting enemies, including boss summons; reserve space under the global cap. */
export function bossCrowdRules(stage: number, phase = 1) {
  const rank=Math.max(1,Math.min(5,stage));
  return { target: 20 + rank * 8 + (phase - 1) * 4, batch: 6 + rank * 2, interval: 3.2 - rank * .24 };
}
