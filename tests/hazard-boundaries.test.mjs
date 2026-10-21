import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { SurvivalWorld } from '../temp/tests/battle/SurvivalWorld.mjs';
import { stepHazards } from '../temp/tests/battle/EnemySystem.mjs';
import { hazardLaneContains } from '../temp/tests/battle/HazardLane.mjs';
import { hazardContains } from '../temp/tests/battle/Escape.mjs';
import { Graphics } from '../temp/tests/node_modules/cc/index.mjs';
import { drawHazards } from '../temp/tests/presentation/art/HazardPainter.mjs';
import { makeWorld, makeHazard, makeThunderHazard } from '../tools/art-fixtures.mjs';

const lane = (angle=0, extra={}) => ({id:123,kind:'frontierLane',source:0,x:0,y:0,angle,radius:6,width:.55,created:0,due:1,until:3,next:1.6,damage:20,fired:false,fixedDamage:true,...extra});
const point = (angle,u,v) => ({x:Math.cos(angle)*u-Math.sin(angle)*v,y:Math.sin(angle)*u+Math.cos(angle)*v});
for (const angle of [0,Math.PI/4,Math.PI/2,-2.1]) test(`sand lane capsule boundary at ${angle}: damage and escape agree`,()=>{
  for (const [u,v,hit] of [[3,.54,true],[3,.56,false],[3,3,false],[-.54,0,true],[-.56,0,false],[6.54,0,true],[6.56,0,false],[6.4,.4,false]]) {
    const h=lane(angle),p=point(angle,u,v),w=new SurvivalWorld(19,'ranger',2);
    assert.equal(hazardLaneContains(h,p),hit,`${u},${v}`);
    assert.equal(hazardContains(h,p),hit);
    w.player=p;w.hazards=[h];w.time=1;stepHazards(w);
    assert.equal(w.hp<100,hit,`actual first hit ${u},${v}`);
  }
});
test('sand rift ticks use the same narrow lane and respect warning/expiry',()=>{
  const w=new SurvivalWorld(19,'ranger',2),h=lane(0,{sandRift:true});
  w.hazards=[h];w.player={x:3,y:0};w.time=.99;stepHazards(w);assert.equal(w.hp,100);assert(!h.fired);
  w.time=1;stepHazards(w);assert.equal(w.hp,80);
  w.invulnerable=0;w.player={x:3,y:.56};w.time=1.61;stepHazards(w);assert.equal(w.hp,80,'old circle would hit this safe point');
  w.player={x:3,y:.54};w.time=2.22;stepHazards(w);assert.equal(w.hp,74);
  w.invulnerable=0;w.time=3;stepHazards(w);assert.equal(w.hp,74);assert.equal(w.hazards.length,0);
});
test('grouped sand lanes deal only one initial hit at the intersection',()=>{
  const w=new SurvivalWorld(19,'ranger',2);w.player={x:0,y:0};w.time=1;
  w.hazards=[lane(0,{group:5}),lane(Math.PI/2,{id:124,group:5})];stepHazards(w);
  assert.equal(w.hp,80);assert(w.hazards.every(h=>h.groupHit));
});
for(const thunder of [false,true])test(`${thunder?'thunder':'sand'} sector fill covers inner fan and excludes opposite side`,async()=>{
  const w=makeWorld(thunder?3:2,{time:.5});
  const h=thunder?makeThunderHazard('sector',{radius:3,width:Math.PI/2,angle:.4,due:1}):makeHazard('sector',{radius:3,width:Math.PI/2,angle:.4,due:1});
  w.hazards=[h];const g=new Graphics();drawHazards(g,w,false);
  // Rasterize only the danger fill, avoiding decorative glyphs and edge strokes.
  const fill=g.commands.find(c=>c.op==='fill');assert(fill);
  assert.equal((fill.d.match(/M/g)||[]).length,1,'centre and arc must form one subpath');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="-200 -200 400 400"><path d="${fill.d}" fill="white"/></svg>`;
  const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=(a,r)=>{const x=Math.round(200+Math.cos(a)*r),y=Math.round(200+Math.sin(a)*r);return data[(y*info.width+x)*4+3];};
  assert(alpha(.4,48)>240,'inner fan must visibly warn');
  assert.equal(alpha(.4+Math.PI,48),0,'complementary arc must stay safe');
  assert.equal(alpha(.4+Math.PI/4+.1,100),0,'outside angular boundary stays blank');
});
