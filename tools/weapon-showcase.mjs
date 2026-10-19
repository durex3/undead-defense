/** Deterministic runtime Armory + Painter study. Scripted minions, no HUD or full level AI. */
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import sharp from "sharp";
const out="artifacts/weapon-redesign/showcase";
if(process.argv.includes("--copy-local")) {
  if(!fs.existsSync("build/web-mobile/index.html"))throw Error("Build Web first");
  fs.cpSync(out,"build/web-mobile/qa-weapons",{recursive:true});
  const {WEAPONS,NAMES}=await import("../temp/tests/battle/SurvivalConfig.mjs");
  const {MODS}=await import("../temp/tests/battle/ArmoryConfig.mjs");
  const target="build/web-mobile/qa-weapons";
  for(const skill of WEAPONS)fs.copyFileSync(`artifacts/art-builds/${skill}.png`,`${target}/mods-${skill}.png`);
  const data=Object.fromEntries(WEAPONS.map(s=>[s,MODS[s].map(m=>({name:m.name,effect:m.effect,cost:m.cost}))]));
  fs.writeFileSync(`${target}/mods.html`,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>四十改造对照</title><style>body{max-width:1200px;margin:24px auto;padding:0 16px;background:#182923;color:#e6dfc8;font:16px/1.7 system-ui}select{font:inherit;padding:8px}img{max-width:100%;border:1px solid #617b6b}a{color:#c2dba7}</style><h1>四十项改造与双改配置</h1><p>每张图按行展示基础、四项单改、五种合法双改；每行八个时刻。真实Armory离线绘制，非实机录屏。<a href="index.html">返回基础动态预览</a></p><select id="skill">${WEAPONS.map(s=>`<option value="${s}">${NAMES[s]}</option>`).join("")}</select><div id="info"></div><a id="full"><img id="sheet" alt="所有改造配置时间采样图"></a><script>const data=${JSON.stringify(data)};const select=document.getElementById('skill');function update(){const s=select.value;document.getElementById('sheet').src='mods-'+s+'.png';document.getElementById('full').href='mods-'+s+'.png';document.getElementById('info').textContent=data[s].map(m=>m.name+'：'+m.effect+'；代价：'+m.cost).join(' / ')}select.onchange=update;update();</script></html>`);
  const page=`${target}/index.html`;
  fs.writeFileSync(page,fs.readFileSync(page,"utf8").replace('<select id="weapon">','<p><a href="mods.html">查看四十项改造与双改采样对照</a></p><select id="weapon">'));
  console.log("http://127.0.0.1:8128/qa-weapons/");process.exit(0);
}
execFileSync(process.execPath,["tools/test-build.mjs"],{stdio:"inherit"});
const {WEAPONS,NAMES}=await import("../temp/tests/battle/SurvivalConfig.mjs");
const {SurvivalWorld}=await import("../temp/tests/battle/SurvivalWorld.mjs");
const {BattlePainter}=await import("../temp/tests/presentation/BattlePainter.mjs");
const {Graphics}=await import("../temp/tests/node_modules/cc/index.mjs");
fs.mkdirSync(out,{recursive:true});const report=[];
for(const skill of WEAPONS) {
  const w=new SurvivalWorld(31,"ranger",1);w.enemies=[];w.player={x:0,y:0};w.viewport={x:16,y:7.5};
  for(const s of WEAPONS)w.skills[s]=s===skill?1:0;
  for(let i=0;i<9;i++) {
    const angle=i*Math.PI*2/9;
    const e=w.addEnemy("minion",Math.cos(angle)*(3.2+i*.15),Math.sin(angle)*(3.2+i*.15));
    Object.assign(e,{state:"seek",hp:1e5,maxHp:1e5});
  }
  const g=new Graphics(),painter=new BattlePainter(g);painter.reset();
  const frames=[];let events=[],maxVertices=0;
  for(let step=0;step<420;step++) {
    w.time+=1/60;
    for(const e of w.enemies) {
      if(e.freezeUntil>w.time)continue;
      const d=Math.hypot(e.x,e.y),speed=(e.slowUntil>w.time?1-e.slow:1)*.65;
      if(d>.9) {e.x-=e.x/d*speed/60;e.y-=e.y/d*speed/60;}
    }
    w.armory.step(1/60);events.push(...w.drain());
    if(step%6!==0)continue;
    painter.draw(w,.1,events,false);events=[];maxVertices=Math.max(maxVertices,g.vertexCount);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="844" height="390"><rect width="844" height="390" fill="#263c35"/><g transform="translate(422 230) scale(${390/720} ${-390/720})">${g.toSVG()}</g><text x="16" y="26" fill="#e1dcc4" font-size="16">${skill} | level 1 | ${w.time.toFixed(1)}s | runtime armory, scripted targets | offline, no HUD</text></svg>`;
    frames.push(await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer());
    if([2,8,16,35,60].includes(frames.length-1))await sharp(Buffer.from(svg)).png().toFile(`${out}/${skill}-${frames.length-1}.png`);
  }
  await sharp(Buffer.concat(frames),{raw:{width:844,height:390*frames.length,channels:4,pageHeight:390}}).gif({loop:0,delay:100,colours:128,dither:0}).toFile(`${out}/${skill}.gif`);
  report.push({skill,frames:frames.length,maxVertices,damage:w.damage[skill]||0});
  console.log(JSON.stringify(report.at(-1)));
}
fs.writeFileSync(`${out}/report.json`,JSON.stringify({scope:"Level-one unmodified runtime Armory, scripted approaching high-HP minions respecting freeze/slow. Offline painter 10fps, not full level, HUD, browser footage or phone performance.",records:report,violations:report.filter(r=>r.maxVertices>45000)},null,2));
fs.writeFileSync(`${out}/index.html`,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>十武器重做预览</title><style>body{max-width:900px;margin:24px auto;padding:0 16px;background:#182923;color:#e6dfc8;font:16px/1.7 system-ui}select{padding:8px;font:inherit}img{width:100%;border:1px solid #617b6b;margin-top:16px}small{color:#b0bfb2}</style><h1>十武器基础动作</h1><p>一级、无改造，真实武器逻辑；高生命目标按脚本靠近，并响应冻结与减速。每段7秒。不含HUD与完整关卡AI，不代表真机表现。</p><select id="weapon">${WEAPONS.map(s=>`<option value="${s}">${NAMES[s]}</option>`).join("")}</select><img id="clip" alt="武器离线动态预览"><p id="stats"></p><small>飞刀默认绕身；骨矛蓄力直贯；幽灵离队两爪回收；寒霜结霜爆冰。返回游戏：<a href="/">Web试玩</a></small><script>const records=${JSON.stringify(report)};const select=document.getElementById('weapon');function update(){const r=records.find(r=>r.skill===select.value);document.getElementById('clip').src=r.skill+'.gif';document.getElementById('stats').textContent='绘制采样 '+r.frames+'帧 · 近似顶点峰值 '+r.maxVertices;}select.onchange=update;update();</script></html>`);
