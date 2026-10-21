import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { EnemyArt } from "../EnemyCatalog";
import type { Pose } from "../Actor";
import { Silhouette, detailPoly, detailLine, detailEllipse } from "../Brush";
export function drawGraveBody(
  g: Graphics,
  w: SurvivalWorld,
  e: Enemy,
  art: EnemyArt,
  p: Pose,
) {
  const c = art.palette,
    boss = e.kind === "boss",
    hunter = boss ? e.grave?.life === 2 : e.kind === "shedstalker",
    small = e.kind === "gravegrub" || e.kind === "minion",
    tall = e.kind === "scarprelate" || e.kind === "echoacolyte",
    twin = e.kind === "coffinregent",
    wide = boss ? 48 : small ? 22 : 32,
    top = boss ? (hunter ? 112 : 74) : small ? 27 : tall ? 78 : 58;
  const s = new Silhouette(g, p, c.bone, c.outline, 2.5);
  if (small) {
    for (let i = 0; i < 3; i++) {
      s.ellipse(-15 + i * 14, 16, 11, 10);
      for (const side of [-1, 1])
        s.limb([-14 + i * 14, 16], [-22 + i * 14, side < 0 ? 0 : 26], 2, 1);
    }
    s.commit();
    for (let i = 0; i < 3; i++)
      detailLine(g, p, [-21 + i * 14, 16], [-11 + i * 14, 19], c.shade, 2);
    detailEllipse(g, p, 18, 21, 3, 3, c.eye);
    return;
  }
  for (const side of [-1, 1]) {
    if (hunter) {
      s.limb([side * 12, 42], [side * 22, 10], 5, 3);
      s.poly([
        [side * 22, 14],
        [side * 33, 0],
        [side * 13, 0],
      ]);
      s.limb([side * 15, top - 28], [side * 48, 22], 5, 2);
      s.poly([
        [side * 48, 28],
        [side * 58, 12],
        [side * 43, 18],
      ]);
      for (let i = 0; i < 3; i++)
        s.poly([
          [side * 12, top - 34 - i * 9],
          [side * (wide + 15 - i * 7), top - 4 - i * 18],
          [side * (wide + 1 - i * 7), top - 32 - i * 12],
        ]);
    } else {
      for (const back of [0, 1])
        s.limb(
          [side * (back ? 27 : 13), 24],
          [side * (back ? wide : wide - 10), back ? 0 : 8],
          5,
          3,
        );
    }
  }
  s.poly([
    [-15, 22],
    [15, 22],
    [20, top - 25],
    [0, top - 15],
    [-20, top - 25],
  ]);
  if (!hunter) {
    const n = twin ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const x = twin ? (i ? 20 : -20) : 0;
      s.poly([
        [x - 19, top - 35],
        [x + 19, top - 35],
        [x + 23, top],
        [x + 12, top + 12],
        [x - 12, top + 12],
        [x - 23, top],
      ]);
    }
  } else s.ellipse(0, top - 12, 12, 15);
  s.commit();
  if (!hunter) {
    for (const x of twin ? [-20, 20] : [0]) {
      detailPoly(
        g,
        p,
        [
          [x - 14, top - 28],
          [x + 14, top - 28],
          [x + 15, top - 1],
          [x, top + 5],
          [x - 15, top - 1],
        ],
        c.cloth,
      );
      detailLine(g, p, [x - 13, top - 17], [x + 13, top - 9], c.accent, 3);
    }
  }
  for (let i = 0; i < 3; i++)
    for (const side of [-1, 1])
      detailLine(
        g,
        p,
        [side * 3, top - 33 - i * 9],
        [side * (16 - i * 2), top - 37 - i * 9],
        c.shade,
        2.5,
      );
  detailEllipse(g, p, 0, top - 32, 5, 7, c.eye);
  if (hunter) {
    for (const side of [-1, 1])
      detailEllipse(g, p, side * 5, top - 9, 2.5, 3, c.eye);
    detailLine(g, p, [-4, top - 20], [4, top - 20], c.shade, 2);
  }
  if (tall) {
    for (const side of [-1, 1])
      detailLine(g, p, [side * 18, 24], [side * 29, top + 11], c.accent, 3);
  }
}
