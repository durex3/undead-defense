import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SurvivalWorld } from '../temp/tests/battle/SurvivalWorld.mjs';
import { SYNTHESIS_RECIPES, EVOLUTIONS } from '../temp/tests/battle/SurvivalConfig.mjs';
import { CombatFeedback, FEEDBACK_SOUNDS, feedbackCue } from '../temp/tests/presentation/CombatFeedback.mjs';

test('every combination emits final feedback exactly once with the selected form',()=>{
  for(const [main,partner] of Object.entries(SYNTHESIS_RECIPES)) {
    const w=new SurvivalWorld();w.skills[main]=w.skills[partner]=10;w.step(1/60);
    const ready=w.drain();
    if(EVOLUTIONS[main].length>1) {
      assert(!ready.some(e=>e.final));assert.equal(w.pendingEvolution,main);
      const form=EVOLUTIONS[main][1].id;assert(w.evolve(form));
      const final=w.drain().filter(e=>e.final);assert.equal(final.length,1);assert.equal(final[0].form,form);
    } else {
      const final=ready.filter(e=>e.final);assert.equal(final.length,1);assert.equal(final[0].form,EVOLUTIONS[main][0].id);
    }
    w.step(1/60);assert(!w.drain().some(e=>e.final));
    assert.equal(w.skills[main],10);assert.equal(w.skills[partner],10);
  }
});

test('rank breakthroughs never impersonate final combination feedback',()=>{
  const w=new SurvivalWorld();w.skills.fire=6;w.state='upgrade';w.cards=['fire'];w.choose('fire');
  assert(w.drain().some(e=>e.type==='evolve'&&e.value===7&&!e.final));
  w.skills.fire=9;w.state='upgrade';w.cards=['fire'];w.choose('fire');
  assert(!w.drain().some(e=>e.final));
});

test('final effect snapshots retain the chosen branch when later state changes',()=>{
  const w=new SurvivalWorld();w.skills.fire=w.skills.blade=10;w.step(1/60);w.drain();w.evolve('inferno');
  const e=w.drain().find(e=>e.final);w.evolutions.fire='meteor';assert.equal(e.form,'inferno');
});

test('combination sound gate limits crowds and gives final evolution priority',()=>{
  const mixer=new CombatFeedback();
  assert(mixer.claim({type:'evolve',final:true},0));
  for(const type of ['comboFire','comboIce','comboPurify','fireImpact'])
    assert.equal(mixer.claim({type,form:'meteor'},.1),null);
  assert.equal(mixer.routineAllowed(.69),false);assert.equal(mixer.routineAllowed(.7),true);
  let accepted=0;for(let i=0;i<100;i++)if(mixer.claim({type:'comboIce'},1))accepted++;
  assert.equal(accepted,1);assert.equal(mixer.claim({type:'comboIce'},1.24),null);
  assert(mixer.claim({type:'comboIce'},1.25));mixer.reset();assert(mixer.claim({type:'comboIce'},0));
  assert.equal(feedbackCue({type:'hit'}),null);assert.equal(feedbackCue({type:'evolve',value:10}),null);
});

test('purification pulses use their own interval and require live overlapping fields',()=>{
  const w=new SurvivalWorld();w.skills.water=w.skills.poison=10;w.evolutions.water='tide';
  const e=w.addEnemy('minion',0,0);e.state='seek';e.hp=e.maxHp=100000;
  w.expansion.cast('water');w.expansion.cast('water');w.expansion.field('poison',w.player,2,4,0);w.time=1;
  w.expansion.stepFields(0);assert.equal(w.drain().filter(e=>e.type==='comboPurify').length,1);
  const hp=e.hp;w.expansion.stepFields(0);assert.equal(e.hp,hp);assert(!w.drain().some(e=>e.type==='comboPurify'));
  w.time=1.5;w.expansion.stepFields(0);assert.equal(w.drain().filter(e=>e.type==='comboPurify').length,0);
  w.time=2.2;w.expansion.stepFields(0);assert.equal(w.drain().filter(e=>e.type==='comboPurify').length,1);
  w.expansion.remove('poison');w.time=3.4;w.expansion.stepFields(0);assert(!w.drain().some(e=>e.type==='comboPurify'));
});

test('new original audio clips are short, distinct PCM files with headroom and fading tails',()=>{
  const ids=new Set(),audio=new Set();
  for(const name of FEEDBACK_SOUNDS) {
    const path=`assets/resources/audio/${name}.wav`,b=fs.readFileSync(path);
    assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');
    assert.equal(b.readUInt16LE(20),1);assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt32LE(24),22050);
    assert.equal(b.readUInt16LE(34),16);assert(b.length<50000);
    let peak=0,tail=0;for(let i=44;i<b.length;i+=2){const v=Math.abs(b.readInt16LE(i));peak=Math.max(peak,v);if(i>b.length-220)tail=Math.max(tail,v);}
    assert(peak>1000&&peak<25000);assert(tail<peak*.1);
    audio.add(b.subarray(44).toString('base64'));ids.add(JSON.parse(fs.readFileSync(path+'.meta','utf8')).uuid);
  }
  assert.equal(ids.size,FEEDBACK_SOUNDS.length);assert.equal(audio.size,FEEDBACK_SOUNDS.length);
});
