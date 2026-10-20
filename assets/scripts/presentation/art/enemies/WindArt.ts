import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { EnemyArt } from "../EnemyCatalog";
import type { Pose } from "../Actor";
import { Silhouette, detailPoly, detailLine, detailEllipse } from "../Brush";
/** Hollow ceramic wind birds. Body geometry, feet and wings belong to each role. */
export function drawWindBody(
  g: Graphics,
  w: SurvivalWorld,
  e: Enemy,
  art: EnemyArt,
  p: Pose,
) {
  const c = art.palette,
    k = e.kind === "minion" ? "fledglingeffigy" : e.kind,
    s = new Silhouette(g, p, c.base, c.outline, 2.5);
  const poly = (v: [number, number][], color = c.light) =>
    detailPoly(g, p, v, color);
  const line = (
    a: [number, number],
    b: [number, number],
    color = c.metal,
    width = 2,
  ) => detailLine(g, p, a, b, color, width);
  const oval = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    color = c.shade,
  ) => detailEllipse(g, p, x, y, rx, ry, color);
  const casting = e.state === "windup" || e.state === "charge",
    open = e.state === "recover" && e.wind?.vulnerable;
  const gait = p.stride;
  // Feet are the anchor; birds walk even when their wing silhouettes rise above them.
  if (k === "fledglingeffigy") {
    s.poly([
      [-18, 10],
      [-22, 23],
      [-11, 37],
      [7, 40],
      [19, 28],
      [16, 13],
      [4, 8],
    ]);
    s.poly([
      [-16, 19],
      [-29, 30],
      [-26, 15],
      [-21, 12],
    ]);
    s.poly([
      [-10, 12],
      [-11 + gait, 2],
      [-19 + gait, 1],
      [-17 + gait, 6],
      [-5, 15],
    ]);
    s.poly([
      [8, 12],
      [11 - gait, 3],
      [20 - gait, 1],
      [20 - gait, 6],
      [12, 17],
    ]);
    s.commit();
    poly(
      [
        [-18, 24],
        [-8, 34],
        [4, 35],
        [-4, 22],
      ],
      c.light,
    );
    oval(7, 28, 9, 10, c.shade);
    oval(8, 30, 4, 5, c.outline);
    poly(
      [
        [14, 27],
        [25, 23],
        [15, 20],
      ],
      c.metalLight,
    );
    line([-9, 14], [0, 18]);
  } else if (k === "reedwhistler") {
    s.poly([
      [-12, 17],
      [-11, 44],
      [-4, 48],
      [-6, 69],
      [0, 78],
      [8, 74],
      [10, 62],
      [23, 59],
      [24, 53],
      [7, 54],
      [9, 39],
      [15, 28],
      [9, 15],
    ]);
    s.poly([
      [-10, 40],
      [-23, 55],
      [-19, 59],
      [-4, 46],
    ]);
    s.poly([
      [7, 37],
      [19, 49],
      [22, 43],
      [12, 29],
    ]);
    for (const x of [-7, 7])
      s.poly([
        [x - 3, 20],
        [x - 3, 3],
        [x - 10, 1],
        [x + 4, 1],
        [x + 3, 21],
      ]);
    s.commit();
    poly(
      [
        [-7, 45],
        [-2, 50],
        [-2, 68],
        [3, 71],
        [4, 58],
        [2, 43],
      ],
      c.light,
    );
    oval(2, 65, 3, 5, c.outline);
    oval(21, 56, 3, 2, c.outline);
    line([-19, 54], [-10, 46], c.outline, 3);
    line([14, 43], [17, 46], c.outline, 3);
    poly(
      [
        [-10, 26],
        [3, 31],
        [8, 21],
        [-4, 17],
      ],
      c.cloth,
    );
    line([-4, 36], [4, 35]);
  } else if (k === "sickleplumer") {
    s.poly([
      [-22, 13],
      [-22, 31],
      [-7, 43],
      [13, 40],
      [23, 25],
      [17, 12],
    ]);
    s.poly([
      [-9, 36],
      [-18, 51],
      [-14, 65],
      [0, 76],
      [20, 74],
      [30, 62],
      [28, 52],
      [19, 61],
      [6, 63],
      [-2, 55],
      [3, 42],
    ]);
    s.poly([
      [13, 17],
      [31, 8],
      [29, 21],
      [18, 27],
    ]);
    for (const x of [-12, 12])
      s.poly([
        [x - 3, 15],
        [x - 3 + gait, 2],
        [x - 11 + gait, 1],
        [x + 4 + gait, 1],
        [x + 4, 17],
      ]);
    s.commit();
    poly(
      [
        [-15, 28],
        [-3, 38],
        [11, 35],
        [4, 24],
      ],
      c.light,
    );
    poly(
      [
        [-9, 54],
        [-8, 63],
        [2, 69],
        [18, 68],
        [24, 61],
        [8, 65],
      ],
      c.light,
    );
    oval(13, 28, 8, 9, c.shade);
    oval(14, 30, 3, 4, c.outline);
    poly(
      [
        [19, 28],
        [30, 24],
        [20, 22],
      ],
      c.metalLight,
    );
    line([-15, 22], [3, 17]);
  } else if (k === "foldedskimmer") {
    s.poly([
      [-5, 26],
      [-21, 45],
      [-31, 66],
      [-12, 58],
      [0, 43],
      [18, 65],
      [33, 72],
      [26, 47],
      [11, 28],
    ]);
    s.poly([
      [-7, 40],
      [6, 49],
      [15, 39],
      [11, 26],
      [-2, 21],
      [-11, 30],
    ]);
    s.poly([
      [-7, 26],
      [-24, 7],
      [-28, 4],
      [-20, 4],
      [1, 23],
    ]);
    s.poly([
      [6, 26],
      [19, 7],
      [30, 3],
      [17, 2],
      [0, 22],
    ]);
    s.poly([
      [-8, 29],
      [-20, 18],
      [-22, 3],
      [-15, 11],
      [0, 25],
    ]);
    s.commit();
    poly(
      [
        [-25, 61],
        [-15, 54],
        [-4, 39],
        [-10, 43],
      ],
      c.light,
    );
    poly(
      [
        [5, 40],
        [21, 61],
        [29, 66],
        [20, 48],
      ],
      c.light,
    );
    oval(5, 38, 5, 6, c.shade);
    poly(
      [
        [10, 37],
        [23, 32],
        [11, 31],
      ],
      c.metalLight,
    );
    line([-10, 32], [0, 28]);
  } else if (k === "windarbiter") {
    s.poly([
      [-22, 13],
      [-19, 51],
      [-12, 69],
      [-15, 81],
      [-8, 90],
      [10, 87],
      [18, 74],
      [12, 58],
      [25, 40],
      [19, 14],
    ]);
    for (const [x, h] of [
      [-16, 101],
      [-5, 114],
      [7, 105],
      [18, 96],
    ])
      s.poly([
        [x - 4, 69],
        [x - 5, h - 4],
        [x, h],
        [x + 5, h - 2],
        [x + 3, 68],
      ]);
    s.poly([
      [-12, 58],
      [-39, 76],
      [-34, 47],
      [-19, 35],
    ]);
    s.poly([
      [13, 55],
      [35, 64],
      [40, 49],
      [22, 36],
    ]);
    for (const x of [-12, 12])
      s.poly([
        [x - 4, 20],
        [x - 6, 3],
        [x - 16, 1],
        [x + 7, 1],
        [x + 4, 20],
      ]);
    s.commit();
    poly(
      [
        [-15, 51],
        [-7, 70],
        [8, 67],
        [11, 48],
        [-1, 40],
      ],
      c.light,
    );
    for (const [x, h] of [
      [-16, 101],
      [-5, 114],
      [7, 105],
      [18, 96],
    ])
      oval(x, h - 9, 2.5, 5, c.outline);
    oval(0, 77, 9, 8, c.shade);
    oval(2, 79, 4, 4, c.outline);
    poly(
      [
        [10, 76],
        [26, 69],
        [10, 67],
      ],
      c.metalLight,
    );
    for (const x of [-27, 27]) {
      oval(x, 55, 3, 6, c.outline);
      line([x - 4, 42], [x + 3, 45]);
    }
    poly(
      [
        [-16, 28],
        [0, 36],
        [17, 28],
        [12, 16],
        [-12, 16],
      ],
      c.cloth,
    );
  } else if (k === "plumejudge") {
    s.poly([
      [-14, 25],
      [-17, 47],
      [-4, 61],
      [12, 59],
      [20, 48],
      [12, 31],
      [6, 21],
    ]);
    s.poly([
      [-9, 49],
      [-34, 66],
      [-50, 83],
      [-48, 96],
      [-27, 92],
      [-7, 73],
      [4, 55],
    ]);
    s.poly([
      [10, 39],
      [28, 52],
      [47, 51],
      [43, 44],
      [23, 36],
    ]);
    s.poly([
      [-4, 29],
      [-16, 9],
      [-30, 1],
      [-9, 4],
      [1, 15],
      [14, 2],
      [34, 0],
      [20, 8],
      [7, 28],
    ]);
    for (const x of [-8, 8])
      s.poly([
        [x - 3, 27],
        [x - 4, 3],
        [x - 12, 1],
        [x + 5, 1],
        [x + 3, 28],
      ]);
    s.commit();
    poly(
      [
        [-43, 87],
        [-30, 85],
        [-10, 67],
        [-19, 72],
      ],
      c.light,
    );
    poly(
      [
        [22, 44],
        [38, 47],
        [43, 45],
        [23, 40],
      ],
      c.light,
    );
    oval(6, 51, 8, 9, c.shade);
    oval(7, 53, 3, 4, c.outline);
    poly(
      [
        [13, 50],
        [20, 42],
        [18, 30],
        [13, 41],
      ],
      c.metalLight,
    );
    line([-14, 39], [4, 31]);
    line([-24, 78], [-13, 69], c.metalLight, 3);
  } else {
    // Suspended owl: broad broken arch wings, short circular face, feet and a long split tail.
    s.poly([
      [-21, 24],
      [-28, 52],
      [-21, 78],
      [0, 87],
      [22, 79],
      [29, 55],
      [18, 24],
    ]);
    s.poly([
      [-20, 66],
      [-38, 94],
      [-65, 108],
      [-80, 100],
      [-72, 73],
      [-52, 57],
      [-61, 83],
      [-47, 81],
      [-34, 54],
      [-19, 38],
    ]);
    s.poly([
      [18, 63],
      [35, 81],
      [58, 87],
      [76, 77],
      [72, 52],
      [58, 43],
      [61, 66],
      [48, 65],
      [33, 43],
      [20, 33],
    ]);
    s.poly([
      [-8, 30],
      [-16, 0],
      [-9, 5],
      [0, -14],
      [8, 3],
      [15, -2],
      [9, 32],
    ]);
    for (const x of [-18, 18])
      s.poly([
        [x - 4, 29],
        [x - 5, 4],
        [x - 14, 1],
        [x + 9, 1],
        [x + 5, 27],
      ]);
    s.commit();
    poly(
      [
        [-70, 99],
        [-62, 102],
        [-41, 90],
        [-26, 64],
        [-38, 73],
        [-51, 88],
        [-65, 87],
      ],
      c.light,
    );
    poly(
      [
        [30, 68],
        [46, 79],
        [59, 79],
        [68, 73],
        [67, 62],
        [57, 70],
        [43, 70],
      ],
      c.light,
    );
    oval(0, 63, 24, 23, c.light);
    oval(-9, 65, 9, 12, c.shade);
    oval(10, 65, 9, 12, c.shade);
    oval(-8, 66, 4, 5, c.outline);
    oval(10, 66, 4, 5, c.outline);
    oval(-7, 68, 1.5, 2, c.eye);
    oval(11, 68, 1.5, 2, c.eye);
    poly(
      [
        [-4, 59],
        [5, 59],
        [9, 52],
        [1, 43],
        [-1, 51],
      ],
      c.metalLight,
    );
    poly(
      [
        [-17, 40],
        [0, 33],
        [17, 40],
        [13, 27],
        [-12, 27],
      ],
      c.cloth,
    );
    line([-56, 84], [-43, 66], c.metalLight, 3);
    line([49, 66], [39, 51], c.metalLight, 3);
  }
  // A small ceramic seam opens on recovery; attack status is visible without covering the body.
  if (k !== "fledglingeffigy") {
    const y = k === "boss" ? 34 : k === "windarbiter" ? 33 : 24;
    line([-7, y], [0, y - 4], open ? c.accent : c.metal, open ? 4 : 2);
    line([0, y - 4], [8, y + 2], open ? c.accent : c.metal, open ? 4 : 2);
    if (casting) {
      oval(-3, y + 8, 2, 2, c.eye);
      oval(4, y + 10, 2, 2, c.eye);
    }
  }
}
