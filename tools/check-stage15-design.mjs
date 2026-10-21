/** Design-only static blockout, arithmetic and isolated airborne-crossing sample. */
import fs from "node:fs";
import sharp from "sharp";
import ts from "typescript";
const out = "artifacts/stage15-design";
fs.mkdirSync(out, { recursive: true });
const compiled = ts.transpileModule(
  fs.readFileSync("assets/scripts/battle/StageGrowth.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022 } },
).outputText;
const { stageGrowth, stageReference } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const boxes = [
  { x: -11, y: -12, hx: 3, hy: 1.1 },
  { x: 11, y: 12, hx: 3, hy: 1.1 },
  { x: -11, y: 12, hx: 1.1, hy: 3 },
  { x: 11, y: -12, hx: 1.1, hy: 3 },
  { x: -18, y: 0, hx: 0.8, hy: 2.6 },
  { x: 18, y: 0, hx: 0.8, hy: 2.6 },
];
const blocked = (x, y, r) =>
  Math.abs(x) > 22 - r ||
  Math.abs(y) > 26 - r ||
  boxes.some(
    (b) => Math.abs(x - b.x) < b.hx + r && Math.abs(y - b.y) < b.hy + r,
  );
const paths = [
  [
    [0, -8],
    [-3, -8],
    [-3, 17],
    [0, 17],
  ],
  [
    [0, -8],
    [3, -8],
    [3, 17],
    [0, 17],
  ],
  [
    [0, -8],
    [0, -23.5],
    [-20.2, -23.5],
    [-20.2, 23.5],
    [20.2, 23.5],
    [20.2, -23.5],
    [0, -23.5],
    [0, -8],
  ],
];
function clear(path, r) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.025);
    for (let j = 0; j <= n; j++)
      if (
        blocked(
          a[0] + ((b[0] - a[0]) * j) / n,
          a[1] + ((b[1] - a[1]) * j) / n,
          r,
        )
      )
        return false;
  }
  return true;
}
function connected(r) {
  const free = new Set();
  for (let x = -44; x <= 44; x++)
    for (let y = -52; y <= 52; y++)
      if (!blocked(x * 0.5, y * 0.5, r)) free.add(`${x},${y}`);
  const seen = new Set(["0,-16"]),
    q = [[0, -16]];
  for (let head = 0; head < q.length; head++) {
    const [x, y] = q[head];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const key = `${x + dx},${y + dy}`;
      if (free.has(key) && !seen.has(key)) {
        seen.add(key);
        q.push([x + dx, y + dy]);
      }
    }
  }
  return {
    radius: r,
    freeCells: free.size,
    reachable: seen.size,
    connected: free.size === seen.size,
    routes: paths.map((p) => clear(p, r)),
  };
}
const warning = 2.4,
  flight = 0.8,
  contact = 0.16,
  radius = 0.8;
const landings = Array.from({ length: 3 }, (_, i) => ({
  due: warning + i * (flight + contact),
  until: warning + i * (flight + contact) + contact,
}));
const chains = [
  { created: 0, until: landings.at(-1).until },
  { created: 0, until: landings.at(-1).until + 0.8 },
];
let peak = 0;
for (let t = 0; t < 6; t += 0.002)
  peak = Math.max(
    peak,
    chains.filter((h) => t >= h.created && t < h.until).length,
  );
// One already released inter-landing flight: P1(-1.2,0)->P2(1.2,0), t=1.0..1.8.
// Player crosses perpendicularly at base speed, then keeps moving clear of the next impact.
const airborne = {
  start: 1,
  end: 1.8,
  H: 1.4,
  from: { x: -1.2, y: 0 },
  to: { x: 1.2, y: 0 },
};
const begin = 1.29,
  end = 1.51,
  player = (t) => ({ x: 0, y: 4.2 * (t - 1.4) });
let minHeight = Infinity,
  minShadowDistance = Infinity,
  walkable = true;
for (let i = 0; i <= 220; i++) {
  const t = begin + ((end - begin) * i) / 220,
    u = (t - airborne.start) / flight,
    p = player(t),
    z = 4 * airborne.H * u * (1 - u),
    shadow = { x: -1.2 + 2.4 * u, y: 0 };
  minHeight = Math.min(minHeight, z);
  minShadowDistance = Math.min(
    minShadowDistance,
    Math.hypot(p.x - shadow.x, p.y - shadow.y),
  );
  if (blocked(p.x, p.y, 0.3)) walkable = false;
}
const nextClearance = Math.hypot(player(1.8).x - 1.2, player(1.8).y);
const reference = stageReference(15),
  growth = stageGrowth(15),
  hp = growth.bossHealth * 8400;
