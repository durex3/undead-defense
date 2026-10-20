import type { Graphics } from "cc";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { EnemyArt } from "../EnemyCatalog";
import type { Pose } from "../Actor";
import { Silhouette, detailPoly, detailLine, detailEllipse } from "../Brush";
const COATS: Record<string, readonly [number, number, number]> = {
  shardhermit: [15, 23, 6],
  facetgastropod: [18, 32, 7],
  prismmason: [12, 25, 5],
  corebrood: [24, 15, 5],
  bifacetregent: [19, 35, 8],
  strataflinger: [30, 24, 7],
  boss: [34, 30, 8],
};
/** Mineral organisms, with original silhouettes and attached wax; devices use their real collision centers. */
export function drawPrismBody(
  g: Graphics,
  w: SurvivalWorld,
  e: Enemy,
  art: EnemyArt,
  p: Pose,
) {
  const c = art.palette,
    k = e.kind,
    s = new Silhouette(g, p, c.base, c.outline, 2.5),
    poly = (v: [number, number][], color = c.light) =>
      detailPoly(g, p, v, color),
    line = (
      a: [number, number],
      b: [number, number],
      color = c.metalLight,
      width = 3,
    ) => detailLine(g, p, a, b, color, width),
    oval = (x: number, y: number, rx: number, ry: number, color = c.shade) =>
      detailEllipse(g, p, x, y, rx, ry, color);
  if (k === "prismcore") {
    s.poly([
      [-30, 0],
      [-18, 24],
      [7, 30],
      [28, 14],
      [30, -10],
      [9, -29],
      [-17, -24],
    ]);
    s.commit();
    poly(
      [
        [-25, 0],
        [-15, 20],
        [4, 25],
        [0, 0],
      ],
      c.light,
    );
    poly(
      [
        [0, 0],
        [4, 25],
        [24, 12],
        [25, -9],
        [8, -24],
      ],
      c.shade,
    );
    line([-16, -17], [9, 15], c.accent, 3);
    return;
  }
  if (k === "prismmirror") {
    const vertical = e.prism?.axis !== "y",
      v = (x: number, y: number): [number, number] =>
        vertical ? [x, y] : [y, x];
    s.poly([v(-6, -33), v(-9, 0), v(-5, 33), v(5, 33), v(9, 0), v(6, -33)]);
    s.commit();
    poly([v(-3, -28), v(-5, 0), v(-2, 28), v(3, 28), v(2, -28)], c.light);
    line(v(0, -27), v(0, 27), c.accent, 2);
    return;
  }
  if (k === "boss") {
    for (const [x, top] of [
      [-40, 78],
      [-20, 103],
      [0, 118],
      [22, 96],
      [42, 72],
    ])
      s.poly([
        [x - 12, 44],
        [x - 9, top - 18],
        [x, top],
        [x + 12, top - 20],
        [x + 14, 45],
      ]);
    for (const x of [-30, 0, 30])
      s.poly([
        [x - 7, 3],
        [x + 8, 3],
        [x + 11, 33],
        [x - 10, 33],
      ]);
    s.poly([
      [-47, 28],
      [-44, 58],
      [-18, 76],
      [19, 74],
      [47, 54],
      [43, 25],
      [0, 12],
    ]);
    s.commit();
    poly(
      [
        [-40, 50],
        [-17, 67],
        [0, 58],
        [0, 23],
        [-35, 30],
      ],
      c.light,
    );
    poly(
      [
        [0, 58],
        [18, 66],
        [40, 49],
        [35, 29],
        [0, 23],
      ],
      c.shade,
    );
    for (const [x, top] of [
      [-20, 103],
      [0, 118],
      [22, 96],
    ])
      poly(
        [
          [x - 5, top - 20],
          [x, top - 6],
          [x + 6, top - 23],
          [x + 3, 65],
        ],
        c.metalLight,
      );
    poly(
      [
        [-20, 53],
        [0, 64],
        [21, 52],
        [11, 39],
        [-12, 39],
      ],
      c.outline,
    );
    poly(
      [
        [-9, 52],
        [0, 59],
        [10, 51],
        [0, 46],
      ],
      c.eye,
    );
    line([-31, 16], [29, 18], c.metal, 4);
  } else if (k === "shardhermit") {
    for (const x of [-19, 13])
      for (const side of [-1, 1])
        s.poly([
          [x, 18],
          [x + side * 9, 9],
          [x + side * 10, 2],
          [x + side * 3, 3],
          [x - 3, 15],
        ]);
    s.poly([
      [-22, 18],
      [-19, 36],
      [-4, 47],
      [20, 39],
      [26, 18],
    ]);
    s.poly([
      [-19, 22],
      [-30, 27],
      [-34, 20],
      [-28, 15],
      [-20, 16],
    ]);
    s.poly([
      [21, 18],
      [33, 23],
      [36, 15],
      [28, 11],
    ]);
    s.commit();
    poly(
      [
        [-16, 34],
        [-3, 42],
        [13, 37],
        [2, 22],
        [-17, 22],
      ],
      c.light,
    );
    poly(
      [
        [2, 22],
        [14, 35],
        [20, 20],
      ],
      c.shade,
    );
    line([-5, 25], [5, 25], c.eye, 2);
  } else if (k === "facetgastropod") {
    s.poly([
      [-30, 5],
      [27, 5],
      [32, 12],
      [13, 20],
      [-10, 22],
      [-28, 13],
    ]);
    s.poly([
      [-22, 20],
      [-21, 49],
      [-5, 64],
      [16, 48],
      [17, 20],
    ]);
    s.poly([
      [13, 33],
      [36, 40],
      [38, 34],
      [17, 25],
    ]);
    s.commit();
    poly(
      [
        [-16, 44],
        [-4, 57],
        [10, 46],
        [8, 28],
        [-12, 27],
      ],
      c.light,
    );
    line([-8, 33], [-12, 43], c.shade, 3);
    line([-12, 43], [-1, 49], c.shade, 3);
    line([-1, 49], [5, 39], c.shade, 3);
    line([19, 33], [34, 37], c.accent, 3);
    oval(26, 12, 2, 2, c.eye);
  } else if (k === "prismmason") {
    for (const x of [-23, 0, 23])
      s.poly([
        [x - 4, 2],
        [x + 5, 2],
        [x * 0.35 + 4, 26],
        [x * 0.35 - 4, 26],
      ]);
    s.poly([
      [-27, 24],
      [0, 69],
      [27, 24],
      [17, 24],
      [0, 52],
      [-17, 24],
    ]);
    s.commit();
    poly(
      [
        [-21, 26],
        [0, 61],
        [0, 51],
        [-14, 26],
      ],
      c.light,
    );
    poly(
      [
        [3, 50],
        [10, 57],
        [14, 45],
        [9, 35],
      ],
      c.metalLight,
    );
    line([-6, 31], [6, 31], c.eye, 2);
    oval(0, 42, 4, 5, c.shade);
  } else if (k === "corebrood") {
    for (const x of [-22, -6, 12, 25])
      s.poly([
        [x - 4, 14],
        [x + 4, 14],
        [x + 7, 3],
        [x, 2],
      ]);
    s.poly([
      [-34, 10],
      [-30, 24],
      [-18, 34],
      [7, 30],
      [20, 23],
      [35, 15],
      [29, 7],
      [-10, 5],
    ]);
    s.ellipse(-4, 29, 20, 16, 10);
    s.commit();
    oval(-4, 30, 15, 12, c.cloth);
    poly(
      [
        [-13, 31],
        [-5, 40],
        [5, 34],
        [2, 25],
        [-9, 22],
      ],
      c.light,
    );
    line([-21, 9], [-22, 25], c.shade, 3);
    line([15, 10], [16, 23], c.shade, 3);
    oval(27, 16, 2, 2, c.eye);
  } else if (k === "bifacetregent") {
    for (const x of [-9, 9])
      s.poly([
        [x - 4, 3],
        [x + 4, 3],
        [x + 5, 31],
        [x - 5, 31],
      ]);
    s.poly([
      [-18, 34],
      [-12, 58],
      [0, 77],
      [13, 57],
      [18, 34],
      [0, 23],
    ]);
    for (const side of [-1, 1])
      s.poly([
        [side * 13, 45],
        [side * 34, 73],
        [side * 41, 46],
        [side * 30, 30],
      ]);
    s.commit();
    for (const side of [-1, 1]) {
      poly(
        [
          [side * 18, 45],
          [side * 32, 65],
          [side * 35, 46],
          [side * 29, 36],
        ],
        c.light,
      );
      line([side * 19, 45], [side * 32, 58], c.accent, 2);
    }
    poly(
      [
        [-8, 55],
        [0, 69],
        [8, 54],
        [0, 47],
      ],
      c.shade,
    );
    oval(0, 56, 3, 3, c.eye);
  } else if (k === "strataflinger") {
    for (const x of [-26, -9, 12, 29])
      s.poly([
        [x - 5, 3],
        [x + 5, 3],
        [x + 7, 28],
        [x - 6, 28],
      ]);
    for (const [x, y] of [
      [-25, 34],
      [0, 46],
      [25, 34],
    ])
      s.poly([
        [x - 17, y - 10],
        [x - 16, y + 12],
        [x, y + 26],
        [x + 17, y + 10],
        [x + 18, y - 12],
      ]);
    s.commit();
    for (const [x, y] of [
      [-25, 34],
      [0, 46],
      [25, 34],
    ]) {
      oval(x, y + 4, 10, 13, c.cloth);
      poly(
        [
          [x - 7, y + 5],
          [x, y + 14],
          [x + 8, y + 4],
          [x, y - 5],
        ],
        c.light,
      );
    }
    line([-6, 27], [6, 27], c.eye, 3);
  }
  const coat = COATS[k];
  if (coat) {
    const [width, y, height] = coat,
      layers =
        (e.fractureUntil ?? 0) > w.time ? Math.min(2, e.fracture ?? 0) : 0,
      open = e.state === "recover" && e.prism?.vulnerable,
      gap = open ? 6 : 2;
    for (const side of [-1, 1]) {
      poly(
        [
          [side * gap, y + height],
          [side * (width - 3), y + height + 2],
          [side * width, y],
          [side * (width - 2), y - height],
          [side * (gap + 1), y - height + 2],
        ],
        layers === 2 ? "#817f70" : "#b9b395",
      );
      line(
        [side * (gap + 2), y + height - 2],
        [side * (width - 4), y + height],
        "#dfd4ae",
        2,
      );
    }
    for (let i = 0; i < layers; i++) {
      const x = (i === 0 ? -1 : 1) * width * 0.55;
      poly(
        [
          [x - 2, y + height],
          [x + 2, y + 2],
          [x - 2, y - 1],
          [x + 2, y - height],
          [x + 5, y],
        ],
        c.outline,
      );
    }
    if (open) line([-width * 0.6, y - 3], [width * 0.6, y + 3], c.eye, 3);
  }
}
