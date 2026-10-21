import type { Hazard, Point } from "./SurvivalTypes";
import { ECLIPSE_PILLARS, eclipseMap } from "./EclipseMap";
import type { SurvivalWorld } from "./SurvivalWorld";
export const BEAM_NEAR = 1.4,
  BEAM_FAR = 6.2,
  BEAM_WIDTH = 0.2,
  BEAM_OMEGA = Math.PI / 4.8;
export interface EclipseSweep {
  pivot: Point;
  angle: number;
  sign: number;
  due: number;
  end: number;
  hit: boolean;
  cancelled?: boolean;
  index: number;
}
export interface EclipseHazard {
  origin: Point;
  sweeps: EclipseSweep[];
  group: number;
  phase: number;
  bossC: boolean;
  order: number;
  last: number;
  player: Point;
  cancelled?: boolean;
  interrupted?: boolean;
  damaged?: boolean;
}
export function eclipseAngle(f: EclipseSweep, t: number) {
  return f.angle + f.sign * BEAM_OMEGA * Math.max(0, Math.min(2.4, t - f.due));
}
/** Slab intersection on the thick beam's expanded solid. The centre cap stops outside the stone. */
export function eclipseLength(p: Point, a: number, pillarsOnly = false) {
  const u = { x: Math.cos(a), y: Math.sin(a) };
  let length = BEAM_FAR;
  for (const box of ECLIPSE_PILLARS) {
    let lo = 0,
      hi = Infinity;
    for (const [start, dir, center, half] of [
      [p.x, u.x, box.x, box.halfWidth + BEAM_WIDTH],
      [p.y, u.y, box.y, box.halfHeight + BEAM_WIDTH],
    ]) {
      if (Math.abs(dir) < 1e-12) {
        if (Math.abs(start - center) > half) {
          hi = -1;
          break;
        }
      } else {
        const x = (center - half - start) / dir,
          y = (center + half - start) / dir;
        lo = Math.max(lo, Math.min(x, y));
        hi = Math.min(hi, Math.max(x, y));
      }
    }
    if (hi >= lo && hi >= 0) length = Math.min(length, Math.max(0, lo));
  }
  if (pillarsOnly) return length;
  for (const [start, dir, limit] of [
    [p.x, u.x, 22 - BEAM_WIDTH],
    [p.y, u.y, 26 - BEAM_WIDTH],
  ])
    if (Math.abs(dir) > 1e-12)
      length = Math.min(
        length,
        Math.max(0, ((dir > 0 ? limit : -limit) - start) / dir),
      );
  return length;
}
export function eclipseSegment(f: EclipseSweep, t: number, unclipped = false) {
  const a = eclipseAngle(f, t),
    length = unclipped ? BEAM_FAR : eclipseLength(f.pivot, a),
    u = { x: Math.cos(a), y: Math.sin(a) };
  if (length <= BEAM_NEAR) return undefined;
  return {
    a: { x: f.pivot.x + u.x * BEAM_NEAR, y: f.pivot.y + u.y * BEAM_NEAR },
    z: { x: f.pivot.x + u.x * length, y: f.pivot.y + u.y * length },
    length,
    angle: a,
  };
}
function segmentDistance(p: Point, a: Point, z: Point) {
  const x = z.x - a.x,
    y = z.y - a.y,
    k = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * x + (p.y - a.y) * y) / (x * x + y * y)),
    );
  return Math.hypot(p.x - a.x - x * k, p.y - a.y - y * k);
}
export function eclipseDistance(
  f: EclipseSweep,
  p: Point,
  t: number,
  unclipped = false,
) {
  const s = eclipseSegment(f, t, unclipped);
  return s ? segmentDistance(p, s.a, s.z) : Infinity;
}
export function eclipseShadow(f: EclipseSweep, p: Point, t: number) {
  const a = eclipseAngle(f, t),
    pillar = eclipseLength(f.pivot, a, true);
  return (
    pillar < BEAM_FAR &&
    pillar <= eclipseLength(f.pivot, a) + 1e-8 &&
    !f.cancelled &&
    t >= f.due &&
    t < f.end &&
    eclipseDistance(f, p, t, true) <= 0.5 &&
    eclipseDistance(f, p, t) > 0.5 + 1e-7
  );
}
/** Split at occlusion discontinuities (expanded stone corners), then bound the real rotating
 capsule's distance. Only an evaluated real clipped capsule can produce a hit, never a fan/chord. */
