/** Isolated headless integration test. Does not read or modify a user's Chrome profile. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  out = "artifacts/edge-stage";
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
  await c("Network.setUserAgentOverride", {
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  });
  await c("Page.navigate", { url: "http://127.0.0.1:8128" });
  for (let i = 0; i < 200; i++) {
    if (await run("Boolean(globalThis.__undead?.ready)")) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const report = {};
  report.setup = await run(
    `(()=>{const g=__undead;g.enabled=false;g.progress.data.stages=[1,2,3,4,5,6,7,8,9,10,11,12];g.selectedStage=13;g.restart();g.overlay.destroyAllChildren();const w=g.world;w.state='battle';w.pauses.add('qa');w.player={x:0,y:0};w.camera={x:0,y:0};w.time=400;w.enemies=[];for(const k of Object.keys(w.skills))w.skills[k]=0;const e=w.addEnemy('boss',4,1.4);e.state='windup';e.bossPhase=3;w.edge.state(e).action='C';w.edge.begin(e);w.effects.push({type:'bossPhase',...e,value:3});g.camera={x:0,y:0};g.stage.setPosition(0,0);g.update(0);return {stage:w.stageId,touch:g.touchMode,lines:w.hazards.length,announcement:g.announcement.string};})()`,
  );
  if (
    report.setup.stage !== 13 ||
    !report.setup.touch ||
    report.setup.lines !== 2 ||
    !report.setup.announcement.includes("III")
  )
    throw Error("Mobile Edge boot failed " + JSON.stringify(report.setup));
  for (const width of [844, 740]) {
    await c("Emulation.setDeviceMetricsOverride", {
      width,
      height: 390,
      deviceScaleFactor: 1,
      mobile: true,
    });
    for (const [state, offset] of [
      ["warning", -0.2],
      ["head", 0.7],
      ["park", 1.9],
      ["recall", 4.7],
    ]) {
      await run(
        `(()=>{const g=__undead,w=g.world;w.time=w.hazards[0].due+${offset};w.edge.syncBody(w.enemies.find(e=>e.kind==='boss'));g.update(0);g.painter.draw(w,0,[],true);return true;})()`,
      );
      await new Promise((r) => setTimeout(r, 150));
      const shot = await c("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(
        out + "/mobile-" + width + "-" + state + ".png",
        Buffer.from(shot.data, "base64"),
      );
    }
  }
  report.edges = [];
  for (const side of [-1, 1]) {
    const edge = await run(
      `(()=>{const g=__undead,w=g.world;w.hazards=[];w.enemies=[];w.time=400;w.player={x:0,y:${side}*25.2};g.camera={x:0,y:${side}*1124};w.camera={x:0,y:${side}*1124/48};g.stage.setPosition(0,-g.camera.y);const e=w.addEnemy('boss',4,${side}*23);e.state='seek';e.bossPhase=3;w.edge.state(e).action='C';const accepted=w.edge.begin(e);g.update(0);g.painter.draw(w,0,[],true);return {accepted,slots:w.edge.slots,legal:w.hazards.every(h=>w.edge.legal(h)),player:w.player,camera:w.camera};})()`,
    );
    if (!edge.accepted || edge.slots !== 2 || !edge.legal)
      throw Error("Edge edge snapshot invalid " + JSON.stringify(edge));
    report.edges.push(edge);
    await new Promise((r) => setTimeout(r, 150));
    const shot = await c("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      out + "/mobile-edge-" + side + ".png",
      Buffer.from(shot.data, "base64"),
    );
  }
  await c("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await run(
    `(()=>{const g=__undead,w=g.world;w.player={x:0,y:0};w.camera={x:0,y:0};g.camera={x:0,y:0};g.stage.setPosition(0,0);w.hazards=[];w.time=30;w.enemies=[];for(const [i,kind]of ['scrapbound','edgecaster','stepcutter','reelstalker','twinclamp','edgepuppeteer'].entries()){const e=w.addEnemy(kind,-9+i*3.5,0);e.state='seek';}g.update(0);g.painter.draw(w,0,[],false);return true;})()`,
  );
  await new Promise((r) => setTimeout(r, 150));
  {
    const shot = await c("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      out + "/desktop-faction.png",
      Buffer.from(shot.data, "base64"),
    );
  }
  for (const grade of [1, 2, 3]) {
    await run(
      `(()=>{const g=__undead,w=g.world;w.enemies=[];for(const s of Object.keys(w.skills))w.skills[s]=0;w.skills.water=8;w.weaponGrades.water=${grade};w.mods.water=['spring','pulse'];const e=w.addEnemy('scrapbound',3,0);e.hp=e.maxHp=1e6;e.state='seek';w.cooldowns.water=0;w.armory.shots=[];w.armory.fields=[];w.armory.step(0);w.cooldowns.water=100;for(let i=0;i<15;i++){w.time+=1/60;w.armory.step(1/60);}g.update(0);g.painter.draw(w,0,[],false);return true;})()`,
    );
    await new Promise((r) => setTimeout(r, 150));
    let shot = await c("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      out + "/water-grade-" + grade + ".png",
      Buffer.from(shot.data, "base64"),
    );
    await run(
      `(()=>{const g=__undead,w=g.world;for(let i=0;i<20;i++){w.time+=1/60;w.armory.step(1/60);}g.update(0);g.painter.draw(w,0,[],false);return true;})()`,
    );
    await new Promise((r) => setTimeout(r, 150));
    shot = await c("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      out + "/water-field-" + grade + ".png",
      Buffer.from(shot.data, "base64"),
    );
  }
  report.errors = events
    .filter((e) => e.method === "Runtime.exceptionThrown")
    .map((e) => e.params.exceptionDetails);
  fs.writeFileSync(
    out + "/mobile-browser.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) throw Error("Mobile runtime exceptions");
} finally {
  await cmd("Browser.close").catch(() => {});
  ws.close();
  child.kill();
}
