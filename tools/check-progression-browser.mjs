/** Isolated headless integration test. Does not read or modify a user's Chrome profile. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  out = "artifacts/weapon-progression";
fs.mkdirSync(out, { recursive: true });
const child = spawn(
  chrome,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=/private/tmp/undead-progression-browser-${process.pid}`,
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
  async function shot(name) {await new Promise(r=>setTimeout(r,140));const r=await c('Page.captureScreenshot',{format:'png'});fs.writeFileSync(out+'/'+name+'.png',Buffer.from(r.data,'base64'));}
  const report={};
  await run(`(()=>{const g=__undead;g.progress.data.coins=10000;g.progress.data.stages=[9];g.menuScreens.showWeapons();return true;})()`);
  await shot('catalogue');
  report.initial=await run(labelsOf);
  if(!report.initial.some(s=>s.includes('/3')))throw Error('Fourteen-series pagination missing');
  if(!report.initial.some(s=>s.includes('可升级 · 精良 · 360金币')))throw Error('Upgrade hint missing from catalogue list');
  await run(`__undead.menuScreens.showWeapons(0,'可升级');true`);await shot('upgrade-filter');
  report.upgradeFilter=await run(labelsOf);
  if(!report.upgradeFilter.some(s=>s.includes('普通 · 飞刀')) || report.upgradeFilter.some(s=>s.includes('普通 · 烈焰火球')))throw Error('Upgrade filter includes unopened series');
  await run(`__undead.progress.data.coins=0;__undead.menuScreens.showWeapons(0,'可升级');true`);await shot('upgrade-insufficient');
  report.insufficient=await run(labelsOf);
  if(!report.insufficient.some(s=>s.includes('还差360金币')))throw Error('Upgrade shortage not visible');
  await run(`__undead.progress.data.coins=10000;true`);
  if(!report.initial.some(s=>s.includes('多刃环绕 · 数把实体刀持续绕身切割')))throw Error('Weapon description hidden by upgrade affordance');
  if(!report.initial.includes('↑'))throw Error('Upgrade arrow missing');
  await run(`__undead.menuScreens.catalogActions[5]();true`);
  report.arrowPreview=await run(labelsOf);
  if(!report.arrowPreview.includes('武器进阶') || !report.arrowPreview.some(s=>s.includes('旋纹飞刃')))throw Error('Upgrade arrow does not open actual form preview');


  await run(`__undead.menuScreens.showWeaponDetail('blade');__undead.menuScreens.confirmWeaponPurchase(true);true`);
  await shot('evolve-preview');
  report.preview=await run(labelsOf);
  if(!report.preview.some(s=>s.includes('旋纹飞刃')))throw Error('New form preview missing');
  report.trade=await run(`(()=>{const g=__undead,m=g.menuScreens,action=m.catalogActions[1];action();action();return {coins:g.progress.coins,grade:g.progress.weaponGrades.blade,pool:g.progress.availableWeapons.length};})()`);
  if(report.trade.coins!==9640 || report.trade.grade!==2 || report.trade.pool!==10)throw Error('Trade duplicate/snapshot error');
  for(let i=0;i<2;i++)await run(`__undead.menuScreens.confirmWeaponPurchase(true);__undead.menuScreens.catalogActions[1]();true`);
  await shot('epic-blade-detail');
  for(const skill of ['hammer','lamp'])await run(`__undead.menuScreens.showWeaponDetail('${skill}');__undead.menuScreens.confirmWeaponPurchase();__undead.menuScreens.catalogActions[1]();true`);
  for(let i=0;i<2;i++)await run(`__undead.menuScreens.showWeaponDetail('hammer');__undead.menuScreens.confirmWeaponPurchase(true);__undead.menuScreens.catalogActions[1]();true`);
  report.owned=await run(`({coins:__undead.progress.coins,grades:__undead.progress.weaponGrades,pool:__undead.progress.availableWeapons})`);
  if(report.owned.coins!==3520 || report.owned.grades.hammer!==4 || report.owned.pool.length!==12)throw Error('Multi-goods purchase/evolution failed '+JSON.stringify(report.owned));
  await run(`__undead.menuScreens.showAchievements(0,'机制挑战');true`);await shot('mechanism-achievements');report.achievements=await run(labelsOf);
  if(!report.achievements.some(s=>s.includes('6种不同起手')))throw Error('Epic challenge not updated');
  await run(`__undead.menuScreens.showAchievements(3,'通关记录');true`);await shot('clear-achievements-page4');
  await run(`__undead.menuScreens.showWeaponDetail('needle');true`);await shot('epic-needle-locked');
  await run(`(()=>{const g=__undead;g.selectedStage=10;g.restart();const w=g.world;w.chooseStartingWeapon(w.startingWeapons[0]);w.level=64;w.player={x:0,y:0};g.camera=w.camera={x:0,y:0};w.enemies=[];w.hazards=[];w.effects=[];for(const s of Object.keys(w.skills))w.skills[s]=0;for(const s of ['blade','hammer','lamp','needle'])w.skills[s]=8;for(const [k,x,y]of [['paperbonegrub',2,0],['sealclerk',3,1],['folioray',4,-1],['spineclasp',-3,1]]){const e=w.addEnemy(k,x,y);e.state='seek';e.hp=e.maxHp=1e6;}w.time=400;w.armory.step(0);w.time+=.2;w.armory.step(.2);w.pauses.add('qa');g.shown='';g.announcementLife=g.modLife=0;g.painter.draw(w,.1,w.drain(),false);return true;})()`);await shot('epic-combat');
  report.combat=await run(`({grades:__undead.world.weaponGrades,marks:__undead.world.armory.support.marks.size,link:__undead.world.armory.support.link,damage:__undead.world.damage})`);
  if(!report.combat.link || !report.combat.marks)throw Error('Support weapons inactive');
  report.errors=events.filter(e=>e.method==='Runtime.exceptionThrown').map(e=>e.params.exceptionDetails);
  fs.writeFileSync(out+'/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  if(report.errors.length)throw Error('Runtime exceptions');
} finally {
  await cmd("Browser.close").catch(() => {});
  ws.close();
  child.kill();
}
