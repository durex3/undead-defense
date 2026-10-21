/** Isolated headless integration test. Does not read or modify a user's Chrome profile. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  out = "artifacts/save-recovery";
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


  const labelsOf=`(()=>{const all=[];function walk(n){for(const c of n.components||[])if(typeof c.string==='string')all.push(c.string);for(const c of n.children||[])walk(c);}walk(__undead.overlay);return all;})()`;
  async function shot(name){await new Promise(r=>setTimeout(r,150));const r=await c('Page.captureScreenshot',{format:'png'});fs.writeFileSync(out+'/'+name+'.png',Buffer.from(r.data,'base64'));}
  const report={};
  report.compatible=await run(`(()=>{const g=__undead,C=g.progress.constructor,storage=g.progress.storage,key='ashen-survivors-armory-progress-v1';const d={...g.progress.data,revision:120,stages:[1,2,3,4,5,6,7],coins:1640,purchasedWeapons:['hammer'],achievements:['forge_mastery','future-test'],grades:{blade:3,fire:4},modWins:{blade:{'orbit+return':[3],'removed+orbit':[3]}}};storage.setItem(key,JSON.stringify(d));g.progress=new C(storage);g.menuScreens.showStart();return {coins:g.progress.coins,stages:g.progress.data.stages,hammer:g.progress.unlockedWeapon('hammer'),wheel:g.progress.unlockedWeapon('wheel'),notice:g.progress.loadNotice};})()`);
  if(report.compatible.coins!==1640 || report.compatible.stages.length!==7 || !report.compatible.hammer || !report.compatible.wheel)throw Error('Compatible progress failed '+JSON.stringify(report.compatible));
  await shot('compatible-start');
  if(!(await run(labelsOf)).includes('存档检查'))throw Error('Recovery entry missing');
  await run(`__undead.menuScreens.showRecovery();true`);await shot('recovery-list');report.list=await run(labelsOf);
  if(!report.list.some(s=>s.includes('1640金币')))throw Error('Recovery summary missing');
  report.beforeRestore=await run(`(()=>{const g=__undead,C=g.progress.constructor,s=g.progress.storage,key='ashen-survivors-armory-progress-v1';s.setItem(key,JSON.stringify({...g.progress.data,revision:999,stages:[],stageBest:{},achievements:[],coins:0}));s.setItem(key+'-backup',JSON.stringify({...g.progress.data,revision:999,stages:[],stageBest:{},achievements:[],coins:0}));g.progress=new C(s);g.menuScreens.showRecovery();const record=g.progress.recoveryRecords.find(r=>r.data.coins===1640);g.menuScreens.confirmRecovery(record.id);return {coins:g.progress.coins,stages:g.progress.data.stages.length};})()`);
  await shot('recovery-confirm');
  if(report.beforeRestore.coins!==0 || report.beforeRestore.stages!==0)throw Error('Preview modified account');
  report.restored=await run(`(()=>{const g=__undead,m=g.menuScreens,confirm=m.catalogActions[1];confirm();confirm();return {coins:g.progress.coins,stages:g.progress.data.stages.length,hammer:g.progress.unlockedWeapon('hammer'),notice:g.progress.loadNotice};})()`);
  await shot('restored');
  if(report.restored.coins!==1640 || report.restored.stages!==7 || !report.restored.hammer)throw Error('Recovery transaction failed');
  report.reopened=await run(`(()=>{const g=__undead;g.progress=new g.progress.constructor(g.progress.storage);g.menuScreens.showStart();return {coins:g.progress.coins,stages:g.progress.data.stages.length};})()`);
  if(report.reopened.coins!==1640 || report.reopened.stages!==7)throw Error('Cold reopen failed');

  report.repairPreview=await run(`(()=>{const g=__undead;globalThis.wx={getClipboardData:options=>options.success({data:'ASR1-4-400-2026102101-ekzqm6'})};g.menuScreens.showRecovery();g.menuScreens.pasteRepairCode();return {coins:g.progress.coins,stages:g.progress.data.stages.length};})()`);
  await shot('repair-code-preview');
  if(report.repairPreview.coins!==1640 || report.repairPreview.stages!==7)throw Error('Repair preview changed account');
  report.repaired=await run(`(()=>{const g=__undead,apply=g.menuScreens.catalogActions[1];apply();apply();return {coins:g.progress.coins,stages:g.progress.data.stages,available:g.progress.availableWeapons};})()`);
  if(report.repaired.coins!==400 || report.repaired.stages.join(',')!=='1,2,3,4' || report.repaired.available.length!==10)throw Error('Requested correction mismatch');
  await run(`__undead.menuScreens.showStageSelect(4);true`);await shot('repaired-stage-four');
  if(!(await run(labelsOf)).some(s=>s.includes('已通关')))throw Error('Restored clear not visible in stage carousel');
  async function reloadGame(){await c('Page.reload',{ignoreCache:true});let ready=false;for(let i=0;i<200;i++){try{ready=await run('Boolean(globalThis.__undead?.ready)');}catch{}if(ready)return;await new Promise(r=>setTimeout(r,100));}throw Error('Cold reload did not boot');}
  await reloadGame();
  report.coldRepair=await run(`({coins:__undead.progress.coins,stages:__undead.progress.data.stages,achievements:__undead.progress.data.achievements})`);
  if(report.coldRepair.coins!==400 || report.coldRepair.stages.length!==4 || !report.coldRepair.achievements.every(s=>typeof s==='string'))throw Error('Repair not durable after actual page reload');
  await run(`(()=>{const g=__undead;g.selectedStage=5;g.restart();const w=g.world;w.chooseStartingWeapon(w.startingWeapons[0]);w.skills.blade=8;w.mods.blade=['orbit','return'];w.state='won';g.progress.observe(w);return true;})()`);
  await reloadGame();
  report.coldVictory=await run(`({coins:__undead.progress.coins,stages:__undead.progress.data.stages,modWins:__undead.progress.data.modWins,notice:__undead.progress.loadNotice})`);
  if(report.coldVictory.coins!==580 || report.coldVictory.stages.length!==5 || !report.coldVictory.modWins.blade['orbit+return'].every(n=>typeof n==='number'))throw Error('Real compiled victory save corrupted on reload');
  await shot('cold-victory-preserved');
  report.errors=events.filter(e=>e.method==='Runtime.exceptionThrown').map(e=>e.params.exceptionDetails);
  fs.writeFileSync(out+'/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.errors.length)throw Error('Runtime exceptions');
} finally {
  await cmd("Browser.close").catch(() => {});
  ws.close();
  child.kill();
}
