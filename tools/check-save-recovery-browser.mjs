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
  if(!(await run(labelsOf)).includes('存档管理'))throw Error('Recovery entry missing');
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

  await run(`(()=>{const m=__undead.menuScreens;m.showRecovery();m.catalogActions[m.catalogActions.length-1]();return true;})()`);
  if(!(await run(labelsOf)).includes('输入补回码'))throw Error('Input entry missing');
  report.emptyInput=await run(`(()=>{const g=__undead,m=g.menuScreens;m.catalogActions[2]();return {hint:m.repairHint.string,coins:g.progress.coins,input:!!m.repairInput};})()`);
  if(!report.emptyInput.input || !report.emptyInput.hint.includes('请先'))throw Error('Empty validation lost input');
  await run(`(()=>{globalThis.wx={getClipboardData:o=>o.fail()};__undead.menuScreens.catalogActions[1]();return true;})()`);
  await c('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:422,y:169}]});
  await c('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await new Promise(r=>setTimeout(r,200));
  report.nativeInput=await run(`({tag:document.activeElement.tagName,type:document.activeElement.type,hint:__undead.menuScreens.repairHint.string})`);
  if(!['INPUT','TEXTAREA'].includes(report.nativeInput.tag))throw Error('Native input did not focus');
  await c('Input.insertText',{text:'bad-code'});
  await run(`document.activeElement.blur();__undead.menuScreens.catalogActions[2]();true`);
  report.invalidInput=await run(`({value:__undead.menuScreens.repairInput.string,hint:__undead.menuScreens.repairHint.string})`);
  if(report.invalidInput.value!=='bad-code' || !report.invalidInput.hint.includes('无效'))throw Error('Typed invalid code was not retained');
  // Replace through native browser editing, not by assigning the Cocos string.
  await run(`__undead.menuScreens.repairInput.setFocus();true`);
  await new Promise(r=>setTimeout(r,100));
  await run(`document.activeElement.select();true`);
  await c('Input.insertText',{text:'ASR1-4-400-2026102101-ekzqm6'});
  await run(`document.activeElement.blur();true`);
  report.typed=await run(`({value:__undead.menuScreens.repairInput.string,editing:__undead.menuScreens.repairEditing})`);
  if(report.typed.value!=='ASR1-4-400-2026102101-ekzqm6')throw Error('Native input text was not captured');
  await shot('repair-code-input');
  if((await run(labelsOf)).includes('label'))throw Error('Default EditBox label leaked');
  report.repairPreview=await run(`(()=>{const g=__undead;g.menuScreens.catalogActions[2]();return {coins:g.progress.coins,stages:g.progress.data.stages.length};})()`);
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
  report.manualSaved=await run(`(()=>{const g=__undead,m=g.menuScreens;m.showManualSaves();for(let slot=1;slot<=3;slot++){m.confirmManualSave(slot,'save');m.catalogActions[1]();}return g.progress.manualSaves.map(e=>({slot:e.slot,state:e.state,coins:e.data?.coins}));})()`);
  if(report.manualSaved.length!==3 || !report.manualSaved.every(e=>e.state==='saved'&&e.coins===580))throw Error('Three manual slots failed');
  await shot('manual-saves-full');
  report.manualOverwrite=await run(`(()=>{const g=__undead,m=g.menuScreens;g.progress.data.coins=700;g.progress.data.revision++;g.progress.pending=true;g.progress.flush();m.confirmManualSave(1,'save');const before=g.progress.manualSaves[0].data.coins;m.catalogActions[1]();return {before,after:g.progress.manualSaves[0].data.coins};})()`);
  if(report.manualOverwrite.before!==580 || report.manualOverwrite.after!==700)throw Error('Manual overwrite preview mutated save');
  await reloadGame();
  report.manualLoaded=await run(`(()=>{const g=__undead,m=g.menuScreens;m.confirmManualSave(2,'load');const before=g.progress.coins;m.catalogActions[1]();return {before,after:g.progress.coins,states:g.progress.manualSaves.map(e=>e.state)};})()`);
  if(report.manualLoaded.before!==700 || report.manualLoaded.after!==580)throw Error('Manual cold load failed');
  await run(`__undead.menuScreens.confirmManualSave(1,'delete');true`);await shot('manual-delete-confirm');
  await run(`__undead.menuScreens.catalogActions[0]();true`);
  if(!(await run(`__undead.progress.manualSaves[0].data.coins===700`)))throw Error('Cancel deleted slot');
  await run(`__undead.menuScreens.confirmManualSave(1,'delete');__undead.menuScreens.catalogActions[1]();true`);
  await reloadGame();
  report.manualDeleted=await run(`({coins:__undead.progress.coins,states:__undead.progress.manualSaves.map(e=>e.state)})`);
  if(report.manualDeleted.coins!==580 || report.manualDeleted.states.join(',')!=='empty,saved,saved')throw Error('Deleted slot resurrected or current progress lost');
  await run(`__undead.menuScreens.showManualSaves();true`);await shot('manual-after-reload');
  report.compiledHammer=await run(`(()=>{const g=__undead;g.enabled=false;g.selectedStage=1;g.restart();const w=g.world;w.player={x:0,y:0};w.enemies=[];for(const s of Object.keys(w.skills))w.skills[s]=0;w.skills.hammer=8;w.weaponGrades.hammer=2;const e=w.addEnemy('minion',2.4,0);Object.assign(e,{hp:1e8,maxHp:1e8,state:'seek'});w.armory.step(0);w.cooldowns.hammer=1e6;for(let i=0;i<240;i++){w.time+=1/600;w.armory.step(1/600);}const first=w.damage.hammer;for(let i=0;i<240;i++){w.time+=1/600;w.armory.step(1/600);}return {first,volley:w.damage.hammer};})()`);
  if(Math.abs(report.compiledHammer.first-101.2)>.001||Math.abs(report.compiledHammer.volley-182.16)>.001)throw Error('Compiled hammer followup/grade mismatch');
  report.sandDamage=await run(`(()=>{const g=__undead;g.selectedStage=2;g.restart();const w=g.world;w.chooseStartingWeapon(w.startingWeapons[0]);w.director.step=()=>{};w.armory.step=()=>{};w.enemies=[];w.move={x:0,y:0};const probe=(y,rift=false)=>{w.hp=100;w.invulnerable=0;w.player={x:3,y};w.time=1;w.hazards=[{id:100,source:0,kind:'frontierLane',x:0,y:0,angle:0,radius:6,width:.55,created:0,due:1,until:3,damage:20,fixedDamage:true,fired:rift,next:1,sandRift:rift}];w.step(.01);return w.hp;};const result={outside:probe(.56),inside:probe(.54),riftOutside:probe(.56,true),riftInside:probe(.54,true)};g.enabled=false;w.state='paused';g.overlay.destroyAllChildren();g.stage.setPosition(-144,0);w.time=.5;w.player={x:3,y:1.2};w.hazards=[{id:101,source:0,kind:'frontierLane',x:0,y:0,angle:0,radius:6,width:.55,created:0,due:1,until:3,fired:false}];w.camera={x:3,y:0};g.camera={x:144,y:0};g.painter.draw(w,0,[],false);return result;})()`);
  if(report.sandDamage.outside!==100 || report.sandDamage.inside!==80 || report.sandDamage.riftOutside!==100 || report.sandDamage.riftInside!==94)throw Error('Compiled sand boundaries mismatch '+JSON.stringify(report.sandDamage));
  await shot('sand-lane-boundary');
  await run(`(()=>{const g=__undead;g.selectedStage=3;g.restart();const w=g.world;w.state='paused';w.player={x:2,y:0};g.stage.setPosition(-60,0);w.time=.5;w.hazards=[{id:102,source:0,kind:'sector',x:0,y:0,angle:.4,radius:3,width:Math.PI/2,created:0,due:1,until:2,fired:false,thunder:{shape:'sector'}}];g.painter.draw(w,0,[],false);return true;})()`);
  await shot('thunder-sector-warning');
  await run(`(()=>{const g=__undead;g.selectedStage=1;g.restart();const w=g.world;w.state='paused';w.player={x:0,y:-1};w.time=20;w.enemies=[];g.stage.setPosition(0,-30);for(const [i,kind]of ['siegebone','thornshield','siegebow','flanker'].entries()){const e=w.addEnemy(kind,-6+i*4,1);e.state='seek';e.facing=0;}g.painter.draw(w,0,[],false);return true;})()`);
  await shot('stage-one-redesign');
  for(const character of ['ranger','alchemist','necromancer']) {
    await run(`(()=>{const g=__undead,w=g.world;w.character='${character}';w.player={x:0,y:0};w.move={x:1,y:0};w.time=20.2;w.enemies=[];g.stage.setPosition(0,-40);g.painter.draw(w,0,[],false);return true;})()`);
    await shot('hero-'+character);
  }
  report.errors=events.filter(e=>e.method==='Runtime.exceptionThrown').map(e=>e.params.exceptionDetails);
  fs.writeFileSync(out+'/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.errors.length)throw Error('Runtime exceptions');
} finally {
  await cmd("Browser.close").catch(() => {});
  ws.close();
  child.kill();
}
