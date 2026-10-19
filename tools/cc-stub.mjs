/**
 * Minimal offline stand-in for the few `cc` APIs used by the art layer.
 *
 * This is NOT a renderer. It records Graphics path commands so tests and
 * tools/art-preview.mjs can inspect draw submissions, vertex counts and
 * produce an approximate SVG contact sheet. Cocos Creator remains the
 * source of truth for final rendering.
 */

const TAU = Math.PI * 2;
const f = (n) => (Math.round(n * 100) / 100).toString();

export class Color {
  constructor(r = 0, g = 0, b = 0, a = 255) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
  fromHEX(hex) {
    const s = String(hex).replace("#", "");
    if (s.length === 3) {
      this.r = parseInt(s[0] + s[0], 16);
      this.g = parseInt(s[1] + s[1], 16);
      this.b = parseInt(s[2] + s[2], 16);
    } else {
      this.r = parseInt(s.slice(0, 2), 16);
      this.g = parseInt(s.slice(2, 4), 16);
      this.b = parseInt(s.slice(4, 6), 16);
    }
    this.a = 255;
    return this;
  }
  clone() {
    return new Color(this.r, this.g, this.b, this.a);
  }
  toCSS() {
    return `rgba(${this.r},${this.g},${this.b},${(this.a / 255).toFixed(3)})`;
  }
}
Color.WHITE = new Color(255, 255, 255, 255);
Color.BLACK = new Color(0, 0, 0, 255);

