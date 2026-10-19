import test from "node:test";
import assert from "node:assert/strict";
import {Graphics} from "../temp/tests/node_modules/cc/index.mjs";
import {createPose,updatePose} from "../temp/tests/presentation/art/Actor.mjs";
import {enemyArt} from "../temp/tests/presentation/art/EnemyCatalog.mjs";
import {lightningEnvelope} from "../temp/tests/presentation/art/spells/LightningMotion.mjs";
import {drawExtraSpell} from "../temp/tests/presentation/art/spells/ExtraSpellArt.mjs";
import {drawActorLayer} from "../temp/tests/presentation/art/EnemyPainter.mjs";
import {makeWorld,addEnemy,makeHazard,makeExtra} from "../tools/art-fixtures.mjs";

test("lightning contact fades, and only a real echo phase starts a second flash",()=>{
  const attack=makeExtra("lightning",{age:.01});
  const contact=lightningEnvelope(attack,0);assert.ok(contact.contact);
  attack.age=.3;attack.phase=1;
  const trace=lightningEnvelope(attack,0);assert.ok(!trace.contact);assert.ok(trace.opacity<contact.opacity*.12);
  attack.age=.46;attack.next=.63;attack.phase=2;
  assert.ok(!lightningEnvelope(attack,0).contact,"normal expiry must not invent another strike");
  attack.stats.mods=["echo"];
  assert.ok(lightningEnvelope(attack,0).contact);assert.ok(lightningEnvelope(attack,0).opacity>trace.opacity);
});

test("storm contact follows each node's own strike time and unstruck nodes stay invisible",()=>{
  const attack=makeExtra("lightning",{mods:["storm"],age:.19,index:2});
  assert.ok(!lightningEnvelope(attack,0).contact);assert.ok(lightningEnvelope(attack,1).contact);
  const w=makeWorld(3);attack.index=0;w.armory.extra.attacks=[attack];
  const g=new Graphics();drawExtraSpell(g,w,false,false);assert.equal(g.commands.length,0);
  attack.index=1;drawExtraSpell(g,w,false,false);assert.ok(g.commands.length>0);
});

test("actor anticipation strengthens, release follows its own hazard, and recovery settles",()=>{
  const w=makeWorld(1),e=addEnemy(w,"siegeflag",{windup:true}),p=createPose(),art=enemyArt(1,e.kind);
  e.timer=.9;updatePose(p,w,e,art,false);const early=p.windup;
  e.timer=.05;updatePose(p,w,e,art,false);assert.ok(p.windup>early);
  w.hazards=[makeHazard("circle",{source:e.id+1,due:0,until:10})];
  updatePose(p,w,e,art,false);assert.ok(p.windup>0);
  w.hazards[0].source=e.id;updatePose(p,w,e,art,false);assert.equal(p.windup,0);assert.ok(p.lean>0);
  e.state="recover";e.timer=.8;updatePose(p,w,e,art,false);const earlyRecover=p.crouch;
  e.timer=.05;updatePose(p,w,e,art,false);assert.ok(p.crouch<earlyRecover);
});

test("freezing stops the walk cycle while visual sampling leaves simulation fields untouched",()=>{
  const w=makeWorld(1),e=addEnemy(w,"siegebone",{freeze:true}),p=createPose(),art=enemyArt(1,e.kind);
  const snapshot=JSON.stringify(e);updatePose(p,w,e,art,false);assert.equal(p.stride,0);assert.equal(p.bob,0);
  assert.equal(JSON.stringify(e),snapshot);
  w.time+=.4;updatePose(p,w,e,art,false);assert.equal(p.stride,0);assert.equal(p.bob,0);
});

test("frozen floating machines and saws keep their body geometry still",()=>{
  for(const kind of ["arclantern","railsaw"]) {
    const w=makeWorld(3);addEnemy(w,kind,{freeze:true});
    const a=new Graphics();drawActorLayer(a,w,false,false);
    w.time+=.5;const b=new Graphics();drawActorLayer(b,w,false,false);
    assert.deepEqual(b.commands,a.commands,kind);
  }
});
