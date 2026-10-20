import type { Graphics } from "cc";
import type { Hazard, Point } from "../../battle/SurvivalTypes";
import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import { tideHead, TIDE_STRIPS } from "../../battle/TideGeometry";
import { tideStop } from "../../battle/TideMap";
import { ink } from "./Ink";
const S = 48;
function segment(g: Graphics, a: Point, b: Point) {
  g.moveTo(a.x * S, a.y * S);
  g.lineTo(b.x * S, b.y * S);
}
function badge(g: Graphics, p: Point, order: number) {
  g.strokeColor = ink("#102026");
  g.lineWidth = 7;
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < order; i++) {
      g.moveTo(p.x * S - 4 + (i - (order - 1) / 2) * 9, p.y * S + 15);
      g.lineTo(p.x * S - 4 + (i - (order - 1) / 2) * 9, p.y * S + 27);
    }
    g.stroke();
    g.strokeColor = ink("#ffe4a8");
    g.lineWidth = 3;
  }
}
export function drawTideHazard(g: Graphics, h: Hazard, t: number) {
  if (!h.tide || t > h.until) return;
  const b = h.tide,
    warning = t < h.due,
    preview = !!b.preview,
    dx = Math.cos(h.angle),
    dy = Math.sin(h.angle);
  const point = (d: number, side = 0) => ({
    x: h.x + dx * d - dy * side,
    y: h.y + dy * d + dx * side,
  });
  const color = preview ? "#f6cf91" : warning ? "#ffb07a" : "#b8fff0";
  if (b.shape === "tide") {
    const front = Math.max(0, t - h.due) * b.speed,
      step = (b.halfSpan * 2) / TIDE_STRIPS;
    // Filled warning cells and the live band share the collision strip cutoffs.
    g.fillColor = ink(
      warning ? "#e69e74" : "#68c5ba",
      preview ? 12 : warning ? 50 : 125,
    );
    for (let i = 0; i < TIDE_STRIPS; i++) {
      const stop = b.stops[i];
      if (stop <= 0 || (!warning && front >= stop)) continue;
      const a = point(
          warning ? 0 : Math.max(0, front - h.width),
          -b.halfSpan + i * step,
        ),
        z = point(warning ? stop : front, -b.halfSpan + i * step),
        c = point(warning ? stop : front, -b.halfSpan + (i + 1) * step),
        d = point(
          warning ? 0 : Math.max(0, front - h.width),
          -b.halfSpan + (i + 1) * step,
        );
      g.moveTo(a.x * S, a.y * S);
      g.lineTo(z.x * S, z.y * S);
      g.lineTo(c.x * S, c.y * S);
      g.lineTo(d.x * S, d.y * S);
      g.close();
    }
    g.fill();
    const edges = () => {
      for (let i = 0; i < TIDE_STRIPS; i++) {
        const stop = b.stops[i];
        if (stop <= 0 || (!warning && front >= stop)) continue;
        const side = -b.halfSpan + i * step;
        segment(
          g,
          point(warning ? 0 : front, side),
          point(warning ? 0 : front, side + step),
        );
        if (warning) {
          segment(g, point(stop, side), point(stop, side + step));
          if (i === 0 || i === TIDE_STRIPS - 1)
            segment(
              g,
              point(0, side + (i ? step : 0)),
              point(stop, side + (i ? step : 0)),
            );
        }
      }
    };
    g.strokeColor = ink("#102026", 230);
    g.lineWidth = 7;
    edges();
    g.stroke();
    g.strokeColor = ink(color, preview ? 150 : 255);
    g.lineWidth = warning ? 4.5 : 6;
    edges();
    g.stroke();
    if (warning) {
      g.strokeColor = ink(color, preview ? 155 : 230);
      g.lineWidth = 2;
      for (const side of [-b.halfSpan * 0.65, 0, b.halfSpan * 0.65]) {
        const p = point(0.7, side);
        segment(g, point(0.15, side), point(1, side));
        segment(g, p, point(0.35, side - 0.25));
        segment(g, p, point(0.35, side + 0.25));
      }
      g.stroke();
    }
    badge(g, point(warning ? 0 : Math.min(front, h.radius), 0), b.order);
  } else {
    if (warning) {
      g.strokeColor = ink("#102026", 220);
      g.lineWidth = h.width * S * 2 + 5;
      segment(g, b.from, b.to);
      g.stroke();
      g.strokeColor = ink(color, preview ? 130 : 180);
      g.lineWidth = h.width * S * 2;
      segment(g, b.from, b.to);
      g.stroke();
      g.strokeColor = ink("#ffe6bd");
      g.lineWidth = 2;
      segment(g, b.from, b.to);
      for (const side of [-1, 1])
        segment(g, b.to, {
          x: b.to.x - dx * 0.4 - dy * side * 0.2,
          y: b.to.y - dy * 0.4 + dx * side * 0.2,
        });
      g.stroke();
      badge(g, b.from, b.order);
    } else {
      const head = tideHead(h, t);
      if (b.shape === "hook") {
        // Quiet rope is decoration. Only the outlined iron head has a hitbox.
        g.strokeColor = ink("#a38a67", 90);
        g.lineWidth = 1.5;
        segment(g, b.chainFrom, head);
        g.stroke();
      }
      const x = head.x * S,
        y = head.y * S;
      g.fillColor = ink(b.shape === "hook" ? "#a48b72" : "#d2d6bb");
      g.strokeColor = ink("#102026");
      g.lineWidth = 3;
      if (b.shape === "hook") {
        g.circle(x, y, h.width * S);
        g.fill();
        g.stroke();
        g.strokeColor = ink("#e5cda2");
        g.lineWidth = 3;
        g.moveTo(x - 10, y + 6);
        g.lineTo(x, y - 8);
        g.lineTo(x + 10, y + 6);
        g.stroke();
      } else {
        const v = (u: number, v: number) => ({
          x: head.x + dx * u - dy * v,
          y: head.y + dy * u + dx * v,
        });
        g.lineWidth = 4;
        g.strokeColor = ink("#102026");
        for (let layer = 0; layer < 2; layer++) {
          segment(g, v(-0.35, 0), v(0.35, 0));
          segment(g, v(0.1, -0.18), v(0.35, 0));
          segment(g, v(0.1, 0.18), v(0.35, 0));
          g.stroke();
          g.strokeColor = ink("#ffe0ac");
          g.lineWidth = 2;
        }
      }
    }
  }
}
export function drawTidePreviews(g: Graphics, w: SurvivalWorld) {
  for (const e of w.enemies) {
    const s = e.tide;
    if (!s || e.hp <= 0 || s.step <= 0 || e.state === "recover") continue;
    if (s.preview) drawTideHazard(g, s.preview, w.time);
    if (
      s.points.length === 3 &&
      s.step === 1 &&
      !s.blocked &&
      ["hook", "crane", "B"].includes(s.action)
    ) {
      const from = s.points[1],
        desired = s.points[2],
        a = Math.atan2(desired.y - from.y, desired.x - from.x),
        r = e.kind === "boss" ? 0.7 : e.kind === "severedcrane" ? 0.65 : 0.5,
        length = tideStop(
          from,
          a,
          Math.hypot(desired.x - from.x, desired.y - from.y),
          r,
        ),
        to = {
          x: from.x + Math.cos(a) * length,
          y: from.y + Math.sin(a) * length,
        };
      g.strokeColor = ink("#e4c49b", 140);
      g.lineWidth = 2;
      segment(g, from, to);
      g.stroke();
      badge(g, from, 2);
    }
    if (s.berth) {
      g.strokeColor = ink("#b1d6cf", 160);
      g.lineWidth = 2;
      segment(g, e, s.berth);
      g.circle(s.berth.x * S, s.berth.y * S, 0.7 * S);
      g.stroke();
    }
  }
}
