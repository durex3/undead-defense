/** Full world-step simulation + runtime painter replay. Not browser footage. */
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import sharp from "sharp";
if(process.argv.includes("--copy-local")) {
  const out="artifacts/art-combat",target="build/web-mobile/qa-combat";
  if(!fs.existsSync("build/web-mobile/index.html"))throw Error("Build Web before staging the local review page");
  const result=JSON.parse(fs.readFileSync(`${out}/report.json`,"utf8"));
  if(fs.existsSync(`${out}/before-report.json`)) {
    const baseline=JSON.parse(fs.readFileSync(`${out}/before-report.json`,"utf8"));
    const windows=clips=>clips.map(r=>({stage:r.stage,kind:r.kind,start:r.start,end:r.end,maxHazards:r.maxHazards,maxEnemies:r.maxEnemies,playerHits:r.playerHits}));
    result.diagnosticWindowsMatchBaseline=JSON.stringify(windows(result.clips))===JSON.stringify(windows(baseline.clips));
    if(!result.diagnosticWindowsMatchBaseline)throw Error("Diagnostic simulation windows changed; inspect before staging");
    fs.writeFileSync(`${out}/report.json`,JSON.stringify(result,null,2));
  }
  fs.mkdirSync(target,{recursive:true});
  for(const name of fs.readdirSync(out))if(/\.(html|gif|png|json)$/.test(name))fs.copyFileSync(`${out}/${name}`,`${target}/${name}`);
  for(const name of ["feedback.gif","frame-2.png"]) {
    const source=`artifacts/art-feedback/${name}`;
    if(fs.existsSync(source))fs.copyFileSync(source,`${target}/${name}`);
  }
  console.log("Local review staged at http://127.0.0.1:8128/qa-combat/");process.exit(0);
}
execFileSync(process.execPath,["tools/test-build.mjs"],{stdio:"inherit"});
const {SurvivalWorld}=await import("../temp/tests/battle/SurvivalWorld.mjs");
const {WEAPONS,isElite}=await import("../temp/tests/battle/SurvivalConfig.mjs");
const {thunderMap}=await import("../temp/tests/battle/ThunderMap.mjs");
const {moonMap}=await import("../temp/tests/battle/MoonMap.mjs");
const {Graphics}=await import("../temp/tests/node_modules/cc/index.mjs");
const {BattlePainter}=await import("../temp/tests/presentation/BattlePainter.mjs");
const {drawStageMap}=await import("../temp/tests/presentation/StageMapPainter.mjs");
const out="artifacts/art-combat";fs.mkdirSync(out,{recursive:true});
// Preserve the first full-simulation run as evidence for this polish pass.
for(const stage of [3,4])for(const kind of ["encounter","boss"])
  for(const suffix of [".gif","-0.png","-20.png","-40.png","-59.png"]){
    const name=`stage-${stage}-${kind}${suffix}`;
    if(fs.existsSync(`${out}/${name}`)&&!fs.existsSync(`${out}/before-${name}`))fs.copyFileSync(`${out}/${name}`,`${out}/before-${name}`);
  }
if(fs.existsSync(`${out}/report.json`)&&!fs.existsSync(`${out}/before-report.json`))fs.copyFileSync(`${out}/report.json`,`${out}/before-report.json`);
const builds={3:{blade:["hunt"],fire:["heavy"],water:["wave"],lightning:["storm"]},
  4:{blade:["orbit"],ghost:["haunt"],frost:["aftershock"],lightning:["storm"]}};
