/** Stage19 design-only layout and sampled two-body/solo escape examples. No registration. */
import fs from "node:fs";
import ts from "typescript";
import sharp from "sharp";
const out = "artifacts/stage19-design";
fs.mkdirSync(out, { recursive: true });
const compiled = ts.transpileModule(
  fs.readFileSync("assets/scripts/battle/StageGrowth.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022 } },
).outputText;
const { stageReference, stageGrowth } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const boxes = [
  { x: -12, y: -12, hx: 2.3, hy: 1.1 },
  { x: 12, y: 12, hx: 2.3, hy: 1.1 },
  { x: -12, y: 12, hx: 1.1, hy: 2.3 },
  { x: 12, y: -12, hx: 1.1, hy: 2.3 },
  { x: -18, y: 0, hx: 0.8, hy: 1.8 },
  { x: 18, y: 0, hx: 0.8, hy: 1.8 },
];
const blocked = (p, r) =>
  Math.abs(p.x) > 22 - r ||
  Math.abs(p.y) > 26 - r ||
  boxes.some(
    (b) => Math.abs(p.x - b.x) < b.hx + r && Math.abs(p.y - b.y) < b.hy + r,
  );
function clear(a, b, r) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.025));
  for (let i = 0; i <= n; i++)
    if (
      blocked(
        { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n },
        r,
      )
    )
      return false;
  return true;
}
const paths = [
  [
    [0, -8],
    [-4, -8],
    [-4, 18],
    [0, 18],
  ],
  [
    [0, -8],
    [4, -8],
    [4, 18],
    [0, 18],
  ],
  [
    [0, -8],
    [0, -23.5],
    [-20.4, -23.5],
    [-20.4, 23.5],
    [20.4, 23.5],
    [20.4, -23.5],
    [0, -23.5],
    [0, -8],
  ],
].map((ps) => ps.map(([x, y]) => ({ x, y })));
function connected(r) {
  const free = new Set();
  for (let x = -44; x <= 44; x++)
    for (let y = -52; y <= 52; y++)
      if (!blocked({ x: x * 0.5, y: y * 0.5 }, r)) free.add(x + "," + y);
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
      const k = x + dx + "," + (y + dy);
      if (free.has(k) && !seen.has(k)) {
        seen.add(k);
        q.push([x + dx, y + dy]);
      }
    }
  }
  return {
    radius: r,
    freeCells: free.size,
    reachable: seen.size,
    connected: seen.size === free.size,
    routes: paths.map((ps) => ps.slice(1).every((p, i) => clear(ps[i], p, r))),
  };
}
const aim = (a, b) => Math.atan2(b.y - a.y, b.x - a.x),
  point = (p, a, d) => ({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d });
