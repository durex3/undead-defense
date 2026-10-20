/** Design-only whitebox. Does not register stage 10 or alter runtime/account data. */
import fs from "node:fs";
import sharp from "sharp";
const out = "artifacts/sealedlibrary-design";
fs.mkdirSync(out, { recursive: true });
const boxes = [
  [-9, -10, 3, 0.9],
  [-12, -7.5, 0.9, 2.5],
  [9, 10, 3, 0.9],
  [12, 7.5, 0.9, 2.5],
  [-13, 13, 1.7, 3.5],
  [13, -13, 1.7, 3.5],
  [-4, 20, 3.2, 1.1],
  [4, -20, 3.2, 1.1],
];
const blocked = (p, r) =>
  Math.abs(p.x) > 22 - r ||
  Math.abs(p.y) > 26 - r ||
  boxes.some(
    ([x, y, w, h]) => Math.abs(p.x - x) < w + r && Math.abs(p.y - y) < h + r,
  );
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function segment(a, b, r) {
  const n = Math.max(1, Math.ceil(distance(a, b) / 0.05));
  for (let i = 0; i <= n; i++)
    if (
      blocked(
        { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n },
        r,
      )
    )
      return true;
  return false;
}
const refs = [
  [0, -8],
  [0, 0],
  [-17, 0],
  [-17, 18],
  [0, 16],
  [17, 18],
  [17, 0],
  [0, -15],
];
const key = (x, y) => `${x},${y}`;
function connectivity(r) {
  const walk = new Set();
  for (let x = -44; x <= 44; x++)
    for (let y = -52; y <= 52; y++)
      if (!blocked({ x: x * 0.5, y: y * 0.5 }, r)) walk.add(key(x, y));
  const seen = new Set([key(0, -16)]),
    queue = [[0, -16]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const z = key(x + dx, y + dy);
      if (
        walk.has(z) &&
        !seen.has(z) &&
        !segment(
          { x: x * 0.5, y: y * 0.5 },
          { x: (x + dx) * 0.5, y: (y + dy) * 0.5 },
          r,
        )
      ) {
        seen.add(z);
        queue.push([x + dx, y + dy]);
      }
    }
  }
  const references = refs.map(([x, y]) => ({
    x,
    y,
    connected: seen.has(key(x * 2, y * 2)),
  }));
  const inner = [-4, 4].map((x) => ({
    x,
    clear:
      !segment({ x: 0, y: -8 }, { x, y: -8 }, r) &&
      !segment({ x, y: -8 }, { x, y: 14 }, r) &&
      !segment({ x, y: 14 }, { x: 0, y: 14 }, r),
  }));
  const golden = refs.every(([x, y], i) => {
    const previous = refs[(i + refs.length - 1) % refs.length];
    return !segment({ x: previous[0], y: previous[1] }, { x, y }, r);
  });
  return {
    radius: r,
    grid: 0.5,
    edgeSampling: 0.05,
    walkable: walk.size,
    reachable: seen.size,
    references,
    inner,
    goldenPathClear: golden,
    passed:
      references.every((p) => p.connected) &&
      inner.every((p) => p.clear) &&
      golden,
  };
}
const xy = (x, y) => ({ x, y }),
  origin = xy(0, 0);
// All examples use fixed-angle rectangles. Relative slab intersection is exact within each linear path step.
const rect = (id, center, half, angle, due, duration, velocity, seal) => ({
  id,
  center,
  half,
  angle,
  due,
  until: due + duration,
  velocity,
  seal,
});
const imprint = (id, c, due = 1.9, a = 0, seal = xy(c.x, c.y + 2.1)) =>
  rect(id, c, xy(2.5, 1), a, due, 0.25, xy(0, 0), seal);
const page = (id, c, due, seal) =>
  rect(id, c, xy(0.25, 0.9), 0, due, 6 / 3.6, xy(3.6, 0), seal);