export function eclipseImpact(
  f: EclipseSweep,
  p: Point,
  t: number,
  previous = t,
  old = p,
): boolean {
  if (f.cancelled || t < f.due || previous >= f.end || t < previous)
    return false;
  const lo = Math.max(previous, f.due),
    hi = Math.min(t, f.end),
    at = (v: number) => {
      const k = t === previous ? 1 : (v - previous) / (t - previous);
      return { x: old.x + (p.x - old.x) * k, y: old.y + (p.y - old.y) * k };
    };
  const points = [lo, hi];
  for (const b of ECLIPSE_PILLARS)
    for (const x of [-1, 1])
      for (const y of [-1, 1]) {
        const a = Math.atan2(
          b.y + y * (b.halfHeight + BEAM_WIDTH) - f.pivot.y,
          b.x + x * (b.halfWidth + BEAM_WIDTH) - f.pivot.x,
        );
        for (let n = -3; n <= 3; n++) {
          const v =
            f.due + (a + 2 * Math.PI * n - f.angle) / (f.sign * BEAM_OMEGA);
          if (v > lo && v < hi) points.push(v);
        }
      }
  points.sort((a, b) => a - b);
  const velocity =
    t === previous ? 0 : Math.hypot(p.x - old.x, p.y - old.y) / (t - previous);
  let minFace = BEAM_FAR;
  for (const b of ECLIPSE_PILLARS)
    for (const d of [
      Math.abs(b.x - b.halfWidth - BEAM_WIDTH - f.pivot.x),
      Math.abs(b.x + b.halfWidth + BEAM_WIDTH - f.pivot.x),
      Math.abs(b.y - b.halfHeight - BEAM_WIDTH - f.pivot.y),
      Math.abs(b.y + b.halfHeight + BEAM_WIDTH - f.pivot.y),
    ])
      if (d > 1e-9) minFace = Math.min(minFace, d);
  const bound =
    velocity + BEAM_OMEGA * (BEAM_FAR + (BEAM_FAR * BEAM_FAR) / minFace);
  const dist = (v: number) => eclipseDistance(f, at(v), v);
  const search = (a: number, z: number, depth: number): boolean => {
    const m = (a + z) / 2,
      d = dist(m);
    if (d <= 0.5 + 1e-9) return true;
    // Unclipped distance is globally Lipschitz even where occlusion jumps.
    if (
      eclipseDistance(f, at(m), m, true) >
      0.5 + ((velocity + BEAM_FAR * BEAM_OMEGA) * (z - a)) / 2
    )
      return false;
    if (Number.isFinite(d) && d > 0.5 + (bound * (z - a)) / 2) return false;
    if (
      !Number.isFinite(d) &&
      eclipseLength(f.pivot, eclipseAngle(f, m)) <
        BEAM_NEAR - (bound * (z - a)) / 2
    )
      return false;
    if (depth >= 22 || z - a < 1e-7)
      return dist(a) <= 0.5 + 1e-9 || dist(z) <= 0.5 + 1e-9;
    return search(a, m, depth + 1) || search(m, z, depth + 1);
  };
  if (lo === hi) return dist(lo) <= 0.5 + 1e-9;
  for (let i = 1; i < points.length; i++)
    if (search(points[i - 1], points[i], 0)) return true;
  return false;
}
/** Certify the whole shadow interval, not just its endpoints. A bounded proof of
 * uninterrupted unclipped contact plus continuous actual-beam separation prevents
 * a short occlusion gap or a fast crossing from contributing challenge time. */