const segDist = (p, a, b) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    k = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - a.x - k * dx, p.y - a.y - k * dy);
};
function fan(p, b, a, r) {
  const delta = Math.abs(
      Math.atan2(Math.sin(aim(b, p) - a), Math.cos(aim(b, p) - a)),
    ),
    half = (70 * Math.PI) / 180;
  if (delta <= half) return Math.hypot(p.x - b.x, p.y - b.y) <= r + 0.3;
  return (
    Math.min(...[-1, 1].map((s) => segDist(p, b, point(b, a + s * half, r)))) <=
    0.3
  );
}
const scenes = [
  ["center", { x: 0, y: 0 }, { x: -3, y: -2 }, { x: 3.5, y: 1 }],
  ["edge", { x: 20, y: 0 }, { x: 20, y: -3.2 }, { x: 19.9, y: 4 }],
  ["corner", { x: 20, y: 24 }, { x: 16, y: 21.4 }, { x: 19, y: 20 }],
  ["plinth", { x: -8, y: -12 }, { x: -7, y: -15 }, { x: -6, y: -10 }],
];
const modes = ["duetA", "duetB", "hunterA", "hunterB", "wardenA", "wardenB"];
function example(start, hunter, warden, mode, d, turn, turnAt) {
  const dt = 1 / 120,
    p = { ...start },
    h = { ...hunter },
    r = { ...warden },
    events = [],
    attacks = [],
    locks = [];
  const add = (source, kind, at, length = 0, speed = 0) =>
    events.push({ source, kind, at, length, speed });
  if (mode === "duetA") {
    add("h", "charge", 0, 5.6, 4.8);
    add("r", "bolt", 0.9, 7, 5);
  }
  if (mode === "duetB") {
    add("r", "split", 0, 7, 5);
    add("h", "fan", 0.9, 3.5);
  }
  if (mode === "hunterA") add("h", "charge", 0, 5.6, 5);
  if (mode === "hunterB") add("h", "fan", 0, 3.5);
  if (mode === "wardenA") add("r", "split", 0, 7, 5);
  if (mode === "wardenB") add("r", "charge", 0, 3.8, 4.6);
  if (
    (mode.startsWith("hunter")
      ? [h]
      : mode.startsWith("warden")
        ? [r]
        : [h, r]
    ).some((b) => blocked(b, 0.7))
  )
    return null;
  let hit = false;
  for (let i = 0; i <= 1008; i++) {
    const t = i * dt;
    for (const e of events)
      if (!e.locked && t + 1e-8 >= e.at) {
        e.locked = true;
        const b = e.source === "h" ? h : r,
          a = aim(b, p),
          due = t + 2.4,
          end =
            due +
            (e.kind === "charge" || e.kind === "bolt" || e.kind === "split"
              ? e.length / e.speed
              : 0.2),
          origin = { ...b };
        if (
          e.kind === "charge" &&
          !clear(origin, point(origin, a, e.length), 0.7)
        )
          return null;
        attacks.push({ ...e, a, origin, due, end });
        locks.push({
          source: e.source,
          kind: e.kind,
          at: +t.toFixed(3),
          due: +due.toFixed(3),
          end: +end.toFixed(3),
        });
      }
    for (const a of attacks) {
      const body = a.source === "h" ? h : r;
      if (a.kind === "charge" && t >= a.due) {
        const pos = point(
          a.origin,
          a.a,
          Math.min(a.length, (t - a.due) * a.speed),
        );
        Object.assign(body, pos);
      }
      if (!a.follow && t + 1e-8 >= a.end) {
        a.follow = true;
        if (attacks.length === 1 && !mode.startsWith("duet")) {
          if (mode === "hunterA" || mode === "hunterB")
            add("h", "bolt", t, 6.6, 5.2);
          if (mode === "wardenA") add("r", "fan", t, 3.4);
          if (mode === "wardenB") add("r", "bolt", t, 6.6, 5.2);
        }
      }
    }
    if (t >= 0.35 && d >= 0) {
      const a = ((t < turnAt ? d : turn) * Math.PI) / 12,
        z = point(p, a, 4.2 * dt);
      if (!clear(p, z, 0.3)) return null;
      Object.assign(p, z);
    }
    if (mode.startsWith("duet") && Math.hypot(h.x - r.x, h.y - r.y) < 1.4)
      return null;
    if (
      [h, r].some((b, j) =>
        mode.startsWith("hunter") && j === 1
          ? false
          : mode.startsWith("warden") && j === 0
            ? false
            : Math.hypot(p.x - b.x, p.y - b.y) < 1,
      )
    )
      return null;
    for (const a of attacks)
      if (t >= a.due && t < a.end) {
        if (a.kind === "charge")
          hit ||=
            Math.hypot(
              p.x - (a.source === "h" ? h : r).x,
              p.y - (a.source === "h" ? h : r).y,
            ) <= 0.9;
        else if (a.kind === "fan") hit ||= fan(p, a.origin, a.a, a.length);
        else
          for (const offset of a.kind === "split"
            ? [(-28 * Math.PI) / 180, (28 * Math.PI) / 180]
            : [0]) {
            const b = point(a.origin, a.a + offset, (t - a.due) * a.speed);
            hit ||= Math.hypot(p.x - b.x, p.y - b.y) <= 0.62;
          }
      }
    if (hit) return null;
    if (
      attacks.length >= 2 &&
      events.every((e) => e.locked) &&
      t > Math.max(...attacks.map((a) => a.end)) + 0.05
    )
      return {
        firstDirectionDeg: d * 15,
        turnAt,
        afterTurnDirectionDeg: turn * 15,
        locks,
      };
  }
  return null;
}
const examples = [];
for (const [name, start, h, r] of scenes)
  for (const mode of modes) {
    let escape;
    for (const turnAt of [0.8, 1.3, 2, 2.7]) {
      if (escape) break;
      for (let d = 0; d < 24 && !escape; d++)
        for (let turn = 0; turn < 24 && !escape; turn++)
          escape = example(start, h, r, mode, d, turn, turnAt);
    }
    examples.push({ scene: name, mode, sampledEscape: escape ?? null });
  }