const report = {
  status: "design-only",
  scope:
    "Static connected routes, authored timing, a single unobstructed mid-air crossing and fixed formula budgets; not runtime combat validation.",
  layout: { boxes, paths, actors: [connected(0.3), connected(0.7)] },
  timing: {
    warning,
    flight,
    contact,
    radius,
    landings,
    secondChainOffset: 0.8,
    peakReservedSlots: peak,
    firstLaunch: warning - flight,
  },
  crossing: {
    from: player(begin),
    to: player(end),
    seconds: end - begin,
    baseSpeed: 4.2,
    sideMargin: 0.45,
    minHeight,
    requiredHeight: 0.9,
    minShadowDistance,
    maxShadowDistance: 0.4,
    walkable,
    nextImpactClearance: nextClearance,
    requiredClearance: radius + 0.3,
    valid:
      player(begin).y <= -0.45 &&
      player(end).y >= 0.45 &&
      minHeight >= 0.9 &&
      minShadowDistance <= 0.4 &&
      walkable &&
      nextClearance > radius + 0.3,
  },
  growth: {
    ...growth,
    ...reference,
    bossHP: hp,
    bossHudHP: Math.ceil(hp),
    bossIncreaseOver14: hp / (stageGrowth(14).bossHealth * 8400) - 1,
    recovery: Math.max(0.35, 0.9 ** 11),
    elite135: 30 * 1.45 * 11.4 * 2 * growth.elite,
    elite225: 30 * 1.75 * 12 * 2 * growth.elite,
    clearCoins: 380,
    totalCoins1to15: 3600,
  },
  limitations: [
    "No stage15 runtime registration, AI, collision implementation, saves or purchases",
    "No joint dual-chain escape or all nine Boss variants validated",
    "No actual Cocos mobile projection, frame-rate or human difficulty checks",
    "No gameplay build or WeChat upload",
  ],
};
if (
  report.layout.actors.some((a) => !a.connected || a.routes.some((v) => !v)) ||
  !report.crossing.valid ||
  peak > 2 ||
  landings.some((x) => x.due < warning)
)
  throw Error("Stage15 design whitebox failed");
fs.writeFileSync(
  out + "/whitebox.json",
  JSON.stringify(report, null, 2) + "\n",
);
const X = 310,
  Y = 330,
  S = 11,
  xy = (x, y) => `${X + x * S},${Y - y * S}`;
const rects = boxes
  .map(
    (b) =>
      `<rect x="${X + (b.x - b.hx) * S}" y="${Y - (b.y + b.hy) * S}" width="${b.hx * 2 * S}" height="${b.hy * 2 * S}" fill="#62686a" stroke="#c8b697"/>`,
  )
  .join("");
const routes = paths
  .map(
    (p, i) =>
      `<polyline points="${p.map(([x, y]) => xy(x, y)).join(" ")}" fill="none" stroke="${["#8dc8c3", "#d8b980", "#a5a9d4"][i]}" stroke-width="3" stroke-dasharray="5 4"/>`,
  )
  .join("");
const targets = [
    [-3, 1],
    [0, 1],
    [2.4, 2.2],
  ],
  marks = targets
    .map(
      ([x, y], i) =>
        `<circle cx="${X + x * S}" cy="${Y - y * S}" r="${radius * S}" fill="none" stroke="#e4c694"/><text x="${X + x * S}" y="${Y - y * S + 4}" text-anchor="middle" fill="#f3e2bd" font-size="12">${i + 1}</text>`,
    )
    .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="710"><rect width="620" height="710" fill="#1c2229"/><text x="310" y="25" text-anchor="middle" fill="#eadbc1" font-size="20">15 · LEAD FOUNDRY / DESIGN</text><rect x="68" y="44" width="484" height="572" fill="#303638" stroke="#a9b0ad"/>${rects}${routes}${marks}<polyline points="${targets.map(([x, y]) => xy(x, y)).join(" ")}" fill="none" stroke="#a39f96" stroke-dasharray="2 5"/><circle cx="310" cy="418" r="6" fill="#edcd7f"/><text x="310" y="646" text-anchor="middle" fill="#d0d8dc" font-size="14">Airborne is safe / only brief landings cause damage</text><text x="310" y="675" text-anchor="middle" fill="#a5b0bd" font-size="13">Static blockout and one crossing example only</text><text x="310" y="695" text-anchor="middle" fill="#a5b0bd" font-size="13">Not registered, playable, built or uploaded</text></svg>`;
fs.writeFileSync(out + "/layout.svg", svg);
await sharp(Buffer.from(svg))
  .png()
  .toFile(out + "/layout.png");
console.log(
  JSON.stringify(
    {
      layout: report.layout.actors,
      timing: report.timing,
      crossing: report.crossing,
      growth: report.growth,
    },
    null,
    2,
  ),
);
