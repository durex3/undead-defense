import test from "node:test";
import assert from "node:assert/strict";
import {Graphics} from "../temp/tests/node_modules/cc/index.mjs";
import {HitDecorBudget,crowdedEffects} from "../temp/tests/presentation/art/VisualDensity.mjs";
import {spawnParticles,updateParticles,resetParticles,drawGroundFields} from "../temp/tests/presentation/art/SpellPainter.mjs";
import {skyBoltPoints} from "../temp/tests/presentation/art/spells/LightningMotion.mjs";
import {drawExtraSpell} from "../temp/tests/presentation/art/spells/ExtraSpellArt.mjs";
import {drawHazards} from "../temp/tests/presentation/art/HazardPainter.mjs";
import {BattlePainter} from "../temp/tests/presentation/BattlePainter.mjs";
import {drawHeroReadability} from "../temp/tests/presentation/art/HeroPainter.mjs";
import {makeWorld,makeExtra,makeShot,makeField,makeThunderHazard} from "../tools/art-fixtures.mjs";

test("ordinary hits coalesce locally and remain bounded, with an independent reduced budget",()=>{
  const b=new HitDecorBudget();b.begin(false);
  assert.ok(b.allow(1,1,"fire"));assert.ok(!b.allow(10,10,"fire"));assert.ok(b.allow(10,10,"water"));
  let accepted=2;for(let i=1;i<100;i++)if(b.allow(i*40,0,"fire"))accepted++;
  assert.equal(accepted,8);b.begin(true);
  accepted=0;for(let i=0;i<100;i++)if(b.allow(i*40,0,"fire"))accepted++;
  assert.equal(accepted,4);
});

for(const reduced of [false,true])test(`player-hit cue survives ordinary hit flood (${reduced?"reduced":"normal"})`,()=>{
  resetParticles();const events=[{type:"playerHit",x:0,y:0}];
  for(let i=0;i<600;i++)events.push({type:"hit",skill:"lightning",x:i,y:0});
  spawnParticles(events,reduced);const g=new Graphics();updateParticles(g,.01,reduced);
  assert.ok(g.commands.some(c=>c.color.startsWith("rgba(255,122,122,")),"player-hit ring was overwritten or hidden");
  assert.ok(g.commands.length<=40,"ordinary hits exceeded their decorative budget");
  updateParticles(new Graphics(),1,true);const after=new Graphics();updateParticles(after,.01,false);
  assert.equal(after.commands.length,0,"quality switch resurrected old particles");
});

test("crowding reduces field decoration and leaves the exact radius boundary",()=>{
  const w=makeWorld(1);w.armory.fields=[makeField("water",{radius:2})];
  const normal=new Graphics(),quiet=new Graphics();drawGroundFields(normal,w,false,false);drawGroundFields(quiet,w,false,true);
  assert.ok(quiet.commands.length<normal.commands.length);
  assert.deepEqual(quiet.commands[2],normal.commands[2]);
});

test("sky bolt enters above camera, descends to locked point, and bridge remains a separate modification",()=>{
  const p=skyBoltPoints(40,-20,420,.01,0);assert.ok(p[0][1]>=420);assert.deepEqual(p.at(-1),[40,-20]);
  for(let i=1;i<p.length;i++)assert.ok(p[i][1]<p[i-1][1]);
  const w=makeWorld(3),a=makeExtra("lightning",{age:.01,index:2});w.armory.extra.attacks=[a];
  const plain=new Graphics();drawExtraSpell(plain,w,false,false);
  a.stats.mods=["bridge"];const bridge=new Graphics();drawExtraSpell(bridge,w,false,false);
  assert.ok(bridge.commands.length>plain.commands.length);
});

test("crowded four-weapon layer preserves final enemy warning geometry",()=>{
  const w=makeWorld(3,{time:.5});w.armory.fields=Array.from({length:7},(_,i)=>makeField("water",{x:i*.1}));
  w.armory.shots=[makeShot("blade"),makeShot("fire")];w.armory.extra.attacks=[makeExtra("lightning")];
  assert.ok(crowdedEffects(w));w.hazards=[makeThunderHazard("wall",{radius:8,gap:.6})];
  const expected=new Graphics();drawHazards(expected,w,false);
  const actual=new Graphics();new BattlePainter(actual).draw(w,.016,[],false);
  assert.deepEqual(actual.commands.slice(-expected.commands.length),expected.commands);
});

test("crowded hero locator stays below warnings and respects noHero previews",()=>{
  const w=makeWorld(4);w.armory.fields=Array.from({length:6},()=>makeField("water"));
  const snapshot=JSON.stringify({player:w.player,move:w.move,invulnerable:w.invulnerable});
  const rim=new Graphics();drawHeroReadability(rim,w);
  const withHero=new Graphics();new BattlePainter(withHero).draw(w,0,[]);
  assert.deepEqual(withHero.commands.slice(-rim.commands.length),rim.commands);
  const without=new Graphics();new BattlePainter(without,{noHero:true}).draw(w,0,[]);
  assert.ok(!without.commands.some(c=>JSON.stringify(c)===JSON.stringify(rim.commands[0])));
  assert.equal(JSON.stringify({player:w.player,move:w.move,invulnerable:w.invulnerable}),snapshot);
});

test("heavy accents throttle repeated contacts, resume with presentation time and expire",()=>{
  const event={type:"explosion",skill:"fire",form:"heavy",x:0,y:0,radius:1};
  const sample=events=>{resetParticles();spawnParticles(events,false);const g=new Graphics();updateParticles(g,0,false);return g.commands;};
  assert.deepEqual(sample(Array.from({length:50},()=>event)),sample([event]));
  resetParticles();spawnParticles([event],true);updateParticles(new Graphics(),.13,true);
  spawnParticles([event],true);const active=new Graphics();updateParticles(active,0,true);
  assert.ok(active.commands.length>0);
  updateParticles(new Graphics(),1,true);const expired=new Graphics();updateParticles(expired,0,false);
  assert.equal(expired.commands.length,0);
});
