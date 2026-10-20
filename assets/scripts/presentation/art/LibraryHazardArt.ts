import type { Graphics } from "cc";
import type { Hazard, Point } from "../../battle/SurvivalTypes";
import {
  libraryCorners,
  libraryPosition,
  libraryEnvelope,
} from "../../battle/LibraryGeometry";
import { ink } from "./Ink";
const S = 48;
export function drawLibraryHazard(g: Graphics, h: Hazard, time: number) {
  const b = h.library!;
  if (b.cancelled || time >= h.until) return;
  const active = time >= h.due,
    preview = time < h.created,
    color =
      b.shape === "imprint"
        ? "#f1b99b"
        : b.shape === "page"
          ? "#b8dae2"
          : "#dbc1ef";
  const path = (points: Point[], closed = false) => {
    points.forEach((p, i) =>
      i ? g.lineTo(p.x * S, p.y * S) : g.moveTo(p.x * S, p.y * S),
    );
    if (closed) g.close();
  };
  const stroke = (
    points: Point[],
    width: number,
    c = color,
    alpha = 255,
    closed = false,
  ) => {
    path(points, closed);
    g.strokeColor = ink(c, alpha);
    g.lineWidth = width;
    g.stroke();
  };
  const badge = (p: Point) => {
    const x = p.x * S,
      y = p.y * S;
    g.fillColor = ink("#1d1b25", 230);
    g.rect(x - 8, y - 5, 15 + b.order * 9, 23);
    g.fill();
    g.strokeColor = ink(color);
    g.lineWidth = 4;
    for (let i = 0; i < b.order; i++) {
      g.moveTo(x + i * 9, y);
      g.lineTo(x + i * 9, y + 12);
    }
    g.stroke();
  };
  if (b.shape === "imprint") {
    const corners = libraryCorners(h, time);
    path(corners, true);
    g.fillColor = ink(color, active ? 100 : preview ? 10 : 55);
    g.fill();
    stroke(corners, 7, "#1d1b25", 230, true);
    stroke(corners, 4, color, preview ? 140 : 255, true);
    const a = h.angle,
      c = Math.cos(a),
      s = Math.sin(a);
    for (const side of [-1, 1]) {
      const local = (x: number, y: number) => ({
        x: h.x + x * c - y * s,
        y: h.y + x * s + y * c,
      });
      stroke(
        [local(side * 1.5, -0.45), local(side * 1.1, 0.45)],
        3,
        color,
        active ? 255 : 180,
      );
    }
  } else {
    const envelope = libraryEnvelope(h);
    stroke(envelope, 2, color, preview ? 70 : 100, true);
    const a = libraryPosition(h, h.due),
      z = libraryPosition(h, h.until);
    stroke([a, z], 3, color, active ? 75 : 170);
    for (const t of [h.due, h.until])
      stroke(libraryCorners(h, t), 3, color, preview ? 100 : 220, true);
    if (active) {
      const corners = libraryCorners(h, time);
      path(corners, true);
      g.fillColor = ink("#e5d9ba");
      g.fill();
      stroke(corners, 5, "#24212b", 255, true);
      stroke(corners, 2, color, 255, true);
    }
    const d = Math.atan2(z.y - a.y, z.x - a.x);
    stroke(
      [
        {
          x: z.x - Math.cos(d - 0.6) * 0.35,
          y: z.y - Math.sin(d - 0.6) * 0.35,
        },
        z,
        {
          x: z.x - Math.cos(d + 0.6) * 0.35,
          y: z.y - Math.sin(d + 0.6) * 0.35,
        },
      ],
      4,
      color,
      220,
    );
  }
  const start = libraryPosition(h, h.due),
    corner = libraryCorners(h, h.due)[0];
  badge({ x: corner.x - 0.15, y: corner.y - 0.2 });
  if (!active) {
    const seal = b.seal;
    // Thin connection is informational, never an additional damaging line.
    stroke([start, seal], 1.5, color, 110);
    g.fillColor = ink("#1d1b25", 220);
    g.circle(seal.x * S, seal.y * S, 0.58 * S);
    g.fill();
    // Sample explicitly: Creator's arc direction differs from the offline Canvas-compatible stub.
    const ring = Array.from({ length: 29 }, (_, i) => {
      const a = 0.25 + ((Math.PI * 2 - 0.5) * i) / 28;
      return { x: seal.x + Math.cos(a) * 0.5, y: seal.y + Math.sin(a) * 0.5 };
    });
    stroke(ring, 6, "#f6e3a4");
    // Open paper corners and paired ticks distinguish the counter from an impact disk.
    stroke(
      [
        { x: seal.x - 0.2, y: seal.y + 0.12 },
        { x: seal.x + 0.15, y: seal.y + 0.12 },
        { x: seal.x + 0.22, y: seal.y - 0.1 },
        { x: seal.x - 0.12, y: seal.y - 0.1 },
      ],
      3,
      "#f6e3a4",
    );
    badge({ x: seal.x - 0.07, y: seal.y - 0.13 });
  }
}
