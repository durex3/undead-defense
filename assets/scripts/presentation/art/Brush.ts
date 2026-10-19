import { Graphics } from "cc";
import { ink } from "./Ink";
import type { Pose } from "./Actor";
import { cachedEdges } from "./Contour";

export type Pt = [number, number];

export const lx = (pose: Pose, u: number) => pose.x + u * pose.scale * pose.face;
export const ly = (pose: Pose, v: number) => pose.y + (v + pose.lift) * pose.scale;

function signedArea(points: Pt[]) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area;
}

/**
 * Accumulates the outer contour of one actor into a single multi-subpath
 * path. Fill uses same-winding parts; stroke uses only their exposed boundary,
 * so overlapping joints do not leave black seams. Local coordinates share a
 * bounded contour cache and 1/8-pixel precision. Materials are drawn afterwards.
 */
export class Silhouette {
  private hasPath = false;
  private polygons: Pt[][] = [];
  constructor(
    private g: Graphics,
    private pose: Pose,
    private fill: string,
    private outline: string,
    private lineWidth: number,
  ) {}

  poly(local: Pt[]) {
    if (local.length < 3) return;
    const canonical: Pt[] = local.map(([u,v]) => [Math.round(u*8)/8, Math.round(v*8)/8]);
    if (signedArea(canonical) < 0) canonical.reverse();
    const world: Pt[] = canonical.map(([u, v]) => [lx(this.pose, u), ly(this.pose, v)]);
    if (signedArea(world) < 0) world.reverse();
    this.polygons.push(canonical);
    const g = this.g;
    g.moveTo(world[0][0], world[0][1]);
    for (let i = 1; i < world.length; i++) g.lineTo(world[i][0], world[i][1]);
    g.close();
    this.hasPath = true;
  }

  ellipse(u: number, v: number, ru: number, rv: number, segments = 12) {
    const points: Pt[] = [];
    const n = Math.max(6, segments);
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      points.push([u + Math.cos(a) * ru, v + Math.sin(a) * rv]);
    }
    this.poly(points);
  }

  plate(u: number, v: number, w: number, h: number, r = 0) {
    this.poly(roundedRectPoints(u, v, w, h, r));
  }

  limb(a: Pt, b: Pt, wa: number, wb: number) {
    this.poly(taperedQuad(a, b, wa, wb));
  }

  curveLimb(a: Pt, c: Pt, b: Pt, wa: number, wb: number, segments = 6) {
    this.poly(curvedLimb(a, c, b, wa, wb, segments));
  }

  wedge(cx: number, cy: number, r: number, a0: number, a1: number, segments = 10) {
    const points: Pt[] = [[cx, cy]];
    const n = Math.max(3, segments);
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    this.poly(points);
  }

  commit() {
    if (!this.hasPath) return;
    const g = this.g;
    g.fillColor = ink(this.fill, this.pose.alpha);
    g.fill();
    for (const chain of cachedEdges(this.polygons)) {
      g.moveTo(lx(this.pose, chain[0][0]), ly(this.pose, chain[0][1]));
      for (let i = 1; i < chain.length; i++) g.lineTo(lx(this.pose, chain[i][0]), ly(this.pose, chain[i][1]));
    }
    g.strokeColor = ink(this.outline, this.pose.alpha);
    g.lineWidth = Math.max(1, this.lineWidth * this.pose.scale);
    g.stroke();
  }
}

export function roundedRectPoints(u: number, v: number, w: number, h: number, r: number): Pt[] {
  const hw = w / 2,
    hh = h / 2,
    rr = Math.max(0, Math.min(r, hw, hh));
  if (rr <= 0)
    return [
      [u - hw, v - hh],
      [u + hw, v - hh],
      [u + hw, v + hh],
      [u - hw, v + hh],
    ];
  const points: Pt[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 3; i++) {
      const a = a0 + (Math.PI / 2) * (i / 3);
      points.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  };
  points.push([u - hw + rr, v - hh]);
  points.push([u + hw - rr, v - hh]);
  corner(u + hw - rr, v - hh + rr, -Math.PI / 2);
  points.push([u + hw, v + hh - rr]);
  corner(u + hw - rr, v + hh - rr, 0);
  points.push([u - hw + rr, v + hh]);
  corner(u - hw + rr, v + hh - rr, Math.PI / 2);
  points.push([u - hw, v - hh + rr]);
  corner(u - hw + rr, v - hh + rr, Math.PI);
  return points;
}

export function taperedQuad(a: Pt, b: Pt, wa: number, wb: number): Pt[] {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d,
    ny = dx / d;
  return [
    [a[0] + nx * wa, a[1] + ny * wa],
    [b[0] + nx * wb, b[1] + ny * wb],
    [b[0] - nx * wb, b[1] - ny * wb],
    [a[0] - nx * wa, a[1] - ny * wa],
  ];
}

