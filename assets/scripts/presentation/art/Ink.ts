import { Color } from "cc";

/**
 * Shared immutable colour cache for the whole art layer.
 *
 * Alpha is quantised to 16 steps so continuously animated fades do not grow
 * the cache without bound. Never mutate a Color returned by ink().
 */
const cache = new Map<string, Map<number, Color>>();

export function quantizeAlpha(alpha: number) {
  if (alpha >= 255) return 255;
  if (alpha <= 0) return 0;
  return Math.max(0, Math.min(255, Math.round(alpha / 16) * 16));
}

export function ink(hex: string, alpha = 255) {
  const a = quantizeAlpha(alpha);
  let byAlpha = cache.get(hex);
  if (!byAlpha) {
    byAlpha = new Map();
    cache.set(hex, byAlpha);
  }
  let color = byAlpha.get(a);
  if (!color) {
    color = new Color().fromHEX(hex);
    color.a = a;
    byAlpha.set(a, color);
  }
  return color;
}
