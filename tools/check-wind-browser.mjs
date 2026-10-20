/** Isolated headless integration test. Does not read or modify a user's Chrome profile. */
import { spawn } from "node:child_process";
import fs from "node:fs";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  out = "artifacts/wind-stage";
fs.mkdirSync(out, { recursive: true });
const child = spawn(
  chrome,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=/private/tmp/undead-wind-browser-${process.pid}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=844,390",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
let stderr = "";
const endpoint = await new Promise((resolve, reject) => {
  child.stderr.on("data", (b) => {
    stderr += b;
    const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (match) resolve(match[1]);
  });
  child.on("error", reject);
  child.on("exit", (code) =>
    reject(Error("Chrome exited " + code + " " + stderr.slice(-1000))),
  );
  setTimeout(() => reject(Error("Chrome startup timeout")), 20000).unref();
});
const ws = new WebSocket(endpoint);
await new Promise((r, j) => {
  ws.onopen = r;
  ws.onerror = j;
});
let id = 0;
const pending = new Map(),
  events = [];
ws.onmessage = ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p?.reject(Error(JSON.stringify(m.error))) : p?.resolve(m.result);
  } else events.push(m);
};
const cmd = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(
      JSON.stringify({
        id: n,
        method,
        params,
        ...(sessionId ? { sessionId } : {}),
      }),
    );
  });
try {
  const { targetId } = await cmd("Target.createTarget", { url: "about:blank" }),
    { sessionId } = await cmd("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
  const c = (m, p) => cmd(m, p, sessionId),
    run = async (expression) => {
      const r = await c("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
      return r.result.value;
    };
  await c("Page.enable");
  await c("Runtime.enable");
  await c("Emulation.setDeviceMetricsOverride", {
    width: 844,
    height: 390,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await c("Page.navigate", { url: "http://127.0.0.1:8128" });
  let ready = false;
  for (let i = 0; i < 200; i++) {
    ready = await run("Boolean(globalThis.__undead?.ready)");
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw Error("Game did not boot");
  const initial = await run(
    "({ready:__undead.ready,stage:__undead.world.stageId})",
  );
  // Test account state exists only in this isolated temporary profile; no real save is touched.
  await run(
    `(()=>{const g=__undead;g.progress.data.stages=[8];g.menuScreens.showStageSelect(9);return true;})()`,
  );
  async function shot(name) {
    const r = await c("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(out + "/" + name + ".png", Buffer.from(r.data, "base64"));
  }
  await new Promise((r) => setTimeout(r, 250));
  await shot("browser-stage-select");
  const labels = await run(
    `(()=>{const g=__undead,all=[];function walk(n){for(const c of n.components||[])if(typeof c.string==='string')all.push(c.string);for(const c of n.children||[])walk(c);}walk(g.overlay);return all;})()`,
  );
  if (
    labels.some((x) => x.includes("虫巢")) ||
    !labels.some((x) => x.includes("断羽风廊"))
  )
    throw Error("Stage 9 missing from selection");
  await run(
    `(()=>{const g=__undead;g.selectedStage=9;g.restart();g.world.chooseStartingWeapon(g.world.startingWeapons[0]);g.world.level=64;g.world.hp=g.world.maxHp=1e8;return g.world.stageId;})()`,
  );
  await new Promise((r) => setTimeout(r, 300));
  const started = await run(
    "({stage:__undead.world.stageId,state:__undead.world.state,time:__undead.world.time,viewport:__undead.world.viewport})",
  );
  if (started.stage !== 9 || started.state !== "battle")
    throw Error("Stage 9 cannot start " + JSON.stringify(started));
  // Freeze simulation and display real Cocos HUD, actors and locked dual plan at the teaching moment.
  await run(
    `(()=>{const g=__undead,w=g.world;w.time=312;w.hp=w.maxHp=100;g.announcementLife=0;g.modLife=0;w.effects=[];w.enemies=[];w.hazards=[];w.player={x:0,y:0};g.camera={x:0,y:0};w.camera={x:0,y:0};for(const [k,x,y] of [['windarbiter',-3,0],['plumejudge',3,0],['fledglingeffigy',-4,-2],['foldedskimmer',5,2]]){const e=w.addEnemy(k,x,y);e.state='seek';e.attack=0;}const a=w.enemies[0];w.wind.stepEnemy(a,.01);w.pauses.add('screenshot');g.shown='';g.painter.draw(w,.1,[],g.preferences.powerSaving);return w.hazards.length;})()`,
  );
  await new Promise((r) => setTimeout(r, 200));
  await shot("browser-dual-warning");
  const warning = await run(
    "({hazards:__undead.world.hazards.length,slots:__undead.world.wind.slots,pairs:__undead.world.wind.stats.pairs})",
  );
  if (warning.pairs < 1) throw Error("Pair not published in browser");
  await run(
    `(()=>{const w=__undead.world;w.time+=2.7;for(const h of w.hazards)w.wind.stepHazard(h);__undead.painter.draw(w,.1,[],__undead.preferences.powerSaving);return true;})()`,
  );
  await new Promise((r) => setTimeout(r, 200));
  await shot("browser-dual-active");
  // Let the built game actually run a short normal combat slice at every stage segment.
  const checkpoints = [];
  for (const time of [30, 70, 100, 135, 225, 305, 311, 360]) {
    checkpoints.push(
      await run(
        `(()=>{const g=__undead;g.restart();const w=g.world;w.chooseStartingWeapon(w.startingWeapons[0]);w.level=64;w.time=${time};w.hp=w.maxHp=1e8;w.director.step(w,0);for(let i=0;i<90;i++){w.step(1/30);w.drain();}w.pauses.add('screenshot');return {time:${time},stage:w.stageId,state:w.state,enemies:w.enemies.map(e=>e.kind),slots:w.wind.slots};})()`,
      ),
    );
  }
  const errors = events
    .filter((e) => e.method === "Runtime.exceptionThrown")
    .map((e) => e.params.exceptionDetails);
  const report = {
    initial,
    started,
    selectionLabels: labels,
    warning,
    checkpoints,
    errors,
  };
  fs.writeFileSync(
    out + "/browser-report.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) throw Error("Browser runtime exceptions");
} finally {
  await cmd("Browser.close").catch(() => {});
  ws.close();
  child.kill();
}
