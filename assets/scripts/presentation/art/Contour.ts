import type { Pt } from "./Brush";

const contourCache = new Map<string, Pt[][]>();
/** Local-space geometry is quantised by Brush, so moving actors can reuse the
 * same outline. FIFO capacity bounds retained geometry across stage changes. */
export function cachedEdges(polygons: Pt[][]): Pt[][] {
  const key = polygons.map(p => p.map(v => `${v[0]},${v[1]}`).join(";")).join("|");
  const existing = contourCache.get(key);
  if (existing) return existing;
  const edges = exposedEdges(polygons);
  if (contourCache.size >= 512) contourCache.delete(contourCache.keys().next().value!);
  contourCache.set(key, edges);
  return edges;
}

/** Remove hidden portions of overlapping part edges. No polygon triangulation
 * or extra draw passes: the original paths still provide the union's fill. */
export function exposedEdges(polygons: Pt[][]): Pt[][] {
  const bounds = polygons.map(p => ({
    x0: Math.min(...p.map(v => v[0])), x1: Math.max(...p.map(v => v[0])),
    y0: Math.min(...p.map(v => v[1])), y1: Math.max(...p.map(v => v[1])),
  }));
  const result: Pt[][] = [];
  for (let k = 0; k < polygons.length; k++) {
    const polygon = polygons[k];
    let chain: Pt[] | undefined;
    for (let e = 0; e < polygon.length; e++) {
      const a = polygon[e], b = polygon[(e + 1) % polygon.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      if (length < 1e-6) continue;
      const candidates: number[] = [], cuts = [0, 1];
      for (let j = 0; j < polygons.length; j++) {
        if (j === k) continue;
        const box = bounds[j];
        if (Math.max(a[0], b[0]) < box.x0 || Math.min(a[0], b[0]) > box.x1 ||
            Math.max(a[1], b[1]) < box.y0 || Math.min(a[1], b[1]) > box.y1) continue;
        candidates.push(j);
        const other = polygons[j];
        for (let f = 0; f < other.length; f++) {
          const c = other[f], d = other[(f + 1) % other.length];
          const ux = d[0] - c[0], uy = d[1] - c[1];
          const cross = dx * uy - dy * ux;
          if (Math.abs(cross) < 1e-8) continue;
          const t = ((c[0] - a[0]) * uy - (c[1] - a[1]) * ux) / cross;
          const u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / cross;
          if (t > 1e-6 && t < 1 - 1e-6 && u >= 0 && u <= 1) cuts.push(t);
        }
      }
      cuts.sort((a, b) => a - b);
      for (let t = 1; t < cuts.length; t++) {
        const lo = cuts[t - 1], hi = cuts[t];
        if (hi - lo < 1e-6) continue;
        const mid = (lo + hi) / 2;
        // Polygons are CCW. Sample just outside so shared seams disappear,
        // while duplicate/coincident outer edges keep a visible contour.
        const x = a[0] + dx * mid + dy / length * 0.001;
        const y = a[1] + dy * mid - dx / length * 0.001;
        if (candidates.some(j => inside(x, y, polygons[j]))) { chain = undefined; continue; }
        const start: Pt = [a[0] + dx * lo, a[1] + dy * lo];
        const end: Pt = [a[0] + dx * hi, a[1] + dy * hi];
        const last = chain?.[chain.length - 1];
        if (!last || Math.hypot(last[0] - start[0], last[1] - start[1]) > 1e-5) {
          chain = [start]; result.push(chain);
        }
        chain!.push(end);
      }
    }
  }
  return result;
}

function inside(x: number, y: number, p: Pt[]) {
  let hit = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
