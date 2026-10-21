/** Isolated headless integration test. Does not read or modify a user's Chrome profile. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  out = "artifacts/coin-ui-0.38.1";
fs.mkdirSync(out, { recursive: true });
const child = spawn(
  chrome,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=/private/tmp/undead-save-recovery-browser-${process.pid}`,
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

  const labelsOf = `(()=>{const all=[];function walk(n){for(const c of n.components||[])if(typeof c.string==='string')all.push(c.string);for(const c of n.children||[])walk(c);}walk(__undead.overlay);return all;})()`;
  async function shot(name) {
    await new Promise((r) => setTimeout(r, 150));
    const r = await c("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(out + "/" + name + ".png", Buffer.from(r.data, "base64"));
  }
  const report={};
  report.start=await run(`(()=>{const g=__undead;g.progress.data.coins=400;g.menuScreens.showStart();return (()=>{const all=[];function walk(n){for(const c of n.components||[])if(typeof c.string==='string')all.push(c.string);for(const c of n.children||[])walk(c);}walk(g.overlay);return all;})();})()`);
  if(!report.start.some(s=>s==='账户金币 400'))throw Error('Start coins missing');await shot('start-coins-844');
  report.battle=await run(`(()=>{const g=__undead;g.selectedStage=1;g.restart();g.world.state='battle';g.world.pause('capture',true);g.overlay.destroyAllChildren();return true;})()`);await shot('health-coins-844');
  report.battle=await run(`__undead.stats.string`);if(!report.battle.includes('生命 100 · 金币 400'))throw Error('Health coins missing');
  await c('Emulation.setDeviceMetricsOverride',{width:740,height:390,deviceScaleFactor:1,mobile:true});await shot('health-coins-740');
  report.changed=await run(`(()=>{__undead.progress.data.coins=40;return true;})()`);await shot('health-coins-updated');report.changed=await run('__undead.stats.string');if(!report.changed.includes('金币 40'))throw Error('Coins stale');
  await run(`(()=>{__undead.progress.data.coins=0;return true;})()`);await shot('health-coins-zero');report.zero=await run('__undead.stats.string');if(!report.zero.includes('金币 0'))throw Error('Zero coins missing');
  await run(`(()=>{const g=__undead;g.progress.data.coins=10000000;g.world.hp=100;g.world.maxHp=100;g.world.level=64;g.world.kills=99999;g.world.time=9999;return true;})()`);await shot('health-coins-large');
  await run('__undead.menuScreens.showStart();true');await shot('start-coins-740');
  report.errors = events
    .filter((e) => e.method === "Runtime.exceptionThrown")
    .map((e) => e.params.exceptionDetails);
  fs.writeFileSync(
    out + "/browser-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) throw Error("Runtime exceptions");
} finally {
  await cmd("Browser.close").catch(() => {});
  ws.close();
  child.kill();
}
