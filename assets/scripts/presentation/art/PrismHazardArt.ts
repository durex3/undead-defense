import type { Graphics } from "cc";
import type { Hazard, Point } from "../../battle/SurvivalTypes";
import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import { prismHead } from "../../battle/PrismGeometry";
import { ink } from "./Ink";
const S = 48;
function segment(g: Graphics, a: Point, b: Point) {
  g.moveTo(a.x * S, a.y * S);
  g.lineTo(b.x * S, b.y * S);
}
function diamond(g: Graphics, p: Point, r: number) {
  g.moveTo(p.x * S, p.y * S + r);
  g.lineTo(p.x * S + r, p.y * S);
  g.lineTo(p.x * S, p.y * S - r);
  g.lineTo(p.x * S - r, p.y * S);
  g.close();
}
export function drawPrismHazard(g: Graphics, h: Hazard, t: number) {
  if (!h.prism || h.until <= t) return;
  const b = h.prism,
    path = b.path,
    warning = t < h.due,
    preview = !!b.preview,
    core = b.shape === "core",
    limit = b.cut ?? path.total;
  const route = () => {
    let used = 0;
    for (let i = 0; i < path.lengths.length; i++) {
      const a = path.points[i],
        z = path.points[i + 1],
        len = Math.min(path.lengths[i], Math.max(0, limit - used));
      if (len > 0)
        segment(g, a, {
          x: a.x + ((z.x - a.x) * len) / path.lengths[i],
          y: a.y + ((z.y - a.y) * len) / path.lengths[i],
        });
      used += path.lengths[i];
    }
  };
  if (warning) {
    g.strokeColor = ink(core ? "#d1a874" : "#d6b6e5", preview ? 20 : 45);
    g.lineWidth = h.width * S * 2;
    route();
    g.stroke();
    g.strokeColor = ink("#151624", 230);
    g.lineWidth = 6;
    route();
    g.stroke();
  }
  g.strokeColor = ink(
    preview ? "#d8bb98" : core ? "#ffd19a" : "#f4d1f9",
    warning ? (preview ? 140 : 230) : 75,
  );
  g.lineWidth = warning ? 2 : 1.5;
  route();
  g.stroke();
  if (warning) {
    let used = 0;
    g.strokeColor = ink(core ? "#ffd7a3" : "#f4d1f9", preview ? 150 : 245);
    g.lineWidth = 2;
    for (let i = 0; i < path.lengths.length; i++) {
      const a = path.points[i],
        z = path.points[i + 1],
        len = path.lengths[i];
      if (used + len > limit + 0.01) break;
      const dx = (z.x - a.x) / len,
        dy = (z.y - a.y) / len,
        p = {
          x: a.x + dx * Math.min(len, 0.85),
          y: a.y + dy * Math.min(len, 0.85),
        };
      for (const side of [-1, 1])
        segment(g, p, {
          x: p.x - dx * 0.35 - dy * side * 0.2,
          y: p.y - dy * 0.35 + dx * side * 0.2,
        });
      used += len;
    }
    g.stroke();
    // Put the order badge on its own outgoing leg: shared origins must not
    // merge the first and second warning into an apparent third shot.
    const a = path.points[0], z = path.points[1];
    const distance = Math.min(path.lengths[0], 1.2);
    const p = {
      x: a.x + ((z.x - a.x) * distance) / path.lengths[0],
      y: a.y + ((z.y - a.y) * distance) / path.lengths[0],
    };
    g.strokeColor = ink("#ffe6bb");
    g.lineWidth = 3;
    for (let i = 0; i < b.order; i++) {
      g.moveTo(p.x * S + (i - (b.order - 1) / 2) * 8, p.y * S + 18);
      g.lineTo(p.x * S + (i - (b.order - 1) / 2) * 8, p.y * S + 29);
    }
    g.stroke();
  }
  if (path.points.length === 3 && path.lengths[0] <= limit) {
    const bend = path.points[1];
    g.fillColor = ink("#1c1826");
    diamond(g, bend, 10);
    g.fill();
    g.strokeColor = ink("#e6be87", warning ? 240 : 110);
    g.lineWidth = 2;
    diamond(g, bend, 8);
    g.stroke();
  }
  if (!warning) {
    const p = prismHead(h, t);
    if (core) {
      g.strokeColor = ink("#ffda9f", 235);
      g.lineWidth = 2;
      g.circle(p.x * S, p.y * S, h.width * S);
      g.stroke();
    } else {
      const old = prismHead(h, Math.max(h.due, t - 0.12));
      g.strokeColor = ink("#d5b4e8", 150);
      g.lineWidth = 3;
      segment(g, old, p);
      g.stroke();
      g.fillColor = ink("#f8dfa9");
      g.strokeColor = ink("#171722");
      g.lineWidth = 2;
      diamond(g, p, h.width * S);
      g.fill();
      g.stroke();
    }
  }
}
export function drawPrismPreviews(g: Graphics, w: SurvivalWorld) {
  for (const e of w.enemies) {
    const s = e.prism;
    if (!s || e.hp <= 0 || e.state === "recover") continue;
    if (s.preview) drawPrismHazard(g, s.preview, w.time);
    for (const { point, axis } of s.sites ?? []) {
      const v = axis === "x";
      g.strokeColor = ink("#e3bc91");
      g.lineWidth = 2;
      g.rect(
        point.x * S - (v ? 9 : 34),
        point.y * S - (v ? 34 : 9),
        v ? 18 : 68,
        v ? 68 : 18,
      );
      g.stroke();
    }
    if (s.site && s.step > 0) {
      const p = s.site,
        v = s.axis !== "y",
        x = p.x * S,
        y = p.y * S;
      g.strokeColor = ink("#e3bc91");
      g.lineWidth = 2;
      g.rect(x - (v ? 9 : 34), y - (v ? 34 : 9), v ? 18 : 68, v ? 68 : 18);
      g.stroke();
      g.strokeColor = ink("#c6b6d9", 100);
      g.lineWidth = 1.5;
      segment(g, e, p);
      g.stroke();
    }
  }
}
