/** Stage nine design-only whitebox and force/curve examples. No runtime registration. */
import fs from "node:fs";
import assert from "node:assert/strict";
import sharp from "sharp";
const out = "artifacts/windcloister-design";
fs.mkdirSync(out, { recursive: true });
const boxes = [
  [-9, 5.5, 1.2, 2.5],
  [9, -5.5, 1.2, 2.5],
  [-12, 15, 2.5, 1.1],
  [12, -15, 2.5, 1.1],
  [10, 15, 1.1, 2.4],
  [-10, -15, 1.1, 2.4],
  [0, 22, 2, 1],
  [0, -22, 2, 1],
];
const refs = [
  [0, -8],
  [0, 0],
  [-16, 0],
  [16, 0],
  [0, 13],
  [0, -13],
];
const blocked = (p, r) =>
  Math.abs(p[0]) > 22 - r ||
  Math.abs(p[1]) > 26 - r ||
  boxes.some(
    ([x, y, w, h]) => Math.abs(p[0] - x) < w + r && Math.abs(p[1] - y) < h + r,
  );
const grid = 0.5,
  nx = 89,
  key = ([x, y]) =>
    Math.round((y + 26) / grid) * nx + Math.round((x + 22) / grid),
  point = (k) => [(k % nx) * grid - 22, Math.floor(k / nx) * grid - 26];
function clear(a, b, r) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05));
  for (let i = 0; i <= n; i++)
    if (
      blocked(
        [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n],
        r,
      )
    )
      return false;
  return true;
}
function search(start, r) {
  const q = [key(start)],
    seen = new Set(q);
  assert(!blocked(start, r));
  for (let i = 0; i < q.length; i++) {
    const a = point(q[i]);
    for (const d of [
      [grid, 0],
      [-grid, 0],
      [0, grid],
      [0, -grid],
    ]) {
      const p = [a[0] + d[0], a[1] + d[1]],
        k = key(p);
      if (seen.has(k) || !clear(a, p, r)) continue;
      seen.add(k);
      q.push(k);
    }
  }
  return seen;
}
const connectivity = [0.3, 0.7].map((radius) => {
  const seen = search(refs[0], radius);
  return {
    radius,
    grid,
    edgeSample: 0.05,
    cells: seen.size,
    refs: refs.map((p) => ({ point: p, reachable: seen.has(key(p)) })),
  };
});
assert(connectivity.every((c) => c.refs.every((r) => r.reachable)));
const routes = [
  [
    [0, -8],
    [-5, -8],
    [-5, 13],
    [0, 13],
  ],
  [
    [0, -8],
    [5, -8],
    [5, 13],
    [0, 13],
  ],
];
for (const route of routes)
  for (let i = 1; i < route.length; i++)
    assert(clear(route[i - 1], route[i], 0.7));
const control = [
  [-4, 0],
  [-2, 2.4],
  [0, 0],
];
const bezier = (u) => {
  const v = 1 - u;
  return [
    v * v * control[0][0] + 2 * v * u * control[1][0] + u * u * control[2][0],
    v * v * control[0][1] + 2 * v * u * control[1][1] + u * u * control[2][1],
  ];
};
const samples = Array.from({ length: 33 }, (_, i) => bezier(i / 32));
let arcLength = 0;
const lengths = [0];
for (let i = 1; i < samples.length; i++) {
  assert(clear(samples[i - 1], samples[i], 0.22));
  arcLength += Math.hypot(
    samples[i][0] - samples[i - 1][0],
    samples[i][1] - samples[i - 1][1],
  );
  lengths.push(arcLength);
}
const curveError =
  Math.hypot(
    control[0][0] - 2 * control[1][0] + control[2][0],
    control[0][1] - 2 * control[1][1] + control[2][1],
  ) /
  (4 * 32 ** 2);
assert(curveError <= 0.01);
const wind = {
  center: [0, 0],
  halfLength: 3.5,
  halfWidth: 1.6,
  due: 1.8,
  until: 4.4,
  speed: 0.8,
  direction: [1, 0],
};
const feather = {
  due: 2.5,
  speed: 4.3,
  radius: 0.22,
  until: 2.5 + arcLength / 4.3,
};
function head(t) {
  const d = Math.max(0, Math.min(arcLength, (t - feather.due) * feather.speed));
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < d) i++;
  const f = (d - lengths[i - 1]) / (lengths[i] - lengths[i - 1]);
  return [
    samples[i - 1][0] + (samples[i][0] - samples[i - 1][0]) * f,
    samples[i - 1][1] + (samples[i][1] - samples[i - 1][1]) * f,
  ];
}
function simulate(
  angle,
  { withWind = true, moving = true, stopAt = Infinity } = {},
) {
  let p = [0, 0],
    safe = true,
    smallestGap = Infinity;
  const dt = 1 / 120,
    trace = [{ t: 0, p: [...p] }];
  for (let i = 1; i <= Math.ceil(wind.until / dt); i++) {
    const t = i * dt,
      old = [...p],
      move =
        moving && t > 0.35 && t < stopAt
          ? [Math.cos(angle) * 4.2, Math.sin(angle) * 4.2]
          : [0, 0];
    const gust =
      withWind &&
      t >= wind.due &&
      t < wind.until &&
      Math.abs(p[0]) <= 3.5 &&
      Math.abs(p[1]) <= 1.6
        ? 0.8
        : 0;
    let next = [p[0] + (move[0] + gust) * dt, p[1] + move[1] * dt];
    if (clear(p, next, 0.3)) p = next;
    else if (!clear(p, p, 0.3)) safe = false;
    if (t >= feather.due && t <= feather.until) {
      const a = head(t - dt),
        b = head(t),
        start = [a[0] - old[0], a[1] - old[1]],
        end = [b[0] - p[0], b[1] - p[1]],
        dx = end[0] - start[0],
        dy = end[1] - start[1],
        f = Math.max(
          0,
          Math.min(
            1,
            -(start[0] * dx + start[1] * dy) / (dx * dx + dy * dy || 1),
          ),
        ),
        gap = Math.hypot(start[0] + dx * f, start[1] + dy * f);
      smallestGap = Math.min(smallestGap, gap);
      if (gap <= 0.52) safe = false;
    }
    if (i % 24 === 0) trace.push({ t: +t.toFixed(2), p: [...p] });
  }
  return { safe, smallestGap, end: p, trace };
}
const exits = Array.from({ length: 24 }, (_, i) => ({
  angle: i * 15,
  ...simulate((i * Math.PI) / 12),
}));
assert(exits.some((r) => r.safe));
const still = simulate(0, { withWind: false, moving: false }),
  drift = simulate(0, { moving: false });
