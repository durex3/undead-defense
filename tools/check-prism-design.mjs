/** Design-only geometry audit. Does not register or implement stage seven. */
import fs from "node:fs";
const out = "artifacts/prismvault-design";
fs.mkdirSync(out, { recursive: true });
const boxes = [
  [-10, 7, 1.6, 3],
  [10, -7, 1.6, 3],
  [-6, -17, 3.2, 1.4],
  [6, 17, 3.2, 1.4],
  [-15, -11, 1.5, 2],
  [15, 11, 1.5, 2],
];
const refs = [
  [0, -8],
  [0, 0],
  [-15, 0],
  [15, 0],
  [0, 12],
  [0, -12],
];
const blocked = (x, y, r) =>
  Math.abs(x) > 22 - r ||
  Math.abs(y) > 26 - r ||
  boxes.some(
    ([bx, by, w, h]) => Math.abs(x - bx) < w + r && Math.abs(y - by) < h + r,
  );
const grid = 0.5,
  nx = 89,
  ny = 105,
  toKey = ([x, y]) =>
    Math.round((y + 26) / grid) * nx + Math.round((x + 22) / grid),
  point = (k) => [(k % nx) * grid - 22, Math.floor(k / nx) * grid - 26];
function search(start, r) {
  const queue = [toKey(start)],
    prev = new Map([[queue[0], null]]);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i],
      [x, y] = point(id);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const xx = x + dx * grid,
        yy = y + dy * grid;
      if (blocked(xx, yy, r)) continue;
      const k = toKey([xx, yy]);
      if (prev.has(k)) continue;
      let clear = true;
      for (let t = 0; t <= 1; t += 0.1)
        if (blocked(x + (xx - x) * t, y + (yy - y) * t, r)) clear = false;
      if (clear) {
        prev.set(k, id);
        queue.push(k);
      }
    }
  }
  return prev;
}
const connectivity = [0.3, 0.7].map((radius) => {
  const reached = search(refs[0], radius);
  return {
    radius,
    grid,
    edgeSample: 0.05,
    reachableCells: reached.size,
    routes: refs.map((p) => ({ point: p, reachable: reached.has(toKey(p)) })),
  };
});
function hit(origin, direction, length, r) {
  let first;
  for (const [bx, by, hw, hh] of boxes) {
    let lo = 0,
      hi = length,
      normal = [0, 0],
      corner = false;
    for (let axis = 0; axis < 2; axis++) {
      const start = origin[axis],
        d = direction[axis],
        center = [bx, by][axis],
        half = [hw, hh][axis] + r;
      if (Math.abs(d) < 1e-9) {
        if (Math.abs(start - center) > half) {
          lo = Infinity;
          break;
        }
      } else {
        const a = (center - half - start) / d,
          b = (center + half - start) / d,
          entry = Math.min(a, b);
        if (Math.abs(entry - lo) < 1e-7 && entry > 0) corner = true;
        if (entry > lo) {
          lo = entry;
          normal = axis === 0 ? [d > 0 ? -1 : 1, 0] : [0, d > 0 ? -1 : 1];
        }
        hi = Math.min(hi, Math.max(a, b));
      }
    }
    if (lo <= hi && lo >= 0 && (!first || lo < first.at))
      first = { at: lo, normal, corner, box: [bx, by] };
  }
  return first;
}
const start = [-4, 3.5],
  target = [-4, 8],
  radius = 0.22,
  plane = -8.4 + radius,
  mirrored = [2 * plane - target[0], target[1]],
  delta = mirrored.map((v, i) => v - start[i]),
  len = Math.hypot(...delta),
  d = delta.map((x) => x / len),
  contact = hit(start, d, 12, radius);
if (!contact || contact.corner)
  throw Error("design example lacks unambiguous reflector");
const bend = start.map((v, i) => v + d[i] * contact.at),
  dot = d[0] * contact.normal[0] + d[1] * contact.normal[1],
  reflected = d.map((v, i) => v - 2 * dot * contact.normal[i]),
  end = bend.map((v, i) => v + reflected[i] * (12 - contact.at));
const after = hit(
  bend.map((v, i) => v + reflected[i] * 1e-5),
  reflected,
  12 - contact.at - 1e-5,
  radius,
);
const cross = Math.abs(
  (target[0] - bend[0]) * reflected[1] - (target[1] - bend[1]) * reflected[0],
);
const report = {
  status: "design-only; no runtime or mobile/human acceptance",
  bounds: [22, 26],
  boxes,
  connectivity,
  reflectionExample: {
    start,
    target,
    radius,
    normal: contact.normal,
    bend,
    end,
    totalTravel: 12,
    speed: 4.2,
    arrivalAtTarget: len / 4.2,
    targetOnReflectedRay: cross < 1e-6,
    secondObstacle: after ?? null,
  },
};
if (
  connectivity.some((c) => c.routes.some((x) => !x.reachable)) ||
  cross > 1e-6 ||
  after
)
  throw Error("whitebox audit failed");
fs.writeFileSync(
  `${out}/whitebox.json`,
  JSON.stringify(report, null, 2) + "\n",
);
const xy = ([x, y]) => `${260 + x * 10},${300 - y * 10}`,
  route = [];
const loop = [refs[0], refs[2], refs[4], refs[3], refs[5], refs[0]];
for (let i = 0; i < loop.length - 1; i++) {
  const prev = search(loop[i], 0.7),
    part = [];
  let k = toKey(loop[i + 1]);
  while (k !== null && k !== undefined) {
    part.push(point(k));
    k = prev.get(k);
  }
  route.push(...part.reverse());
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="820" height="600" viewBox="0 0 820 600"><rect width="820" height="600" fill="#171d28"/><rect x="40" y="40" width="440" height="520" fill="#343241" stroke="#9a91aa"/><g fill="#787186" stroke="#c6b2df" stroke-width="2">${boxes.map(([x, y, w, h]) => `<rect x="${260 + (x - w) * 10}" y="${300 - (y + h) * 10}" width="${w * 20}" height="${h * 20}"/>`).join("")}</g><polyline points="${route.map(xy).join(" ")}" fill="none" stroke="#74bda5" stroke-width="2"/><polyline points="${[start, bend, end].map(xy).join(" ")}" fill="none" stroke="#ffbc83" stroke-width="3"/>${refs.map((p) => `<circle cx="${260 + p[0] * 10}" cy="${300 - p[1] * 10}" r="4" fill="#b5dec9"/>`).join("")}<g fill="#eee0c5" font-size="19" font-family="sans-serif"><text x="520" y="80">第七关：折晶矿窟</text><text x="520" y="115" font-size="14">设计白盒，未接入运行时</text><text x="520" y="165" font-size="15">绿色：半径0.7可通行环路</text><text x="520" y="200" font-size="15">橙色：一次反射样例</text><text x="520" y="235" font-size="15">矩形：真实晶柱碰撞边界</text><text x="520" y="290" font-size="15">基准移速4.2 / 玩家半径0.3</text><text x="520" y="325" font-size="15">0.5网格 + 0.05边采样</text><text x="520" y="390" font-size="14">仅验证静态连通与几何样例</text><text x="520" y="420" font-size="14">不代表怪群、组合或真人难度</text></g></svg>`;
fs.writeFileSync(`${out}/layout.svg`, svg);
console.log(
  JSON.stringify(
    {
      connected: connectivity.map((x) => x.routes.every((p) => p.reachable)),
      reflection: report.reflectionExample,
    },
    null,
    2,
  ),
);
