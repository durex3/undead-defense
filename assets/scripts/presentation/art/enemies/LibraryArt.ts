import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { EnemyArt } from "../EnemyCatalog";
import type { Pose } from "../Actor";
import { Silhouette, detailPoly, detailLine, detailEllipse } from "../Brush";
/** Bound paper creatures: folded pages, hard covers and copper joints, anchored on real feet. */
export function drawLibraryBody(
  g: Graphics,
  w: SurvivalWorld,
  e: Enemy,
  art: EnemyArt,
  p: Pose,
) {
  const c = art.palette,
    k = e.kind === "minion" ? "paperbonegrub" : e.kind,
    s = new Silhouette(g, p, c.base, c.outline, 2.5);
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
  const open = e.state === "recover" && e.library?.vulnerable,
    cast = e.state === "windup",
    gait = p.stride;
  if (k === "paperbonegrub") {
    s.poly([
      [-29, 14],
      [-25, 27],
      [-13, 32],
      [-4, 28],
      [5, 34],
      [18, 30],
      [27, 20],
      [20, 10],
      [-9, 8],
    ]);
    for (const x of [-18, 0, 17])
      s.poly([
        [x - 3, 15],
        [x - 8 - gait, 4],
        [x - 13 - gait, 1],
        [x - 5 - gait, 0],
        [x + 4, 12],
      ]);
    s.commit();
    poly(
      [
        [-23, 23],
        [-13, 28],
        [-6, 22],
        [4, 29],
        [14, 25],
        [5, 17],
        [-8, 16],
      ],
      c.light,
    );
    poly(
      [
        [10, 28],
        [22, 23],
        [18, 13],
        [7, 12],
      ],
      c.cloth,
    );
    oval(17, 22, 3, 4, c.outline);
    line([-18, 13], [-8, 18]);
    line([-2, 14], [4, 22], c.shade);
  } else if (k === "sealclerk") {
    s.poly([
      [-14, 21],
      [-15, 69],
      [-7, 78],
      [11, 74],
      [15, 24],
      [4, 16],
    ]);
    s.poly([
      [9, 47],
      [25, 55],
      [30, 48],
      [24, 29],
      [18, 27],
      [17, 42],
    ]);
    s.poly([
      [20, 33],
      [34, 32],
      [35, 22],
      [19, 22],
    ]);
    s.poly([
      [-13, 27],
      [-21, 12],
      [-26, 1],
      [-16, 3],
      [-5, 26],
    ]);
    s.poly([
      [8, 25],
      [17, 8],
      [25, 1],
      [13, 1],
      [1, 23],
    ]);
    s.commit();
    poly(
      [
        [-10, 68],
        [-5, 72],
        [4, 68],
        [6, 30],
        [-5, 24],
      ],
      c.light,
    );
    poly(
      [
        [-13, 68],
        [-9, 72],
        [-7, 25],
        [-12, 26],
      ],
      c.metal,
    );
    oval(0, 56, 5, 8, c.outline);
    line([-4, 43], [4, 40], c.shade);
    line([-5, 35], [5, 33], c.shade);
    poly(
      [
        [21, 30],
        [32, 29],
        [32, 25],
        [22, 25],
      ],
      cast ? c.accent : c.metalLight,
    );
    poly(
      [
        [3, 23],
        [8, 16],
        [5, 4],
        [0, 10],
      ],
      c.cloth,
    );
  } else if (k === "folioray") {
    s.poly([
      [-3, 12],
      [-29, 19],
      [-42, 38],
      [-33, 46],
      [-9, 32],
      [1, 37],
      [23, 31],
      [39, 42],
      [43, 24],
      [20, 9],
      [5, 6],
    ]);
    s.poly([
      [-13, 15],
      [-16 + gait, 3],
      [-24 + gait, 1],
      [-10 + gait, 1],
      [-5, 15],
    ]);
    s.poly([
      [10, 16],
      [17 - gait, 3],
      [27 - gait, 1],
      [12 - gait, 1],
      [4, 14],
    ]);
    s.commit();
    poly(
      [
        [-34, 39],
        [-28, 38],
        [-8, 27],
        [-4, 18],
        [-27, 26],
      ],
      c.light,
    );
    poly(
      [
        [4, 28],
        [22, 23],
        [35, 32],
        [33, 21],
        [13, 14],
      ],
      c.light,
    );
    poly(
      [
        [-6, 31],
        [3, 34],
        [9, 24],
        [5, 10],
        [-3, 10],
      ],
      c.metal,
    );
    oval(0, 24, 3, 4, c.eye);
    line([-28, 32], [-12, 25], c.shade);
    line([15, 20], [29, 26], c.shade);
  } else if (k === "spineclasp") {
    s.poly([
      [-24, 13],
      [-34, 43],
      [-25, 54],
      [-10, 46],
      [1, 27],
      [18, 48],
      [32, 52],
      [35, 20],
      [20, 10],
    ]);
    s.poly([
      [-21, 17],
      [-29, 3],
      [-35, 1],
      [-20, 1],
      [-10, 15],
    ]);
    s.poly([
      [19, 16],
      [27, 2],
      [36, 1],
      [22, 0],
      [9, 15],
    ]);
    s.commit();
    poly(
      [
        [-29, 42],
        [-24, 48],
        [-13, 42],
        [-3, 22],
        [-13, 25],
      ],
      c.light,
    );
    poly(
      [
        [8, 24],
        [20, 42],
        [28, 46],
        [28, 25],
        [19, 19],
      ],
      c.light,
    );
    poly(
      [
        [-17, 14],
        [-6, 25],
        [8, 23],
        [21, 14],
        [10, 9],
        [-5, 9],
      ],
      c.cloth,
    );
    oval(-3, 20, 4, 3, c.outline);
    oval(9, 19, 3, 3, c.outline);
    line([-23, 38], [-14, 29]);
    line([21, 38], [22, 29]);
  } else if (k === "sealprovost") {
    s.poly([
      [-9, 22],
      [-11, 93],
      [-3, 103],
      [7, 98],
      [12, 27],
      [4, 19],
    ]);
    for (const [y, width] of [
      [42, 30],
      [64, 24],
      [85, 19],
    ]) {
      s.poly([
        [-width, y - 5],
        [-width, y + 12],
        [width - 4, y + 15],
        [width, y - 5],
        [width - 7, y - 5],
        [width - 9, y + 6],
        [-width + 7, y + 5],
        [-width + 7, y - 5],
      ]);
    }
    for (const x of [-22, -8, 10, 26])
      s.poly([
        [x - 3, 29],
        [x - 5, 8],
        [x - 13, 1],
        [x + 3, 1],
        [x + 5, 26],
      ]);
    s.commit();
    poly(
      [
        [-4, 94],
        [2, 98],
        [7, 31],
        [1, 26],
      ],
      c.light,
    );
    for (const [x, y] of [
      [-20, 46],
      [19, 45],
      [-15, 68],
      [15, 68],
      [-10, 89],
      [11, 90],
    ])
      oval(x, y, 3, 4, cast ? c.accent : c.metal);
    poly(
      [
        [-9, 74],
        [7, 76],
        [6, 56],
        [-7, 54],
      ],
      c.cloth,
    );
    oval(0, 66, 4, 6, c.outline);
    line([-15, 34], [18, 34]);
    line([-6, 27], [7, 23], c.metalLight, 3);
  } else if (k === "claspjailer") {
    s.poly([
      [-45, 15],
      [-50, 40],
      [-37, 58],
      [-20, 54],
      [-9, 62],
      [10, 57],
      [24, 67],
      [45, 57],
      [51, 30],
      [37, 12],
      [-8, 8],
    ]);
    s.poly([
      [-41, 20],
      [-43, 5],
      [-53, 1],
      [-34, 1],
      [-27, 17],
    ]);
    s.poly([
      [-14, 17],
      [-12, 2],
      [-2, 0],
      [6, 2],
      [-2, 19],
    ]);
    s.poly([
      [32, 20],
      [40, 4],
      [51, 1],
      [34, 0],
      [24, 17],
    ]);
    s.commit();
    poly(
      [
        [-43, 39],
        [-35, 51],
        [-23, 47],
        [-19, 25],
        [-34, 22],
      ],
      c.light,
    );
    poly(
      [
        [-14, 52],
        [-8, 56],
        [5, 51],
        [8, 22],
        [-9, 20],
      ],
      c.light,
    );
    poly(
      [
        [24, 59],
        [40, 52],
        [43, 32],
        [30, 20],
        [18, 25],
      ],
      c.light,
    );
    poly(
      [
        [-19, 51],
        [-14, 55],
        [-7, 13],
        [-14, 12],
      ],
      c.metal,
    );
    poly(
      [
        [9, 54],
        [16, 58],
        [25, 18],
        [16, 15],
      ],
      c.metal,
    );
    oval(32, 40, 7, 8, c.outline);
    oval(33, 42, 3, 4, c.eye);
    line([-34, 36], [-25, 34], c.shade);
    line([-7, 42], [3, 40], c.shade);
  } else {
    const spread = e.bossPhase === 1 ? 0 : e.bossPhase === 2 ? 8 : 16,
      raise = cast ? 4 : 0;
    s.poly([
      [-10, 27],
      [-14, 103],
      [0, 112],
      [13, 103],
      [12, 25],
      [0, 15],
    ]);
    s.poly([
      [-9, 97],
      [-34 - spread, 113 + raise],
      [-53 - spread, 104 + raise],
      [-48 - spread, 46],
      [-13, 25],
    ]);
    s.poly([
      [9, 97],
      [32 + spread, 110 + raise],
      [54 + spread, 100 + raise],
      [49 + spread, 43],
      [12, 25],
    ]);
    for (const x of [-34, -12, 14, 37])
      s.poly([
        [x - 5, 35],
        [x - 7, 9],
        [x - 17, 2],
        [x + 3, 1],
        [x + 7, 30],
      ]);
    s.poly([
      [-7, 29],
      [-8, -3],
      [-2, 3],
      [2, -8],
      [7, 5],
      [9, 29],
    ]);
    s.commit();
    poly(
      [
        [-14, 94],
        [-33 - spread, 105 + raise],
        [-47 - spread, 99 + raise],
        [-42 - spread, 51],
        [-16, 34],
      ],
      c.light,
    );
    poly(
      [
        [14, 94],
        [32 + spread, 103 + raise],
        [46 + spread, 96 + raise],
        [43 + spread, 49],
        [16, 33],
      ],
      c.light,
    );
    poly(
      [
        [-8, 103],
        [0, 107],
        [8, 102],
        [9, 32],
        [0, 26],
        [-8, 32],
      ],
      c.metal,
    );
    poly(
      [
        [-26, 81],
        [-17, 91],
        [16, 89],
        [29, 76],
        [22, 52],
        [5, 43],
        [-17, 51],
      ],
      c.bone,
    );
    oval(-11, 72, 8, 10, c.shade);
    oval(13, 71, 8, 10, c.shade);
    oval(-10, 73, 3, 5, c.eye);
    oval(12, 72, 3, 5, c.eye);
    poly(
      [
        [-3, 61],
        [5, 61],
        [8, 54],
        [0, 49],
        [-5, 54],
      ],
      c.shade,
    );
    line([-16, 47], [18, 47], c.outline, 3);
    for (const y of [48, 61, 91]) {
      line([-40 - spread, y + 6], [-27, y], c.shade, 2);
      line([26, y], [40 + spread, y + 4], c.shade, 2);
    }
    poly(
      [
        [-20, 32],
        [-20, 3],
        [-12, 12],
        [-9, 34],
      ],
      c.cloth,
    );
    poly(
      [
        [17, 33],
        [22, -1],
        [28, 8],
        [25, 35],
      ],
      c.cloth,
    );
  }
  if (k !== "paperbonegrub") {
    const y = k === "boss" ? 40 : k === "sealprovost" ? 32 : 22;
    line([-7, y], [0, y - 4], open ? c.accent : c.metal, open ? 4 : 2);
    line([0, y - 4], [7, y + 1], open ? c.accent : c.metal, open ? 4 : 2);
  }
}
