import { Color } from "cc";

/**
 * Four stage painters share one immutable palette cache.
 * Colours are keyed by hex + alpha so a crowd frame allocates nothing after warm-up.
 */
const inks = new Map<string, Color>();

export function ink(hex: string, alpha = 255) {
  const key = hex + ":" + alpha;
  let c = inks.get(key);
  if (!c) {
    c = new Color().fromHEX(hex);
    c.a = alpha;
    inks.set(key, c);
  }
  return c;
}
