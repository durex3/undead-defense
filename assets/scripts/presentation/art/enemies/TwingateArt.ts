import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { EnemyArt } from "../EnemyCatalog";
import type { Pose } from "../Actor";
import { Silhouette, detailLine, detailEllipse, detailPoly } from "../Brush";
export function drawTwingateBody(
  g: Graphics,
  w: SurvivalWorld,
  e: Enemy,
  art: EnemyArt,
  p: Pose,
) {
  const c = art.palette,
    boss = e.kind === "boss",
    hunter = boss
      ? e.twin?.role !== "warden"
      : ["shorthorn", "splitblade", "huntermarshal"].includes(e.kind),
    small = e.kind === "gategrub" || e.kind === "minion",
    solo =
      boss &&
      w.twingate.encounter.solo &&
      w.time >= w.twingate.encounter.soloAt,
    top = small ? 35 : boss ? (hunter ? 79 : solo ? 84 : 114) : hunter ? 62 : 83,
    wide = small ? 19 : boss ? 43 : 30;
  const s = new Silhouette(g, p, c.bone, c.outline, 2.5);
  for (const side of [-1, 1]) {
    s.limb([side * 10, small ? 14 : 30], [side * wide, 0], small ? 3 : 6, 2);
    if (hunter && !small)
      s.limb([side * 23, 30], [side * (wide + 12), 9], 5, 2);
  }
  s.poly([
    [-14, small ? 9 : 24],
    [14, small ? 9 : 24],
    [wide * 0.65, top - 23],
    [0, top - 8],
    [-wide * 0.65, top - 23],
  ]);
  s.ellipse(0, top - 8, small ? 10 : 13, small ? 8 : 13);
  if (hunter && !small)
    for (const side of [-1, 1]) {
      s.limb([side * 15, top - 22], [side * 41, 14], 6, 2);
      s.poly([
        [side * 35, 26],
        [side * 60, 18],
        [side * 48, 1],
        [side * 44, 14],
      ]);
      s.poly([
        [side * 8, top - 5],
        [side * 21, top + 18],
        [side * 14, top - 10],
      ]);
    }
  if (!small && (!hunter || solo)) {
    s.poly([
      [-wide - 14, top - 35],
      [-wide - 4, top - 17],
      [0, top - 30],
      [wide + 4, top - 17],
      [wide + 14, top - 35],
      [0, top - 23],
    ]);
    s.limb([0, top - 43], [0, top + 13], 3, 2);
    s.poly([
      [0, top + 24],
      [-7, top + 9],
      [7, top + 9],
    ]);
  }
  if (solo && !hunter) {
    for (const side of [-1, 1])
      s.limb([side * (wide + 6), top - 27], [side * (wide + 16), 0], 5, 2);
    s.limb([-14, top - 23], [-48, 14], 6, 2);
    s.poly([
      [-48, 30],
      [-64, 13],
      [-44, 1],
    ]);
  }
  s.commit();
  detailPoly(
    g,
    p,
    [
      [-5, top - 10],
      [0, top - 3],
      [6, top - 10],
      [0, top - 16],
    ],
    c.eye,
  );
  if (!small) {
    for (const side of [-1, 1]) {
      detailLine(
        g,
        p,
        [side * 3, top - 26],
        [side * 15, top - 35],
        c.accent,
        3,
      );
      if (!hunter || solo)
        detailLine(
          g,
          p,
          [side * (wide + 6), top - 27],
          [0, top - 40],
          c.metalLight,
          2,
        );
    }
    detailEllipse(g, p, 0, top - 38, 5, 7, c.metal);
  }
  if (solo && hunter) {
    detailLine(g, p, [-13, top + 9], [0, top + 27], c.accent, 4);
    detailLine(g, p, [13, top + 9], [0, top + 27], c.accent, 4);
  }
}
