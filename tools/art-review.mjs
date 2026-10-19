/** Reproducible 844x390 combat composites using runtime painters, not screenshots. */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
execFileSync(process.execPath, ["tools/test-build.mjs"], { stdio: "inherit" });
const { Graphics } = await import("../temp/tests/node_modules/cc/index.mjs");
const { BattlePainter } = await import("../temp/tests/presentation/BattlePainter.mjs");
const { drawStageMap } = await import("../temp/tests/presentation/StageMapPainter.mjs");
const { makeWorld, addEnemy, makeShot, makeField, makeExtra, makeHazard, makeMoonHazard, makeThunderHazard } = await import("./art-fixtures.mjs");
const groups = {
  1: ["siegebone","thornshield","siegebow","flanker","siegeflag"],
  2: ["sandworker","shellroller","sandspitter","sandstalker","broodelite"],
  3: ["rivetwalker","anchorweaver","arclantern","railsaw","gridwarden"],
  4: ["thornrunner","crescentmantis","vaultlynx","antlerprowler","hornwarden"],
};
const sets = { 1: ["blade","fire","water","lightning"], 2: ["frost","mine","bone","fire"],
  3: ["lightning","void","blade","holy"], 4: ["ghost","frost","holy","water"] };
const out = "artifacts/art-review";
fs.mkdirSync(out, { recursive:true });
// Preserve the original audit illustrations once.
for (let stage=1;stage<=4;stage++) for (const ext of ["png","svg"]) {
  const from = `${out}/stage-${stage}.${ext}`, before = `${out}/before-stage-${stage}.${ext}`;
  if (fs.existsSync(from) && !fs.existsSync(before)) fs.copyFileSync(from,before);
}
const report=[];
for (let stage=1;stage<=4;stage++) for (const reduced of [false,true]) for (let frame=0;frame<3;frame++) {
  const time=200+frame*.35, w=makeWorld(stage,{time,viewport:{x:7.5*844/390,y:7.5}});
  for(let i=0;i<12;i++) addEnemy(w,groups[stage][i%5],{x:-7+(i%4)*4,y:-3+Math.floor(i/4)*2.4,
    windup:i===2 && frame===0,freeze:i===4,fields:{facing:i%2?0:Math.PI}});
  addEnemy(w,"boss",{x:8,y:3.3,fields:{facing:Math.PI}});
  for(const [i,skill] of sets[stage].entries()) {
    const x=-4+i*2.6,y=-1.5+(i%2)*3;
    if(["blade","fire","water"].includes(skill)) {
      w.armory.shots.push(makeShot(skill,{x:x+frame*.6,y,angle:.4+i,age:.15+frame*.12}));
      if(skill!=="blade") w.armory.fields.push(makeField(skill,{x,y:y-1,radius:1.4}));
    } else w.armory.extra.attacks.push(makeExtra(skill,{x,y,age:.12+frame*.2,phase:skill==="holy"&&frame===2?2:0,
      next:.5,index:2,points:[{x,y},{x:x+2,y:y+.8}],start:{x,y},stats:{radius:1.4}}));
  }
  w.hazards = stage===3 ? [makeThunderHazard("line",{x:-4,y:3,angle:-.2,radius:6,width:.3,created:200,due:200.35,until:202}),
    makeThunderHazard("wall",{x:2,y:-3,radius:8,width:.5,created:200,due:200.35,until:202})] :
    stage===4 ? [makeMoonHazard({shape:"claw",start:{x:-5,y:2},end:{x:-5,y:2},radius:2.5,angle:-1,turn:1.5,created:200,due:200.35,out:.8}),
      makeMoonHazard({shape:"sweep",start:{x:3,y:-2},end:{x:4,y:-2},radius:2.6,angle:1,turn:2,created:200,due:200.35,out:.8})] :
    [makeHazard("sector",{x:-3,y:2.5,angle:-1,radius:2.5,width:1.5,created:200,due:200.35,until:202})];
  const floor=new Graphics(),actors=new Graphics(),painter=new BattlePainter(actors);painter.reset();
  drawStageMap(floor,stage);painter.draw(w,1/60,[{type:"hit",skill:sets[stage][0],x:-3,y:1}],reduced);
  const tag=`stage-${stage}${reduced?"-reduced":""}${frame?`-frame-${frame}`:""}`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="844" height="390"><g transform="translate(422 195) scale(${390/720} ${-390/720})">${floor.toSVG()}${actors.toSVG()}</g><rect width="844" height="23" fill="#10191f"/><text x="10" y="16" fill="#d9dbc9" font-family="sans-serif" font-size="12">Stage ${stage} | 844 x 390 | ${sets[stage].join(" + ")} | ${reduced?"reduced":"normal"} | frame ${frame} | Offline composite, no HUD</text></svg>`;
  fs.writeFileSync(`${out}/${tag}.svg`,svg);await sharp(Buffer.from(svg)).png().toFile(`${out}/${tag}.png`);
  report.push({stage,reduced,frame,weapons:sets[stage],submissions:floor.commands.length+actors.commands.length,vertices:floor.vertexCount+actors.vertexCount});
}
const dense=makeWorld(3,{time:200,viewport:{x:7.5*844/390,y:7.5}});
for(let i=0;i<100;i++) addEnemy(dense,i===99?"boss":i===98?"gridwarden":i>=94?(i%2?"thunderanchor":"gridelectrode"):
  i<70?"rivetwalker":groups[3][i%4],{x:(i%10-4.5)*1.15,y:(Math.floor(i/10)-4.5)*1.05,freeze:i%11===0});
dense.armory.shots.push(makeShot("blade",{x:1,y:1}));
for(const [i,skill] of ["lightning","void","holy"].entries()) dense.armory.extra.attacks.push(makeExtra(skill,{x:i*2-2,y:-1,index:3,
  points:[{x:-3,y:1},{x:0,y:2},{x:3,y:1}]}));
dense.hazards=[makeThunderHazard("wall",{x:3,y:0,radius:8,created:199,due:201,until:202}),
  makeThunderHazard("line",{x:0,y:3,radius:8,created:199,due:201,until:202})];
const denseFloor=new Graphics(),denseActors=new Graphics();drawStageMap(denseFloor,3);
const densePainter=new BattlePainter(denseActors);densePainter.reset();densePainter.draw(dense,1/60,[],false);
const stress={enemies:100,weapons:4,hazards:2,vertices:denseFloor.vertexCount+denseActors.vertexCount,
  submissions:denseFloor.commands.length+denseActors.commands.length};
const violations=report.filter(r=>r.vertices>45000);if(stress.vertices>45000) violations.push(stress);
fs.writeFileSync(`${out}/combat-budget.json`,JSON.stringify({scenes:report,stress,violations},null,2));
console.log(JSON.stringify({scenes:report.length,maxSceneVertices:Math.max(...report.map(r=>r.vertices)),stress,violations:violations.length,out}));
if(violations.length) process.exitCode=1;
