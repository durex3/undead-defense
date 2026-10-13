import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayPreferences} from '../temp/tests/platform/PlayPreferences.mjs';
test('preferences persist independently, filter malformed lessons and retry failed writes', () => {
 const data = new Map(); let fail = false;
 const storage = {getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('quota');data.set(k,v)}};
 const p = new PlayPreferences(storage); p.toggleMute(); p.mark('move'); p.mark('move');
 assert.equal(p.powerSaving,true);p.togglePowerSaving();assert.equal(new PlayPreferences(storage).powerSaving,false);
 const r = new PlayPreferences(storage); assert.equal(r.muted,true); assert.deepEqual(r.completed,['move']);
 fail=true; r.mark('nova'); assert.equal(r.pending,true); fail=false; r.flush();
 assert.deepEqual(new PlayPreferences(storage).completed,['move','nova']);
 data.set('ashen-survivors-preferences-v1',JSON.stringify({version:1,muted:'yes',completed:['bad','xp','xp']}));
 const clean=new PlayPreferences(storage);assert.equal(clean.muted,false);assert.deepEqual(clean.completed,['xp']);
 data.set('ashen-survivors-preferences-v1','broken');assert.doesNotThrow(()=>new PlayPreferences(storage));
});
