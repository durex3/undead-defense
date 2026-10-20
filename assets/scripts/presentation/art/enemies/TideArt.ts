import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { EnemyArt } from "../EnemyCatalog";
import type { Pose } from "../Actor";
import { Silhouette, detailPoly, detailLine, detailEllipse } from "../Brush";
const WAX_COATS: Record<string, readonly [number, number, number]> = {
  brineporter: [18, 34, 9],
  sluiceray: [24, 16, 5],
  sailharpooner: [10, 33, 7],
  winchbeast: [20, 19, 6],
  twinlockwarden: [29, 36, 11],
  severedcrane: [24, 67, 5],
  boss: [37, 26, 10],
};

/** Seven original dock silhouettes: basket, ray, sail, winch, gates, gantry and living wreck. */
export function drawTideBody(
  g: Graphics,
  w: SurvivalWorld,
  e: Enemy,
  art: EnemyArt,
  p: Pose,
) {
  const c = art.palette,
    s = new Silhouette(g, p, c.base, c.outline, 2.5),
    k = e.kind;
  const poly = (v: [number, number][], color = c.light) =>
    detailPoly(g, p, v, color);
  const line = (
    a: [number, number],
    b: [number, number],
    color = c.metalLight,
    width = 3,
  ) => detailLine(g, p, a, b, color, width);
  const ring = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    color = c.metal,
  ) => detailEllipse(g, p, x, y, rx, ry, color);
  if (k === "boss") {
    s.poly([
      [-53, 28],
      [-47, 52],
      [-22, 46],
      [0, 51],
      [25, 45],
      [55, 62],
      [43, 22],
      [22, 10],
      [-30, 9],
    ]);
    s.poly([
      [-3, 43],
      [-4, 100],
      [3, 100],
      [6, 43],
    ]);
    s.poly([
      [5, 96],
      [34, 70],
      [8, 72],
      [22, 57],
      [5, 59],
    ]);
    for (const x of [-34, -12, 16, 34])
      s.poly([
        [x - 5, 15],
        [x + 7, 16],
        [x + 13, 3],
        [x + 1, 2],
      ]);
    s.commit();
    poly(
      [
        [-46, 40],
        [-22, 36],
        [3, 39],
        [35, 34],
        [48, 49],
        [38, 23],
        [17, 16],
        [-31, 17],
      ],
      c.shade,
    );
    poly(
      [
        [6, 91],
        [28, 72],
        [10, 75],
        [18, 61],
        [7, 64],
      ],
      c.cloth,
    );
    for (const x of [-30, -10, 12]) {
      line([x, 21], [x - 5, 43], c.metal, 4);
      ring(x + 3, 30, 5, 6, c.outline);
      ring(x + 4, 31, 2, 3, c.eye);
    }
    line([-38, 47], [31, 42], c.light, 3);
    line([42, 35], [53, 47], c.eye, 3);
    line([-44, 34], [-56, 15], c.metal, 4);
    poly(
      [
        [-62, 20],
        [-56, 10],
        [-46, 12],
        [-50, 5],
        [-61, 4],
        [-68, 13],
      ],
      c.metal,
    );
  } else if (k === "sluiceray") {
    s.poly([
      [-36, 15],
      [-14, 36],
      [0, 30],
      [15, 36],
      [36, 15],
      [20, 12],
      [8, 4],
      [-9, 4],
      [-22, 12],
    ]);
    s.poly([
      [0, 8],
      [14, 0],
      [19, 2],
      [4, 19],
    ]);
    s.commit();
    poly(
      [
        [-31, 16],
        [-14, 30],
        [-8, 17],
      ],
      c.cloth,
    );
    poly(
      [
        [31, 16],
        [14, 30],
        [8, 17],
      ],
      c.cloth,
    );
    ring(0, 27, 10, 8);
    line([-8, 27], [8, 27]);
    line([0, 20], [0, 34]);
    ring(-5, 15, 2, 2, c.eye);
    ring(5, 15, 2, 2, c.eye);
  } else if (k === "sailharpooner") {
    s.poly([
      [-9, 5],
      [-3, 5],
      [0, 26],
      [5, 3],
      [12, 3],
      [8, 35],
      [-8, 35],
    ]);
    s.poly([
      [-8, 32],
      [-11, 55],
      [-3, 63],
      [9, 56],
      [10, 32],
    ]);
    s.poly([
      [-9, 34],
      [-31, 62],
      [-23, 27],
    ]);
    s.poly([
      [8, 37],
      [28, 44],
      [30, 38],
      [9, 28],
    ]);
    s.commit();
    poly(
      [
        [-26, 55],
        [-12, 35],
        [-22, 31],
      ],
      c.cloth,
    );
    poly(
      [
        [-7, 51],
        [5, 53],
        [6, 42],
        [-6, 40],
      ],
      c.shade,
    );
    line([-3, 47], [4, 48], c.eye, 2);
    line([25, 17], [27, 65], c.metal, 3);
    poly(
      [
        [27, 69],
        [20, 58],
        [26, 62],
        [32, 59],
      ],
      c.metalLight,
    );
  } else if (k === "winchbeast") {
    for (const x of [-23, 18])
      for (const side of [-1, 1])
        s.poly([
          [x, 20],
          [x + side * 8, 11],
          [x + side * 12, 2],
          [x + side * 2, 2],
          [x - 4, 16],
        ]);
    s.poly([
      [-27, 14],
      [-25, 30],
      [-10, 38],
      [18, 34],
      [30, 20],
      [24, 12],
    ]);
    s.commit();
    poly(
      [
        [-22, 29],
        [-9, 33],
        [20, 29],
        [23, 20],
        [-21, 20],
      ],
      c.shade,
    );
    ring(-1, 30, 12, 9);
    ring(-1, 30, 6, 5, c.shade);
    line([-15, 30], [13, 30]);
    line([23, 20], [35, 12], c.metal, 3);
    poly(
      [
        [30, 15],
        [34, 7],
        [43, 9],
        [40, 3],
        [30, 3],
        [26, 10],
      ],
      c.metalLight,
    );
    ring(22, 22, 2, 2, c.eye);
  } else if (k === "twinlockwarden") {
    for (const x of [-12, 12])
      s.poly([
        [x - 5, 4],
        [x + 6, 4],
        [x + 9, 28],
        [x - 7, 29],
      ]);
    s.poly([
      [-20, 23],
      [-18, 55],
      [-9, 66],
      [10, 66],
      [20, 53],
      [21, 23],
    ]);
    for (const x of [-25, 25])
      s.poly([
        [x - 11, 28],
        [x - 11, 70],
        [x + 10, 70],
        [x + 12, 28],
      ]);
    s.commit();
    for (const x of [-25, 25]) {
      poly(
        [
          [x - 8, 32],
          [x - 8, 66],
          [x + 7, 66],
          [x + 8, 32],
        ],
        c.shade,
      );
      line([x - 5, 41], [x + 5, 41]);
      line([x - 5, 56], [x + 5, 56]);
    }
    poly(
      [
        [-10, 60],
        [9, 60],
        [11, 48],
        [-12, 48],
      ],
      c.outline,
    );
    line([-5, 54], [5, 54], c.eye, 3);
    line([-12, 31], [12, 31], c.metal, 5);
  } else if (k === "severedcrane") {
    for (const x of [-24, 0, 24])
      s.poly([
        [x - 4, 2],
        [x + 5, 2],
        [x * 0.4 + 5, 42],
        [x * 0.4 - 5, 42],
      ]);
    s.poly([
      [-31, 42],
      [-31, 73],
      [30, 73],
      [30, 65],
      [-23, 65],
      [-22, 42],
    ]);
    s.commit();
    line([-25, 68], [23, 68], c.light, 4);
    line([-23, 44], [1, 66], c.metal, 4);
    line([23, 64], [23, 34], c.metal, 2);
    poly(
      [
        [19, 39],
        [23, 30],
        [31, 33],
        [28, 25],
        [19, 25],
        [14, 33],
      ],
      c.metalLight,
    );
    ring(-8, 47, 9, 8, c.shade);
    ring(-7, 48, 3, 3, c.eye);
  } else {
    s.poly([
      [-15, 3],
      [-4, 4],
      [0, 20],
      [6, 4],
      [18, 3],
      [13, 11],
      [8, 25],
      [-10, 25],
      [-16, 12],
    ]);
    s.poly([
      [-20, 20],
      [-23, 49],
      [-14, 57],
      [14, 57],
      [23, 47],
      [20, 20],
    ]);
    s.ellipse(0, 52, 9, 9, 8);
    s.commit();
    poly(
      [
        [-17, 26],
        [-19, 46],
        [16, 46],
        [17, 26],
      ],
      c.cloth,
    );
    line([-14, 34], [14, 34], c.metal, 3);
    line([-7, 27], [-9, 45], c.metal, 3);
    line([7, 27], [9, 45], c.metal, 3);
    poly(
      [
        [-7, 54],
        [7, 54],
        [6, 47],
        [-6, 47],
      ],
      c.shade,
    );
    line([-3, 51], [3, 51], c.eye, 2);
  }
  // Attached wax plates retain each dock creature's original silhouette.
  const bounds = WAX_COATS[k];
  if (bounds) {
    const [width, y, height] = bounds,
      fracture =
        (e.fractureUntil ?? 0) > w.time ? Math.min(2, e.fracture ?? 0) : 0,
      open = e.state === "recover" && !!e.tide?.vulnerable,
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
        fracture === 2 ? "#817f70" : open ? "#aaa88a" : "#b9b395",
      );
      line(
        [side * (gap + 2), y + height - 2],
        [side * (width - 4), y + height],
        "#dfd4ae",
        2,
      );
    }
    for (let i = 0; i < fracture; i++) {
      const x = (i === 0 ? -1 : 1) * width * 0.55;
      poly(
        [
          [x - 2, y + height],
          [x + 2, y + 2],
          [x - 2, y - 1],
          [x + 2, y - height],
          [x + 5, y],
          [x + 2, y + 4],
        ],
        c.outline,
      );
    }
  }
  if (e.tide?.vulnerable && e.state === "recover")
    line([-12, 19], [12, 29], c.eye, 3);
}