const ref = stageReference(19),
  prior = stageReference(18),
  total = ref.bossDps * ref.bossSeconds;
const report = {
  scope:
    "Design only: .5-grid connectivity, sampled path clearance and twenty-four isolated 120Hz examples with delayed locks and actual sampled body/head positions. No crowds, continuous runtime collision, viewport/HUD proof, AI, balance, human win rate or device QA.",
  boxes,
  connectivity: [connected(0.3), connected(0.7)],
  examples,
  budget: {
    ...ref,
    ...stageGrowth(19),
    total,
    hunter: total * 0.5,
    warden: total * 0.5,
    increasePercent: 100 * (total / (prior.bossDps * prior.bossSeconds) - 1),
    clearCoins: 460,
    ghostFineCost: 360,
    ghostRareCost: 720,
  },
  proposal: {
    initialBodies: 2,
    revivals: 0,
    oneSharedHpBudget: true,
    weaponSeries: 14,
    addedForms: 2,
    addedAchievements: 2,
    masteryCertificates: 24,
  },
};
fs.writeFileSync(
  out + "/whitebox.json",
  JSON.stringify(report, null, 2) + "\n",
);
const X = (x) => 270 + x * 10.5,
  Y = (y) => 367 - y * 10.5;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="760"><rect width="1040" height="760" fill="#151c25"/><style>text{font-family:Arial,'PingFang SC',sans-serif;fill:#eee8db}.small{font-size:16px;fill:#b5c6cf}</style><text x="30" y="42" font-size="26">19 · 双阙猎庭 / Design whitebox</text><rect x="${X(-22)}" y="${Y(26)}" width="462" height="546" fill="#26363a" stroke="#7d969d"/>${boxes.map((b) => `<rect x="${X(b.x - b.hx)}" y="${Y(b.y + b.hy)}" width="${b.hx * 21}" height="${b.hy * 21}" fill="#70837b" stroke="#d2c1a1"/>`).join("")}${paths.map((ps, i) => `<polyline points="${ps.map((p) => X(p.x) + "," + Y(p.y)).join(" ")}" fill="none" stroke="${["#8ed4b4", "#e6bd81", "#8cb7df"][i]}" stroke-width="2" stroke-dasharray="7 5"/>`).join("")}<circle cx="${X(0)}" cy="${Y(-8)}" r="5" fill="#fff"/><text x="${X(0) + 10}" y="${Y(-8) + 5}" class="small">Spawn</text><text x="35" y="688" class="small">Player r0.3 · two bodies r0.7 · clear inner lanes</text><text x="555" y="110" font-size="23">Two bodies · one total HP budget</text><rect x="555" y="140" width="210" height="19" fill="#dfb17d"/><rect x="765" y="140" width="210" height="19" fill="#8cb9da"/><text x="555" y="185" class="small">Hunter 50% / Warden 50%</text><text x="555" y="240" font-size="21">Choose which threat to remove first</text><text x="570" y="290" class="small">Hunter down → Warden learns a body dash</text><text x="570" y="327" class="small">Warden down → Hunter gains a ranged shot</text><text x="555" y="390" class="small">No heal · no revival · survivor remains hittable</text><text x="555" y="425" class="small">Every new lock gets a full 2.4s warning</text><text x="555" y="460" class="small">Two active sources reserve both danger slots</text><text x="555" y="525" font-size="23">Total: ${total.toFixed(1)} / 460 clear gold</text><text x="555" y="565" class="small">Ghost: fine + rare / 14 weapon families</text><text x="555" y="635" class="small">Static design; gameplay verification pending.</text></svg>`;
fs.writeFileSync(out + "/layout.svg", svg);
await sharp(Buffer.from(svg))
  .png()
  .toFile(out + "/layout.png");
if (
  report.connectivity.some((c) => !c.connected || c.routes.some((v) => !v)) ||
  examples.some((e) => !e.sampledEscape)
)
  throw Error("Stage19 design whitebox failed");
console.log(
  JSON.stringify(
    {
      connectivity: report.connectivity,
      budget: report.budget,
      examples: examples.map((e) => ({
        scene: e.scene,
        mode: e.mode,
        passed: !!e.sampledEscape,
      })),
    },
    null,
    2,
  ),
);