const scenarios = [
  { name: "single-imprint", hazards: [imprint(1, origin)] },
  {
    name: "imprint-plus-page",
    hazards: [imprint(1, origin), page(2, xy(-4, 0), 2.6, xy(0, -2.1))],
  },
  {
    name: "two-closing-pages",
    hazards: [
      rect(1, xy(-2.3, 0), xy(0.25, 1.6), 0, 2, 1.4, xy(1, 0), xy(-1, -2.6)),
      rect(2, xy(2.3, 0), xy(0.25, 1.6), 0, 2, 1.4, xy(-1, 0), xy(1, 2.6)),
    ],
  },
  {
    name: "two-offset-imprints",
    hazards: [
      imprint(1, xy(-1.4, 0), 2, 0, xy(-1.4, -2.1)),
      imprint(2, xy(1.4, 2.2), 2.8, Math.PI / 2, xy(-0.7, 2.2)),
    ],
  },
  {
    name: "phase-three-early-page",
    hazards: [imprint(1, origin, 2), page(2, xy(-4, 0), 2.3, xy(0, -2.1))],
  },
  {
    name: "phase-three-offset-clamp",
    hazards: [
      rect(
        1,
        xy(-1.7, 0),
        xy(0.25, 1.6),
        0,
        2.3,
        1.4,
        xy(1, 0),
        xy(-0.4, -2.6),
      ),
      rect(2, xy(2.9, 0), xy(0.25, 1.6), 0, 2.3, 1.4, xy(-1, 0), xy(1.6, 2.6)),
    ],
  },
];
function boxSweep(a, b, h, t0, t1) {
  const from = Math.max(t0, h.due),
    to = Math.min(t1, h.until);
  if (from > to) return false;
  const at = (time) => {
    const f = (time - t0) / (t1 - t0 || 1),
      x =
        a.x +
        (b.x - a.x) * f -
        h.center.x -
        h.velocity.x * Math.max(0, time - h.due),
      y =
        a.y +
        (b.y - a.y) * f -
        h.center.y -
        h.velocity.y * Math.max(0, time - h.due),
      c = Math.cos(h.angle),
      s = Math.sin(h.angle);
    return xy(x * c + y * s, -x * s + y * c);
  };
  const p = at(from),
    q = at(to);
  let lo = 0,
    hi = 1;
  for (const [start, delta, half] of [
    [p.x, q.x - p.x, h.half.x + 0.3],
    [p.y, q.y - p.y, h.half.y + 0.3],
  ]) {
    if (Math.abs(delta) < 1e-10) {
      if (Math.abs(start) > half) return false;
    } else {
      let t = (-half - start) / delta,
        z = (half - start) / delta;
      if (t > z) [t, z] = [z, t];
      lo = Math.max(lo, t);
      hi = Math.min(hi, z);
      if (lo > hi) return false;
    }
  }
  return hi >= 0 && lo <= 1;
}
function circleEnter(a, b, c, r) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    x = a.x - c.x,
    y = a.y - c.y,
    aa = dx * dx + dy * dy,
    cc = x * x + y * y - r * r;
  if (cc <= 0) return 0;
  if (aa < 1e-12) return null;
  const bb = 2 * (x * dx + y * dy),
    disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const t = (-bb - Math.sqrt(disc)) / (2 * aa);
  return t >= 0 && t <= 1 ? t : null;
}
const routes = [{ angle: 0, turn: 0, stop: 0 }];
for (let i = 0; i < 24; i++) {
  for (const stop of [1.3, 2.1, Infinity])
    routes.push({ angle: (i * Math.PI) / 12, turn: 0, stop });
  for (const turn of [-Math.PI / 2, Math.PI / 2])
    routes.push({ angle: (i * Math.PI) / 12, turn, stop: Infinity });
}
function trial(hazards, route, counter) {
  let p = { ...origin },
    cancelled = new Set();
  const track = [{ ...p }],
    until = Math.max(...hazards.map((h) => h.until));
  for (let t = 0; t < until;) {
    const dt = Math.min(0.025, until - t),
      z = { ...p },
      a = route.angle + (t >= 1.3 ? route.turn : 0),
      moving = t >= 0.35 && t < route.stop;
    if (moving) {
      z.x += Math.cos(a) * 4.2 * dt;
      z.y += Math.sin(a) * 4.2 * dt;
    }
    if (segment(p, z, 0.3)) return { safe: false, cancelled: [], track };
    if (counter)
      for (const h of hazards)
        if (!cancelled.has(h.id) && t <= h.due) {
          const hit = circleEnter(p, z, h.seal, 0.5);
          if (hit !== null && t + hit * dt <= h.due + 1e-9) cancelled.add(h.id);
        }
    if (
      hazards.some((h) => !cancelled.has(h.id) && boxSweep(p, z, h, t, t + dt))
    )
      return { safe: false, cancelled: [...cancelled], track };
    p = z;
    t += dt;
    track.push({ ...p });
  }
  return { safe: true, cancelled: [...cancelled], track };
}
const examples = scenarios.map((s) => {
  const pure = routes
      .map((r) => trial(s.hazards, r, false))
      .filter((r) => r.safe),
    counter = routes
      .map((r) => trial(s.hazards, r, true))
      .filter((r) => r.safe && r.cancelled.length > 0);
  const seals = s.hazards.map((h) => {
    const d = distance(origin, h.seal),
      c = Math.cos(h.angle),
      sn = Math.sin(h.angle);
    let gap = Infinity;
    for (let t = 0; t <= h.until - h.due + 0.0001; t += 0.01) {
      const dx = h.seal.x - h.center.x - h.velocity.x * t,
        dy = h.seal.y - h.center.y - h.velocity.y * t;
      gap = Math.min(
        gap,
        Math.hypot(
          Math.max(0, Math.abs(dx * c + dy * sn) - h.half.x),
          Math.max(0, Math.abs(-dx * sn + dy * c) - h.half.y),
        ) - 0.5,
      );
    }
    return {
      id: h.id,
      distance: +d.toFixed(3),
      fullOwnSweepGap: +gap.toFixed(3),
      clear: !blocked(h.seal, 0.5) && d >= 1.2 && d <= 3.2 && gap >= 0.4,
    };
  });
  return {
    name: s.name,
    seals,
    pureSafeRoutes: pure.length,
    counterSafeRoutes: counter.length,
    routeCount: routes.length,
    passed:
      pure.length > 0 && counter.length > 0 && seals.every((x) => x.clear),
    pureSample: pure[0]?.track,
    counterSample: counter[0]?.track,
    cancelledBySample: counter[0]?.cancelled,
  };
});
const connectivityResults = [0.3, 0.7].map(connectivity);
const report = {
  status: "design-only; stage 10 not registered",
  scope:
    "0.5-grid static connectivity with .05 edge sampling, two inner routes, fixed rectangle toy scenarios with .35 reaction/4.2 speed, .025 steps, relative rectangular sweep and swept foot/sign events. Empty court only: no live AI, moving crowd, HUD projection, real battle or human difficulty claim.",
  boxes,
  connectivity: connectivityResults,
  examples: examples.map(({ pureSample, counterSample, ...x }) => x),
  passed:
    connectivityResults.every((x) => x.passed) &&
    examples.every((x) => x.passed),
};
const mapPoint = (p) => `${270 + p.x * 10},${310 - p.y * 10}`;
const polyline = (pts, color) =>
  `<polyline points="${pts.map(mapPoint).join(" ")}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
const mainRoute = refs.map(([x, y]) => xy(x, y));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="660" viewBox="0 0 1040 660"><rect width="1040" height="660" fill="#17212a"/><rect x="50" y="50" width="440" height="520" fill="#303740" stroke="#9b9d96"/><g fill="#665446" stroke="#b8a583" stroke-width="2">${boxes.map(([x, y, w, h]) => `<rect x="${270 + (x - w) * 10}" y="${310 - (y + h) * 10}" width="${w * 20}" height="${h * 20}"/>`).join("")}</g>${polyline([...mainRoute, mainRoute[0]], "#7e9aab")}${[-4, 4].map((x) => polyline([xy(x, -8), xy(x, 14)], "#9bcbba")).join("")}<rect x="245" y="300" width="50" height="20" fill="#d1a281" fill-opacity=".35" stroke="#edc3a4"/><circle cx="270" cy="289" r="5" fill="none" stroke="#e5d5a5" stroke-width="2"/>${polyline(examples[1].counterSample || [], "#d9cb91")}<circle cx="270" cy="390" r="4" fill="#d9e6e3"/><g font-family="sans-serif" fill="#ece0c9"><text x="535" y="70" font-size="26">第十关：缄页禁库</text><text x="535" y="105" font-size="16">设计白盒 / 尚未接入运行时</text><text x="535" y="155" font-size="18">新判断：直接绕开，或先踩签撤掉一招</text><text x="535" y="190" font-size="15">墨框：L形书架与孤立书岛，中央半径6留空</text><text x="535" y="220" font-size="15">青线：两条独立内庭通路；灰线：巡回大环</text><text x="535" y="250" font-size="15">金线：空场印页组合中，一条踩签后存活样例</text><text x="535" y="310" font-size="20">Boss 三阶段</text><text x="535" y="345" font-size="16">I 100～70%：单印 / 单页 / 对称夹页</text><text x="535" y="380" font-size="16">II 70～35%：双印 / 印页 / 已教学斜向夹页</text><text x="535" y="415" font-size="16">III 35～0%：换向双印 / 反侧时序 / 偏心中缝</text><text x="535" y="465" font-size="15">两危险槽；每页各一槽，封签属于对应危险</text><text x="535" y="495" font-size="15">精英包括返场均100%正常生命；不回血、不锁血</text><text x="535" y="540" font-size="15">仅静态连通与六类合成样例，不代替实际战斗</text><text x="535" y="570" font-size="15">真人难度、成长、HUD遮挡及真机性能待开发验证</text></g></svg>`;
fs.writeFileSync(`${out}/layout.svg`, svg);
await sharp(Buffer.from(svg)).png().toFile(`${out}/layout.png`);
fs.writeFileSync(
  `${out}/whitebox.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
