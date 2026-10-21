import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { EnemyArt } from "../EnemyCatalog";
import type { Pose } from "../Actor";
import { Silhouette, detailPoly, detailLine, detailEllipse } from "../Brush";
export function drawLeadBody(
  g: Graphics,
  w: SurvivalWorld,
  e: Enemy,
  art: EnemyArt,
  p: Pose,
) {
  const c = art.palette,
    k = e.kind === "minion" ? "leadgrub" : e.kind,
    boss = k === "boss",
    small = k === "leadgrub",
    twin = k === "twinpitch",
    cart = k === "offsetcart",
    tall = k === "presswarden" || k === "kneehopper",
    wide = boss ? 52 : twin ? 39 : cart ? 38 : small ? 22 : 25,
    top = boss ? 70 : tall ? 70 : small ? 22 : 48;
  const s = new Silhouette(g, p, c.base, c.outline, 2.5);
  if (small) {
    for (let i = 0; i < 3; i++)
      for (const side of [-1, 1])
        s.poly([
          [-18 + i * 14, 14],
          [-23 + i * 14, side < 0 ? 1 : 25],
          [-17 + i * 14, side < 0 ? 0 : 29],
          [-10 + i * 14, 15],
        ]);
    for (let i = 0; i < 3; i++) s.ellipse(-14 + i * 14, 17, 11 - i, 12 - i);
    s.commit();
    for (let i = 0; i < 3; i++)
      detailLine(g, p, [-18 + i * 12, 12], [-12 + i * 12, 22], c.metalLight, 2);
    detailEllipse(g, p, 17, 21, 3, 3, c.eye);
    return;
  }
  for (const side of [-1, 1])
    for (let i = 0; i < (small ? 3 : 1); i++) {
      const x = side * wide;
      s.poly([
        [side * (wide - 10), 20 + i * 5],
        [x, 12 + i * 4],
        [x + side * 6, 0],
        [x - side * 8, 0],
        [x - side * 12, 12 + i * 4],
      ]);
    }
  s.poly([
    [-wide * 0.75, 10],
    [wide * 0.75, 10],
    [wide * 0.45, 31],
    [-wide * 0.45, 31],
  ]);
  if (tall) {
    for (let i = 0; i < 3; i++)
      s.poly([
        [-13 + i * 2, 24 + i * 14],
        [13, 24 + i * 14],
        [11, 37 + i * 14],
        [-11 + i * 2, 37 + i * 14],
      ]);
  } else
    s.poly([
      [-18, 20],
      [18, 20],
      [small ? 12 : 23, top - 5],
      [-(small ? 12 : 23), top - 5],
    ]);
  const arms = boss
    ? e.bossPhase >= 2
      ? [-1, 1]
      : [-1]
    : twin
      ? [-1, 1]
      : [cart ? 1 : -1];
  for (const side of arms) {
    s.poly([
      [side * 12, top - 8],
      [side * (wide + 4), top + 5],
      [side * (wide + 2), top + 20],
      [side * (wide - 12), top + 10],
    ]);
    s.ellipse(side * (wide + 2), top + 20, 13, 10);
  }
  if (boss && e.bossPhase === 3)
    for (const side of [-1, 1])
      s.poly([
        [side * 22, 28],
        [side * 64, 45],
        [side * 68, 26],
        [side * 35, 13],
      ]);
  s.commit();
  detailPoly(
    g,
    p,
    [
      [-12, top - 9],
      [12, top - 9],
      [9, top + 7],
      [-9, top + 7],
    ],
    c.shade,
  );
  detailEllipse(g, p, 0, top, 5, 6, c.eye);
  for (const side of arms) {
    detailEllipse(g, p, side * (wide + 2), top + 23, 9, 5, c.shade);
    detailEllipse(g, p, side * (wide + 2), top + 27, 6, 6, c.metalLight);
    detailLine(
      g,
      p,
      [side * 14, top - 6],
      [side * (wide - 3), top + 10],
      c.accent,
      3,
    );
  }
  if (cart)
    for (const side of [-1, 1]) {
      detailEllipse(g, p, side * 29, 8, 10, 10, c.shade);
      detailEllipse(g, p, side * 29, 8, 4, 4, c.metalLight);
    }
  if (small)
    for (let i = 0; i < 3; i++)
      detailLine(g, p, [-12, 9 + i * 7], [12, 10 + i * 7], c.metalLight, 2);
  if (tall)
    for (let i = 0; i < 3; i++)
      detailLine(g, p, [-8, 31 + i * 13], [9, 31 + i * 13], c.metalLight, 3);
  if (boss)
    detailPoly(
      g,
      p,
      [
        [-27, 16],
        [27, 16],
        [19, 29],
        [-19, 29],
      ],
      c.metal,
    );
}