export function eclipseShadowInterval(
  f: EclipseSweep,
  a: Point,
  z: Point,
  from: number,
  to: number,
) {
  if (to <= from || from < f.due || to >= f.end || f.cancelled) return false;
  const at = (t: number) => {
    const k = (t - from) / (to - from);
    return { x: a.x + (z.x - a.x) * k, y: a.y + (z.y - a.y) * k };
  };
  if (![from, (from + to) / 2, to].every((t) => eclipseShadow(f, at(t), t)))
    return false;
  const cuts = [from, to];
  for (const b of ECLIPSE_PILLARS)
    for (const x of [-1, 1])
      for (const y of [-1, 1]) {
        const angle = Math.atan2(
          b.y + y * (b.halfHeight + BEAM_WIDTH) - f.pivot.y,
          b.x + x * (b.halfWidth + BEAM_WIDTH) - f.pivot.x,
        );
        for (let n = -3; n <= 3; n++) {
          const t =
            f.due + (angle + 2 * Math.PI * n - f.angle) / (f.sign * BEAM_OMEGA);
          if (t > from && t < to) cuts.push(t);
        }
      }
  cuts.sort((a, b) => a - b);
  for (let i = 1; i < cuts.length; i++)
    if (
      !eclipseShadow(
        f,
        at((cuts[i - 1] + cuts[i]) / 2),
        (cuts[i - 1] + cuts[i]) / 2,
      )
    )
      return false;
  const speed =
    Math.hypot(z.x - a.x, z.y - a.y) / (to - from) + BEAM_FAR * BEAM_OMEGA;
  const contained = (lo: number, hi: number, depth: number): boolean => {
    const mid = (lo + hi) / 2,
      d = eclipseDistance(f, at(mid), mid, true);
    if (d + (speed * (hi - lo)) / 2 <= 0.5 + 1e-9) return true;
    if (depth >= 18 || hi - lo < 1e-7) return false;
    return contained(lo, mid, depth + 1) && contained(mid, hi, depth + 1);
  };
  return contained(from, to, 0) && !eclipseImpact(f, z, to, from, a);
}
export function eclipseImpacts(
  h: Hazard,
  p: Point,
  t: number,
  previous = t,
  old = p,
) {
  return h
    .eclipse!.sweeps.filter((f) => eclipseImpact(f, p, t, previous, old))
    .map((f) => f.index);
}
export function eclipseCut(h: Hazard, t: number) {
  const b = h.eclipse!;
  b.interrupted = true;
  for (const f of b.sweeps) if (f.due > t) f.cancelled = true;
  h.until = Math.max(
    t,
    ...b.sweeps.filter((f) => !f.cancelled).map((f) => f.end),
  );
  b.cancelled = b.sweeps.every((f) => f.cancelled);
}

export function eclipseMove(
  p: Point,
  v: Point,
  dt: number,
  r: number,
  time: number,
  visit?: (a: Point, z: Point, from: number, to: number) => void,
) {
  const n = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(v.x * dt), Math.abs(v.y * dt), dt * 4) / 0.05),
  );
  for (let i = 0; i < n; i++)
    for (let axis = 0; axis < 2; axis++) {
      const a = { ...p },
        from = time - dt + (dt * (2 * i + axis)) / (2 * n),
        to = from + dt / (2 * n);
      if (axis === 0)
        p.x = Math.max(-22 + r, Math.min(22 - r, p.x + (v.x * dt) / n));
      else p.y = Math.max(-26 + r, Math.min(26 - r, p.y + (v.y * dt) / n));
      eclipseMap.resolve(p, r);
      visit?.(a, { ...p }, from, to);
    }
}
/** Joint base-speed escape, with reaction delay, wall sliding and current crowd. Does not use counters, speed upgrades or invulnerability. */
export function eclipseEscape(w: SurvivalWorld, extra: Hazard[]) {
  const hazards = [
      ...w.hazards.filter(
        (h) => h.eclipse && !h.eclipse.cancelled && h.until > w.time,
      ),
      ...extra,
    ],
    until = Math.max(w.time, ...hazards.map((h) => h.until));
  const actors = w.enemies.filter(
    (e) =>
      e.hp > 0 &&
      e.state === "seek" &&
      !e.immovable &&
      Math.hypot(e.x - w.player.x, e.y - w.player.y) < 8,
  );
  for (let i = -1; i < 24; i++)
    for (const turn of [0, -Math.PI / 2, Math.PI / 2]) {
      if (i === -1 && turn !== 0) continue;
      const p = { ...w.player };
      let safe = true;
      for (let t = w.time; t < until - 1e-8;) {
        const dt = Math.min(0.08, until - t),
          elapsed = t - w.time,
          a = (i * Math.PI) / 12 + (elapsed >= 1.3 ? turn : 0),
          speed = i < 0 || elapsed < 0.35 ? 0 : 4.2;
        eclipseMove(
          p,
          { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
          dt,
          0.3,
          t + dt,
          (old, z, from, to) => {
            if (
              safe &&
              (actors.some((e) => Math.hypot(e.x - z.x, e.y - z.y) < 0.65) ||
                hazards.some((h) => eclipseImpacts(h, z, to, from, old).length))
            )
              safe = false;
          },
        );
        if (!safe) break;
        t += dt;
      }
      if (safe) return true;
    }
  return false;
}
