import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { EnemyArt } from "../EnemyCatalog";
import type { Pose } from "../Actor";
import { Silhouette, detailPoly, detailLine, detailEllipse } from "../Brush";
/** Armillary instruments: insect scrap, hovering disc, tall reverse neck, side axle and twin rings. */
export function drawEclipseBody(
  g: Graphics,
  w: SurvivalWorld,
  e: Enemy,
  art: EnemyArt,
  p: Pose,
) {
  const c = art.palette,
    k = e.kind === "minion" ? "dialscrap" : e.kind,
    boss = k === "boss",
    small = k === "dialscrap",
    twin = k === "twindial",
    offset = k === "offsetorrery" || k === "eclipsewarden",
    tall = k === "reversegazer";
  const s = new Silhouette(g, p, c.base, c.outline, 2.5),
    top = boss ? 94 : tall ? 75 : k === "eclipsewarden" ? 84 : small ? 26 : 52,
    wide = boss ? 42 : twin ? 35 : small ? 18 : 27;
  if (small) {
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++)
        s.poly([
          [side * 8, 12 + i * 7],
          [side * (20 + i * 2), 4 + i * 6],
          [side * (24 + i * 2), i * 5],
          [side * 18, 5 + i * 6],
        ]);
    s.ellipse(0, 18, 15, 20);
    s.ellipse(0, 34, 9, 8);
    s.commit();
    for (const x of [-5, 5]) detailEllipse(g, p, x, 35, 2.5, 3, c.eye);
    for (let i = 0; i < 3; i++)
      detailLine(g, p, [-9, 10 + i * 8], [9, 13 + i * 8], c.metalLight, 2);
    return;
  }
  if (k === "glowdisc") {
    s.ellipse(0, 38, 29, 10);
    s.ellipse(0, 48, 14, 14);
    s.commit();
    detailEllipse(g, p, 0, 48, 7, 8, c.eye);
    detailEllipse(g, p, 0, 38, 23, 5, c.metalLight);
    detailLine(g, p, [-19, 22], [19, 22], c.accent, 2);
    return;
  }
  for (const side of [-1, 1]) {
      s.poly([
        [side * (wide - 7), 20],
        [side * (wide + 7), 12],
        [side * (wide + 10), 0],
        [side * (wide - 4), 1],
        [side * (wide - 3), 12],
      ]);
    }
  s.poly([
    [-wide * 0.7, 8],
    [wide * 0.7, 8],
    [wide * 0.5, 22],
    [-wide * 0.5, 22],
  ]);
  if (tall)
    s.poly([
      [-6, 17],
      [5, 17],
      [11, top - 12],
      [0, top - 8],
      [-9, 38],
    ]);
  else
    s.poly([
      [-wide * 0.35, 17],
      [wide * 0.35, 17],
      [wide * 0.5, top - 12],
      [-wide * 0.4, top - 12],
    ]);
  s.ellipse(
    offset ? 13 : 0,
    top,
    small ? 12 : boss ? 22 : 17,
    small ? 10 : boss ? 23 : 18,
  );
  s.commit();
  const ring = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    angle: number,
  ) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 24; i++) {
      const a = angle + (i * Math.PI * 1.7) / 24;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    for (let i = 1; i < pts.length; i++)
      detailLine(g, p, pts[i - 1], pts[i], c.metalLight, boss ? 4 : 3);
  };
  const cx = offset ? 13 : 0;
  ring(
    cx,
    top,
    boss ? 47 : small ? 21 : 30,
    boss ? 30 : small ? 12 : 19,
    w.time * 0.12,
  );
  if (twin || boss || k === "eclipsewarden")
    ring(cx, top, boss ? 37 : 38, boss ? 46 : 27, -w.time * 0.09 + 0.8);
  if (boss && e.bossPhase >= 2) ring(0, top, 54, 18, 1.1 + w.time * 0.08);
  if (boss && e.bossPhase === 3) {
    for (const side of [-1, 1]) {
      detailLine(
        g,
        p,
        [side * 13, top - 8],
        [side * 49, top - 30],
        c.metalLight,
        4,
      );
      ring(side * 49, top - 30, 14, 19, side * w.time * 0.14);
      detailEllipse(g, p, side * 49, top - 30, 6, 8, c.eye);
    }
  }
  detailEllipse(
    g,
    p,
    cx,
    top,
    small ? 7 : boss ? 15 : 11,
    small ? 7 : boss ? 16 : 12,
    c.shade,
  );
  detailPoly(
    g,
    p,
    [
      [cx, top + 12],
      [cx + 8, top],
      [cx, top - 12],
      [cx - 8, top],
    ],
    c.eye,
  );
  for (const side of [-1, 1])
    detailLine(
      g,
      p,
      [side * wide * 0.4, 14],
      [side * wide * 0.7, 19],
      c.metalLight,
      3,
    );
  if (offset || boss) {
    detailLine(g, p, [0, top - 18], [25, top - 18], c.metalLight, 5);
    detailEllipse(g, p, 25, top - 18, 5, 5, c.accent);
  }
  if (twin) {
    ring(-23, top - 27, 14, 10, 0.2);
    ring(23, top - 27, 14, 10, 2);
  }
}
