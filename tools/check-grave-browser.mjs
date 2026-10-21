/** Isolated headless integration test. Does not read or modify a user's Chrome profile. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  out = "artifacts/grave-stage/browser";
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
  report.setup=await run(`(()=>{const g=__undead;g.progress.data.stages=Array.from({length:15},(_,i)=>i+1);g.progress.data.coins=10000;g.progress.pending=true;g.progress.flush();g.selectedStage=16;g.restart();g.world.state='battle';g.world.cards=[];g.world.enemies=[];g.world.player={x:0,y:0};g.world.camera={x:0,y:0};g.camera={x:0,y:0};g.world.pause('capture',true);g.world.time=360;for(const k of Object.keys(g.world.skills))g.world.skills[k]=0;const e=g.world.addEnemy('boss',-3,0);e.state='seek';e.attack=0;g.world.grave.state(e).action='B';g.world.grave.begin(e);g.world.time=361;g.painter.draw(g.world,0,[],true);return{stage:g.world.stageId,total:e.grave.total,health:e.hp,plans:e.grave.items.length};})()`);
  await shot('negative-coffin-warning-844');
  if(report.setup.stage!==16)throw Error('Wrong stage');
  report.firstDeath=await run(`(()=>{const g=__undead,w=g.world,e=w.enemies.find(e=>e.kind==='boss');w.hit(e,1e9,'blade');g.painter.draw(w,0,w.drain(),true);return{state:w.state,hp:e.hp,reviveAt:e.grave.deadUntil,coins:g.progress.coins,kills:w.kills};})()`);
  if(report.firstDeath.state!=='battle'||report.firstDeath.hp!==0||report.firstDeath.kills!==0)throw Error('First lethal settled');
  await shot('coffin-revival-844');
  report.second=await run(`(()=>{const g=__undead,w=g.world,e=w.enemies.find(e=>e.kind==='boss');w.pause('capture',false);w.time=e.grave.deadUntil;w.grave.tick();w.pause('capture',true);w.hazards=[];e.grave.scar={x:-3,y:2,angle:0,radius:4.2,half:Math.PI/4,due:0,end:0,old:false,hit:false};e.grave.scarUntil=w.time+12;e.grave.action='B';e.state='seek';w.grave.begin(e);w.time+=1;g.painter.draw(w,0,w.drain(),true);return{life:e.grave.life,hp:e.hp,items:e.grave.items.length};})()`);
  if(report.second.life!==2||report.second.items!==2)throw Error('Second form/dual source failed');
  await shot('hunter-dual-warning-844');
  await c('Emulation.setDeviceMetricsOverride',{width:740,height:390,deviceScaleFactor:1,mobile:true});
  await shot('hunter-dual-warning-740');
  await run(`(()=>{const g=__undead,w=g.world;w.weaponGrades.fire=4;w.skills.fire=8;w.mods.fire=['heavy','flame'];w.pause('capture',true);w.armory.step(0);g.painter.draw(w,0,w.drain(),true);g.menuScreens.showWeaponDetail('fire');return true;})()`);

  report.upgrade=await run(`(()=>{const p=__undead.progress;p.data.grades={...p.data.grades,fire:3};const before=p.coins,r=p.evolveWeapon('fire',3);return{before,after:p.coins,result:r,grade:p.weaponGrades.fire};})()`);
  if(report.upgrade.result!=='evolved'||report.upgrade.before-report.upgrade.after!==1440||report.upgrade.grade!==4)throw Error('Fire epic purchase failed');
  await run(`__undead.menuScreens.showWeaponDetail('fire');true`);await shot('epic-fire-detail');
  await run(`(()=>{const g=__undead,w=g.world;g.overlay.destroyAllChildren();g.shown='';w.pause('capture',true);w.skills.fire=8;w.weaponGrades.fire=4;w.mods.fire=['heavy','flame'];w.cooldowns.fire=0;for(let i=0;i<100;i++){w.time+=1/60;w.armory.step(1/60);}g.painter.draw(w,0,w.drain(),true);return true;})()`);await shot('epic-fire-field');
  report.qualified=await run(`(()=>{const g=__undead,C=g.world.constructor,pairs={"blade":["orbit+return","orbit+shards","hunt+return","hunt+shards","return+shards"],"fire":["embers+heavy","flame+heavy","embers+salvo","flame+salvo","embers+flame"],"water":["recall+spring","pulse+spring","recall+wave","pulse+wave","pulse+recall"],"frost":["aftershock+outward","brittle+outward","aftershock+sectors","brittle+sectors","aftershock+brittle"],"lightning":["echo+relay","bridge+relay","echo+storm","bridge+storm","bridge+echo"],"ghost":["execution+haunt","execution+reap","haunt+swarm","reap+swarm","haunt+reap"],"bone":["lance+marrow","lance+ridge","fan+marrow","fan+ridge","marrow+ridge"],"mine":["scatter+trip","fuse+trip","burrow+scatter","burrow+fuse","fuse+scatter"],"void":["binary+drift","drift+repel","binary+collapse","collapse+repel","binary+repel"],"holy":["cross+execution","brand+execution","cross+rain","brand+rain","brand+cross"],"hammer":["heavy+rift","heavy+return","rift+sweep","return+sweep","return+rift"],"wheel":["grind+heavy","curve+heavy","grind+twin","curve+twin","curve+grind"],"lamp":["focus+linger","focus+pulse","linger+wide","pulse+wide","linger+pulse"],"needle":["deep+long","barb+deep","long+swift","barb+swift","barb+long"]};
    for(const opener of Object.keys(pairs).slice(0,12))for(const key of pairs[opener]){const w=new C(41,'ranger',16);w.enemies=[];w.player={x:0,y:0};w.camera={x:0,y:0};w.startingWeapon=opener;w.skills[opener]=8;w.mods[opener]=key.split('+');const e=w.addEnemy('boss',-3,0);e.state='seek';
      for(const [life,action] of [[1,'A'],[1,'B'],[2,'B']]){w.time+=20;w.hazards=[];w.player={x:0,y:0};e.x=-3;e.y=0;e.state='seek';e.grave.life=life;e.grave.action=action;e.grave.scar={x:-3,y:2,angle:0,radius:4.2,half:Math.PI/4,due:0,end:0,old:false,hit:false};e.grave.scarUntil=w.time+12;if(!w.grave.begin(e))throw Error('No actual group');const end=e.grave.next;w.player={x:15,y:-15};while(w.time<end){const prev=w.time;w.time=Math.min(end,w.time+.05);w.grave.sample(w.player,w.player,prev,w.time);w.grave.stepEnemy(e,w.time-prev);}w.player={x:e.x+1,y:e.y};w.hit(e,1,opener);if(!w.challenge.graveGroups.has(life+action))throw Error('No actual qualification '+life+action);}
      e.grave.life=2;w.hit(e,1e9,opener);if(w.state!=='won')throw Error('No final win');const before=g.progress.coins;g.progress.observe(w);g.progress.observe(w);if(g.progress.coins!==before+400)throw Error('Double settle');
    }return{qualified:g.progress.data.graveQualified,title:g.progress.hasAchievement('grave_twelve_paths'),coins:g.progress.coins,grade:g.progress.weaponGrades.fire};})()`);
  if(!report.qualified.title||Object.values(report.qualified.qualified).filter(v=>v.length===5).length!==12)throw Error('Challenge/Set serialization failed');
  await run(`(()=>{const m=__undead.menuScreens;m.showManualSaves();for(let slot=1;slot<=3;slot++){m.confirmManualSave(slot,'save');m.catalogActions[1]();}return true;})()`);
  await shot('three-save-slots');
  await c('Page.reload');
  for(let i=0;i<150;i++){if(await run('Boolean(globalThis.__undead?.ready)'))break;await new Promise(r=>setTimeout(r,100));}
  report.cold=await run(`({coins:__undead.progress.coins,title:__undead.progress.hasAchievement('grave_twelve_paths'),qualified:__undead.progress.data.graveQualified,grade:__undead.progress.weaponGrades.fire,slots:__undead.progress.manualSaves.map(s=>s.state),best:__undead.progress.data.stageBest[16]})`);
  if(!report.cold.title||report.cold.grade!==4||report.cold.coins!==report.qualified.coins||report.cold.slots.join(',')!=='saved,saved,saved')throw Error('Cold account regression');
  await run('__undead.menuScreens.showAchievements(0,"机制挑战");true');await shot('grave-achievement');
  await run('__undead.menuScreens.showGravePaths();true');await shot('grave-opener-progress');
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
