/** Isolated headless integration test. Does not read or modify a user's Chrome profile. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  out = "artifacts/library-stage";
fs.mkdirSync(out, { recursive: true });
const child = spawn(
  chrome,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=/private/tmp/undead-library-browser-${process.pid}`,
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
  const labelsOf = `(()=>{const all=[];function walk(n){for(const c of n.components||[])if(typeof c.string==='string')all.push(c.string);for(const c of n.children||[])walk(c);}walk(__undead.overlay);return all;})()`;
  await run(
    `(()=>{const g=__undead;g.progress.data.stages=[9];g.menuScreens.showStageSelect(10);return true;})()`,
  );
  async function shot(name) {
    const r = await c("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(out + "/" + name + ".png", Buffer.from(r.data, "base64"));
  }
  await new Promise((r) => setTimeout(r, 200));
  await shot("browser-stage-select");
  const labels = await run(labelsOf);
  if (
    !labels.some((x) => x.includes("10 · 缄页禁库")) ||
    !labels.some((x) => x.includes("280"))
  )
    throw Error("Tenth stage selection/reward missing");
  await run(
    `(()=>{const g=__undead;g.selectedStage=10;g.restart();g.world.chooseStartingWeapon(g.world.startingWeapons[0]);g.world.level=64;g.world.hp=g.world.maxHp=1e8;return true;})()`,
  );
  await new Promise((r) => setTimeout(r, 200));
  const started = await run(
    "({stage:__undead.world.stageId,state:__undead.world.state,viewport:__undead.world.viewport})",
  );
  if (started.stage !== 10 || started.state !== "battle")
    throw Error("Tenth stage cannot start");
  await run(
    `(()=>{const g=__undead,w=g.world;w.time=312;w.hp=w.maxHp=100;g.announcementLife=g.modLife=0;w.effects=[];w.enemies=[];w.hazards=[];w.player={x:0,y:0};g.camera={x:0,y:0};w.camera={x:0,y:0};for(const [k,x,y] of [['sealprovost',-3,0],['claspjailer',4,0],['paperbonegrub',-4,-2],['folioray',5,2]]){const e=w.addEnemy(k,x,y);e.state='seek';e.attack=0;}const a=w.enemies[0];w.library.state(a).action='pair';w.library.begin(a);w.pauses.add('screenshot');g.shown='';g.painter.draw(w,.1,[],g.preferences.powerSaving);return w.hazards.length;})()`,
  );
  await new Promise((r) => setTimeout(r, 200));
  await shot("browser-two-signs");
  const signPositions = await run(
    `__undead.world.hazards.map(h=>h.library.seal)`,
  );
  const pixels = await sharp(out + "/browser-two-signs.png")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const signPixels = signPositions.map((p) => {
    const cx = 422 + p.x * 26,
      cy = 195 - p.y * 26;
    let n = 0;
    for (
      let y = Math.max(0, Math.floor(cy - 18));
      y < Math.min(390, Math.ceil(cy + 18));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(cx - 18));
        x < Math.min(844, Math.ceil(cx + 18));
        x++
      ) {
        const r = Math.hypot(x - cx, y - cy),
          i = (y * pixels.info.width + x) * 4;
        if (
          r >= 9 &&
          r <= 17 &&
          pixels.data[i] > 175 &&
          pixels.data[i + 1] > 150 &&
          pixels.data[i + 2] < 190
        )
          n++;
      }
    return n;
  });
  if (signPixels.some((n) => n < 40))
    throw Error(
      "Seals are not visually legible: " + JSON.stringify(signPixels),
    );

  const counter = await run(
    `(()=>{const g=__undead,w=g.world,[a,b]=w.hazards,seal={...a.library.seal},before=JSON.stringify({x:b.x,y:b.y,angle:b.angle,due:b.due,velocity:b.library.velocity});w.player={x:seal.x,y:seal.y-.9};w.pauses.clear();w.setMove(0,1);for(let i=0;i<12;i++)w.step(1/30);w.setMove(0,0);w.pauses.add('screenshot');g.painter.draw(w,.1,w.drain(),g.preferences.powerSaving);return {stepped:w.library.stats.stepped,cancelled:a.library.countered,siblingCancelled:!!b.library.cancelled,slots:w.library.slots,siblingUnchanged:before===JSON.stringify({x:b.x,y:b.y,angle:b.angle,due:b.due,velocity:b.library.velocity})};})()`,
  );
  if (
    counter.stepped !== 1 ||
    !counter.cancelled ||
    counter.siblingCancelled ||
    counter.slots !== 1 ||
    !counter.siblingUnchanged
  )
    throw Error("Actual foot counter failed " + JSON.stringify(counter));
  await new Promise((r) => setTimeout(r, 150));
  await shot("browser-one-sign-cancelled");
  const phases = [];
  for (const phase of [1, 2, 3]) {
    phases.push(
      await run(
        `(()=>{const g=__undead;g.restart();const w=g.world;w.chooseStartingWeapon(w.startingWeapons[0]);w.level=64;w.time=390;w.hp=w.maxHp=100;w.player={x:0,y:0};w.camera={x:0,y:0};g.camera={x:0,y:0};g.announcementLife=g.modLife=0;w.effects=[];w.enemies=[];w.hazards=[];const e=w.addEnemy('boss',-3,0);e.state='seek';e.attack=0;w.library.state(e);e.hp=e.maxHp*${phase === 1 ? 1 : phase === 2 ? 0.69 : 0.34};const hp=e.hp;if(${phase}>1){w.library.stepEnemy(e,.01);if(e.library.action!=='transition')throw Error('Missing transition');w.time=e.library.next+.01;w.library.stepEnemy(e,.01);w.time+=1.1;w.library.stepEnemy(e,1.1);}e.state='seek';e.library.step=0;e.library.action='${phase === 1 ? "A" : phase === 2 ? "B" : "C"}';w.library.begin(e);w.pauses.add('screenshot');g.shown='';g.painter.draw(w,.1,[],g.preferences.powerSaving);return {requested:${phase},actual:e.bossPhase,hp:e.hp,expectedHp:hp,slots:w.library.slots,hazards:w.hazards.map(h=>({shape:h.library.shape,order:h.library.order,due:h.due,created:h.created}))};})()`,
      ),
    );
    await new Promise((r) => setTimeout(r, 180));
    await shot("browser-boss-phase-" + phase);
    const text = await run(`__undead.bossHealthLabel.string`);
    if (
      !text.includes(["第一阶段 I", "第二阶段 II", "第三阶段 III"][phase - 1])
    )
      throw Error("Wrong phase label " + text);
    if (
      phases.at(-1).actual !== phase ||
      phases.at(-1).hp !== phases.at(-1).expectedHp
    )
      throw Error("Incorrect phase health/state");
  }
  const pause = await run(
    `(()=>{const w=__undead.world,t=w.time,plan=JSON.stringify(w.hazards);w.step(2);return {timeUnchanged:w.time===t,planUnchanged:JSON.stringify(w.hazards)===plan};})()`,
  );
  if (!pause.timeUnchanged || !pause.planUnchanged)
    throw Error("Pause changed plan");
  const errors = events
      .filter((e) => e.method === "Runtime.exceptionThrown")
      .map((e) => e.params.exceptionDetails),
    report = {
      initial,
      started,
      selectionLabels: labels,
      counter,
      signPixels,
      phases,
      pause,
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
