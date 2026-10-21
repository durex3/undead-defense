/** Isolated headless integration test. Does not read or modify a user's Chrome profile. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  out = "artifacts/blade-shards-0.38.3/browser";
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
  const report={cases:[]};
  for(const grade of [1,2,3,4])for(const partner of ['orbit','hunt','return']){
    const r=await run(`(()=>{const g=__undead;g.progress.data.coins=400;g.selectedStage=1;g.restart();const w=g.world;w.state='battle';w.cards=[];w.enemies=[];w.player={x:0,y:0};w.camera={x:0,y:0};g.camera={x:0,y:0};for(const s of Object.keys(w.skills))w.skills[s]=0;w.skills.blade=8;w.weaponGrades.blade=${grade};w.mods.blade=['${partner}','shards'];const x='${partner}'==='hunt'?5.5:2.7;const primary=w.addEnemy('siegebow',x,0);primary.hp=primary.maxHp=1e6;primary.state='seek';for(const side of [-1,1]){const e=w.addEnemy('siegebone',x,side*1.8);e.hp=e.maxHp=1e6;e.state='seek';}
      const children=[],baseHit=w.armory.hit.bind(w.armory),baseLaunch=w.armory.launch.bind(w.armory);let childDamage=0,mainDamage=0;w.armory.hit=(e,damage,p,skill,...args)=>{const before=e.hp;baseHit(e,damage,p,skill,...args);if(p.child)childDamage+=before-e.hp;else mainDamage+=before-e.hp;};w.armory.launch=(c,child=false)=>{if(child&&c.skill==='blade')children.push({origin:c.origin,target:c.target,damage:c.stats.damage});return baseLaunch(c,child);};
      w.armory.step(0);w.cooldowns.blade=100;for(let i=0;i<100&&!children.length;i++){w.time+=1/120;w.armory.step(1/120);}if(children.length!==2)throw Error('No real hit split');
      // Advance a few frames to show two distinct short flights toward side targets.
      for(let i=0;i<4;i++){w.time+=1/120;w.armory.step(1/120);}w.pause('capture',true);g.menuScreens.redraw();g.painter.draw(w,0,w.drain(),true);globalThis.__shardCheck={children,get childDamage(){return childDamage;},get mainDamage(){return mainDamage;}};return{grade:${grade},partner:'${partner}',children,activeChildren:w.armory.shots.filter(p=>p.active&&p.child).length};})()`);
    if(grade===4&&partner==='hunt')await shot('epic-locked-shards-844');
    r.damage=await run(`(()=>{const g=__undead,w=g.world;for(let i=0;i<240;i++){w.time+=1/120;w.armory.step(1/120);}g.painter.draw(w,0,w.drain(),true);return{child:__shardCheck.childDamage,main:__shardCheck.mainDamage,children:__shardCheck.children.length,live:w.armory.shots.filter(p=>p.active&&p.child).length};})()`);
    if(r.damage.child<=0||r.damage.children!==2||r.damage.live!==0)throw Error('Fragments failed actual damage/lifetime '+JSON.stringify(r));report.cases.push(r);
  }
  await c('Emulation.setDeviceMetricsOverride',{width:740,height:390,deviceScaleFactor:1,mobile:true});
  await run(`(()=>{const g=__undead,w=g.world;w.cooldowns.blade=0;w.armory.step(0);for(let i=0;i<100;i++){w.time+=1/120;w.armory.step(1/120);if(w.armory.shots.some(p=>p.active&&p.child)){for(let j=0;j<4;j++){w.time+=1/120;w.armory.step(1/120);}break;}}g.painter.draw(w,0,w.drain(),true);return true;})()`);await shot('epic-locked-shards-740');
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