class PathBuilder {
  constructor() {
    this.d = "";
    this.x = 0;
    this.y = 0;
    this.sx = 0;
    this.sy = 0;
    this.open = false;
    this.points = 0;
  }
  moveTo(x, y) {
    this.d += `M${f(x)} ${f(y)} `;
    this.x = this.sx = x;
    this.y = this.sy = y;
    this.open = true;
    this.points++;
  }
  lineTo(x, y) {
    if (!this.open) return this.moveTo(x, y);
    this.d += `L${f(x)} ${f(y)} `;
    this.x = x;
    this.y = y;
    this.points++;
  }
  close() {
    if (!this.open) return;
    this.d += "Z ";
    this.x = this.sx;
    this.y = this.sy;
    this.open = false;
    this.points++;
  }
  quadraticCurveTo(cx, cy, x, y) {
    const x0 = this.x,
      y0 = this.y;
    const n = 10;
    for (let i = 1; i <= n; i++) {
      const t = i / n,
        u = 1 - t;
      this.lineTo(
        u * u * x0 + 2 * u * t * cx + t * t * x,
        u * u * y0 + 2 * u * t * cy + t * t * y,
      );
    }
  }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    const x0 = this.x,
      y0 = this.y;
    const n = 12;
    for (let i = 1; i <= n; i++) {
      const t = i / n,
        u = 1 - t;
      this.lineTo(
        u * u * u * x0 +
          3 * u * u * t * c1x +
          3 * u * t * t * c2x +
          t * t * t * x,
        u * u * u * y0 +
          3 * u * u * t * c1y +
          3 * u * t * t * c2y +
          t * t * t * y,
      );
    }
  }
  arc(cx, cy, r, a0, a1, ccw = false) {
    const startX = cx + Math.cos(a0) * r,
      startY = cy + Math.sin(a0) * r;
    if (!this.open) this.moveTo(startX, startY);
    else this.lineTo(startX, startY);
    let sweep = a1 - a0;
    if (ccw) {
      while (sweep > 0) sweep -= TAU;
    } else {
      while (sweep < 0) sweep += TAU;
    }
    const n = Math.max(4, Math.ceil(Math.abs(sweep) / (Math.PI / 16)));
    for (let i = 1; i <= n; i++) {
      const a = a0 + (sweep * i) / n;
      this.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  }
  ellipse(cx, cy, rx, ry) {
    const n = 24;
    this.moveTo(cx + rx, cy);
    for (let i = 1; i <= n; i++) {
      const a = (TAU * i) / n;
      this.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    this.close();
  }
  circle(cx, cy, r) {
    this.ellipse(cx, cy, r, r);
  }
  rect(x, y, w, h) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.close();
  }
  roundRect(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    if (rr <= 0) return this.rect(x, y, w, h);
    const corners = [
      [x + w - rr, y + rr, -Math.PI / 2, 0],
      [x + w - rr, y + h - rr, 0, Math.PI / 2],
      [x + rr, y + h - rr, Math.PI / 2, Math.PI],
      [x + rr, y + rr, Math.PI, Math.PI * 1.5],
    ];
    this.moveTo(x + rr, y);
    this.lineTo(x + w - rr, y);
    for (const [cx, cy, a0, a1] of corners) {
      for (let i = 1; i <= 4; i++) {
        const a = a0 + ((a1 - a0) * i) / 4;
        this.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
    }
    this.close();
  }
  reset() {
    this.d = "";
    this.x = this.y = this.sx = this.sy = 0;
    this.open = false;
    this.points = 0;
  }
}

export class Graphics {
  constructor() {
    this.path = new PathBuilder();
    this.lastPath = "";
    this.lastPoints = 0;
    this.commands = [];
    this.vertexCount = 0;
    this.fillColor = new Color(255, 255, 255, 255);
    this.strokeColor = new Color(0, 0, 0, 255);
    this.lineWidth = 1;
    this.lineJoin = 0;
    this.lineCap = 0;
  }
  clear() {
    this.path.reset();
    this.lastPath = "";
    this.lastPoints = 0;
    this.commands.length = 0;
    this.vertexCount = 0;
  }
  moveTo(x, y) {
    this.path.moveTo(x, y);
  }
  lineTo(x, y) {
    this.path.lineTo(x, y);
  }
  close() {
    this.path.close();
  }
  quadraticCurveTo(cx, cy, x, y) {
    this.path.quadraticCurveTo(cx, cy, x, y);
  }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    this.path.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
  }
  arc(cx, cy, r, a0, a1, ccw) {
    this.path.arc(cx, cy, r, a0, a1, ccw);
  }
  ellipse(cx, cy, rx, ry) {
    this.path.ellipse(cx, cy, rx, ry);
  }
  circle(cx, cy, r) {
    this.path.circle(cx, cy, r);
  }
  rect(x, y, w, h) {
    this.path.rect(x, y, w, h);
  }
  roundRect(x, y, w, h, r) {
    this.path.roundRect(x, y, w, h, r);
  }
  fill() {
    if (!this.path.d) return;
    this.commands.push({
      op: "fill",
      d: this.path.d,
      color: this.fillColor.toCSS(),
    });
    this.vertexCount += this.path.points;
    this.lastPath = this.path.d;
    this.lastPoints = this.path.points;
    this.path.reset();
  }
  stroke() {
    const source = this.path.d || this.lastPath;
    if (!source) return;
    const points = this.path.d ? this.path.points : this.lastPoints;
    this.commands.push({
      op: "stroke",
      d: source,
      color: this.strokeColor.toCSS(),
      width: this.lineWidth,
    });
    this.vertexCount += points;
    this.lastPath = "";
    this.lastPoints = 0;
    this.path.reset();
  }
  toSVG() {
    return this.commands
      .map((c) =>
        c.op === "fill"
          ? `<path d="${c.d}" fill="${c.color}" fill-rule="nonzero"/>`
          : `<path d="${c.d}" fill="none" stroke="${c.color}" stroke-width="${f(
              c.width,
            )}" stroke-linejoin="round" stroke-linecap="round"/>`,
      )
      .join("\n");
  }
  /** Approximate world-space bounds of every recorded path, for tests. */
  get bounds() {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const command of this.commands) {
      const nums = (command.d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      for (let i = 0; i + 1 < nums.length; i += 2) {
        minX = Math.min(minX, nums[i]);
        maxX = Math.max(maxX, nums[i]);
        minY = Math.min(minY, nums[i + 1]);
        maxY = Math.max(maxY, nums[i + 1]);
      }
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }
}

/* Placeholders so future presentation modules can be imported without cc. */
export class Node {}
export class Component {}
export class UITransform {}
export class Label {}
export class Sprite {}
export class SpriteFrame {}
export class Texture2D {}
export class Rect {}
export class AudioClip {}
export class AudioSource {}
export class Camera {}
export class Canvas {}
export const Layers = { Enum: { UI_2D: 1 } };
export const KeyCode = {};
