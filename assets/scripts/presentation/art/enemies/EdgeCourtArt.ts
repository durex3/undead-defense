import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { EnemyArt } from "../EnemyCatalog";
import type { Pose } from "../Actor";
import { Silhouette, detailPoly, detailLine, detailEllipse } from "../Brush";
/** Asymmetric cold iron puppets: articulated feet and empty/holding arm poses show the handoff. */
export function drawEdgeBody(
  g: Graphics,
  w: SurvivalWorld,
  e: Enemy,
  art: EnemyArt,
  p: Pose,
) {
  const c = art.palette,
    k = e.kind === "minion" ? "scrapbound" : e.kind,
    s = new Silhouette(g, p, c.base, c.outline, 2.6),
    boss = k === "boss",
    twin = k === "twinclamp",
    master = k === "edgepuppeteer",
    low = k === "reelstalker",
    small = k === "scrapbound";
  const poly = (v: [number, number][], color = c.light) =>
      detailPoly(g, p, v, color),
    line = (
      a: [number, number],
      b: [number, number],
      color = c.metal,
      width = 2,
    ) => detailLine(g, p, a, b, color, width),
    oval = (x: number, y: number, rx: number, ry: number, color = c.shade) =>
      detailEllipse(g, p, x, y, rx, ry, color);
  const wide = boss ? 40 : twin ? 38 : low ? 32 : small ? 18 : 23,
    top = boss ? 94 : master ? 86 : twin ? 65 : low ? 35 : small ? 39 : 62;
  for (const side of [-1, 1])
    for (let i = 0; i < (boss || low || twin ? 2 : 1); i++) {
      const x = side * (wide - 6),
        d = p.stride * (i ? 1 : -1);
      s.poly([
        [x - 5, 22 + i * 8],
        [x + side * 8 + d, 12 + i * 4],
        [x + side * 13 + d, 2],
        [x + side * 2 + d, 1],
        [x - 4, 15 + i * 8],
      ]);
    }
  s.poly([
    [-wide, 21],
    [-wide + 5, top - 10],
    [-wide * 0.25, top + 2],
    [wide * 0.75, top - 7],
    [wide, 25],
    [wide * 0.55, 13],
    [-wide * 0.6, 16],
  ]);
  if (!small && !low) {
    s.poly([
      [-wide + 3, top - 16],
      [-wide - 14, top - 25],
      [-wide - 19, 22],
      [-wide - 8, 19],
      [-wide - 7, top - 31],
    ]);
    s.poly([
      [wide - 5, top - 18],
      [wide + 15, top - 28],
      [wide + 20, 42],
      [wide + 9, 39],
      [wide + 5, top - 36],
    ]);
  }
  s.commit();
  poly(
    [
      [-wide + 7, top - 15],
      [-5, top - 5],
      [-10, 24],
      [-wide + 5, 26],
    ],
    c.shade,
  );
  poly(
    [
      [2, top - 7],
      [wide - 5, top - 13],
      [wide - 8, 27],
      [5, 20],
    ],
    c.metal,
  );
  oval(
    -4,
    top * 0.58,
    small ? 7 : boss ? 18 : 12,
    small ? 7 : boss ? 21 : 15,
    c.outline,
  );
  poly(
    [
      [-12, top * 0.58],
      [-3, top * 0.58 + 12],
      [7, top * 0.58],
      [-3, top * 0.58 - 11],
    ],
    e.state === "recover" ? c.eye : c.accent,
  );
  line([-10, top * 0.58 - 7], [5, top * 0.58 + 7], c.shade, 2);
  const detached = w.hazards.some(
    (h) =>
      h.source === e.id &&
      h.edge?.shape === "blade" &&
      h.edge.flights[0].due <= w.time &&
      h.until > w.time,
  );
  if (!small && !low) {
    const x = wide + 14,
      y = 45;
    if (detached) {
      line([x - 6, y], [x + 7, y + 5], c.light, 4);
      line([x - 5, y + 8], [x + 5, y + 11], c.light, 3);
    } else {
      poly(
        [
          [x - 5, y - 15],
          [x + 8, y - 8],
          [x + 12, y + 25],
          [x + 2, y + 39],
          [x - 8, y + 21],
        ],
        c.metalLight,
      );
      line([x + 1, y - 5], [x + 3, y + 23], c.light, 2);
    }
  }
  if (k === "edgecaster" || master) {
    poly(
      [
        [-wide - 10, top + 2],
        [-wide + 4, top + 13],
        [-wide + 14, top],
        [-wide + 7, top - 9],
      ],
      c.metalLight,
    );
  }
  if (k === "stepcutter") {
    for (const side of [-1, 1])
      poly(
        [
          [side * 13, 28],
          [side * 26, 15],
          [side * 19, 5],
          [side * 8, 16],
        ],
        c.metalLight,
      );
  }
  if (low) {
    for (const side of [-1, 1]) {
      oval(side * 25, 17, 11, 11, c.outline);
      oval(side * 25, 17, 6, 6, c.metalLight);
    }
    poly(
      [
        [wide - 4, 30],
        [wide + 17, 39],
        [wide + 9, 25],
        [wide + 14, 14],
        [wide - 5, 19],
      ],
      c.light,
    );
  }
  if (twin) {
    for (const side of [-1, 1])
      poly(
        [
          [side * 35, 29],
          [side * 53, 42],
          [side * 56, 64],
          [side * 46, 55],
          [side * 38, 36],
        ],
        c.metalLight,
      );
  }
  if (boss) {
    for (let i = 0; i < e.bossPhase; i++)
      poly(
        [
          [-20 + i * 17, top + 6],
          [-14 + i * 17, top + 18],
          [-8 + i * 17, top + 6],
        ],
        c.accent,
      );
    line([-wide + 8, 25], [wide - 6, 24], c.metalLight, 4);
  }
  for (const x of [-wide * 0.5, wide * 0.55])
    oval(x, top - 14, 2.5, 2.5, c.light);
}
