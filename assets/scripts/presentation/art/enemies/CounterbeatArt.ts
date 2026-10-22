import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { EnemyArt } from "../EnemyCatalog";
import type { Pose } from "../Actor";
import { Silhouette, detailLine, detailEllipse, detailPoly } from "../Brush";
export function drawCounterbeatBody(
  g: Graphics,
  w: SurvivalWorld,
  e: Enemy,
  art: EnemyArt,
  p: Pose,
) {
  const c = art.palette,
    boss = e.kind === "boss",
    small = e.kind === "chimeshard" || e.kind === "minion",
    support = e.kind === "resonancebearer",
    pipes = e.kind === "pipereader",
    sweep = boss || e.kind === "broadcantor",
    thrust = boss || e.kind === "forklancer" || e.kind === "needleconductor",
    top = boss ? 115 : small ? 35 : support ? 72 : 84;
  const s = new Silhouette(g, p, c.base, c.outline, 2.5);
  for (const side of [-1, 1]) {
    s.limb(
      [side * 10, small ? 15 : 32],
      [side * (small ? 18 : 23), 0],
      small ? 3 : 6,
      2,
    );
    if (!small) s.limb([side * 13, top - 28], [side * 38, top - 55], 6, 3);
  }
  s.poly([
    [-14, small ? 9 : 24],
    [14, small ? 9 : 24],
    [boss ? 28 : 19, top - 25],
    [0, top - 9],
    [-(boss ? 28 : 19), top - 25],
  ]);
  s.ellipse(0, top - 9, small ? 10 : 13, small ? 8 : 14);
  if (small) {
    s.poly([
      [-22, 18],
      [0, 35],
      [22, 18],
      [15, 7],
      [-15, 7],
    ]);
  }
  if (sweep)
    s.poly([
      [-33, top - 50],
      [-64, top - 24],
      [-58, top - 65],
      [-38, top - 73],
    ]);
  if (thrust) {
    s.limb([31, top - 52], [52, top + 14], 3, 2);
    s.poly([
      [52, top + 23],
      [45, top + 6],
      [52, top + 10],
      [59, top + 6],
    ]);
    if (e.kind === "forklancer") {
      s.limb([44, top], [42, top + 19], 2, 1);
      s.limb([57, top], [60, top + 17], 2, 1);
    }
  }
  if (pipes || support)
    for (let i = 0; i < (support ? 5 : 4); i++) {
      const x = -24 + i * 12;
      s.limb([x, top - 46], [x, top + 8 + (i % 2) * 10], 4, 2);
    }
  s.commit();
  detailPoly(
    g,
    p,
    [
      [-6, top - 11],
      [0, top - 5],
      [6, top - 11],
      [0, top - 17],
    ],
    c.eye,
  );
  if (small) {
    for (const side of [-1, 1])
      detailLine(g, p, [side * 4, 12], [side * 16, 23], c.accent, 2);
  } else {
    detailLine(g, p, [-14, top - 29], [14, top - 29], c.metalLight, 3);
    for (const side of [-1, 1]) {
      const sway = boss ? Math.sin(w.time * 3 + side) * 8 : 0;
      detailLine(
        g,
        p,
        [side * 6, top - 36],
        [side * 14 + sway, top - 65],
        c.accent,
        2,
      );
      detailEllipse(g, p, side * 14 + sway, top - 65, 4, 6, c.metalLight);
    }
  }
  if (e.counter?.retireUntil)
    detailLine(g, p, [-20, top + 13], [20, top + 13], c.accent, 3);
}
