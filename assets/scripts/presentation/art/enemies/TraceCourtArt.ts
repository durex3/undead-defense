import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { EnemyArt } from "../EnemyCatalog";
import type { Pose } from "../Actor";
import { Silhouette, detailLine, detailEllipse, detailPoly } from "../Brush";
export function drawTraceBody(
  g: Graphics,
  w: SurvivalWorld,
  e: Enemy,
  art: EnemyArt,
  p: Pose,
) {
  const c = art.palette,
    boss = e.kind === "boss",
    small = e.kind === "shackleshard" || e.kind === "minion",
    hunter = boss ? e.trace?.life === 2 : e.kind === "trailhound",
    tall = e.kind === "trailmarshal",
    top = boss ? (hunter ? 112 : 76) : small ? 32 : tall ? 84 : 64,
    wide = boss ? 46 : small ? 20 : 30;
  const s = new Silhouette(g, p, c.bone, c.outline, 2.5);
  for (const side of [-1, 1]) {
    s.limb(
      [side * 10, small ? 18 : 35],
      [side * (hunter ? 23 : wide), 0],
      small ? 3 : 6,
      2,
    );
    if (!hunter)
      s.limb(
        [side * 22, small ? 20 : 30],
        [side * (wide + 8), 8],
        small ? 2 : 5,
        2,
      );
    if (!small) {
      s.limb([side * 14, top - 22], [side * (hunter ? 48 : 38), 24], 6, 3);
      s.poly([
        [side * 35, 30],
        [side * 56, 20],
        [side * 44, 4],
        [side * 41, 20],
      ]);
    }
  }
  s.poly([
    [-12, small ? 8 : 25],
    [12, small ? 8 : 25],
    [18, top - 20],
    [0, top - 8],
    [-18, top - 20],
  ]);
  s.ellipse(0, top - 8, small ? 10 : 13, small ? 9 : 15);
  if (!hunter && !small)
    s.poly([
      [-wide - 7, top - 30],
      [wide + 7, top - 30],
      [wide + 10, top - 8],
      [-wide - 10, top - 8],
    ]);
  if (tall)
    s.poly([
      [-8, top - 6],
      [0, top + 24],
      [8, top - 6],
    ]);
  s.commit();
  if (!small)
    for (const side of [-1, 1]) {
      detailEllipse(
        g,
        p,
        side * (hunter ? 20 : wide - 6),
        top - 20,
        8,
        8,
        c.metal,
      );
      for (let i = 0; i < 3; i++)
        detailLine(
          g,
          p,
          [side * (wide - 6), top - 24 - i * 10],
          [side * (wide - 12), top - 32 - i * 10],
          c.accent,
          2,
        );
    }
  detailPoly(
    g,
    p,
    [
      [-5, top - 10],
      [0, top - 5],
      [5, top - 10],
      [0, top - 16],
    ],
    c.eye,
  );
  detailLine(g, p, [-8, top - 28], [8, top - 28], c.shade, 2);
  if (boss && hunter) {
    detailLine(g, p, [-20, top - 28], [-48, top - 6], c.accent, 4);
    detailLine(g, p, [20, top - 28], [48, top - 6], c.accent, 4);
  }
}