const report=[];
for(const stage of [3,4]) {
  const w=new SurvivalWorld(73,"ranger",stage),map=stage===3?thunderMap:moonMap;
  w.level=64;w.hp=w.maxHp=100000;w.viewport={x:7.5*844/390,y:7.5};
  for(const skill of WEAPONS) {w.skills[skill]=builds[stage][skill]?4:0;w.mods[skill]=builds[stage][skill]||[];}
  const ground=new Graphics();drawStageMap(ground,stage);const mapSvg=ground.toSVG();
  const actors=new Graphics(),painter=new BattlePainter(actors);painter.reset();
  const completed=new Set();let clip=null,events=[];
  const finish=async()=>{
    if(!clip)return;
    const name=`stage-${stage}-${clip.kind}`;
    await sharp(Buffer.concat(clip.raw),{raw:{width:844,height:390*clip.raw.length,channels:4,pageHeight:390}})
      .gif({loop:0,delay:100,colours:128,dither:0}).toFile(`${out}/${name}.gif`);
    const {raw,...metadata}=clip;
    report.push({...metadata,stage,frames:raw.length,file:`${name}.gif`,build:builds[stage],verticesLimit:45000});
    console.log(JSON.stringify({stage,clip:clip.kind,frames:raw.length,maxHazards:clip.maxHazards,maxVertices:clip.maxVertices}));
    completed.add(clip.kind);clip=null;events=[];painter.reset();
  };
  for(let step=0;step<430*60 && w.state!=="won";step++) {
    if(w.state==="tactical")w.chooseTacticalBlessing(w.tacticalChoices[0].id);
    if(!w.active)throw Error(`Unexpected pause ${w.state}`);
    const enemy=w.enemies.find(e=>e.hp>0&&isElite(e.kind));
    const angle=w.time*.31,target=enemy?{x:enemy.x+Math.cos(angle)*3.8,y:enemy.y+Math.sin(angle)*3.8}:
      {x:Math.cos(w.time*.12)*6,y:Math.sin(w.time*.12)*6};map.resolve(target,.35);
    const heading=map.heading(w.player,target);w.setMove(Math.cos(heading),Math.sin(heading));
    w.step(1/60);const emitted=w.drain();if(clip)events.push(...emitted);
    const f=1-Math.exp(-11/60);
    w.camera.x+=(Math.max(-512/48,Math.min(512/48,w.player.x))-w.camera.x)*f;
    w.camera.y+=(Math.max(-984/48,Math.min(984/48,w.player.y))-w.camera.y)*f;
    const visibleHazards=w.hazards.filter(h=>h.until>w.time&&w.visible(h,-1));
    const boss=w.enemies.some(e=>e.kind==="boss"&&e.hp>0);
    if(!clip) {
      const kind=!completed.has("encounter")&&w.time>130&&w.time<350&&
        (visibleHazards.length>=2||w.time>175)?"encounter":
        !completed.has("boss")&&boss&&(visibleHazards.length>0||w.time>380)?"boss":null;
      if(kind) {clip={kind,start:w.time,end:w.time,maxHazards:0,maxEnemies:0,maxVertices:0,playerHits:0,raw:[]};painter.reset();}
    }
    if(!clip)continue;
    clip.maxHazards=Math.max(clip.maxHazards,visibleHazards.length);
    clip.maxEnemies=Math.max(clip.maxEnemies,w.enemies.filter(e=>w.visible(e,0)).length);
    clip.playerHits+=emitted.filter(e=>e.type==="playerHit").length;
    if(step%6!==0)continue;
    painter.draw(w,.1,events,false);events=[];
    const vertices=ground.vertexCount+actors.vertexCount;clip.maxVertices=Math.max(clip.maxVertices,vertices);clip.end=w.time;
    const scale=390/720;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="844" height="390"><g transform="translate(${422-w.camera.x*48*scale} ${195+w.camera.y*48*scale}) scale(${scale} ${-scale})">${mapSvg}${actors.toSVG()}</g>
      <rect width="844" height="23" fill="#111b20"/><text x="8" y="16" fill="#e0d8bf" font-family="sans-serif" font-size="11">Stage ${stage} | ${w.time.toFixed(1)}s | full simulation | fixed four weapons + high HP | offline, no HUD | hazards ${visibleHazards.length}</text></svg>`;
    clip.raw.push(await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer());
    if([0,20,40,59].includes(clip.raw.length-1)) {
      const path=`${out}/stage-${stage}-${clip.kind}-${clip.raw.length-1}`;
      fs.writeFileSync(`${path}.svg`,svg);await sharp(Buffer.from(svg)).png().toFile(`${path}.png`);
    }
    if(clip.raw.length===60)await finish();
    if(completed.size===2)break;
  }
  if(clip)await finish();
  if(completed.size<2)throw Error(`Missing replay window in stage ${stage}`);
}
const result={scope:"Full SurvivalWorld.step at 60Hz; fixed level-four weapons, level64 to suppress upgrade menus, high HP, scripted navigation. Offline 844x390 painter at 10fps, no HUD/browser/phone evidence.",clips:report,
  violations:report.filter(r=>r.maxVertices>45000)};
fs.writeFileSync(`${out}/report.json`,JSON.stringify(result,null,2));
fs.writeFileSync(`${out}/index.html`,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>三四关战斗层回放</title><style>body{background:#172127;color:#e3dfcd;font:16px/1.7 system-ui;margin:24px auto;padding:0 16px;max-width:960px}h1{font-size:24px}p{color:#afbbb6}button,select{background:#303f44;color:#f0ddad;border:1px solid #667970;border-radius:5px;padding:8px 12px;margin:4px;font:inherit}img{display:block;width:100%;max-width:844px;aspect-ratio:844/390;border:1px solid #667970;margin-top:16px}small{color:#a6b5b1}#stats{margin:12px 0}</style>
<h1>三、四关战斗层回放</h1><p>完整关卡逻辑驱动的离线矢量渲染，非浏览器录屏。固定四把四级武器、脚本走位、高血量；不含HUD，不用于判断真人胜率或手机帧率。</p>
<select id="stage"><option value="3">第三关 · 雷铸机庭</option><option value="4">第四关 · 苍棘猎原</option></select>
<select id="kind"><option value="encounter">遭遇片段</option><option value="boss">首领片段</option></select>
<select id="version"><option value="">当前版本</option><option value="before-">早期基线（第四轮前）</option></select>
<button id="play">播放循环</button><span>查看关键帧：</span><button data-frame="0">起始</button><button data-frame="20">2秒</button><button data-frame="40">4秒</button><button data-frame="59">末帧</button>
<div id="stats"></div><img id="screen" alt="战斗层离线回放"><small>每段6秒，渲染采样10帧/秒；模拟以60步/秒运行。预警数量按视野内起点计数。第三关样本未覆盖双危险；第四关已覆盖。完整HUD、触控与真机性能仍需试玩。</small>
<script>const clips=${JSON.stringify(report.map(({raw,...r})=>r))};let frame=null;
const ids=['stage','kind','version'],el=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
function update(){const prefix=el.version.value+'stage-'+el.stage.value+'-'+el.kind.value;
document.getElementById('screen').src=prefix+(frame===null?'.gif':'-'+frame+'.png');
const r=clips.find(c=>c.stage===Number(el.stage.value)&&c.kind===el.kind.value);
document.getElementById('stats').textContent=r?r.start.toFixed(1)+'–'+r.end.toFixed(1)+'秒 · '+r.maxEnemies+'个可见敌人峰值 · '+r.maxHazards+'个视野内危险起点峰值 · '+Object.keys(r.build).join(' / '):'';}
ids.forEach(id=>el[id].onchange=update);document.getElementById('play').onclick=()=>{frame=null;update()};
document.querySelectorAll('[data-frame]').forEach(b=>b.onclick=()=>{frame=Number(b.dataset.frame);update()});update();</script></html>`);
console.log(JSON.stringify({clips:report.length,violations:result.violations.length,out}));
if(result.violations.length)process.exitCode=1;
