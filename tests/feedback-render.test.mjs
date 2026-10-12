import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { SurvivalWorld } from '../temp/tests/battle/SurvivalWorld.mjs';
import * as config from '../temp/tests/battle/SurvivalConfig.mjs';
import * as forms from '../temp/tests/battle/WeaponForms.mjs';
function load(path,deps){const exports={};const src=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(src,{exports,require:key=>deps[key],Math});return exports;}
class Color{constructor(){this.a=255;}fromHEX(hex){this.hex=hex;return this;}}
const expansion=load('assets/scripts/presentation/ExpansionPainter.ts',{cc:{Color},'../battle/WeaponForms':forms,'../battle/SurvivalConfig':config});
const {BattlePainter}=load('assets/scripts/presentation/BattlePainter.ts',{cc:{Color},'../battle/WeaponForms':forms,'../battle/SurvivalConfig':config,'../battle/BossSystem':{bossExposed:()=>false},'./ExpansionPainter':expansion});
function recording(){const calls=[];const g=new Proxy({},{get:(o,k)=>o[k]??((...args)=>calls.push([k,...args])),set:(o,k,v)=>(calls.push(['style',k,v]),o[k]=v,true)});return {g,calls};}
const signature=calls=>JSON.stringify(calls.filter(c=>c[0]!=='style'));

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
