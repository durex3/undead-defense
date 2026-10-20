/** Design-only stage-eight blockout and analytic geometry checks; no runtime registration. */
import fs from "node:fs";
import assert from "node:assert/strict";
import sharp from "sharp";
const out = "artifacts/rootglass-design";
fs.mkdirSync(out, { recursive: true });
const boxes = [
  [-9, 9, 2.8, 1.3],
  [9, -9, 2.8, 1.3],
  [-10, -9, 1.4, 3],
  [10, 9, 1.4, 3],
  [-3, 19, 3.5, 1.2],
  [3, -19, 3.5, 1.2],
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
  ny = 105;
const key = ([x, y]) =>
  Math.round((y + 26) / grid) * nx + Math.round((x + 22) / grid);
const point = (k) => [(k % nx) * grid - 22, Math.floor(k / nx) * grid - 26];
function edgeClear(a, b, r) {
  const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05);
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    if (blocked(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r))
      return false;
  }
  return true;
}
function search(start, r) {
  const queue = [key(start)],
    prev = new Map([[queue[0], null]]);
  assert(!blocked(...start, r));
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i],
      [x, y] = point(id);
    for (const [dx, dy] of [
      [grid, 0],
      [-grid, 0],
      [0, grid],
      [0, -grid],
    ]) {
      const p = [x + dx, y + dy];
      if (blocked(...p, r)) continue;
      const k = key(p);
      if (prev.has(k) || !edgeClear([x, y], p, r)) continue;
      prev.set(k, id);
      queue.push(k);
    }
  }
  return prev;
}
const connectivity = [0.3, 0.7].map((radius) => {
  const seen = search(refs[0], radius);
  return {
    radius,
    grid,
    edgeSample: 0.05,
    reachableCells: seen.size,
    references: refs.map((p) => ({ point: p, reachable: seen.has(key(p)) })),
  };
});
assert(connectivity.every((c) => c.references.every((p) => p.reachable)));
// Two independent channels between the lower and upper inner court.
const channels = [
  [
    [0, -8],
    [-5, -8],
    [-5, 12],
    [0, 12],
  ],
  [
    [0, -8],
    [5, -8],
    [5, 12],
    [0, 12],
  ],
];
for (const path of channels)
  for (let i = 1; i < path.length; i++)
    assert(edgeClear(path[i - 1], path[i], 0.7));
const arm = {
  origin: [0, 0],
  inner: 1.5,
  outer: 5.2,
  halfWidth: 0.22,
  startDegrees: -50,
  endDegrees: 50,
  duration: 2.6,
  warning: 1.6,
};
const playerRadius = 0.3,
  speed = 4.2,
  reaction = 0.35,
  angularSpeed = (100 * Math.PI) / 180 / arm.duration;
const hubRadius = arm.inner - arm.halfWidth - playerRadius;
assert(hubRadius > 0.9);
const flower = {
  ring: { inner: 2.2, outer: 3.5, warning: 1.8, active: 0.6 },
  disk: { radius: 2.2, warning: 1.6, active: 0.35 },
  sequenceClearGap: 1.8,
};
// Conservative empty-space bound: from the middle of an annulus to either safe edge.
const ringHalfBand = (flower.ring.outer - flower.ring.inner) / 2 + playerRadius;
const diskWorstEscape = flower.disk.radius + playerRadius;
assert(ringHalfBand < (flower.ring.warning - reaction) * speed);
assert(diskWorstEscape < (flower.disk.warning - reaction) * speed);
const initialPair = {
  armOrigin: [0, 0],
  flowerCenter: [3, 0],
  flowerType: "disk",
  armDue: 1.6,
  flowerDue: 2.8,
};
const segmentDistance = (p, a, b) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    q = Math.max(
      0,
      Math.min(
        1,
        ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy),
      ),
    );
  return Math.hypot(p[0] - a[0] - q * dx, p[1] - a[1] - q * dy);
};
function unsafe(p, t) {
  if (t >= 1.6 && t <= 4.2) {
    const a = ((-50 + (100 * (t - 1.6)) / 2.6) * Math.PI) / 180,
      begin = [Math.cos(a) * 1.5, Math.sin(a) * 1.5],
      end = [Math.cos(a) * 5.2, Math.sin(a) * 5.2];
    if (segmentDistance(p, begin, end) <= 0.52) return true;
  }
  if (t >= 2.8 && t <= 3.15 && Math.hypot(p[0] - 3, p[1]) <= 2.5) return true;
  return false;
}
const start = [3, 0],
  samples = [];
