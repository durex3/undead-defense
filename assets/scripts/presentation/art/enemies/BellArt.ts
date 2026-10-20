import type { Graphics } from "cc";
import type { SurvivalWorld } from "../../../battle/SurvivalWorld";
import type { Enemy } from "../../../battle/SurvivalTypes";
import type { EnemyArt } from "../EnemyCatalog";
import type { Pose } from "../Actor";
import { Silhouette, detailPoly, detailLine, detailEllipse } from "../Brush";
/** Original wax silhouettes; all actors use the shared foot-anchored pose. */
export function drawBellBody(
  g: Graphics,
  w: SurvivalWorld,
  e: Enemy,
  art: EnemyArt,
  p: Pose,
) {
  const c = art.palette,
    crawl = e.kind === "waxcrawler",
    boss = e.kind === "boss",
    porter = e.kind === "waxporter",
    priest = e.kind === "twinbell",
    scribe = e.kind === "waxscribe",
    ringer = e.kind === "bellacolyte";
  const top = boss
    ? 87
    : porter
      ? 64
      : priest
        ? 73
        : ringer
          ? 66
          : scribe
            ? 44
            : crawl
              ? 25
              : 48;
  const width = boss ? 30 : porter ? 28 : scribe ? 25 : crawl ? 29 : 19;
  const shell = new Silhouette(g, p, c.base, c.outline, 2.5);
  if (crawl) {
    for (const x of [-19, 0, 19]) shell.ellipse(x, 15, 13, 10, 8);
    for (const x of [-22, 18])
      for (const side of [-1, 1])
        shell.poly([
          [x, 14],
          [x + side * 8, 6],
          [x + side * 13, 2],
          [x + side * 4, 1],
        ]);
  } else {
    const legs = boss ? [-22, 0, 22] : [-12, 12];
    for (const x of legs)
      shell.poly([
        [x - 5, 4 + p.stride],
        [x + 5, 3 + p.stride],
        [x + 7, 25],
        [x - 6, 28],
      ]);
    shell.poly([
      [-width, 20],
      [-width + 4, top - 16],
      [-width * 0.55, top],
      [width * 0.55, top],
      [width - 4, top - 16],
      [width, 20],
      [width * 0.5, 12],
      [-width * 0.6, 14],
    ]);
    if (porter)
      shell.poly([
        [-35, 15],
        [-37, 40],
        [-27, 50],
        [-19, 44],
        [-25, 22],
      ]);
    if (scribe) shell.ellipse(9, 35, 24, 9, 10);
  }
  shell.commit();
  if (crawl) {
    detailPoly(
      g,
      p,
      [
        [-26, 20],
        [-12, 28],
        [0, 19],
        [13, 28],
        [27, 20],
        [10, 12],
        [-14, 12],
      ],
      c.light,
    );
  } else {
    detailPoly(
      g,
      p,
      [
        [-width + 5, 23],
        [-width + 8, top - 19],
        [-5, top - 5],
        [0, top - 12],
        [-4, 19],
      ],
      c.light,
    );
    detailPoly(
      g,
      p,
      [
        [width - 4, 22],
        [width - 7, top - 18],
        [8, top - 4],
        [11, 18],
      ],
      c.shade,
    );
    detailPoly(
      g,
      p,
      [
        [-10, top - 12],
        [9, top - 12],
        [13, top - 22],
        [-12, top - 25],
      ],
      c.outline,
    );
    detailLine(g, p, [-5, top - 17], [5, top - 17], c.eye, 2);
  }
  const bell = (x: number, y: number, r: number) => {
    detailPoly(
      g,
      p,
      [
        [x - r, y],
        [x - r * 0.65, y + r * 1.3],
        [x, y + r * 1.7],
        [x + r * 0.65, y + r * 1.3],
        [x + r, y],
        [x + r * 1.25, y - 3],
        [x - r * 1.25, y - 3],
      ],
      c.metal,
    );
    detailLine(
      g,
      p,
      [x - r * 0.5, y + 3],
      [x - r * 0.3, y + r],
      c.metalLight,
      3,
    );
    detailEllipse(g, p, x, y - 5, 3, 4, c.accent);
  };
  if (boss) bell(0, 32, 27);
  else if (priest) {
    bell(-24, 42, 10);
    bell(23, 35, 14);
  } else if (ringer || porter)
    bell(porter ? -21 : 0, porter ? 21 : 29, porter ? 19 : 14);
  else if (scribe) {
    detailLine(g, p, [-17, 43], [14, 23], c.metalLight, 4);
    detailLine(g, p, [-8, 34], [22, 34], c.metal, 3);
  } else if (!crawl)
    for (const x of [-12, 0, 12]) {
      detailLine(g, p, [x, 43], [x, 58 + Math.abs(x) * 0.2], c.light, 4);
      detailEllipse(g, p, x, 61 + Math.abs(x) * 0.2, 3, 5, c.accent);
    }
  if ((e.fractureUntil ?? 0) > w.time)
    for (let i = 0; i < (e.fracture ?? 0); i++)
      detailPoly(
        g,
        p,
        [
          [i * 9 - 7, top - 27],
          [i * 9 - 2, top - 34],
          [i * 9 - 8, top - 40],
          [i * 9 - 3, top - 48],
        ],
        c.outline,
      );
  if (e.state === "recover" && e.bell?.vulnerable)
    detailLine(g, p, [-width * 0.6, 25], [width * 0.6, top - 20], c.eye, 3);
}
