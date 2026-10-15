import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatFeedback,feedbackCue} from '../temp/tests/presentation/CombatFeedback.mjs';
test('heavy impact feedback is throttled and cannot mask modification cues',()=>{const f=new CombatFeedback(),hit={type:'explosion',skill:'fire',form:'heavy',x:0,y:0};assert(f.claim(hit,0));assert.equal(f.claim(hit,.1),null);assert(f.claim({type:'modify',final:true,x:0,y:0},.1));assert.equal(f.claim(hit,.6),null);assert(f.claim(hit,1));});
test('regular fields and hits do not shake every frame, and UI time gates leave combat untouched',()=>{const f=new CombatFeedback();for(const type of ['hit','cast','death'])assert.equal(feedbackCue({type,x:0,y:0}),null);assert.equal(feedbackCue({type:'explosion',skill:'water',x:0,y:0}),null);f.claim({type:'modify',final:true,x:0,y:0},0);assert(!f.routineAllowed(.2));assert(f.routineAllowed(.8));f.reset();assert(f.routineAllowed(0));});
