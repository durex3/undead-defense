/** Design only: map connectivity, literal echo geometry, timing and one empty-arena escape. */
import fs from "node:fs";
import sharp from "sharp";
import ts from "typescript";
const out = "artifacts/stage16-design";
fs.mkdirSync(out, { recursive: true });
const compiled = ts.transpileModule(
  fs.readFileSync("assets/scripts/battle/StageGrowth.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022 } },
).outputText;
const { stageGrowth, stageReference } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const boxes = [
  { x: -9, y: -10, hx: 2.8, hy: 1 },
  { x: 9, y: 10, hx: 2.8, hy: 1 },
  { x: -9, y: 10, hx: 1, hy: 2.8 },
  { x: 9, y: -10, hx: 1, hy: 2.8 },
  { x: -17, y: 0, hx: 1, hy: 2.8 },
  { x: 17, y: 0, hx: 1, hy: 2.8 },
];
const blocked = (x, y, r) =>
  Math.abs(x) > 22 - r ||
  Math.abs(y) > 26 - r ||
  boxes.some(
    (b) => Math.abs(x - b.x) < b.hx + r && Math.abs(y - b.y) < b.hy + r,
  );
const routes = [
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
      z = path[i],
      n = Math.ceil(Math.hypot(z[0] - a[0], z[1] - a[1]) / 0.025);
    for (let j = 0; j <= n; j++)
      if (
        blocked(
          a[0] + ((z[0] - a[0]) * j) / n,
          a[1] + ((z[1] - a[1]) * j) / n,
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
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
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
    routes: routes.map((p) => clear(p, r)),
  };
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function pointSegment(p, a, z) {
  const dx = z.x - a.x,
    dy = z.y - a.y,
    k = clamp(
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      0,
      1,
    );
  return Math.hypot(p.x - a.x - dx * k, p.y - a.y - dy * k);
}
/** Exact point distance to a finite filled sector, used only for isolated static design probes. */
function sectorDistance(p, s) {
  const dx = p.x - s.origin.x,
    dy = p.y - s.origin.y,
    c = Math.cos(s.angle),
    n = Math.sin(s.angle),
    q = { x: dx * c + dy * n, y: -dx * n + dy * c },
    r = Math.hypot(q.x, q.y),
    a = Math.abs(Math.atan2(q.y, q.x));
  if (a <= s.halfAngle && r <= s.radius) return 0;
  const z1 = {
      x: s.radius * Math.cos(s.halfAngle),
      y: s.radius * Math.sin(s.halfAngle),
    },
    z2 = { x: z1.x, y: -z1.y };
  return Math.min(
    pointSegment(q, { x: 0, y: 0 }, z1),
    pointSegment(q, { x: 0, y: 0 }, z2),
    a <= s.halfAngle ? Math.abs(r - s.radius) : Infinity,
  );
}
const first = {
  origin: { x: 0, y: 0 },
  angle: 0,
  halfAngle: Math.PI / 4,
  radius: 4.2,
  due: 2.4,
  end: 2.58,
};
const echo = {
  ...first,
  origin: { ...first.origin },
  due: first.end + 2.4,
  end: first.end + 2.58,
};
const core = {
  origin: { x: 0, y: 1.8 },
  angle: 0,
  halfAngle: (50 * Math.PI) / 180,
  radius: 4.2,
  due: 2.4,
  end: 2.58,
};
const paired = [{ ...first }, { ...core, due: 3.2, end: 3.38 }],
  start = { x: 1, y: 1.2 };
let escaped = true,
  minClearance = Infinity;
for (let i = 0; i <= 4000; i++) {
  const t = i * 0.001,
    p = { x: start.x - 4.2 * Math.max(0, t - 0.35), y: start.y };
  if (blocked(p.x, p.y, 0.3)) {
    escaped = false;
    break;
  }
  for (const s of paired)
    if (t >= s.due && t < s.end) {
      const gap = sectorDistance(p, s) - 0.3;
      minClearance = Math.min(minClearance, gap);
      if (gap <= 0) escaped = false;
    }
}
const transition = { lethalAt: 10, releasedEnd: 10.12, revivalSeconds: 2.4 };
transition.reviveAt =
  Math.max(transition.lethalAt, transition.releasedEnd) +
  transition.revivalSeconds;
const growth = stageGrowth(16),
  reference = stageReference(16),
  total = growth.bossHealth * 8400,
  firstHP = total * 0.4,
  secondHP = total - firstHP;
const checks = {
  echoSameGeometry:
    JSON.stringify({ ...first, due: 0, end: 0 }) ===
    JSON.stringify({ ...echo, due: 0, end: 0 }),
  echoFullWarning: echo.due - first.end,
  fullDiskNotRadiusShortcut: sectorDistance({ x: -1, y: 0 }, first) > 0.3,
  originCovered: sectorDistance({ x: 0, y: 0 }, first) === 0,
  outerTangent: Math.abs(sectorDistance({ x: 4.5, y: 0 }, first) - 0.3) < 1e-8,
  backSafe: sectorDistance({ x: -1, y: 0 }, first) > 0.3,
  pairedBaseSpeedEscape: {
    start,
    reaction: 0.35,
    speed: 4.2,
    seconds: 4,
    minClearance,
    valid: escaped,
  },
  twoFormHPAddsExactly: Math.abs(firstHP + secondHP - total) < 1e-8,
};
const report = {
  status: "design-only",
  scope:
    "Static connectivity and isolated sector/echo/timing arithmetic. No playable stage16 or resurrection implementation.",
  layout: { boxes, routes, actors: [connected(0.3), connected(0.7)] },
  sector: { first, echo, paired, checks },
  revival: { ...transition, revives: 1, rewardSettlements: 1 },
  growth: {
    ...growth,
    ...reference,
    totalBossHP: total,
    firstHP,
    secondHP,
    firstHudHP: Math.ceil(firstHP),
    secondHudHP: Math.ceil(secondHP),
    totalHudHP: Math.ceil(total),
    bossIncreaseOver15: total / (stageGrowth(15).bossHealth * 8400) - 1,
    recovery: 0.35,
    clearCoins: 400,
    totalCoins1to16: 4000,
  },
  limits: [
    "No moving-crowd or all Boss-pattern joint-escape validation",
    "No lifecycle state interception, damage ownership, supplies, achievement, save or weapon implementation",
    "No projected mobile/HUD or actual Cocos verification",
    "No gameplay registration, game build, upload or human difficulty validation",
  ],
};
if (
  report.layout.actors.some((a) => !a.connected || a.routes.some((v) => !v)) ||
  !checks.echoSameGeometry ||
  Math.abs(checks.echoFullWarning - 2.4) > 1e-9 ||
  !escaped ||
  !checks.twoFormHPAddsExactly ||
  !checks.outerTangent ||
  !checks.backSafe
)
  throw Error("Stage16 design check failed");
fs.writeFileSync(
  out + "/whitebox.json",
  JSON.stringify(report, null, 2) + "\n",
);
const X = 310,
  Y = 330,
  S = 11,
  xy = ([x, y]) => `${X + x * S},${Y - y * S}`,
  rects = boxes
    .map(
      (b) =>
        `<rect x="${X + (b.x - b.hx) * S}" y="${Y - (b.y + b.hy) * S}" width="${2 * b.hx * S}" height="${2 * b.hy * S}" fill="#616c67" stroke="#c4bfa6"/>`,
    )
    .join(""),
  lines = routes
    .map(
      (p, i) =>
        `<polyline points="${p.map(xy).join(" ")}" fill="none" stroke="${["#8ec9be", "#d7bb8c", "#b2add6"][i]}" stroke-width="3" stroke-dasharray="5 4"/>`,
    )
    .join("");
const fan = (x, y, c) => {
  const points = [
    [x, y],
    ...Array.from({ length: 19 }, (_, i) => [
      x + Math.cos(-Math.PI / 4 + (i * Math.PI) / 36) * 4.2,
      y + Math.sin(-Math.PI / 4 + (i * Math.PI) / 36) * 4.2,
    ]),
  ];
  return `<polygon points="${points.map(xy).join(" ")}" fill="${c}" fill-opacity=".17" stroke="${c}"/>`;
};
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="710"><rect width="620" height="710" fill="#1b2525"/><text x="310" y="25" text-anchor="middle" fill="#eadfc5" font-size="20">16 · ECHO GRAVE / DESIGN</text><rect x="68" y="44" width="484" height="572" fill="#2e3935" stroke="#a4b6ac"/>${rects}${lines}${fan(0, 0, "#c4dcc2")}${fan(0, 1.8, "#c4b5dd")}<circle cx="310" cy="418" r="6" fill="#edcd7f"/><text x="310" y="645" text-anchor="middle" fill="#e5dfc8" font-size="14">One resurrection / two forms / one total health budget</text><text x="310" y="675" text-anchor="middle" fill="#adbbb7" font-size="13">Historical scar + current body, every echo has full warning</text><text x="310" y="697" text-anchor="middle" fill="#adbbb7" font-size="13">Design probes only; not playable or uploaded</text></svg>`;
fs.writeFileSync(out + "/layout.svg", svg);
await sharp(Buffer.from(svg))
  .png()
  .toFile(out + "/layout.png");
console.log(
  JSON.stringify(
    {
      layout: report.layout.actors,
      checks,
      revival: report.revival,
      growth: report.growth,
    },
    null,
    2,
  ),
);
