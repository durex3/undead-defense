/** Isolated headless integration test. Does not read or modify a user's Chrome profile. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  out = "artifacts/blade-hunt-0.38.2";
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
  const report={grades:[]};
  for(const grade of [1,2,3,4]){
    const r=await run(`(()=>{const g=__undead;g.progress.data.coins=400;g.selectedStage=1;g.restart();const w=g.world;w.state='battle';w.cards=[];w.enemies=[];w.player={x:0,y:0};w.camera={x:0,y:0};g.camera={x:0,y:0};for(const s of Object.keys(w.skills))w.skills[s]=0;w.skills.blade=3;w.weaponGrades.blade=${grade};const e=w.addEnemy('siegebow',6,0);e.hp=e.maxHp=1e6;e.state='seek';w.armory.step(0);w.skills.blade=4;w.step(0);const old=w.armory.shots.filter(p=>p.active&&p.orbit).length,cd=w.cooldowns.blade;g.chooseMod('hunt');w.pause('capture',true);g.menuScreens.redraw();g.painter.draw(w,0,w.drain(),true);return {grade:${grade},old,immediateOrbit:w.armory.shots.filter(p=>p.active&&p.orbit).length,cd,afterCD:w.cooldowns.blade,mods:w.mods.blade};})()`);
    if(r.immediateOrbit!==0||r.cd!==r.afterCD||!r.mods.includes('hunt'))throw Error('Hunt transition failed '+JSON.stringify(r));
    if(grade===4)await shot('epic-hunt-installed');
    const flight=await run(`(()=>{const g=__undead,w=g.world;for(let t=0;t<${r.cd}+.1;t+=1/120){w.time+=1/120;w.armory.step(1/120);}g.painter.draw(w,0,w.drain(),true);return{orbit:w.armory.shots.filter(p=>p.active&&p.orbit).length,hunt:w.armory.shots.filter(p=>p.active&&!p.orbit&&!p.child).length};})()`);
    if(flight.orbit!==0||flight.hunt===0)throw Error('Hunt flight missing');r.flight=flight;
    if(grade===4)await shot('epic-hunt-projectiles-844');
    r.damage=await run(`(()=>{const w=__undead.world;for(let i=0;i<90;i++){w.time+=1/120;w.armory.step(1/120);}return w.damage.blade||0;})()`);if(r.damage<=0)throw Error('Hunt no actual damage');report.grades.push(r);
  }
  await c('Emulation.setDeviceMetricsOverride',{width:740,height:390,deviceScaleFactor:1,mobile:true});
  await run(`(()=>{const g=__undead,w=g.world;w.cooldowns.blade=0;w.armory.step(0);for(let i=0;i<12;i++){w.time+=1/120;w.armory.step(1/120);}g.painter.draw(w,0,w.drain(),true);return true;})()`);await shot('epic-hunt-projectiles-740');
  report.coins=await run('__undead.stats.string');if(!report.coins.includes('金币 400'))throw Error('Coin display regression');
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