for (let i = 0; i < 24; i++) {
  const a = (i * Math.PI) / 12;
  let p = [...start],
    safe = true;
  for (let frame = 0; frame <= 300; frame++) {
    const t = frame / 60;
    if (t > reaction && t < 2.75) {
      const q = [
        p[0] + (Math.cos(a) * speed) / 60,
        p[1] + (Math.sin(a) * speed) / 60,
      ];
      if (edgeClear(p, q, playerRadius)) p = q;
    }
    if (unsafe(p, t)) {
      safe = false;
      break;
    }
  }
  samples.push({ degrees: i * 15, safe });
}
assert(samples.some((s) => s.safe));
assert(
  unsafe(start, 2.9),
  "stationary player must be caught by the synthetic pair",
);
assert(
  !unsafe([0, 0], 2.9),
  "the clear hub outside the offset disk remains safe",
);
const report = {
  status:
    "design-only; static and synthetic empty-space checks, not runtime/dynamic escape or human validation",
  bounds: [22, 26],
  boxes,
  connectivity,
  independentInnerChannels: channels,
  metrics: { speed, playerRadius, reaction },
  arm: {
    ...arm,
    angularSpeedRadians: angularSpeed,
    outerTipSpeed: arm.outer * angularSpeed,
    innerSafePlayerCenterRadius: hubRadius,
  },
  flower,
  emptySpaceDistances: {
    ringHalfBand,
    diskWorstEscape,
    ringReach: (1.8 - reaction) * speed,
    diskReach: (1.6 - reaction) * speed,
  },
  syntheticPair: {
    ...initialPair,
    timeStep: 1 / 60,
    moveUntil: 2.75,
    samples,
    safeDirections: samples.filter((s) => s.safe).length,
  },
};
fs.writeFileSync(
  `${out}/whitebox.json`,
  JSON.stringify(report, null, 2) + "\n",
);
const xy = ([x, y]) => `${260 + x * 10},${300 - y * 10}`;
const annular = (r1, r2, a0, a1) => {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = ((a0 + ((a1 - a0) * i) / 40) * Math.PI) / 180;
    pts.push(xy([Math.cos(a) * r2, Math.sin(a) * r2]));
  }
  for (let i = 40; i >= 0; i--) {
    const a = ((a0 + ((a1 - a0) * i) / 40) * Math.PI) / 180;
    pts.push(xy([Math.cos(a) * r1, Math.sin(a) * r1]));
  }
  return pts.join(" ");
};
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="600" viewBox="0 0 920 600"><rect width="920" height="600" fill="#172321"/><rect x="40" y="40" width="440" height="520" fill="#303b32" stroke="#9faaa0"/><g fill="#6e7466" stroke="#bbb598" stroke-width="2">${boxes.map(([x, y, w, h]) => `<rect x="${260 + (x - w) * 10}" y="${300 - (y + h) * 10}" width="${w * 20}" height="${h * 20}"/>`).join("")}</g>${channels.map((path) => `<polyline points="${path.map(xy).join(" ")}" fill="none" stroke="#91c6b6" stroke-width="3"/>`).join("")}<polygon points="${annular(1.5, 5.2, -50, 50)}" fill="#d0ac6f" fill-opacity=".3" stroke="#e8c38b"/><line x1="275" y1="300" x2="312" y2="300" stroke="#eece9e" stroke-width="4"/><circle cx="260" cy="300" r="9.8" fill="#91c6b6" fill-opacity=".5"/><circle cx="290" cy="300" r="22" fill="#d99d82" fill-opacity=".4" stroke="#e8b694"/>${refs.map((p) => `<circle cx="${260 + p[0] * 10}" cy="${300 - p[1] * 10}" r="4" fill="#bedbcc"/>`).join("")}<g font-family="sans-serif" fill="#eee1c7"><text x="520" y="65" font-size="24">第八关：蚀根温室</text><text x="520" y="100" font-size="15">设计白盒 / 未接入运行时</text><text x="520" y="150" font-size="17">青线：两条独立内庭通路</text><text x="520" y="185" font-size="17">矩形：固定破盆与育根床</text><text x="520" y="235" font-size="17">扇面：藤臂完整摆动区域</text><text x="520" y="270" font-size="17">青心：支点内侧可停留空间</text><text x="520" y="305" font-size="17">圆盘：延时实心花爆样例</text><text x="520" y="365" font-size="15">移速4.2 / 半径0.3 / 反应0.35秒</text><text x="520" y="400" font-size="15">藤臂单向100° / 2.6秒 / 无返程伤害</text><text x="520" y="455" font-size="15">仅检查静态连通与合成样例</text><text x="520" y="490" font-size="15">不代表拥挤出口或真人难度已通过</text></g></svg>`;
fs.writeFileSync(`${out}/layout.svg`, svg);
await sharp(Buffer.from(svg)).png().toFile(`${out}/layout.png`);
console.log(
  JSON.stringify(
    {
      connectivity: connectivity.map((c) =>
        c.references.every((p) => p.reachable),
      ),
      independentInnerChannels: channels.length,
      tipSpeed: report.arm.outerTipSpeed,
      pairSafeDirections: report.syntheticPair.safeDirections,
    },
    null,
    2,
  ),
);