assert(
  !still.safe,
  "negative control must detect the feather hitting a stationary unpushed player",
);
assert(
  drift.safe,
  "the fixed sample permits borrowing the wind instead of countersteering",
);
assert(4.2 - 0.8 >= 3.4);
assert(Math.abs(0.8 * 2.6 - 2.08) < 1e-8);
const releaseIntoFeather = simulate(Math.PI, { stopAt: 0.7 });
assert(
  !releaseIntoFeather.safe,
  "short countersteer followed by releasing input can drift back into the feather",
);
const report = {
  status:
    "design-only: static connectivity and one fixed synthetic wind/curve pair; no runtime crowd, dynamic scheduling, human or mobile acceptance",
  bounds: [22, 26],
  boxes,
  connectivity,
  independentInnerRoutes: routes,
  metrics: {
    playerSpeed: 4.2,
    playerRadius: 0.3,
    reaction: 0.35,
    windSpeed: 0.8,
    minAgainstWindSpeed: 3.4,
    maxNoInputDrift: 2.08,
  },
  curve: { control, samples, arcLength, chordError: curveError, speed: 4.3 },
  wind,
  feather,
  syntheticPair: {
    step: 1 / 120,
    safeDirections: exits.filter((r) => r.safe).length,
    exits: exits.map(({ trace, ...r }) => r),
    stationaryWithoutWind: still,
    borrowWind: drift,
    releaseIntoFeather,
  },
};
fs.writeFileSync(
  `${out}/whitebox.json`,
  JSON.stringify(report, null, 2) + "\n",
);
const xy = ([x, y]) => `${260 + x * 10},${300 - y * 10}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="970" height="600" viewBox="0 0 970 600"><rect width="970" height="600" fill="#18232a"/><rect x="40" y="40" width="440" height="520" fill="#3a4547" stroke="#a4adad"/><g fill="#837c6c" stroke="#c8bca6" stroke-width="2">${boxes.map(([x, y, w, h]) => `<rect x="${260 + (x - w) * 10}" y="${300 - (y + h) * 10}" width="${w * 20}" height="${h * 20}"/>`).join("")}</g>${routes.map((r) => `<polyline points="${r.map(xy).join(" ")}" stroke="#80b9b6" stroke-width="3" fill="none"/>`).join("")}<rect x="225" y="284" width="70" height="32" fill="#d5c798" fill-opacity=".24" stroke="#ddd0a1"/><path d="M232 300 H287 L278 292 M287 300 L278 308" stroke="#ddd0a1" stroke-width="2" fill="none"/><polyline points="${samples.map(xy).join(" ")}" fill="none" stroke="#edaf98" stroke-width="3"/>${refs.map(([x, y]) => `<circle cx="${260 + x * 10}" cy="${300 - y * 10}" r="4" fill="#c5dbcf"/>`).join("")}<g fill="#eee3ce" font-family="sans-serif"><text x="520" y="65" font-size="24">第九关：断羽风廊</text><text x="520" y="100" font-size="15">设计白盒 / 未接入运行时</text><text x="520" y="150" font-size="17">青线：两条独立内庭路线</text><text x="520" y="185" font-size="17">矩形：固定风蚀柱与断裂座台</text><text x="520" y="235" font-size="17">浅金：向右推移的有限风带</text><text x="520" y="270" font-size="17">杏红：已锁定的曲羽路线</text><text x="520" y="320" font-size="16">风推0.8 / 逆风仍可移动3.4</text><text x="520" y="355" font-size="16">双精英间隔6秒 / 共用两危险槽</text><text x="520" y="405" font-size="15">135秒、225秒单独教学</text><text x="520" y="440" font-size="15">305秒、311秒合场；Boss等待清理</text><text x="520" y="505" font-size="14">仅检查静态连通与一个空场样例</text><text x="520" y="535" font-size="14">不代表所有双精英组合可躲或难度合理</text></g></svg>`;
fs.writeFileSync(`${out}/layout.svg`, svg);
await sharp(Buffer.from(svg)).png().toFile(`${out}/layout.png`);
console.log(
  JSON.stringify(
    {
      connected: connectivity.map((c) => c.refs.every((r) => r.reachable)),
      independentRoutes: routes.length,
      curveLength: arcLength,
      curveError,
      syntheticSafeDirections: report.syntheticPair.safeDirections,
      borrowWindSafe: drift.safe,
    },
    null,
    2,
  ),
);
