import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { EnemyArt } from "../EnemyCatalog";
import type { Pose } from "../Actor";
import { Silhouette, detailPoly, detailLine, detailEllipse } from "../Brush";
/** Ceramic bellies, short refractory feet and visible spouts; no cloth/loom frame. */
export function drawKilnBody(
  g: Graphics,
  w: SurvivalWorld,
  e: Enemy,
  art: EnemyArt,
  p: Pose,
) {
  const c = art.palette,
    k = e.kind === "minion" ? "glazeling" : e.kind,
    s = new Silhouette(g, p, c.base, c.outline, 2.7);
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
  if (k === "kilnvalve") {
    s.poly([
      [-14, 0],
      [-16, 9],
      [-9, 16],
      [-8, 27],
      [8, 27],
      [9, 16],
      [16, 9],
      [14, 0],
    ]);
    s.commit();
    oval(0, 22, 13, 5, c.metalLight);
    line([-12, 22], [12, 22], c.outline, 2);
    line([0, 12], [0, 31], c.eye, 3);
    oval(0, 8, 7, 4, c.accent);
    return;
  }
  const boss = k === "boss",
    jailer = k === "glazejailer",
    twin = k === "splitcrucible",
    sled = k === "ashsled",
    small = k === "glazeling";
  const wide = boss
      ? 48
      : jailer
        ? 43
        : twin
          ? 36
          : sled
            ? 33
            : small
              ? 18
              : 25,
    top = boss ? 82 : jailer ? 55 : twin ? 67 : sled ? 35 : small ? 40 : 57;
  for (const side of [-1, 1])
    for (let i = 0; i < (small ? 1 : 2); i++) {
      const x = side * (wide - 8),
        y = 4 + i * 9;
      s.poly([
        [x - 6, y + 9],
        [x - 8 + p.stride * (i ? 1 : -1), y],
        [x + 7 + p.stride * (i ? 1 : -1), y],
        [x + 5, y + 9],
      ]);
    }
  if (boss || jailer || twin)
    for (let i = 0; i < (boss ? 3 : twin ? 2 : 1); i++) {
      const x = (i - (boss ? 1 : twin ? 0.5 : 0)) * 25;
      s.poly([
        [x - 8, top - 5],
        [x - 9, top + 20 + i * 5],
        [x + 7, top + 20 + i * 5],
        [x + 8, top - 5],
      ]);
    }
  s.poly([
    [-wide, 18],
    [-wide - 3, top * 0.58],
    [-wide * 0.72, top - 3],
    [-wide * 0.25, top + 3],
    [wide * 0.55, top],
    [wide, top * 0.65],
    [wide, 18],
    [wide * 0.6, 8],
    [-wide * 0.65, 8],
  ]);
  s.commit();
  oval(-wide * 0.12, top * 0.54, wide * 0.76, top * 0.35, c.base);
  oval(-wide * 0.24, top * 0.65, wide * 0.47, top * 0.18, c.light);
  for (let i = 0; i < 3; i++) {
    const x = -wide * 0.5 + i * wide * 0.4;
    line([x, top * 0.8], [x - 5, top * 0.58], c.shade, 2);
    line([x - 5, top * 0.58], [x + 4, top * 0.4], c.shade, 2);
  }
  const open = e.state === "recover",
    jaw = boss ? 27 : small ? 9 : 18;
  poly(
    [
      [-jaw, top * 0.38],
      [jaw, top * 0.38],
      [jaw - 3, top * 0.16],
      [-jaw + 3, top * 0.16],
    ],
    c.outline,
  );
  oval(0, top * 0.28, jaw * 0.65, open ? 8 : 4, c.accent);
  line([-jaw, top * 0.4], [jaw, top * 0.4], c.bone, 4);
  for (const side of [-1, 1]) {
    oval(side * wide * 0.33, top * 0.62, 3, 3, c.outline);
    oval(side * wide * 0.33, top * 0.64, 1.5, 1.5, c.eye);
  }
  if (k === "kilnstoker") {
    oval(21, 36, 13, 16, c.metal);
    line([10, 33], [31, 33], c.bone, 4);
    oval(21, 43, 6, 4, c.eye);
  }
  if (k === "forkmason" || boss) {
    for (const side of [-1, 1]) {
      const x = side * (wide - 3),
        spread = boss ? 8 + e.bossPhase * 4 : 11;
      line([x, 24], [x, top * 0.72], c.metalLight, 5);
      line([x, top * 0.72], [x + side * spread, top * 0.72 + 13], c.bone, 5);
      line([x, top * 0.72], [x - side * 8, top * 0.72 + 13], c.bone, 4);
    }
  }
  if (sled || jailer) {
    for (const side of [-1, 1]) {
      oval(side * (wide - 5), 14, 10, 10, c.shade);
      oval(side * (wide - 5), 14, 5, 5, c.metalLight);
    }
    poly(
      [
        [wide - 5, 29],
        [wide + 16, 35],
        [wide + 20, 29],
        [wide + 8, 20],
      ],
      c.bone,
    );
  }
  if (twin)
    for (const side of [-1, 1]) {
      oval(side * 28, top - 5, 14, 20, c.metal);
      oval(side * 28, top + 8, 10, 4, c.outline);
    }
  if (boss)
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 25;
      oval(x, top + 20 + i * 5, 9, 4, c.shade);
      oval(x, top + 20 + i * 5, 5, 2, i < e.bossPhase ? c.eye : c.metal);
    }
}
