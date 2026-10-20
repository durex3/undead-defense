import type { Graphics } from "cc";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { EnemyArt } from "../EnemyCatalog";
import type { Pose } from "../Actor";
import {
  Silhouette,
  detailPoly,
  detailLine,
  detailEllipse,
  lx,
  ly,
} from "../Brush";
import { ink } from "../Ink";
type P = [number, number];
/** Root organisms: leaves, calyces and hanging crowns, with resin bark attached to the body. */
export function drawRootBody(
  g: Graphics,
  w: SurvivalWorld,
  e: Enemy,
  art: EnemyArt,
  p: Pose,
) {
  const originalScale = p.scale,
    originalX = p.x;
  p.scale *= 1 - p.windup * 0.035 + p.recover * 0.025;
  if (!p.frozen) p.x += Math.sin(p.time * 3 + p.id) * 0.8;
  const veins = (segments: [P, P][], color: string, width = 1.5) => {
    g.strokeColor = ink(color, p.alpha);
    g.lineWidth = width * p.scale;
    for (const [a, b] of segments) {
      g.moveTo(lx(p, a[0]), ly(p, a[1]));
      g.lineTo(lx(p, b[0]), ly(p, b[1]));
    }
    g.stroke();
  };
  const c = art.palette,
    k = e.kind === "minion" ? "rootshuffler" : e.kind,
    s = new Silhouette(g, p, c.base, c.outline, 2.5);
  const poly = (v: P[], color = c.light) => detailPoly(g, p, v, color),
    line = (a: P, b: P, color = c.metalLight, width = 2) =>
      detailLine(g, p, a, b, color, width),
    oval = (x: number, y: number, rx: number, ry: number, color = c.shade) =>
      detailEllipse(g, p, x, y, rx, ry, color);
  const leaf = (x: number, y: number, side: number, size: number) =>
    s.poly([
      [x, y],
      [x + side * size, y + size * 0.4],
      [x + side * size * 0.8, y + size * 1.15],
      [x + side * size * 0.2, y + size * 0.75],
    ]);
  let barkY = 23,
    barkW = 12;
  if (k === "boss") {
    // Five arched roots and a hooked stem carry a four-lobed pendant flower.
    for (const [x, y] of [
      [-45, 3],
      [-25, 7],
      [0, 2],
      [26, 5],
      [46, 3],
    ])
      s.curveLimb([x, y], [x * 0.45, 45], [4, 58], 4, 8, 4);
    s.curveLimb([0, 24], [42, 119], [0, 126], 12, 11, 6);
    for (const side of [-1, 1]) {
      s.poly([
        [0, 130],
        [side * 19, 139],
        [side * 47, 120],
        [side * 42, 97],
        [side * 23, 77],
        [side * 10, 91],
      ]);
      s.poly([
        [side * 9, 128],
        [side * 29, 118],
        [side * 21, 91],
        [side * 6, 79],
        [side * 2, 99],
      ]);
    }
    s.poly([
      [-6, 100],
      [9, 99],
      [13, 67],
      [1, 54],
      [-10, 68],
    ]);
    s.commit();
    for (const side of [-1, 1]) {
      poly(
        [
          [side * 5, 125],
          [side * 20, 131],
          [side * 40, 118],
          [side * 33, 99],
          [side * 23, 88],
          [side * 16, 104],
        ],
        c.cloth,
      );
      poly(
        [
          [side * 10, 123],
          [side * 24, 117],
          [side * 16, 94],
          [side * 6, 89],
        ],
        c.light,
      );
      line([side * 18, 118], [side * 23, 99], c.accent, 3);
    }
    poly(
      [
        [-4, 97],
        [5, 96],
        [7, 70],
        [1, 62],
        [-5, 72],
      ],
      c.accent,
    );
    oval(1, 87, 3, 4, c.eye);
    barkY = 47;
    barkW = 15;
  } else if (k === "rootshuffler") {
    for (const x of [-22, 0, 22])
      for (const side of [-1, 1])
        s.limb([x * 0.65, 15], [x + side * 8, 3], 4, 2);
    leaf(-7, 13, -1, 25);
    leaf(0, 11, 1, 32);
    leaf(-1, 22, -1, 20);
    s.ellipse(8, 16, 12, 10, 8);
    s.commit();
    poly(
      [
        [-8, 17],
        [-25, 27],
        [-23, 37],
        [-12, 28],
      ],
      c.light,
    );
    poly(
      [
        [7, 17],
        [25, 25],
        [26, 37],
        [15, 30],
      ],
      c.light,
    );
    oval(13, 19, 5, 6, c.cloth);
    line([9, 21], [16, 22], c.eye, 2);
    barkY = 14;
    barkW = 9;
  } else if (k === "vinecantor" || k === "biforktangler") {
    const elite = k === "biforktangler";
    for (const x of [-24, 0, 22])
      s.curveLimb([x, 3], [x * 0.2, 19], [0, 36], 3, 7, 3);
    s.curveLimb([0, 15], [-11, 47], [2, 70], 8, 5, 4);
    s.curveLimb([0, 46], [34, 90], [25, 61], 6, 3, 5);
    if (elite) {
      s.curveLimb([-1, 46], [-41, 104], [-28, 70], 8, 4, 5);
      leaf(-5, 56, -1, 24);
    } else leaf(-3, 39, -1, 23);
    s.poly([
      [-9, 60],
      [0, 78],
      [10, 68],
      [6, 56],
    ]);
    s.commit();
    poly(
      [
        [-5, 63],
        [1, 72],
        [5, 66],
        [2, 60],
      ],
      c.light,
    );
    line([3, 50], [22, 74], c.accent, 3);
    if (elite) line([-4, 54], [-27, 82], c.cloth, 4);
    oval(1, 64, 3, 2, c.eye);
    barkY = 34;
    barkW = 9;
  } else if (k === "wreathpod") {
    s.curveLimb([-30, 3], [-23, 18], [-2, 25], 4, 8, 4);
    s.curveLimb([28, 3], [19, 19], [2, 25], 4, 8, 4);
    for (const side of [-1, 1]) {
      leaf(side * 9, 15, side, 25);
      s.poly([
        [side * 4, 24],
        [side * 8, 46],
        [side * 22, 55],
        [side * 31, 43],
        [side * 22, 25],
        [side * 15, 25],
        [side * 23, 43],
        [side * 18, 46],
        [side * 11, 27],
      ]);
    }
    s.commit();
    oval(0, 32, 14, 11, c.outline);
    line([-21, 40], [-12, 47], c.light, 3);
    line([13, 47], [23, 40], c.light, 3);
    poly(
      [
        [-9, 23],
        [0, 15],
        [10, 23],
        [3, 27],
      ],
      c.cloth,
    );
    barkY = 16;
    barkW = 12;
  } else if (k === "bulbmaw") {
    for (const x of [-18, 0, 18]) s.limb([x, 3], [x * 0.2, 29], 4, 7);
    s.poly([
      [-8, 22],
      [-22, 40],
      [-18, 64],
      [0, 80],
      [18, 64],
      [22, 40],
      [8, 22],
    ]);
    s.commit();
    poly(
      [
        [-6, 29],
        [-16, 43],
        [-12, 62],
        [0, 72],
        [1, 31],
      ],
      c.light,
    );
    poly(
      [
        [2, 71],
        [13, 61],
        [16, 43],
        [6, 30],
      ],
      c.cloth,
    );
    line([-4, 36], [-4, 64], c.accent, 3);
    oval(3, 51, 3, 5, c.eye);
    barkY = 23;
    barkW = 9;
  } else if (k === "migratorycorolla") {
    for (const x of [-38, -23, -8, 10, 25, 40])
      s.curveLimb([x, 3], [x * 0.7, 17], [0, 29], 3, 7, 3);
    s.limb([-7, 21], [7, 46], 12, 9);
    for (const [x, y] of [
      [-36, 59],
      [-20, 82],
      [6, 88],
      [30, 75],
      [44, 49],
    ])
      s.poly([
        [0, 39],
        [x - 10, y - 12],
        [x, y],
        [x + 11, y - 7],
        [16, 40],
      ]);
    s.poly([
      [0, 35],
      [-13, 44],
      [-8, 61],
      [9, 68],
      [24, 56],
      [19, 39],
    ]);
    s.commit();
    poly(
      [
        [-28, 58],
        [-20, 72],
        [-11, 64],
        [-8, 48],
      ],
      c.light,
    );
    poly(
      [
        [4, 78],
        [8, 66],
        [18, 55],
        [24, 64],
        [25, 71],
      ],
      c.cloth,
    );
    poly(
      [
        [0, 42],
        [-7, 48],
        [-3, 57],
        [8, 59],
        [15, 52],
        [10, 45],
      ],
      c.shade,
    );
    oval(5, 51, 6, 5, c.outline);
    line([0, 63], [9, 67], c.accent, 3);
    barkY = 26;
    barkW = 13;
  } else if (k === "pairedcalyx") {
    for (const x of [-40, -13, 14, 42])
      s.curveLimb([x, 3], [x * 0.5, 18], [0, 32], 4, 8, 3);
    s.limb([-37, 29], [36, 30], 11, 11);
    s.poly([
      [-43, 34],
      [-51, 55],
      [-39, 78],
      [-17, 78],
      [-10, 56],
      [-19, 35],
      [-27, 35],
      [-20, 55],
      [-23, 67],
      [-34, 67],
      [-39, 55],
      [-33, 35],
    ]);
    s.poly([
      [14, 33],
      [8, 54],
      [18, 79],
      [38, 76],
      [49, 57],
      [42, 35],
      [29, 25],
    ]);
    s.commit();
    oval(-30, 53, 10, 12, c.outline);
    poly(
      [
        [19, 37],
        [14, 55],
        [22, 71],
        [27, 67],
        [27, 36],
      ],
      c.light,
    );
    poly(
      [
        [29, 67],
        [35, 70],
        [42, 56],
        [36, 39],
        [29, 35],
      ],
      c.cloth,
    );
    line([-44, 55], [-39, 67], c.light, 3);
    line([28, 40], [28, 64], c.accent, 3);
    barkY = 25;
    barkW = 21;
  }
  if (k === "rootshuffler") {
    poly(
      [
        [-4, 14],
        [-2, 29],
        [-11, 39],
        [-15, 30],
      ],
      c.shade,
    );
    veins(
      [
        [
          [-20, 25],
          [-12, 31],
        ],
        [
          [10, 21],
          [22, 32],
        ],
        [
          [0, 18],
          [-5, 35],
        ],
      ],
      c.metal,
      1.5,
    );
  } else if (k === "vinecantor" || k === "biforktangler") {
    poly(
      [
        [-5, 19],
        [-8, 39],
        [-2, 55],
        [2, 50],
        [0, 26],
      ],
      c.shade,
    );
    veins(
      [
        [
          [1, 28],
          [-3, 46],
        ],
        [
          [12, 58],
          [23, 74],
        ],
        [
          [-19, 48],
          [-7, 42],
        ],
      ],
      c.light,
      2,
    );
    if (k === "biforktangler")
      veins(
        [
          [
            [-11, 60],
            [-25, 80],
          ],
          [
            [-17, 74],
            [-27, 70],
          ],
          [
            [13, 69],
            [26, 67],
          ],
        ],
        c.accent,
        2,
      );
  } else if (k === "wreathpod") {
    poly(
      [
        [-25, 20],
        [-32, 34],
        [-23, 30],
        [-15, 20],
      ],
      c.shade,
    );
    veins(
      [
        [
          [-25, 35],
          [-17, 45],
        ],
        [
          [16, 45],
          [24, 35],
        ],
        [
          [-4, 18],
          [3, 20],
        ],
      ],
      c.accent,
      2,
    );
  } else if (k === "bulbmaw") {
    poly(
      [
        [5, 30],
        [15, 43],
        [13, 60],
        [5, 67],
        [9, 47],
      ],
      c.shade,
    );
    veins(
      [
        [
          [-12, 42],
          [-3, 37],
        ],
        [
          [-12, 56],
          [-4, 60],
        ],
        [
          [9, 41],
          [15, 47],
        ],
      ],
      c.metal,
      2,
    );
    oval(2, 53, 3 + p.windup * 2, 7 + p.windup * 2, c.accent);
  } else if (k === "migratorycorolla") {
    veins(
      [
        [
          [-29, 56],
          [-14, 50],
        ],
        [
          [-19, 73],
          [-8, 55],
        ],
        [
          [7, 79],
          [10, 62],
        ],
        [
          [31, 66],
          [21, 52],
        ],
        [
          [35, 46],
          [23, 44],
        ],
      ],
      c.metalLight,
      2,
    );
    veins(
      [
        [
          [-27, 11],
          [-14, 24],
        ],
        [
          [13, 24],
          [29, 12],
        ],
      ],
      c.shade,
      3,
    );
  } else if (k === "pairedcalyx") {
    veins(
      [
        [
          [-42, 49],
          [-38, 63],
        ],
        [
          [-25, 70],
          [-19, 60],
        ],
        [
          [19, 59],
          [25, 67],
        ],
        [
          [33, 68],
          [40, 54],
        ],
        [
          [-20, 17],
          [-7, 26],
        ],
        [
          [12, 26],
          [29, 17],
        ],
      ],
      c.metalLight,
      2,
    );
    poly(
      [
        [4, 26],
        [11, 31],
        [19, 30],
        [13, 22],
      ],
      c.shade,
    );
  } else if (k === "boss") {
    veins(
      [
        [
          [-36, 10],
          [-19, 34],
        ],
        [
          [32, 10],
          [19, 37],
        ],
        [
          [4, 18],
          [6, 49],
        ],
        [
          [12, 65],
          [20, 91],
        ],
        [
          [24, 96],
          [23, 111],
        ],
      ],
      c.shade,
      3,
    );
    veins(
      [
        [
          [-33, 116],
          [-20, 106],
        ],
        [
          [-18, 113],
          [-15, 96],
        ],
        [
          [18, 113],
          [16, 96],
        ],
        [
          [31, 116],
          [25, 104],
        ],
      ],
      c.accent,
      2,
    );
    poly(
      [
        [-5, 72],
        [0, 65],
        [5, 73],
        [3, 88],
        [-1, 91],
      ],
      c.light,
    );
    oval(1, 89, 3 + p.windup, 5, c.eye);
  }
  const layers =
      (e.fractureUntil ?? 0) > w.time ? Math.min(2, e.fracture ?? 0) : 0,
    open = e.state === "recover" && e.root?.vulnerable,
    gap = open ? 6 : 2;
  for (const side of [-1, 1])
    poly(
      [
        [side * gap, barkY - 6],
        [side * barkW, barkY - 4],
        [side * (barkW + 2), barkY + 6],
        [side * (gap + 1), barkY + 8],
      ],
      layers === 2 ? c.metal : c.metalLight,
    );
  for (let i = 0; i < layers; i++) {
    const x = (i ? 1 : -1) * barkW * 0.65;
    line([x - 2, barkY + 7], [x + 2, barkY - 5], c.outline, 3);
  }
  if (open) line([-7, barkY], [7, barkY + 2], c.eye, 2);
  p.scale = originalScale;
  p.x = originalX;
}
