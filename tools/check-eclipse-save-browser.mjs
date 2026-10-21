/** Isolated headless integration test. Does not read or modify a user's Chrome profile. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  out = "artifacts/eclipse-stage/save-regression";
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
  const report = {};
  report.compatible = await run(
    `(()=>{const g=__undead,C=g.progress.constructor,storage=g.progress.storage,key='ashen-survivors-armory-progress-v1';const d={...g.progress.data,revision:120,stages:[1,2,3,4,5,6,7],coins:1640,purchasedWeapons:['hammer'],achievements:['forge_mastery','future-test'],grades:{blade:3,fire:4},modWins:{blade:{'orbit+return':[3],'removed+orbit':[3]}}};storage.setItem(key,JSON.stringify(d));g.progress=new C(storage);g.menuScreens.showStart();return {coins:g.progress.coins,stages:g.progress.data.stages,hammer:g.progress.unlockedWeapon('hammer'),wheel:g.progress.unlockedWeapon('wheel'),notice:g.progress.loadNotice};})()`,
  );
  if (
    report.compatible.coins !== 1640 ||
    report.compatible.stages.length !== 7 ||
    !report.compatible.hammer ||
    !report.compatible.wheel
  )
    throw Error(
      "Compatible progress failed " + JSON.stringify(report.compatible),
    );
  await shot("compatible-start");
  if (!(await run(labelsOf)).includes("存档管理"))
    throw Error("Recovery entry missing");
  await run(`__undead.menuScreens.showRecovery();true`);
  await shot("recovery-list");
  report.list = await run(labelsOf);
  if (!report.list.some((s) => s.includes("1640金币")))
    throw Error("Recovery summary missing");
  report.beforeRestore = await run(
    `(()=>{const g=__undead,C=g.progress.constructor,s=g.progress.storage,key='ashen-survivors-armory-progress-v1';s.setItem(key,JSON.stringify({...g.progress.data,revision:999,stages:[],stageBest:{},achievements:[],coins:0}));s.setItem(key+'-backup',JSON.stringify({...g.progress.data,revision:999,stages:[],stageBest:{},achievements:[],coins:0}));g.progress=new C(s);g.menuScreens.showRecovery();const record=g.progress.recoveryRecords.find(r=>r.data.coins===1640);g.menuScreens.confirmRecovery(record.id);return {coins:g.progress.coins,stages:g.progress.data.stages.length};})()`,
  );
  await shot("recovery-confirm");
  if (report.beforeRestore.coins !== 0 || report.beforeRestore.stages !== 0)
    throw Error("Preview modified account");
  report.restored = await run(
    `(()=>{const g=__undead,m=g.menuScreens,confirm=m.catalogActions[1];confirm();confirm();return {coins:g.progress.coins,stages:g.progress.data.stages.length,hammer:g.progress.unlockedWeapon('hammer'),notice:g.progress.loadNotice};})()`,
  );
  await shot("restored");
  if (
    report.restored.coins !== 1640 ||
    report.restored.stages !== 7 ||
    !report.restored.hammer
  )
    throw Error("Recovery transaction failed");
  report.reopened = await run(
    `(()=>{const g=__undead;g.progress=new g.progress.constructor(g.progress.storage);g.menuScreens.showStart();return {coins:g.progress.coins,stages:g.progress.data.stages.length};})()`,
  );
  if (report.reopened.coins !== 1640 || report.reopened.stages !== 7)
    throw Error("Cold reopen failed");

  await run(
    `(()=>{const m=__undead.menuScreens;m.showRecovery();m.catalogActions[m.catalogActions.length-1]();return true;})()`,
  );
  if (!(await run(labelsOf)).includes("输入补回码"))
    throw Error("Input entry missing");
  report.emptyInput = await run(
    `(()=>{const g=__undead,m=g.menuScreens;m.catalogActions[2]();return {hint:m.repairHint.string,coins:g.progress.coins,input:!!m.repairInput};})()`,
  );
  if (!report.emptyInput.input || !report.emptyInput.hint.includes("请先"))
    throw Error("Empty validation lost input");
  await run(
    `(()=>{globalThis.wx={getClipboardData:o=>o.fail()};__undead.menuScreens.catalogActions[1]();return true;})()`,
  );
  await c("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 422, y: 169 }],
  });
  await c("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await new Promise((r) => setTimeout(r, 200));
  report.nativeInput = await run(
    `({tag:document.activeElement.tagName,type:document.activeElement.type,hint:__undead.menuScreens.repairHint.string})`,
  );
  if (!["INPUT", "TEXTAREA"].includes(report.nativeInput.tag))
    throw Error("Native input did not focus");
  await c("Input.insertText", { text: "bad-code" });
  await run(
    `document.activeElement.blur();__undead.menuScreens.catalogActions[2]();true`,
  );
  report.invalidInput = await run(
    `({value:__undead.menuScreens.repairInput.string,hint:__undead.menuScreens.repairHint.string})`,
  );
  if (
    report.invalidInput.value !== "bad-code" ||
    !report.invalidInput.hint.includes("无效")
  )
    throw Error("Typed invalid code was not retained");
  // Replace through native browser editing, not by assigning the Cocos string.
  await run(`__undead.menuScreens.repairInput.setFocus();true`);
  await new Promise((r) => setTimeout(r, 100));
  await run(`document.activeElement.select();true`);
  await c("Input.insertText", { text: "ASR1-4-400-2026102101-ekzqm6" });
  await run(`document.activeElement.blur();true`);
  report.typed = await run(
    `({value:__undead.menuScreens.repairInput.string,editing:__undead.menuScreens.repairEditing})`,
  );
  if (report.typed.value !== "ASR1-4-400-2026102101-ekzqm6")
    throw Error("Native input text was not captured");
  await shot("repair-code-input");
  if ((await run(labelsOf)).includes("label"))
    throw Error("Default EditBox label leaked");
  report.repairPreview = await run(
    `(()=>{const g=__undead;g.menuScreens.catalogActions[2]();return {coins:g.progress.coins,stages:g.progress.data.stages.length};})()`,
  );
  await shot("repair-code-preview");
  if (report.repairPreview.coins !== 1640 || report.repairPreview.stages !== 7)
    throw Error("Repair preview changed account");
  report.repaired = await run(
    `(()=>{const g=__undead,apply=g.menuScreens.catalogActions[1];apply();apply();return {coins:g.progress.coins,stages:g.progress.data.stages,available:g.progress.availableWeapons};})()`,
  );
  if (
    report.repaired.coins !== 400 ||
    report.repaired.stages.join(",") !== "1,2,3,4" ||
    report.repaired.available.length !== 10
  )
    throw Error("Requested correction mismatch");
  await run(`__undead.menuScreens.showStageSelect(4);true`);
  await shot("repaired-stage-four");
  if (!(await run(labelsOf)).some((s) => s.includes("已通关")))
    throw Error("Restored clear not visible in stage carousel");
  async function reloadGame() {
    await c("Page.reload", { ignoreCache: true });
    let ready = false;
    for (let i = 0; i < 200; i++) {
      try {
        ready = await run("Boolean(globalThis.__undead?.ready)");
      } catch {}
      if (ready) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Cold reload did not boot");
  }
  await reloadGame();
  report.coldRepair = await run(
    `({coins:__undead.progress.coins,stages:__undead.progress.data.stages,achievements:__undead.progress.data.achievements})`,
  );
  if (
    report.coldRepair.coins !== 400 ||
    report.coldRepair.stages.length !== 4 ||
    !report.coldRepair.achievements.every((s) => typeof s === "string")
  )
    throw Error("Repair not durable after actual page reload");
  await run(
    `(()=>{const g=__undead;g.selectedStage=5;g.restart();const w=g.world;w.chooseStartingWeapon(w.startingWeapons[0]);w.skills.blade=8;w.mods.blade=['orbit','return'];w.state='won';g.progress.observe(w);return true;})()`,
  );
  await reloadGame();
  report.coldVictory = await run(
    `({coins:__undead.progress.coins,stages:__undead.progress.data.stages,modWins:__undead.progress.data.modWins,notice:__undead.progress.loadNotice})`,
  );
  if (
    report.coldVictory.coins !== 580 ||
    report.coldVictory.stages.length !== 5 ||
    !report.coldVictory.modWins.blade["orbit+return"].every(
      (n) => typeof n === "number",
    )
  )
    throw Error("Real compiled victory save corrupted on reload");
  await shot("cold-victory-preserved");
  report.manualSaved = await run(
    `(()=>{const g=__undead,m=g.menuScreens;m.showManualSaves();for(let slot=1;slot<=3;slot++){m.confirmManualSave(slot,'save');m.catalogActions[1]();}return g.progress.manualSaves.map(e=>({slot:e.slot,state:e.state,coins:e.data?.coins}));})()`,
  );
  if (
    report.manualSaved.length !== 3 ||
    !report.manualSaved.every((e) => e.state === "saved" && e.coins === 580)
  )
    throw Error("Three manual slots failed");
  await shot("manual-saves-full");
  report.manualOverwrite = await run(
    `(()=>{const g=__undead,m=g.menuScreens;g.progress.data.coins=700;g.progress.data.revision++;g.progress.pending=true;g.progress.flush();m.confirmManualSave(1,'save');const before=g.progress.manualSaves[0].data.coins;m.catalogActions[1]();return {before,after:g.progress.manualSaves[0].data.coins};})()`,
  );
  if (
    report.manualOverwrite.before !== 580 ||
    report.manualOverwrite.after !== 700
  )
    throw Error("Manual overwrite preview mutated save");
  await reloadGame();
  report.manualLoaded = await run(
    `(()=>{const g=__undead,m=g.menuScreens;m.confirmManualSave(2,'load');const before=g.progress.coins;m.catalogActions[1]();return {before,after:g.progress.coins,states:g.progress.manualSaves.map(e=>e.state)};})()`,
  );
  if (report.manualLoaded.before !== 700 || report.manualLoaded.after !== 580)
    throw Error("Manual cold load failed");
  await run(`__undead.menuScreens.confirmManualSave(1,'delete');true`);
  await shot("manual-delete-confirm");
  await run(`__undead.menuScreens.catalogActions[0]();true`);
  if (!(await run(`__undead.progress.manualSaves[0].data.coins===700`)))
    throw Error("Cancel deleted slot");
  await run(
    `__undead.menuScreens.confirmManualSave(1,'delete');__undead.menuScreens.catalogActions[1]();true`,
  );
  await reloadGame();
  report.manualDeleted = await run(
    `({coins:__undead.progress.coins,states:__undead.progress.manualSaves.map(e=>e.state)})`,
  );
  if (
    report.manualDeleted.coins !== 580 ||
    report.manualDeleted.states.join(",") !== "empty,saved,saved"
  )
    throw Error("Deleted slot resurrected or current progress lost");
  await run(`__undead.menuScreens.showManualSaves();true`);
  await shot("manual-after-reload");
  report.compiledPassives = await run(
    `(()=>{const C=__undead.world.constructor,w=new C(31,'ranger',1);w.enemies=[];w.player={x:0,y:0};for(const k of Object.keys(w.skills))w.skills[k]=0;w.skills.fire=1;w.passives.area=4;w.passives.amount=2;const e=w.addEnemy('minion',2,0);e.state='seek';e.hp=e.maxHp=1e7;w.armory.step(0);const shots=w.armory.shots.filter(a=>a.active).sort((a,b)=>a.index-b.index);const v=new C(31,'ranger',1);v.enemies=[];v.player={x:0,y:0};for(const k of Object.keys(v.skills))v.skills[k]=0;v.skills.bone=1;v.mods.bone=['ridge'];const b=v.addEnemy('minion',2,0);b.state='seek';b.hp=b.maxHp=1e7;v.armory.step(0);v.cooldowns.bone=100;for(let i=0;i<60;i++){v.time+=1/60;v.armory.step(1/60);}return {fire:shots.map(a=>({damage:a.stats.damage,radius:a.stats.radius})),bursts:v.drain().filter(e=>e.form==='boneBurst'),boneRemaining:v.armory.extra.attacks.some(a=>a.active)};})()`,
  );
  {
    const p = report.compiledPassives;
    if (
      p.fire.length !== 3 ||
      Math.abs(p.fire[1].damage / p.fire[0].damage - 0.4) > 1e-9 ||
      Math.abs(p.fire[0].radius / 1.4 - Math.sqrt(1.4)) > 1e-9 ||
      Math.abs(p.fire[1].radius / p.fire[0].radius - 0.8) > 1e-9 ||
      p.bursts.length !== 1 ||
      p.boneRemaining
    )
      throw Error("Compiled passive/bone mismatch " + JSON.stringify(p));
  }
  report.compiledGrowth = await run(
    `(()=>{const C=__undead.world.constructor,rows=[];for(let stage=1;stage<=10;stage++){const w=new C(19,'ranger',stage);rows.push(w.addEnemy('boss').maxHp);}const w=new C(19,'ranger',10),e=w.addEnemy('boss');e.state='seek';e.hp=e.maxHp=1e6;w.fracture(e,2);w.hit(e,100,'bone');return {hp:rows,strategies:Object.keys(w.armory.strategies),bossFracturedHit:1e6-e.hp};})()`,
  );
  if (
    report.compiledGrowth.strategies.length !== 14 ||
    Math.round(report.compiledGrowth.hp[9]) !==
      Math.round(
        (343 + 217 * (1 - Math.exp(-9 / 5))) *
          (60 + 60 * (1 - Math.exp(-9 / 6))),
      ) ||
    report.compiledGrowth.bossFracturedHit !== 75
  )
    throw Error("Compiled growth/strategy mismatch");
  for (let i = 1; i < 10; i++)
    if (report.compiledGrowth.hp[i] <= report.compiledGrowth.hp[i - 1])
      throw Error("Boss growth plateau");
  report.compiledHammer = await run(
    `(()=>{const g=__undead;g.enabled=false;g.selectedStage=1;g.restart();const w=g.world;w.player={x:0,y:0};w.enemies=[];for(const s of Object.keys(w.skills))w.skills[s]=0;w.skills.hammer=8;w.weaponGrades.hammer=2;const e=w.addEnemy('minion',2.4,0);Object.assign(e,{hp:1e8,maxHp:1e8,state:'seek'});w.armory.step(0);w.cooldowns.hammer=1e6;for(let i=0;i<240;i++){w.time+=1/600;w.armory.step(1/600);}const first=w.damage.hammer;for(let i=0;i<240;i++){w.time+=1/600;w.armory.step(1/600);}return {first,volley:w.damage.hammer};})()`,
  );
  if (
    Math.abs(report.compiledHammer.first - 101.2) > 0.001 ||
    Math.abs(report.compiledHammer.volley - 182.16) > 0.001
  )
    throw Error("Compiled hammer followup/grade mismatch");
  report.sandDamage = await run(
    `(()=>{const g=__undead;g.selectedStage=2;g.restart();const w=g.world;w.chooseStartingWeapon(w.startingWeapons[0]);w.director.step=()=>{};w.armory.step=()=>{};w.enemies=[];w.move={x:0,y:0};const probe=(y,rift=false)=>{w.hp=100;w.invulnerable=0;w.player={x:3,y};w.time=1;w.hazards=[{id:100,source:0,kind:'frontierLane',x:0,y:0,angle:0,radius:6,width:.55,created:0,due:1,until:3,damage:20,fixedDamage:true,fired:rift,next:1,sandRift:rift}];w.step(.01);return w.hp;};const result={outside:probe(.56),inside:probe(.54),riftOutside:probe(.56,true),riftInside:probe(.54,true)};g.enabled=false;w.state='paused';g.overlay.destroyAllChildren();g.stage.setPosition(-144,0);w.time=.5;w.player={x:3,y:1.2};w.hazards=[{id:101,source:0,kind:'frontierLane',x:0,y:0,angle:0,radius:6,width:.55,created:0,due:1,until:3,fired:false}];w.camera={x:3,y:0};g.camera={x:144,y:0};g.painter.draw(w,0,[],false);return result;})()`,
  );
  if (
    report.sandDamage.outside !== 100 ||
    report.sandDamage.inside !== 80 ||
    report.sandDamage.riftOutside !== 100 ||
    report.sandDamage.riftInside !== 94
  )
    throw Error(
      "Compiled sand boundaries mismatch " + JSON.stringify(report.sandDamage),
    );
  await shot("sand-lane-boundary");
  await run(
    `(()=>{const g=__undead;g.selectedStage=3;g.restart();const w=g.world;w.state='paused';w.player={x:2,y:0};g.stage.setPosition(-60,0);w.time=.5;w.hazards=[{id:102,source:0,kind:'sector',x:0,y:0,angle:.4,radius:3,width:Math.PI/2,created:0,due:1,until:2,fired:false,thunder:{shape:'sector'}}];g.painter.draw(w,0,[],false);return true;})()`,
  );
  await shot("thunder-sector-warning");
  await run(
    `(()=>{const g=__undead;g.selectedStage=1;g.restart();const w=g.world;w.state='paused';w.player={x:0,y:-1};w.time=20;w.enemies=[];g.stage.setPosition(0,-30);for(const [i,kind]of ['siegebone','thornshield','siegebow','flanker'].entries()){const e=w.addEnemy(kind,-6+i*4,1);e.state='seek';e.facing=0;}g.painter.draw(w,0,[],false);return true;})()`,
  );
  await shot("stage-one-redesign");
  for (const character of ["ranger", "alchemist", "necromancer"]) {
    await run(
      `(()=>{const g=__undead,w=g.world;w.character='${character}';w.player={x:0,y:0};w.move={x:1,y:0};w.time=20.2;w.enemies=[];g.stage.setPosition(0,-40);g.painter.draw(w,0,[],false);return true;})()`,
    );
    await shot("hero-" + character);
  }
  report.compiledLoom = await run(
    `(()=>{const g=__undead;g.progress.data.stages=[1,2,3,4,5,6,7,8,9,10];g.progress.data.achievements=Array.from(new Set([...(g.progress.data.achievements||[]),'forge_mastery']));g.progress.data.coins=3000;g.progress.data.revision++;g.progress.pending=true;g.progress.flush();g.selectedStage=11;g.restart();g.enabled=false;g.overlay.destroyAllChildren();const w=g.world;w.state='paused';w.player={x:0,y:0};w.camera={x:0,y:0};w.time=400;w.enemies=[];for(const k of Object.keys(w.skills))w.skills[k]=0;const boss=w.addEnemy('boss',4,1.4);boss.state='windup';boss.bossPhase=3;w.loom.state(boss).action='C';w.hazards=w.loom.plan(boss);g.camera={x:0,y:0};g.stage.setPosition(0,0);return {stage:w.stageId,bossHP:boss.maxHp,lines:w.hazards.length,wheel3:g.progress.evolveWeapon('wheel',2),wheel4:g.progress.evolveWeapon('wheel',3),coins:g.progress.coins};})()`,
  );
  if (
    report.compiledLoom.stage !== 11 ||
    Math.round(report.compiledLoom.bossHP) !== 57662 ||
    report.compiledLoom.lines !== 2 ||
    report.compiledLoom.wheel3 !== "evolved" ||
    report.compiledLoom.wheel4 !== "evolved" ||
    report.compiledLoom.coins !== 840
  )
    throw Error("Compiled stage11 registration or wheel trade mismatch");
  for (const [name, offset] of [
    ["warning", -0.2],
    ["tight", 0.2],
    ["slack", 1.7],
  ]) {
    await run(
      `(()=>{const g=__undead,w=g.world;w.time=w.hazards[0].due+${offset};g.update(0);g.painter.draw(w,0,[],true);return true;})()`,
    );
    await shot("loom-" + name);
  }
  await run(
    `(()=>{const g=__undead,w=g.world;w.hazards=[];w.time=30;w.enemies=[];for(const [i,kind]of ['ragbound','weftbinder','hemcocoon','shuttlecrawler','twinweftwarden','shuttlejailer'].entries()){const e=w.addEnemy(kind,-6+i*2.5,0);e.state='seek';}g.update(0);g.painter.draw(w,0,[],false);return true;})()`,
  );
  await shot("loom-faction");
  report.loomQualification = await run(
    `(()=>{const g=__undead,C=g.world.constructor;for(const opener of ['blade','fire','water','frost','lightning','ghost','bone','mine']){const w=new C(31,'ranger',11);w.player={x:0,y:0};w.enemies=[];w.startingWeapon=opener;const boss=w.addEnemy('boss',4,0);boss.state='seek';for(const phase of [1,2,3]){boss.bossPhase=phase;w.loom.state(boss).action='C';const hs=w.loom.plan(boss);w.hazards=hs;const start=Math.max(...hs.map(h=>h.due+.7))+.05,end=Math.min(...hs.map(h=>h.due+2.9))-.05;w.loom.sample(phase===1?{x:0,y:-3}:{x:-1,y:-1},phase===1?{x:0,y:3}:{x:1,y:1},start,end);}w.state='won';g.progress.observe(w);}return {qualified:g.progress.data.loomQualifiedOpeners,achievement:g.progress.hasAchievement('loom_eight_paths'),wheel:g.progress.weaponGrades.wheel,coins:g.progress.coins};})()`,
  );
  if (
    report.loomQualification.qualified?.length !== 8 ||
    !report.loomQualification.achievement ||
    report.loomQualification.wheel !== 4 ||
    report.loomQualification.coins !== 3240
  )
    throw Error("Compiled Loom qualification serialization mismatch");
  await c("Page.reload", { ignoreCache: true });
  for (let i = 0; i < 200; i++) {
    if (await run("Boolean(globalThis.__undead?.ready)")) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  report.loomCold = await run(
    `({qualified:__undead.progress.data.loomQualifiedOpeners,achievement:__undead.progress.hasAchievement('loom_eight_paths'),wheel:__undead.progress.weaponGrades.wheel,coins:__undead.progress.coins,slots:__undead.progress.manualSaves.map(s=>s.state)})`,
  );
  if (
    report.loomCold.qualified?.length !== 8 ||
    !report.loomCold.achievement ||
    report.loomCold.wheel !== 4 ||
    report.loomCold.coins !== 3240 ||
    report.loomCold.slots.join(",") !== "empty,saved,saved"
  )
    throw Error("Loom account cold reload failed");
  await run("__undead.menuScreens.showStart();true");
  await shot("loom-title-start");
  await run("__undead.menuScreens.showAchievements(0,'机制挑战');true");
  await shot("loom-achievement-badge");
  report.kilnUpgrade = await run(
    `(()=>{const g=__undead;g.progress.data.stages=[1,2,3,4,5,6,7,8,9,10,11];g.progress.data.revision++;g.progress.pending=true;g.progress.flush();const a=[1,2,3].map(grade=>g.progress.evolveWeapon('bone',grade));return {results:a,grade:g.progress.weaponGrades.bone,coins:g.progress.coins};})()`,
  );
  if (
    report.kilnUpgrade.results.join(",") !== "evolved,evolved,evolved" ||
    report.kilnUpgrade.grade !== 4 ||
    report.kilnUpgrade.coins !== 720
  )
    throw Error("Compiled bone progression failed");
  report.kilnQualified =
    await run(`(()=>{const g=__undead,C=g.world.constructor,pairs={blade:[['orbit','return'],['orbit','shards']],fire:[['heavy','embers'],['heavy','flame']],water:[['spring','recall'],['spring','pulse']],frost:[['outward','aftershock'],['outward','brittle']],lightning:[['relay','echo'],['relay','bridge']],ghost:[['execution','haunt'],['execution','reap']],bone:[['lance','marrow'],['lance','ridge']],mine:[['trip','scatter'],['trip','fuse']],void:[['drift','binary'],['drift','repel']],holy:[['execution','cross'],['execution','brand']]};
    for(const opener of Object.keys(pairs))for(const pair of pairs[opener]){const w=new C(31,'ranger',12);w.player={x:0,y:0};w.camera={x:0,y:0};w.enemies=[];w.startingWeapon=opener;w.skills[opener]=8;w.mods[opener]=pair;const boss=w.addEnemy('boss',4,0);boss.state='seek';for(const phase of [1,2,3]){w.time=phase*20;w.hazards=[];w.enemies=[boss];boss.bossPhase=phase;w.kiln.state(boss).action='B';if(!w.kiln.begin(boss))throw Error('No compiled valve plan');const valve=w.enemies.find(e=>e.kind==='kilnvalve'&&e.hp>0);if(!valve)throw Error('Missing compiled valve');w.hit(valve,1000,opener);}if(w.challenge.kilnPhases.size!==3)throw Error('Lost compiled phase Set');w.state='won';g.progress.observe(w);}
    return {qualified:g.progress.data.kilnQualified,achievement:g.progress.hasAchievement('kiln_ten_paths'),bone:g.progress.weaponGrades.bone,coins:g.progress.coins};})()`);
  if (
    Object.values(report.kilnQualified.qualified).filter((v) => v.length === 2)
      .length !== 10 ||
    !report.kilnQualified.achievement ||
    report.kilnQualified.coins !== 7120
  )
    throw Error("Compiled kiln qualification serialization mismatch");
  await reloadGame();
  report.kilnCold = await run(
    `({qualified:__undead.progress.data.kilnQualified,achievement:__undead.progress.hasAchievement('kiln_ten_paths'),bone:__undead.progress.weaponGrades.bone,wheel:__undead.progress.weaponGrades.wheel,coins:__undead.progress.coins,slots:__undead.progress.manualSaves.map(s=>s.state)})`,
  );
  if (
    Object.values(report.kilnCold.qualified).filter((v) => v.length === 2)
      .length !== 10 ||
    !report.kilnCold.achievement ||
    report.kilnCold.bone !== 4 ||
    report.kilnCold.wheel !== 4 ||
    report.kilnCold.coins !== 7120 ||
    report.kilnCold.slots.join(",") !== "empty,saved,saved"
  )
    throw Error("Kiln account cold reload failed");
  await run("__undead.menuScreens.showStart();true");
  await shot("kiln-title-start");
  await run("__undead.menuScreens.showAchievements(0,'机制挑战');true");
  await shot("kiln-achievement-badge");
  report.edgeUpgrade = await run(
    `(()=>{const g=__undead;g.progress.data.stages=[1,2,3,4,5,6,7,8,9,10,11,12];g.progress.data.revision++;g.progress.pending=true;g.progress.flush();return {results:[1,2].map(grade=>g.progress.evolveWeapon('water',grade)),grade:g.progress.weaponGrades.water,coins:g.progress.coins,epic:'available'};})()`,
  );
  if (
    report.edgeUpgrade.results.join(",") !== "evolved,evolved" ||
    report.edgeUpgrade.grade !== 3 ||
    report.edgeUpgrade.coins !== 6040 ||
    report.edgeUpgrade.epic !== "available"
  )
    throw Error("Compiled water evolution failed");
  report.edgeQualified =
    await run(`(()=>{const g=__undead,C=g.world.constructor,pairs={blade:[['orbit','return'],['orbit','shards']],fire:[['heavy','embers'],['heavy','flame']],water:[['spring','recall'],['spring','pulse']],frost:[['outward','aftershock'],['outward','brittle']],lightning:[['relay','echo'],['relay','bridge']],ghost:[['execution','haunt'],['execution','reap']],bone:[['lance','marrow'],['lance','ridge']],mine:[['trip','scatter'],['trip','fuse']],void:[['drift','binary'],['drift','repel']],holy:[['execution','cross'],['execution','brand']],hammer:[['heavy','rift'],['heavy','return']],wheel:[['heavy','grind'],['heavy','curve']]};
    for(const opener of Object.keys(pairs))for(const pair of pairs[opener]){const w=new C(31,'ranger',13);w.enemies=[];w.startingWeapon=opener;w.skills[opener]=8;w.mods[opener]=pair;const boss=w.addEnemy('boss',-3,0);boss.state='seek';for(const phase of [1,2,3]){w.time=phase*20;w.hazards=[];w.enemies=[boss];boss.x=-3;boss.y=0;boss.state='seek';boss.bossPhase=phase;boss.hp=boss.maxHp*(phase===1?1:phase===2?.65:.3);w.player={x:0,y:0};w.camera={x:0,y:0};w.edge.state(boss).action='C';if(!w.edge.begin(boss))throw Error('No compiled C group');const end=Math.max(...boss.edge.items.map(h=>h.until));w.player={x:15,y:-15};while(w.time<end){const old=w.time;w.time=Math.min(end,w.time+.05);w.edge.sample(w.player,w.player,old,w.time);w.edge.stepEnemy(boss,w.time-old);}w.player={x:boss.x+1,y:boss.y};w.hit(boss,10,opener);if(!w.challenge.edgePhases.has(phase))throw Error('No compiled recovery qualification '+phase);}
     w.state='won';g.progress.observe(w);}
    return {qualified:g.progress.data.edgeQualified,achievement:g.progress.hasAchievement('edge_twelve_paths'),water:g.progress.weaponGrades.water,coins:g.progress.coins};})()`);
  if (
    Object.values(report.edgeQualified.qualified).filter((v) => v.length === 2)
      .length !== 12 ||
    !report.edgeQualified.achievement ||
    report.edgeQualified.coins !== 14200
  )
    throw Error("Compiled edge qualification serialization mismatch");
  await reloadGame();
  report.edgeCold = await run(
    `({qualified:__undead.progress.data.edgeQualified,achievement:__undead.progress.hasAchievement('edge_twelve_paths'),water:__undead.progress.weaponGrades.water,bone:__undead.progress.weaponGrades.bone,wheel:__undead.progress.weaponGrades.wheel,coins:__undead.progress.coins,slots:__undead.progress.manualSaves.map(s=>s.state)})`,
  );
  if (
    Object.values(report.edgeCold.qualified).filter((v) => v.length === 2)
      .length !== 12 ||
    !report.edgeCold.achievement ||
    report.edgeCold.water !== 3 ||
    report.edgeCold.bone !== 4 ||
    report.edgeCold.wheel !== 4 ||
    report.edgeCold.coins !== 14200 ||
    report.edgeCold.slots.join(",") !== "empty,saved,saved"
  )
    throw Error("Edge account cold reload failed");
  await run("__undead.menuScreens.showStart();true");
  await shot("edge-title-start");
  await run("__undead.menuScreens.showAchievements(0,'机制挑战');true");
  await shot("edge-achievement-badge");
  report.eclipseUpgrade = await run(
    `(()=>{const p=__undead.progress;return {result:p.evolveWeapon('water',3),grade:p.weaponGrades.water,coins:p.coins};})()`,
  );
  if (
    report.eclipseUpgrade.result !== "evolved" ||
    report.eclipseUpgrade.grade !== 4 ||
    report.eclipseUpgrade.coins !== 12760
  )
    throw Error("Epic water transaction failed");
  report.eclipseQualified =
    await run(`(()=>{const g=__undead,C=g.world.constructor,pairs={blade:[['orbit','return'],['orbit','shards'],['hunt','return']],fire:[['heavy','embers'],['heavy','flame'],['salvo','embers']],water:[['spring','recall'],['spring','pulse'],['wave','pulse']],frost:[['outward','aftershock'],['outward','brittle'],['sectors','brittle']],lightning:[['relay','echo'],['relay','bridge'],['storm','echo']],ghost:[['execution','haunt'],['execution','reap'],['swarm','haunt']],bone:[['lance','marrow'],['lance','ridge'],['fan','marrow']],mine:[['trip','scatter'],['trip','fuse'],['burrow','scatter']],void:[['drift','binary'],['drift','repel'],['collapse','binary']],holy:[['execution','cross'],['execution','brand'],['rain','brand']],hammer:[['heavy','rift'],['heavy','return'],['sweep','rift']],wheel:[['heavy','grind'],['heavy','curve'],['twin','grind']]};
    for(const opener of Object.keys(pairs))for(const pair of pairs[opener]){const w=new C(31,'ranger',14);w.enemies=[];w.startingWeapon=opener;for(const k of Object.keys(w.skills))w.skills[k]=0;w.skills[opener]=8;w.mods[opener]=pair;
      const boss=w.addEnemy('boss',3,8);boss.state='seek';
      for(const phase of [1,2,3]){w.time=phase*20;w.hazards=[];w.enemies=[boss];boss.x=3;boss.y=phase===3?7.1:phase===2?6.8:8;boss.state='seek';boss.bossPhase=phase;boss.hp=boss.maxHp*(phase===1?1:phase===2?.65:.3);w.player={x:8.6,y:boss.y};w.camera={x:5,y:7.8};w.eclipse.state(boss).action=phase===1?'A':phase===2?'B':'C';if(!w.eclipse.begin(boss))throw Error('No compiled eclipse plan '+phase);
        const f=boss.eclipse.items[0].eclipse.sweeps[0],omega=Math.PI/4.8,startAngle=f.sign>0?-.266:.266,begin=f.due+(startAngle-f.angle)/(f.sign*omega),stop=begin+.812;
        const at=t=>{const a=f.angle+f.sign*omega*(t-f.due);return{x:f.pivot.x+Math.cos(a)*5.6,y:f.pivot.y+Math.sin(a)*5.6};};
        let previous=at(begin);for(let t=begin+.004;t<=stop+1e-8;t+=.004){w.time=t;w.player=at(t);w.eclipse.sample(previous,w.player,t-.004,t);previous={...w.player};}
        w.player={x:15,y:-15};const end=Math.max(...boss.eclipse.items.map(h=>h.until));while(w.time<end){const old=w.time;w.time=Math.min(end,w.time+.02);w.eclipse.sample(w.player,w.player,old,w.time);w.eclipse.stepEnemy(boss,w.time-old);}
        if(!w.challenge.eclipsePhases.has(phase)||w.challenge.bossHits)throw Error('Compiled pillar shadow qualification failed '+phase+' '+JSON.stringify({phases:Array.from(w.challenge.eclipsePhases),hits:w.challenge.bossHits}));
      }
      w.state='won';const before=g.progress.coins;g.progress.observe(w);g.progress.observe(w);if(g.progress.coins!==before+360)throw Error('Duplicate settlement');
    }
    return{qualified:g.progress.data.eclipseQualified,achievement:g.progress.hasAchievement('eclipse_twelve_paths'),water:g.progress.weaponGrades.water,coins:g.progress.coins};})()`);
  if (
    Object.values(report.eclipseQualified.qualified).filter(
      (v) => v.length === 3,
    ).length !== 12 ||
    !report.eclipseQualified.achievement ||
    report.eclipseQualified.coins !== 25720
  )
    throw Error(
      "Eclipse challenge serialization failed " +
        JSON.stringify(report.eclipseQualified),
    );
  await reloadGame();
  report.eclipseCold = await run(
    `({qualified:__undead.progress.data.eclipseQualified,achievement:__undead.progress.hasAchievement('eclipse_twelve_paths'),water:__undead.progress.weaponGrades.water,bone:__undead.progress.weaponGrades.bone,wheel:__undead.progress.weaponGrades.wheel,coins:__undead.progress.coins,slots:__undead.progress.manualSaves.map(s=>s.state)})`,
  );
  if (
    Object.values(report.eclipseCold.qualified).filter((v) => v.length === 3)
      .length !== 12 ||
    !report.eclipseCold.achievement ||
    report.eclipseCold.water !== 4 ||
    report.eclipseCold.coins !== 25720 ||
    report.eclipseCold.slots.join(",") !== "empty,saved,saved"
  )
    throw Error("Eclipse cold reload failed");
  await run("__undead.menuScreens.showStart();true");
  await shot("eclipse-title-start");
  await run("__undead.menuScreens.showAchievements(0,'机制挑战');true");
  await shot("eclipse-achievement-badge");
  await run("__undead.menuScreens.showEclipsePaths();true");
  await shot("eclipse-opener-progress");
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
