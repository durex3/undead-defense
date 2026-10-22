/** Isolated headless integration test. Does not read or modify a user's Chrome profile. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  out = "artifacts/architecture-refactor/browser";
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
  await c("Page.navigate", { url: process.env.UNDEAD_BROWSER_URL || "http://127.0.0.1:8128" });
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
  report.selection=await run(`(()=>{const g=__undead,m=g.menuScreens;g.progress.data.stages=Array.from({length:16},(_,i)=>i+1);g.progress.data.coins=10000;g.progress.pending=true;g.progress.flush();const screens=[];for(let stage=1;stage<=16;stage++){m.showStageSelect(stage);const texts=[];function walk(n){for(const c of n.components||[])if(typeof c.string==='string')texts.push(c.string);for(const child of n.children||[])walk(child);}walk(g.overlay);if(!texts.some(t=>t.includes('账户金币 10000')))throw Error('Selection coins missing '+stage);screens.push({stage,labels:texts});}m.handleTargetKey(37);const left=m.stagePreview;m.handleTargetKey(39);const right=m.stagePreview;m.handleTargetKey(13);if(left!==15||right!==16||g.world.stageId!==16||!g.started)throw Error('Selection navigation callback failed');m.showStageSelect(16);return{screens,left,right};})()`);
  await shot('stage-selection-16');
  report.catalog=await run(`(()=>{
    const g=__undead,m=g.menuScreens,p=g.progress,rows=[];
    const click=title=>{const i=m.catalogLabels.findIndex(b=>b.title===title);if(i<0)throw Error('Missing catalog button '+title);m.catalogActions[i]();};
    for(const filter of ['全部','已解锁','可升级','金币购买','成就解锁']){m.showWeapons(999,filter);if(m.catalogPage<0)throw Error('Invalid page');rows.push({filter,page:m.catalogPage,buttons:m.catalogLabels.map(b=>b.title)});}
    m.showWeapons(0,'可升级');click('↑');if(m.catalog!=='purchase')throw Error('Upgrade icon route');click('取消');if(m.catalog!=='detail')throw Error('Cancel route');
    p.data.grades={...p.data.grades,fire:1};m.showWeaponDetail('fire');const before=p.coins;click('进阶精良 · 360金币');if(p.coins!==before)throw Error('Charged before confirmation');click('确认购买');if(p.coins!==before-360||p.weaponGrades.fire!==2||m.catalog!=='detail')throw Error('Catalog transaction failed');
    m.showWeaponDetail('needle');if(!m.catalogLabels.some(b=>b.title==='查看解锁成就'))throw Error('Achievement route missing');click('查看解锁成就');if(m.catalog!=='achievements')throw Error('Achievement navigation failed');
    m.showWeapons(0,'全部');return {rows,spent:before-p.coins,fireGrade:p.weaponGrades.fire};
  })()`);
  await shot('weapon-catalog');
  report.navigation=await run(`(()=>{
    const g=__undead,m=g.menuScreens,p=g.progress;
    const click=title=>{const i=m.catalogLabels.findIndex(b=>b.title===title);if(i<0)throw Error('Missing '+title);m.catalogFocus=i;m.catalogActions[i]();};
    m.showWeaponDetail('water');const before=p.coins;click('进阶精良 · 360金币');m.handleTargetKey(39);
    if(m.catalog!=='purchase'||m.catalogFocus!==1)throw Error('Confirmation focus lost');m.handleTargetKey(13);
    if(p.coins!==before-360||p.weaponGrades.water!==2)throw Error('Keyboard evolution lost transaction context');
    m.showWeaponDetail('bone');click('进阶精良 · 360金币');m.handleTargetKey(39);m.handleTargetKey(27);
    if(m.catalog!=='detail'||m.catalogFocus!==1||p.coins!==before-360||p.weaponGrades.bone!==1)throw Error('Cancel changed account or lost focus');
    m.showAchievements(0,'机制挑战');click('起手进度');m.handleTargetKey(39);if(m.catalog!=='paths')throw Error('Arrow left progress screen');m.handleTargetKey(27);
    if(m.catalog!=='achievements'||m.catalogFocus!==3)throw Error('Progress back lost parent focus');
    m.showManualSaves();click('保存');m.handleTargetKey(39);m.handleTargetKey(27);
    if(m.catalog!=='manual'||p.manualSaves.some(s=>s.state!=='empty'))throw Error('Save cancel changed slot');
    const body='ASR1-4-400-1750000000000';let hash=2166136261;for(let i=0;i<body.length;i++)hash=Math.imul(hash^body.charCodeAt(i),16777619);const code=body+'-'+(hash>>>0).toString(36);
    m.showRepairEntry(code);const input=m.repairInput;m.handleTargetKey(37);if(m.repairInput!==input||input.string!==code)throw Error('Focus rebuilt native input');
    m.showRepairCodePreview(code);if(m.catalog!=='repair-confirm')throw Error('Repair preview missing');m.handleTargetKey(27);
    if(m.catalog!=='repair-entry'||m.repairInput.string!==code||p.coins!==before-360)throw Error('Repair cancellation lost draft or changed account');
    return {keyboardEvolution:true,cancelFocus:true,progressReturn:true,manualCancel:true,nativeInputPreserved:true,repairCancel:true,spent:before-p.coins};
  })()`);
  report.achievementScreens=await run(`(()=>{
    const g=__undead,m=g.menuScreens,p=g.progress,rows=[],badges=[];
    const labels=()=>{const all=[];function walk(n){for(const c of n.components||[])if(typeof c.string==='string')all.push(c.string);for(const child of n.children||[])walk(child);}walk(g.overlay);return all;};
    for(const category of ['通关记录','机制挑战','配装挑战'])for(let page=0;page<6;page++){m.showAchievements(page,category);rows.push({category,requested:page,page:m.achievementPage,labels:labels()});}
    const paths=[['十二途断棺',5],['十二途踏空',4],['十二途逐晖',3]];
    for(let index=0;index<paths.length;index++){
      m.showAchievements(0,'机制挑战');const links=m.catalogLabels.map((b,i)=>b.title==='起手进度'?i:-1).filter(i=>i>=0);m.catalogActions[links[index]]();
      const texts=labels(),[name,required]=paths[index];if(!texts.some(t=>t.includes(name))||texts.filter(t=>t.includes('  0/'+required)).length!==14)throw Error('Opener progress page mismatch '+name);
      rows.push({path:name,labels:texts});const back=m.catalogLabels.findIndex(b=>b.title==='返回成就');m.catalogActions[back]();if(m.catalog!=='achievements'||m.achievementPage!==0)throw Error('Achievement return failed');
    }
    const saved=p.data.achievements;
    try{
      p.data.achievements=['grave_twelve_paths','lead_twelve_paths','eclipse_twelve_paths','edge_twelve_paths','kiln_ten_paths','loom_eight_paths'];
      for(let page=0;page<2;page++){m.showAchievements(page,'机制挑战');for(const node of g.overlay.children)if(node.name.endsWith('AchievementBadge'))badges.push(node.name);}
      if(new Set(badges).size!==6)throw Error('Expected all six achievement badges');
    }finally{p.data.achievements=saved;}
    m.showAchievements(0,'机制挑战');return{rows,badges};
  })()`);
  await shot('achievement-screen');
  const extraCases=JSON.parse(fs.readFileSync('artifacts/architecture-refactor/extra-behavior-before.json','utf8')).filter(r=>r.scene==='stationary').map(({skill,mods})=>({skill,mods}));
  report.extraLifecycles=await run(`(()=>{
    const C=__undead.world.constructor,rows=[];
    for(const {skill,mods} of ${JSON.stringify(extraCases)}) {
      const w=new C(22,'ranger',1);w.player={x:0,y:0};w.enemies=[];w.time=.13;
      for(const s of Object.keys(w.skills))w.skills[s]=0;
      w.skills[skill]=8;w.mods[skill]=mods;w.passives.amount=4;w.passives.area=4;
      for(let i=0;i<16;i++){const angle=i*Math.PI/8,e=w.addEnemy(i===0?'siegeflag':'siegebone',Math.cos(angle)*2.8,Math.sin(angle)*2.8);e.state='seek';e.hp=e.maxHp=1e7;}
      w.armory.step(0);for(const s of Object.keys(w.skills))w.cooldowns[s]=100;
      if(skill==='mine')for(const a of w.armory.extra.attacks){const e=w.addEnemy('siegebone',a.x,a.y);e.state='seek';e.hp=e.maxHp=1e7;}
      for(let frame=0;frame<240;frame++){w.time+=1/30;w.armory.step(1/30);w.drain();}
      const active=w.armory.extra.attacks.filter(a=>a.active).length,damage=w.damage[skill]||0;
      if(active||damage<=0)throw Error('Compiled lifecycle failed '+skill+':'+mods+' active='+active+' damage='+damage);
      rows.push({skill,mods,active,damage});
    }
    return rows;
  })()`);
  report.combat=await run(`(()=>{const C=__undead.world.constructor,rows=[];for(let stage=1;stage<=16;stage++)for(const exposed of [false,true]){const w=new C(19,'ranger',stage);w.enemies=[];const e=w.addEnemy('boss',3,0);e.hp=e.maxHp=1e7;e.state=exposed?'recover':'seek';for(const k of ['sand','thunder','moon','bell','tide','prism','root','wind','library','loom','kiln','edge','eclipse','lead','grave'])e[k]={...e[k],vulnerable:exposed};w.hit(e,100,'blade');const damage=1e7-e.hp,expected=stage<=4?(exposed?125:100):(exposed?106.25:45);if(Math.abs(damage-expected)>1e-7)throw Error('Combat policy drift '+stage);rows.push({stage,exposed,damage});}return rows;})()`);

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
  report.ai = await run(`(()=>{
    const C=__undead.world.constructor, rows=[];
    for(const [stage,point,form] of [[4,{x:20,y:0},2],[5,{x:20,y:0},1],[11,{x:-13,y:12},3],[12,{x:20,y:0},3],[13,{x:20,y:0},2],[13,{x:20,y:0},3],[16,{x:0,y:0},1],[16,{x:20,y:24},2]]){
      const w=new C(31,'ranger',stage);w.time=400;w.state='battle';w.player={...point};w.hp=w.maxHp=1e8;
      w.camera={x:Math.max(-512/48,Math.min(512/48,point.x)),y:Math.max(-(stage>=11?1124:984)/48,Math.min((stage>=11?1124:984)/48,point.y))};w.viewport={x:7.5*844/390,y:7.5};
      w.director.step=()=>{};w.armory.step=()=>{};
      const e=w.addEnemy('boss',Math.max(-21.3,point.x-4.8),point.y);w.stageStrategy.map.resolve(e,.7);e.state='seek';e.attack=0;
      if(stage===16&&form===2){e.grave.life=2;e.bossPhase=2;e.hp=e.maxHp=e.grave.total*.6;}
      else if(form>1){e.bossPhase=form;e.hp=e.maxHp*(form===3?.2:.4);}
      let maxSlots=0;for(let i=0;i<1800;i++){w.step(1/30);maxSlots=Math.max(maxSlots,w.hazards.filter(h=>h.until>w.time).length);w.drain();}
      rows.push({stage,form,damage:1e8-w.hp,maxSlots,approaches:w.bossTactics.stats.approaches});
    }
    return rows;
  })()`);
  if(report.ai.some(r=>r.damage<=0||r.maxSlots>2))throw Error('Actual Cocos boss pressure or danger-budget regression');
  report.ranged = await run(`(()=>{
    const C=__undead.world.constructor,rows=[];
    for(const [stage,kind] of [[1,'siegebow'],[3,'arclantern'],[16,'echoacolyte']]){
      const w=new C(31,'ranger',stage);w.time=400;w.state='battle';w.hp=w.maxHp=1e8;w.player={x:0,y:0};w.viewport={x:7.5*844/390,y:7.5};w.director.step=()=>{};w.armory.step=()=>{};
      const e=w.addEnemy(kind,-5,0);e.state='seek';e.attack=0;const ids=new Set();let maxSlots=0;
      for(let i=0;i<1800;i++){const t=i/30,target={x:Math.cos(t*.6)*3,y:Math.sin(t*.6)*3},d=Math.hypot(target.x-w.player.x,target.y-w.player.y);w.move={x:d?((target.x-w.player.x)/d):0,y:d?((target.y-w.player.y)/d):0};w.camera={...w.player};w.step(1/30);for(const h of w.hazards)ids.add(h.id);maxSlots=Math.max(maxSlots,w.hazards.filter(h=>h.until>w.time).length);w.drain();}
      rows.push({stage,kind,casts:ids.size,maxSlots,spacing:w.enemyTactics.ranged.stats});
    }
    const w=new C(31,'ranger',16);w.time=400;w.state='battle';w.player={x:-5,y:0};w.director.step=()=>{};w.armory.step=()=>{};
    const a=w.addEnemy('gravegrub',0,0),b=w.addEnemy('gravegrub',0,0);a.state=b.state='seek';a.freezeUntil=402;w.step(.1);
    return {rows,frozenStayed:a.x===0&&a.y===0};
  })()`);
  if(!report.ranged.frozenStayed||report.ranged.rows.some(r=>!r.casts||r.maxSlots>2||!r.spacing.moves))throw Error('Actual Cocos ranged/crowd regression');
  report.bossSelection=await run(`(()=>{
    const C=__undead.world.constructor,rows=[];
    for(const stage of [14,15])for(const phase of [1,2,3]){
      const w=new C(31,'ranger',stage);w.time=400;w.state='battle';w.player={x:0,y:0};w.camera={x:0,y:0};w.viewport={x:7.5*844/390,y:7.5};w.hp=w.maxHp=1e8;w.director.step=()=>{};w.armory.step=()=>{};
      const e=w.addEnemy('boss',-3.8,0);e.state='seek';e.attack=0;e.bossPhase=phase;e.hp=e.maxHp*(phase===3?.2:phase===2?.6:1);let maxSlots=0;
      for(let i=0;i<3600;i++){w.step(1/30);maxSlots=Math.max(maxSlots,w.hazards.filter(h=>h.until>w.time).length);w.drain();}
      const system=stage===14?w.eclipse:w.lead;rows.push({stage,phase,maxSlots,choices:system.bossChoices.stats,patterns:system.stats.patterns});
    }
    return rows;
  })()`);
  if(report.bossSelection.some(r=>r.maxSlots>2||r.choices.choices===0||Object.values(r.patterns).some(v=>v===0)))throw Error('Boss choice geometry or move diversity regression');
  report.eliteCoordination=await run(`(()=>{
    const C=__undead.world.constructor,rows=[];
    for(const stage of [10,16]){
      const w=new C(31,'ranger',stage);w.time=265;w.state='battle';w.player={x:stage===10?20:0,y:0};w.camera={x:stage===10?512/48:0,y:0};w.viewport={x:7.5*844/390,y:7.5};w.hp=w.maxHp=1e8;w.director.step=()=>{};w.armory.step=()=>{};
      const kinds=stage===10?['sealprovost','claspjailer']:['coffinregent','scarprelate'];const actors=kinds.map((kind,i)=>{const e=w.addEnemy(kind,w.player.x+(i?-4.6:1),i?0:4.2);e.state='seek';e.attack=0;return e;});const ids=new Set(),casts=[0,0];let maxSlots=0;
      for(let i=0;i<2700;i++){const y=Math.sin(i/30*.3)*3,d=y-w.player.y;w.move={x:0,y:Math.sign(d)*Math.min(1,Math.abs(d)*30/w.speed)};w.camera.y=w.player.y;w.step(1/30);for(const h of w.hazards)if(!ids.has(h.id)){ids.add(h.id);const n=actors.findIndex(e=>e.id===h.source);if(n>=0)casts[n]++;}maxSlots=Math.max(maxSlots,w.hazards.filter(h=>h.until>w.time).length);w.drain();}
      rows.push({stage,maxSlots,casts,moves:w.enemyTactics.elites.stats.moves});
    }
    return rows;
  })()`);
  if(report.eliteCoordination.some(r=>r.maxSlots>2||r.casts.some(v=>v===0)))throw Error('Actual Cocos elite coordination regression');
  await c('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});
  report.stage17=await run(`(()=>{
    const g=__undead;g.progress.data.stages=Array.from({length:16},(_,i)=>i+1);g.selectedStage=17;g.restart();const w=g.world;w.state='battle';w.enemies=[];w.player={x:0,y:0};w.camera={x:0,y:0};g.camera={x:0,y:0};w.time=400;w.pause('capture',true);const e=w.addEnemy('boss',-4,-3);e.state='seek';e.attack=0;w.trace.state(e).action='B';const began=w.trace.begin(e);g.painter.draw(w,0,[],true);return{stage:w.stageId,total:e.trace.total,first:e.hp,began};
  })()`);
  if(report.stage17.stage!==17||!report.stage17.began)throw Error('Stage17 entry/first route failed');
  await shot('stage17-first-warning-844');
  report.stage17Death=await run(`(()=>{const g=__undead,w=g.world,e=w.enemies.find(e=>e.kind==='boss');const coins=g.progress.coins;w.hit(e,1e9,'blade');g.painter.draw(w,0,w.drain(),true);return{hp:e.hp,state:w.state,kills:w.kills,coins:g.progress.coins,before:coins};})()`);
  if(report.stage17Death.hp!==0||report.stage17Death.state!=='battle'||report.stage17Death.kills!==0||report.stage17Death.coins!==report.stage17Death.before)throw Error('Stage17 first lethal settled');
  await shot('stage17-revival');
  report.stage17Trace=await run(`(()=>{const g=__undead,w=g.world,e=w.enemies.find(e=>e.kind==='boss');w.pause('capture',false);w.time=e.trace.deadUntil;w.trace.tick();w.pause('capture',true);w.hazards=[];w.trace.history.clear();[{x:-4,y:-2},{x:-1,y:-2},{x:-1,y:0}].forEach((p,i)=>w.trace.history.record(p,w.time-2+i));e.state='seek';e.trace.action='B';const began=w.trace.begin(e),h=e.trace.item;w.time+=1;g.painter.draw(w,0,[],true);return{life:e.trace.life,health:e.hp,began,genuine:h.trace.genuine,direction:h.trace.direction,route:h.trace.route};})()`);
  if(report.stage17Trace.life!==2||!report.stage17Trace.began||!report.stage17Trace.genuine||report.stage17Trace.direction!=='left')throw Error('Stage17 real trace/Cocos collection regression');
  await shot('stage17-trace-warning-844');
  await c('Emulation.setDeviceMetricsOverride',{width:740,height:390,deviceScaleFactor:1,mobile:true});
  await shot('stage17-trace-warning-740');
  await c('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});
  report.stage17Return=await run(`(()=>{const g=__undead,w=g.world,e=w.enemies.find(e=>e.kind==='boss'),h=e.trace.item;w.time=h.trace.legs.at(-1).end+.05;w.trace.stepEnemy(e,.05);const f=h.trace.legs.find(f=>f.pass===2);g.painter.draw(w,0,[],true);return{warning:f?f.due-w.time:null,from:f?.from,body:{x:e.x,y:e.y}};})()`);
  if(report.stage17Return.warning<2.4-1e-8||JSON.stringify(report.stage17Return.from)!==JSON.stringify(report.stage17Return.body))throw Error('Stage17 fresh return/body source failed');
  await shot('stage17-return-warning-844');
  report.stage17Economy=await run(`(()=>{const g=__undead,p=g.progress,w=g.world,e=w.enemies.find(e=>e.kind==='boss');const before=p.coins;w.hit(e,1e9,'blade');p.observe(w);p.observe(w);const won=p.coins;p.data.grades={...p.data.grades,holy:1};const fine=p.evolveWeapon('holy',1),rare=p.evolveWeapon('holy',2);p.data.traceQualifiedVersion=1;p.data.traceQualified={blade:['hunt+return|left']};p.pending=true;p.flush();g.menuScreens.showWeaponDetail('holy');return{before,won,after:p.coins,fine,rare,grade:p.weaponGrades.holy,best:p.data.stageBest[17]};})()`);
  if(report.stage17Economy.won-report.stage17Economy.before!==420||report.stage17Economy.won-report.stage17Economy.after!==1080||report.stage17Economy.grade!==3)throw Error('Stage17 win/holy purchase failed');
  await shot('stage17-holy-rare');
  await run(`__undead.menuScreens.showOpenerPaths('trace_twelve_paths','blade');true`);
  await shot('stage17-signed-recipes');
  await c('Emulation.setDeviceMetricsOverride',{width:740,height:390,deviceScaleFactor:1,mobile:true});
  await shot('stage17-signed-recipes-740');
  await c('Page.reload');for(let i=0;i<150;i++){if(await run('Boolean(globalThis.__undead?.ready)'))break;await new Promise(r=>setTimeout(r,100));}
  report.stage17Cold=await run(`({coins:__undead.progress.coins,grade:__undead.progress.weaponGrades.holy,keys:__undead.progress.data.traceQualified?.blade,clear:__undead.progress.hasAchievement('tracecourt_clear'),slots:__undead.progress.manualSaves.map(s=>s.state)})`);
  if(report.stage17Cold.coins!==report.stage17Economy.after||report.stage17Cold.grade!==3||report.stage17Cold.keys?.[0]!=='hunt+return|left'||!report.stage17Cold.clear||report.stage17Cold.slots.join(',')!=='saved,saved,saved')throw Error('Stage17 cold account compatibility failed');
  await c('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});
  report.stage18Director=await run(`(()=>{const C=__undead.world.constructor,w=new C(31,'ranger',18);w.time=400;w.state='battle';w.player={x:0,y:0};w.camera={x:0,y:0};w.viewport={x:16,y:7.5};w.director.step(w,0);return{bosses:w.enemies.filter(e=>e.kind==='boss').length};})()`);
  if(report.stage18Director.bosses!==1)throw Error('Stage18 actual Creator director initialization failed');
  report.stage18Support=await run(`(()=>{
    const g=__undead;g.progress.data.stages=Array.from({length:17},(_,i)=>i+1);g.selectedStage=18;g.restart();const w=g.world;w.state='battle';w.enemies=[];w.player={x:0,y:-2};w.camera={x:0,y:0};g.camera={x:0,y:0};w.time=280;w.pause('capture',true);const e=w.addEnemy('chimeshard',0,0),s=w.addEnemy('resonancebearer',2,0);const buff=w.stageStrategy.combat.incoming(e,100,w.player,false);g.painter.draw(w,0,[],true);return{stage:w.stageId,buff,buffed:w.counter.buffed(e)};
  })()`);
  if(report.stage18Support.stage!==18||report.stage18Support.buff!==65||!report.stage18Support.buffed)throw Error('Stage18 support integration failed');
  await shot('stage18-support-844');
  report.stage18First=await run(`(()=>{const g=__undead,w=g.world;w.enemies=[];w.hazards=[];w.player={x:0,y:0};w.time=400;const e=w.addEnemy('boss',-3,0);e.state='seek';e.attack=0;const began=w.counter.begin(e,'A');g.painter.draw(w,0,[],true);return{began,hp:e.hp,pulses:e.counter.item.counter.pulses.length,first:JSON.stringify(e.counter.item.counter.pulses[0]),slots:w.counter.slots};})()`);
  if(!report.stage18First.began||report.stage18First.pulses!==1||report.stage18First.slots!==1)throw Error('Stage18 first lock failed');
  await shot('stage18-first-lock-844');
  report.stage18Second=await run(`(()=>{const g=__undead,w=g.world,e=w.enemies.find(e=>e.kind==='boss');w.pause('capture',false);w.time+=.9;w.counter.clean();w.pause('capture',true);g.painter.draw(w,0,[],true);const b=e.counter.item.counter;return{pulses:b.pulses.length,warning:b.pulses[1]?.due-w.time,first:JSON.stringify(b.pulses[0]),body:{x:e.x,y:e.y},source:{x:b.pulses[1]?.x,y:b.pulses[1]?.y}};})()`);
  if(report.stage18Second.pulses!==2||report.stage18Second.warning<2.4-1e-8||report.stage18Second.first!==report.stage18First.first||JSON.stringify(report.stage18Second.body)!==JSON.stringify(report.stage18Second.source))throw Error('Stage18 second lock or body source failed');
  await shot('stage18-two-locks-844');
  await c('Emulation.setDeviceMetricsOverride',{width:740,height:390,deviceScaleFactor:1,mobile:true});
  await shot('stage18-two-locks-740');
  report.stage18Economy=await run(`(()=>{const g=__undead,p=g.progress,w=g.world,e=w.enemies.find(e=>e.kind==='boss');const before=p.coins;w.hit(e,1e9,'blade');p.observe(w);p.observe(w);const won=p.coins;p.data.grades={...p.data.grades,holy:3};const evolved=p.evolveWeapon('holy',3);p.data.counterbeatMasteryVersion=1;p.data.counterbeatMastery=['blade','frost'];p.pending=true;p.flush();g.menuScreens.showWeaponDetail('holy');return{before,won,after:p.coins,evolved,grade:p.weaponGrades.holy,best:p.data.stageBest[18]};})()`);
  if(report.stage18Economy.won-report.stage18Economy.before!==440||report.stage18Economy.won-report.stage18Economy.after!==1440||report.stage18Economy.grade!==4||report.stage18Economy.best.form!==1)throw Error('Stage18 win or epic transaction failed');
  await shot('stage18-holy-epic-740');
  await run(`__undead.menuScreens.showOpenerPaths('counterbeat_mastery');true`);
  await shot('stage18-mastery-740');
  await c('Page.reload');for(let i=0;i<150;i++){if(await run('Boolean(globalThis.__undead?.ready)'))break;await new Promise(r=>setTimeout(r,100));}
  report.stage18Cold=await run(`({coins:__undead.progress.coins,grade:__undead.progress.weaponGrades.holy,mastery:__undead.progress.data.counterbeatMastery,clear:__undead.progress.hasAchievement('counterbeat_clear'),slots:__undead.progress.manualSaves.map(s=>s.state)})`);
  if(report.stage18Cold.coins!==report.stage18Economy.after||report.stage18Cold.grade!==4||report.stage18Cold.mastery?.join(',')!=='blade,frost'||!report.stage18Cold.clear||report.stage18Cold.slots.join(',')!=='saved,saved,saved')throw Error('Stage18 cold account compatibility failed');
  await c('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});
  report.stage19=await run(`(()=>{
    const g=__undead;g.progress.data.stages=Array.from({length:18},(_,i)=>i+1);g.selectedStage=19;g.restart();const w=g.world;w.state='battle';w.enemies=[];w.player={x:0,y:0};w.camera={x:0,y:0};g.camera={x:0,y:0};w.time=400;w.pause('capture',false);w.director.step(w,0);w.pause('capture',true);const pair=w.twingate.encounter.members;for(const e of pair){e.state='seek';e.attack=0;e.visibleSince=399;}g.painter.draw(w,0,[],true);return{stage:w.stageId,summary:w.twingate.summary(),roles:pair.map(e=>e.twin.role)};
  })()`);
  if(report.stage19.stage!==19||report.stage19.roles.join(',')!=='hunter,warden'||report.stage19.summary.bodiesRemaining!==2)throw Error('Stage19 atomic encounter failed '+JSON.stringify(report.stage19));
  await shot('stage19-duet-844');
  report.stage19Locks=await run(`(()=>{const g=__undead,w=g.world;w.pause('capture',false);w.invulnerable=1e8;let began=false;for(let i=0;i<3600&&!began;i++){w.director.step=()=>{};w.armory.step=()=>{};w.step(1/30);w.drain();began=w.twingate.stats.pairs>0;}w.pause('capture',true);g.camera={...w.camera};g.painter.draw(w,0,[],true);return{began,slots:w.twingate.slots,parts:w.hazards.filter(h=>h.twin&&h.until>w.time).map(h=>h.twin.parts.length)};})()`);
  if(!report.stage19Locks.began||report.stage19Locks.slots!==2||report.stage19Locks.parts.reduce((a,b)=>a+b,0)!==1)throw Error('Stage19 first pair lock failed '+JSON.stringify(report.stage19Locks));
  await shot('stage19-first-lock-844');
  report.stage19Second=await run(`(()=>{const g=__undead,w=g.world;w.pause('capture',false);w.time+=.91;w.twingate.clean();w.pause('capture',true);g.painter.draw(w,0,[],true);const h=w.hazards.find(h=>h.twin?.parts[0]?.locked>w.time-.02);return{slots:w.twingate.slots,warning:h?.twin.parts[0].due-w.time};})()`);
  if(report.stage19Second.slots!==2||report.stage19Second.warning<2.4-1e-8)throw Error('Stage19 second pair warning failed');
  await shot('stage19-two-locks-844');
  await c('Emulation.setDeviceMetricsOverride',{width:740,height:390,deviceScaleFactor:1,mobile:true});
  await shot('stage19-two-locks-740');
  report.stage19FirstDeath=await run(`(()=>{const g=__undead,w=g.world,p=g.progress,[a,b]=w.twingate.encounter.members;const before=p.coins,hp=b.hp;w.hit(a,1e9,'blade');p.observe(w);w.enemies=w.enemies.filter(e=>e.hp>0);g.painter.draw(w,0,w.drain(),true);return{state:w.state,before,after:p.coins,hp,bhp:b.hp,summary:w.twingate.summary(),wait:w.twingate.encounter.soloAt-w.time};})()`);
  if(report.stage19FirstDeath.state!=='battle'||report.stage19FirstDeath.after!==report.stage19FirstDeath.before||report.stage19FirstDeath.hp!==report.stage19FirstDeath.bhp||report.stage19FirstDeath.summary.bodiesRemaining!==1||report.stage19FirstDeath.wait<1.8-1e-8)throw Error('Stage19 first death/aggregate failed');
  await shot('stage19-inheritance-740');
  report.stage19Solo=await run(`(()=>{const g=__undead,w=g.world;w.pause('capture',false);w.time=w.twingate.encounter.soloAt;w.twingate.tick();w.hazards=[];const e=w.twingate.encounter.alive[0];e.x=-3;e.y=0;w.player={x:0,y:0};w.camera={x:0,y:0};g.camera={x:0,y:0};const began=w.twingate.begin(e,'B');w.pause('capture',true);g.painter.draw(w,0,[],true);return{began,phase:e.bossPhase,role:e.twin.role,hp:e.hp};})()`);
  if(!report.stage19Solo.began||report.stage19Solo.phase!==2||report.stage19Solo.hp!==report.stage19FirstDeath.bhp)throw Error('Stage19 solo form failed');
  await shot('stage19-warden-solo-740');
  report.stage19Economy=await run(`(()=>{const g=__undead,p=g.progress,w=g.world,e=w.twingate.encounter.alive[0],before=p.coins;w.frame++;w.hit(e,1e9,'blade');p.observe(w);p.observe(w);const won=p.coins;p.data.grades={...p.data.grades,ghost:1};const fine=p.evolveWeapon('ghost',1),rare=p.evolveWeapon('ghost',2);p.data.duetOrdersVersion=1;p.data.duetOrders={blade:['hunter_first','warden_first']};p.pending=true;p.flush();g.menuScreens.showWeaponDetail('ghost');return{before,won,after:p.coins,fine,rare,grade:p.weaponGrades.ghost,best:p.data.stageBest[19]};})()`);
  if(report.stage19Economy.won-report.stage19Economy.before!==460||report.stage19Economy.won-report.stage19Economy.after!==1080||report.stage19Economy.grade!==3||report.stage19Economy.best.killOrder!=='hunter_first'||report.stage19Economy.best.bodiesRemaining!==0)throw Error('Stage19 settlement/ghost upgrade failed');
  await shot('stage19-ghost-rare-740');
  await run(`__undead.menuScreens.showOpenerPaths('twingate_twelve_orders','blade');true`);
  await shot('stage19-orders-740');
  await c('Page.reload');for(let i=0;i<150;i++){if(await run('Boolean(globalThis.__undead?.ready)'))break;await new Promise(r=>setTimeout(r,100));}
  report.stage19Cold=await run(`({coins:__undead.progress.coins,grade:__undead.progress.weaponGrades.ghost,orders:__undead.progress.data.duetOrders?.blade,clear:__undead.progress.hasAchievement('twingate_clear'),slots:__undead.progress.manualSaves.map(s=>s.state)})`);
  if(report.stage19Cold.coins!==report.stage19Economy.after||report.stage19Cold.grade!==3||report.stage19Cold.orders?.join(',')!=='hunter_first,warden_first'||!report.stage19Cold.clear||report.stage19Cold.slots.join(',')!=='saved,saved,saved')throw Error('Stage19 cold account compatibility failed');
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
