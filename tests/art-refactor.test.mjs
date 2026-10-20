import test from "node:test";
import assert from "node:assert/strict";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
import { exposedEdges } from "../temp/tests/presentation/art/Contour.mjs";
import { drawActorLayer } from "../temp/tests/presentation/art/EnemyPainter.mjs";
import { drawHeroBody, drawHeroShadow } from "../temp/tests/presentation/art/HeroPainter.mjs";
import { drawHazards } from "../temp/tests/presentation/art/HazardPainter.mjs";
import { drawPickups } from "../temp/tests/presentation/art/PickupPainter.mjs";
import { makeWorld, addEnemy, makeMoonHazard, makeThunderHazard } from "../tools/art-fixtures.mjs";

test("overlapping silhouette parts remove the hidden seam, preserving the exposed edge", () => {
  const edges=exposedEdges([[[0,0],[2,0],[2,2],[0,2]],[[1,1],[3,1],[3,3],[1,3]]]);
  const segments=edges.flatMap(p=>p.slice(1).map((b,i)=>[p[i],b]));
  assert.ok(segments.some(([a,b])=>a[0]===2&&b[0]===2&&a[1]===0&&b[1]===1));
  assert.ok(!segments.some(([a,b])=>a[0]===2&&b[0]===2&&Math.min(a[1],b[1])>=1));
  const length=segments.reduce((sum,[a,b])=>sum+Math.hypot(a[0]-b[0],a[1]-b[1]),0);
  assert.equal(length,12);
});

test("a fully enclosed part contributes no internal outline", () => {
  const edges=exposedEdges([[[0,0],[4,0],[4,4],[0,4]],[[1,1],[2,1],[2,2],[1,2]]]);
  assert.equal(edges.length,1);
  assert.equal(edges[0].length,5);
});

test("overlapping enemy bodies draw from upper feet to lower feet regardless of insertion order", () => {
  const w=makeWorld(1);addEnemy(w,"thornshield",{y:-.2});addEnemy(w,"siegebone",{y:.2});
  const actual=new Graphics();drawActorLayer(actual,w,false,false);
  const upper=makeWorld(1);addEnemy(upper,"siegebone",{y:.2,fields:{id:2}});
  const lower=makeWorld(1);addEnemy(lower,"thornshield",{y:-.2,fields:{id:1}});
  const a=new Graphics(),b=new Graphics();drawActorLayer(a,upper,false,false);drawActorLayer(b,lower,false,false);
  assert.deepEqual(actual.commands,[a.commands[0],b.commands[0],...a.commands.slice(1),...b.commands.slice(1)]);
});

for(const enemyY of [-.2,.2]) test(`hero depth is correct with enemy feet at ${enemyY}`,()=>{
  const w=makeWorld(1);addEnemy(w,"siegebone",{y:enemyY});
  const actual=new Graphics();drawActorLayer(actual,w,false,true);
  const foe=new Graphics();drawActorLayer(foe,w,false,false);
  const shadow=new Graphics(),hero=new Graphics();drawHeroShadow(shadow,w);drawHeroBody(hero,w);
  const ordered=enemyY>0?[...foe.commands.slice(1),...hero.commands]:[...hero.commands,...foe.commands.slice(1)];
  assert.deepEqual(actual.commands,[foe.commands[0],...shadow.commands,...ordered]);
});

test("claw and sweep have distinct preview geometry even without colour",()=>{
  const paths=[];
  for(const shape of ["claw","sweep"]) {
    const w=makeWorld(4,{time:.5});w.hazards=[makeMoonHazard({shape,start:{x:0,y:0},end:{x:0,y:0}})];
    const g=new Graphics();drawHazards(g,w,true);paths.push(g.commands.map(c=>c.d).join(""));
  }
  assert.notEqual(paths[0],paths[1]);
});

test("reduced mode retains the complete thunder wall warning and safe gap",()=>{
  const w=makeWorld(3,{time:.5});w.hazards=[makeThunderHazard("wall",{radius:8,gap:.6})];
  const normal=new Graphics(),reduced=new Graphics();drawHazards(normal,w,false);drawHazards(reduced,w,true);
  assert.deepEqual(normal.commands,reduced.commands);
});

test("pickup emphasis follows player distance without changing experience or potion cues",()=>{
  const w=makeWorld(4);w.gems=[{id:1,x:5,y:0,value:8}];
  w.potions=[{id:2,x:4,y:0}];
  const snapshot=JSON.stringify([w.gems,w.potions]);
  const far=new Graphics();drawPickups(far,w);
  w.player.x=5;const near=new Graphics();drawPickups(near,w);
  assert.ok(near.commands.length>far.commands.length);
  assert.deepEqual(near.commands.slice(-7),far.commands.slice(-7),"potion remains equally visible");
  assert.equal(JSON.stringify([w.gems,w.potions]),snapshot);
});

test("landing chips occur only after impact and expire before the hazard ends",()=>{
  const w=makeWorld(4);w.hazards=[makeMoonHazard({shape:"landing"})];
  const snapshot=JSON.stringify(w.hazards);
  // Count the six angular chips, independently of the new filled warning disc.
  const sample=time=>{w.time=time;const g=new Graphics();drawHazards(g,w,true);return g.commands.filter(c=>c.op==="fill"&&(c.d.match(/Z/gi)||[]).length>=6).length;};
  const waiting=sample(.99),impact=sample(1.01),settled=sample(1.3);
  assert.ok(impact>waiting);assert.ok(impact>settled);
  assert.equal(JSON.stringify(w.hazards),snapshot);
});
