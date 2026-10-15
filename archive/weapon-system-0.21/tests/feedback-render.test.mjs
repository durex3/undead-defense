import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { SurvivalWorld } from '../temp/tests/battle/SurvivalWorld.mjs';
import * as config from '../temp/tests/battle/SurvivalConfig.mjs';
import * as maps from '../temp/tests/battle/FrontierMaps.mjs';
import * as frontier from '../temp/tests/battle/FrontierSystem.mjs';
import * as forms from '../temp/tests/battle/WeaponForms.mjs';
function load(path,deps){const exports={};const src=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(src,{exports,require:key=>deps[key],Math});return exports;}
class Color{constructor(){this.a=255;}fromHEX(hex){this.hex=hex;return this;}}
const expansion=load('assets/scripts/presentation/ExpansionPainter.ts',{cc:{Color},'../battle/WeaponForms':forms,'../battle/SurvivalConfig':config});
const superPainter=load('assets/scripts/presentation/SuperWeaponPainter.ts',{cc:{Color}});
const frontierPainter=load('assets/scripts/presentation/FrontierPainter.ts',{cc:{Color},'../battle/FrontierMaps':maps});
const {BattlePainter}=load('assets/scripts/presentation/BattlePainter.ts',{cc:{Color},'../battle/FrontierMaps':maps,'../battle/FrontierSystem':frontier,'./FrontierPainter':frontierPainter,'../battle/WeaponForms':forms,'../battle/SurvivalConfig':config,'../battle/BossSystem':{bossExposed:()=>false},'./ExpansionPainter':expansion,'./SuperWeaponPainter':superPainter});
function recording(){const calls=[];const g=new Proxy({},{get:(o,k)=>o[k]??((...args)=>calls.push([k,...args])),set:(o,k,v)=>(calls.push(['style',k,v]),o[k]=v,true)});return {g,calls};}
const signature=calls=>JSON.stringify(calls.filter(c=>c[0]!=='style'));

test('frontier maps and enemy silhouettes differ across all three stages and use finite geometry',()=>{
  const mapsSeen=new Set(),enemiesSeen=new Set();
  for(const stage of [11,12,13]){
    const r=recording();frontierPainter.drawFrontierMap(r.g,stage);mapsSeen.add(signature(r.calls));
    assert(r.calls.every(c=>c.every(v=>typeof v!=='number'||Number.isFinite(v))));
    const e=recording();frontierPainter.drawFrontierEnemy(e.g,{kind:'boss',x:0,y:0},stage);enemiesSeen.add(signature(e.calls));
  }
  assert.equal(mapsSeen.size,3);assert.equal(enemiesSeen.size,3);
});

test('frontier telegraphs retain capped endpoints, independent clocks and visible sequence marks',()=>{
  for(const kind of ['frontierLane','frontierImpact']){
    const h={kind,x:0,y:0,endX:4,endY:2,width:.5,radius:1.35,created:0,due:1.6,sequence:1};
    const first=recording(),second=recording(),late=recording();
    frontierPainter.drawFrontierHazard(first.g,h,.8);
    frontierPainter.drawFrontierHazard(second.g,{...h,due:2.5,sequence:2},.8);
    frontierPainter.drawFrontierHazard(late.g,h,1.7);
    assert.notEqual(signature(first.calls),signature(second.calls));assert.notEqual(signature(first.calls),signature(late.calls));
    for(const r of [first,second,late])assert(r.calls.every(c=>c.every(v=>typeof v!=='number'||Number.isFinite(v))));
  }
});

test('each combination has distinct finite drawing geometry beyond its color',()=>{
  const signatures=new Set();
  for(const type of ['comboFire','comboIce','comboPurify']) {
    const w=new SurvivalWorld(),r=recording(),p=new BattlePainter(r.g);
    p.draw(w,.1,[{type,x:1,y:1,radius:2,skill:'blade'}]);signatures.add(signature(r.calls));
    assert(r.calls.every(c=>c.every(v=>typeof v!=='number'||Number.isFinite(v))));
  }
  assert.equal(signatures.size,3);
});

test('fire branch projectiles, ground effects and impact geometries differ',()=>{
  const signatures=new Set();
  for(const form of ['meteor','inferno']) {
    const w=new SurvivalWorld(),r=recording(),p=new BattlePainter(r.g);w.skills.fire=10;w.evolutions.fire=form;
    w.shots=[{skill:'fire',form,x:0,y:0,vx:8,vy:4,age:.2}];w.zones=[{form,x:3,y:0,radius:2,until:5,next:1,damage:1}];
    p.draw(w,.1,[{type:'fireImpact',form,x:0,y:0,radius:2,skill:'fire'}]);signatures.add(signature(r.calls));
  }
  assert.equal(signatures.size,2);
});

