/** Isolated headless integration test. Does not read or modify a user's Chrome profile. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  out = "artifacts/loom-stage";
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
  await c('Network.setUserAgentOverride',{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'});
  await c('Page.navigate',{url:'http://127.0.0.1:8128'});
  for(let i=0;i<200;i++){if(await run('Boolean(globalThis.__undead?.ready)'))break;await new Promise(r=>setTimeout(r,100));}
  const report={};
  report.setup=await run(`(()=>{const g=__undead;g.enabled=false;g.progress.data.stages=[1,2,3,4,5,6,7,8,9,10];g.selectedStage=11;g.restart();g.overlay.destroyAllChildren();const w=g.world;w.state='battle';w.pauses.add('qa');w.player={x:0,y:0};w.camera={x:0,y:0};w.time=400;w.enemies=[];for(const k of Object.keys(w.skills))w.skills[k]=0;const e=w.addEnemy('boss',4,1.4);e.state='windup';e.bossPhase=3;w.loom.state(e).action='C';w.hazards=w.loom.plan(e);w.effects.push({type:'bossPhase',...e,value:3});g.camera={x:0,y:0};g.stage.setPosition(0,0);g.update(0);return {stage:w.stageId,touch:g.touchMode,lines:w.hazards.length,announcement:g.announcement.string};})()`);
  if(report.setup.stage!==11||!report.setup.touch||report.setup.lines!==2||!report.setup.announcement.includes('III'))throw Error('Mobile Loom boot failed '+JSON.stringify(report.setup));
  for(const width of [844,740]){
    await c('Emulation.setDeviceMetricsOverride',{width,height:390,deviceScaleFactor:1,mobile:true});
    for(const [state,offset] of [['warning',-.2],['tight',.2],['slack',1.7]]){
      await run(`(()=>{const g=__undead,w=g.world;w.time=w.hazards[0].due+${offset};g.update(0);g.painter.draw(w,0,[],true);return true;})()`);await new Promise(r=>setTimeout(r,150));
      const shot=await c('Page.captureScreenshot',{format:'png'});fs.writeFileSync(out+'/mobile-'+width+'-'+state+'.png',Buffer.from(shot.data,'base64'));
    }
  }
  report.errors=events.filter(e=>e.method==='Runtime.exceptionThrown').map(e=>e.params.exceptionDetails);
  fs.writeFileSync(out+'/mobile-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.errors.length)throw Error('Mobile runtime exceptions');
}finally{await cmd('Browser.close').catch(()=>{});ws.close();child.kill();}