function quadraticPoint(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

export function curvedLimb(a: Pt, c: Pt, b: Pt, wa: number, wb: number, segments = 6): Pt[] {
  const left: Pt[] = [],
    right: Pt[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = quadraticPoint(a, c, b, t);
    const q = quadraticPoint(a, c, b, Math.min(1, t + 0.01));
    const dx = q[0] - p[0],
      dy = q[1] - p[1],
      d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d,
      ny = dx / d;
    const w = wa + (wb - wa) * t;
    left.push([p[0] + nx * w, p[1] + ny * w]);
    right.push([p[0] - nx * w, p[1] - ny * w]);
  }
  right.reverse();
  return left.concat(right);
}

export function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, segments = 16, includeCenter = false): Pt[] {
  const points: Pt[] = includeCenter ? [[cx, cy]] : [];
  const n = Math.max(3, segments);
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return points;
}

/* ---------------- interior detail (fill-only, no extra outline) ---------------- */

export function detailEllipse(
  g: Graphics,
  pose: Pose,
  u: number,
  v: number,
  ru: number,
  rv: number,
  color: string,
  alpha = pose.alpha,
  segments = 10,
) {
  if (ru <= 0 || rv <= 0) return;
  const points: Pt[] = [];
  const n = Math.max(6, segments);
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    points.push([u + Math.cos(a) * ru, v + Math.sin(a) * rv]);
  }
  detailPoly(g, pose, points, color, alpha);
}

export function detailPoly(g: Graphics, pose: Pose, local: Pt[], color: string, alpha = pose.alpha) {
  if (local.length < 3) return;
  const g2 = g;
  const p0 = local[0];
  g2.fillColor = ink(color, alpha);
  g2.moveTo(lx(pose, p0[0]), ly(pose, p0[1]));
  for (let i = 1; i < local.length; i++) g2.lineTo(lx(pose, local[i][0]), ly(pose, local[i][1]));
  g2.close();
  g2.fill();
}

export function detailLine(
  g: Graphics,
  pose: Pose,
  a: Pt,
  b: Pt,
  color: string,
  width = 1.5,
  alpha = pose.alpha,
) {
  g.strokeColor = ink(color, alpha);
  g.lineWidth = Math.max(1, width * pose.scale);
  g.moveTo(lx(pose, a[0]), ly(pose, a[1]));
  g.lineTo(lx(pose, b[0]), ly(pose, b[1]));
  g.stroke();
}

export function detailArc(
  g: Graphics,
  pose: Pose,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  color: string,
  width = 1.5,
  alpha = pose.alpha,
  segments = 16,
) {
  const points = arcPoints(cx, cy, r, a0, a1, segments);
  g.strokeColor = ink(color, alpha);
  g.lineWidth = Math.max(1, width * pose.scale);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) g.moveTo(lx(pose, p[0]), ly(pose, p[1]));
    else g.lineTo(lx(pose, p[0]), ly(pose, p[1]));
  }
  g.stroke();
}

export function eye(g: Graphics, pose: Pose, u: number, v: number, r: number, color: string, alpha = pose.alpha) {
  detailEllipse(g, pose, u, v, r, r, color, alpha);
  if (r > 2) detailEllipse(g, pose, u + r * 0.25, v + r * 0.1, r * 0.4, r * 0.4, "#10161c", alpha);
}

export function rim(g: Graphics, pose: Pose, points: Pt[], color: string, width = 1.5, alpha = pose.alpha) {
  if (points.length < 2) return;
  g.strokeColor = ink(color, alpha);
  g.lineWidth = Math.max(1, width * pose.scale);
  g.moveTo(lx(pose, points[0][0]), ly(pose, points[0][1]));
  for (let i = 1; i < points.length; i++) g.lineTo(lx(pose, points[i][0]), ly(pose, points[i][1]));
  g.stroke();
}

export function groundShadow(g: Graphics, pose: Pose, halfWidth: number, shrink = 1, alpha = 62, simple = false) {
  const rx = Math.max(3, halfWidth * pose.scale * shrink),
    ry = Math.max(2, 4.5 * pose.scale * shrink);
  const points: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10;
    points.push([Math.cos(a) * rx, -4 * pose.scale + Math.sin(a) * ry]);
  }
  g.fillColor = ink("#040811", alpha);
  g.moveTo(pose.x + points[0][0], pose.y + points[0][1]);
  for (let i = 1; i < points.length; i++) g.lineTo(pose.x + points[i][0], pose.y + points[i][1]);
  g.close();
  g.fill();
  if (simple) return;
  const inner: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10;
    inner.push([Math.cos(a) * rx * 0.62, -3 * pose.scale + Math.sin(a) * ry * 0.55]);
  }
  g.fillColor = ink("#040811", alpha * 0.55);
  g.moveTo(pose.x + inner[0][0], pose.y + inner[0][1]);
  for (let i = 1; i < inner.length; i++) g.lineTo(pose.x + inner[i][0], pose.y + inner[i][1]);
  g.close();
  g.fill();
}

export function ring(
  g: Graphics,
  x: number,
  y: number,
  r: number,
  color: string,
  width = 2,
  alpha = 220,
) {
  g.strokeColor = ink(color, alpha);
  g.lineWidth = width;
  g.moveTo(x + r, y);
  g.arc(x, y, r, 0, Math.PI * 2, false);
  g.close();
  g.stroke();
}