test('tide and stationary spring have different silhouettes at the same radius',()=>{
  const signatures=new Set();
  for(const follow of [false,true]) {
    const w=new SurvivalWorld(),r=recording();w.skills.water=10;w.evolutions.water=follow?'tide':'spring';
    w.expansion.field('water',w.player,3,5,0);w.expansion.fields[0].follow=follow;
    expansion.drawExpansion(r.g,w);signatures.add(signature(r.calls));
  }
  assert.equal(signatures.size,2);
});

test('crowd feedback is bounded before drawing and never evicts the final evolution burst',()=>{
  const w=new SurvivalWorld(),r=recording(),p=new BattlePainter(r.g);
  const hits=Array.from({length:500},(_,id)=>({type:'hit',id,x:0,y:0,skill:'blade'}));
  const combos=Array.from({length:100},()=>({type:'comboIce',x:0,y:0,skill:'ice'}));
  p.draw(w,1/60,[{type:'evolve',final:true,x:0,y:0,skill:'fire'},...hits,...combos]);
  assert(p.particles.length<=180);assert.equal(p.particles.filter(p=>p.e.final).length,1);assert.equal(p.particles.filter(p=>p.e.type==='comboIce').length,1);
  assert(r.calls.length<12000);w.pause('menu',true);p.draw(w,1.2,[]);
  assert(!p.particles.some(p=>p.e.final));assert(p.particles.some(p=>p.e.type==='hit'));
  p.reset();assert.equal(p.particles.length,0);
});

test('enemy telegraphs remain the last layer above player feedback',()=>{
  const w=new SurvivalWorld(),r=recording(),p=new BattlePainter(r.g);
  w.hazards=[{kind:'circle',x:0,y:0,radius:2,width:0,angle:0,created:0,due:2,until:3,fired:false}];
  p.draw(w,.1,[{type:'evolve',final:true,x:0,y:0,skill:'fire'}]);
  const lastStroke=r.calls.filter(c=>c[0]==='style'&&c[1]==='strokeColor').at(-1)[2];
  assert.equal(lastStroke.hex,'#ff7694');
});

test('ghost and scythe final branches have distinct finite projectile geometry',()=>{
 for(const [skill,branches]of [['ghost',['legion','hunters']],['scythe',['reaper','cross']]]){
  const signatures=new Set();
  for(const form of branches){
   const w=new SurvivalWorld(),r=recording(),p=new BattlePainter(r.g);w.skills[skill]=10;w.evolutions[skill]=form;
   w.shots=[{skill,form,x:0,y:0,vx:8,vy:4,age:.2}];p.draw(w,.1,[]);
   signatures.add(signature(r.calls));assert(r.calls.every(c=>c.every(v=>typeof v!=='number'||Number.isFinite(v))));
  }
  assert.equal(signatures.size,2);
 }
});

test('the three new recipe effects have different finite geometries and bounded feedback',()=>{
 const signatures=new Set();
 for(const [type,skill]of [['comboBone','bone'],['comboJudgment','chain'],['comboSoul','totem']]){
  const w=new SurvivalWorld(),r=recording(),p=new BattlePainter(r.g);
  p.draw(w,.1,Array.from({length:100},()=>({type,x:1,y:1,radius:2,skill})));
  signatures.add(signature(r.calls));assert.equal(p.particles.length,1);
  assert(r.calls.every(c=>c.every(v=>typeof v!=='number'||Number.isFinite(v))));
 }
 assert.equal(signatures.size,3);
});

test('ghost, scythe and collapse synergies have distinct bounded geometry',()=>{
 const signatures=new Set();
 for(const [type,skill]of [['comboGhost','ghost'],['comboReap','scythe'],['comboCollapse','meteor']]){
  const w=new SurvivalWorld(),r=recording(),p=new BattlePainter(r.g);
  p.draw(w,.1,Array.from({length:100},()=>({type,x:1,y:1,radius:2,skill})));
  signatures.add(signature(r.calls));assert.equal(p.particles.length,1);
  assert(r.calls.every(c=>c.every(v=>typeof v!=='number'||Number.isFinite(v))));
 }
 assert.equal(signatures.size,3);
});

