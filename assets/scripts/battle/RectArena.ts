import type { Point, Enemy } from "./SurvivalTypes";
export function rectArena(
  boxes: readonly (Point & { halfWidth?: number; halfHeight?: number })[],
  boxWidth: number,
  boxHeight: number,
) {
  function blocked(p: Point, r = 0.3) {
    return boxes.some(
      (b) =>
        Math.abs(p.x - b.x) < (b.halfWidth ?? boxWidth) + r &&
        Math.abs(p.y - b.y) < (b.halfHeight ?? boxHeight) + r,
    );
  }
  function resolve(p: Point, r = 0.3) {
    for (const b of boxes) {
      const dx = p.x - b.x,
        dy = p.y - b.y,
        px = (b.halfWidth ?? boxWidth) + r - Math.abs(dx),
        py = (b.halfHeight ?? boxHeight) + r - Math.abs(dy);
      if (px > 0 && py > 0) {
        if (px < py)
          p.x = b.x + (Math.sign(dx) || 1) * ((b.halfWidth ?? boxWidth) + r);
        else
          p.y = b.y + (Math.sign(dy) || 1) * ((b.halfHeight ?? boxHeight) + r);
      }
    }
  }
  function segment(a: Point, b: Point, r = 0.7) {
    return boxes.some((box) => {
      let lo = 0,
        hi = 1;
      for (const [start, delta, center, half] of [
        [a.x, b.x - a.x, box.x, (box.halfWidth ?? boxWidth) + r],
        [a.y, b.y - a.y, box.y, (box.halfHeight ?? boxHeight) + r],
      ]) {
        if (Math.abs(delta) < 1e-8) {
          if (Math.abs(start - center) >= half) return false;
        } else {
          const t1 = (center - half - start) / delta,
            t2 = (center + half - start) / delta;
          lo = Math.max(lo, Math.min(t1, t2));
          hi = Math.min(hi, Math.max(t1, t2));
          if (lo >= hi) return false;
        }
      }
      return hi > 0 && lo < 1;
    });
  }
  const corners = boxes.flatMap((b) =>
    [-1, 1].flatMap((x) =>
      [-1, 1].map((y) => ({
        x: b.x + x * ((b.halfWidth ?? boxWidth) + 0.8),
        y: b.y + y * ((b.halfHeight ?? boxHeight) + 0.8),
      })),
    ),
  );
  const edges = corners.map((a) =>
    corners.map((b) => (segment(a, b) ? 0 : Math.hypot(a.x - b.x, a.y - b.y))),
  );
  /** Cached next corner from a visibility graph; no teleporting or per-frame path graph allocation. */
  function heading(e: Enemy, target: Point) {
    if (!segment(e, target)) {
      e.navWaypoint = undefined;
      return Math.atan2(target.y - e.y, target.x - e.x);
    }
    let next = e.navWaypoint;
    if (
      !next ||
      Math.hypot(e.x - next.x, e.y - next.y) < 0.2 ||
      segment(e, next)
    ) {
      const costs = corners.map((p) =>
        segment(p, target)
          ? Infinity
          : Math.hypot(p.x - target.x, p.y - target.y),
      );
      const used = new Set<number>();
      for (let k = 0; k < corners.length; k++) {
        let i = -1;
        for (let j = 0; j < corners.length; j++)
          if (!used.has(j) && (i < 0 || costs[j] < costs[i])) i = j;
        if (i < 0 || !Number.isFinite(costs[i])) break;
        used.add(i);
        for (let j = 0; j < corners.length; j++)
          if (edges[i][j] > 0)
            costs[j] = Math.min(costs[j], costs[i] + edges[i][j]);
      }
      let best = Infinity;
      next = undefined;
      for (let i = 0; i < corners.length; i++)
        if (!segment(e, corners[i])) {
          const cost =
            Math.hypot(e.x - corners[i].x, e.y - corners[i].y) + costs[i];
          if (cost < best) {
            best = cost;
            next = corners[i];
          }
        }
      e.navWaypoint = next;
    }
    return Math.atan2((next || target).y - e.y, (next || target).x - e.x);
  }

  return { blocked, resolve, segment, heading };
}