test('all nine superweapon cues have distinct geometry, and the seven new impacts animate within bounded lifetime',()=>{
 const signatures=new Set();
 const types=['comboFire','comboIce','comboReap','comboCollapse','comboBone','comboJudgment','comboSoul','comboPurify','comboGhost'];
 for(const type of types){
  const w=new SurvivalWorld(),r=recording(),p=new BattlePainter(r.g);
  p.draw(w,.05,[{type,x:2,y:3,radius:1.5,skill:'blade',endX:0,endY:0}]);
  signatures.add(signature(r.calls));assert(p.particles[0].max<=.85);
  const initial=signature(r.calls);r.calls.length=0;p.draw(w,.2,[]);assert.notEqual(signature(r.calls),initial);
  assert(r.calls.every(c=>c.every(v=>typeof v!=='number'||Number.isFinite(v))));
  p.draw(w,1,[]);assert.equal(p.particles.length,0);
 }
 assert.equal(signatures.size,9);
});
test('spatial cue gate shows three different impacts instead of suppressing a whole screen of the same superweapon',()=>{
 const w=new SurvivalWorld(),r=recording(),p=new BattlePainter(r.g);
 const events=Array.from({length:100},(_,i)=>({type:'comboBone',x:i*3,y:0,radius:2,skill:'bone'}));
 p.draw(w,.01,events);assert.equal(p.particles.length,3);assert.equal(p.cueUntil.size,3);
 p.draw(w,.01,events.slice(0,3));assert.equal(p.particles.length,3);
 p.draw(w,.11,events.slice(0,3));assert.equal(p.particles.length,6);
 p.draw(w,1,[]);assert.equal(p.cueUntil.size,0);assert.equal(p.particles.length,0);
});
test('new area effects use the exact damage center and do not draw fragments beyond the damage radius',()=>{
 for(const type of ['comboFire','comboReap','comboCollapse','comboBone']){
  const r=recording(),x=144,y=-96,radius=96;
  assert(superPainter.drawSuperWeaponEffect(r.g,{type,x:3,y:-2,radius:2},.25));
  for(const call of r.calls){
   if(['moveTo','lineTo'].includes(call[0]))assert(Math.hypot(call[1]-x,call[2]-y)<=radius+.001,`${type}/${call}`);
   if(call[0]==='circle'){assert.equal(call[1],x);assert.equal(call[2],y);assert(call[3]<=radius);}
  }
 }
});
test('dedicated effect drawing is presentation only and pause freezes impact phases',()=>{
 const w=new SurvivalWorld(),r=recording(),p=new BattlePainter(r.g),state=JSON.stringify({hp:w.hp,damage:w.damage,time:w.time,enemies:w.enemies});
 p.draw(w,.01,[{type:'comboJudgment',x:0,y:0,radius:.8,skill:'chain'}]);
 const life=p.particles[0].life;w.pause('menu',true);p.draw(w,.5,[]);assert.equal(p.particles[0].life,life);
 assert.equal(JSON.stringify({hp:w.hp,damage:w.damage,time:w.time,enemies:w.enemies}),state);
 p.reset();assert.equal(p.particles.length,0);assert.equal(p.cueUntil.size,0);
});
test('seven simultaneous superweapons stay within the reserved particle and geometry budget',()=>{
 const w=new SurvivalWorld(),r=recording(),p=new BattlePainter(r.g);
 const types=Object.keys(superPainter.SUPER_EFFECT_LIFETIMES);
 const events=types.flatMap(type=>Array.from({length:100},(_,i)=>({type,x:i*3,y:1,radius:2,skill:'blade',endX:0,endY:0})));
 p.draw(w,1/60,events);
 assert.equal(p.particles.length,21);assert(p.particles.length<=30);assert.equal(p.cueUntil.size,21);
 assert(r.calls.length<6000,`drawing calls ${r.calls.length}`);
});
test('power-saving mode retains all seven effect identities with a lower simultaneous drawing cost',()=>{
 const types=Object.keys(superPainter.SUPER_EFFECT_LIFETIMES);
 const events=types.flatMap(type=>Array.from({length:3},(_,i)=>({type,x:i*3,y:1,radius:2,skill:'blade'})));
 const full=recording(),small=recording(),w=new SurvivalWorld(),a=new BattlePainter(full.g),b=new BattlePainter(small.g);
 a.draw(w,.01,events);b.draw(w,.01,events,true);
 assert.equal(a.particles.length,21);assert.equal(b.particles.length,14);
 assert.equal(new Set(b.particles.map(p=>p.e.type)).size,7);assert(small.calls.length<full.calls.length);
});
