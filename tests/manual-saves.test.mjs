import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressStore, PROGRESS_KEY, MANUAL_SAVE_LIMIT } from '../temp/tests/platform/ProgressStore.mjs';
const memory=()=>{const m=new Map();return {m,getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
const account=s=>{const p=new ProgressStore(s);p.data.coins=400;p.data.stages=[1,2,3,4];p.data.purchasedWeapons=['hammer'];p.data.grades={blade:2,hammer:2};p.pending=true;p.flush();return p;};
test('exactly three independent manual slots persist and reject out-of-range writes',()=>{
 const s=memory(),p=account(s);assert.equal(MANUAL_SAVE_LIMIT,3);assert.equal(p.manualSaves.length,3);
 for(const e of p.manualSaves)assert.equal(p.saveManual(e.slot,e.token,p.data.revision),'saved');
 assert.equal(p.saveManual(0,'',0),'missing');assert.equal(p.saveManual(4,'',0),'missing');
 const reopened=new ProgressStore(s);assert(reopened.manualSaves.every(e=>e.state==='saved'&&e.data.coins===400));
 p.data.coins=123;p.pending=true;p.flush();assert(reopened.manualSaves.every(e=>e.data.coins===400),'automatic saving must not overwrite manual slots');
});
test('loading restores exact progress, weapons and grades without adding money; snapshot stays independent',()=>{
 const s=memory(),p=account(s),empty=p.manualSaves[0];p.saveManual(1,empty.token,p.data.revision);
 const e=p.manualSaves[0];p.data.coins=999;p.data.stages.push(5);p.pending=true;p.flush();
 assert.equal(p.loadManual(1,e.token,p.data.revision),'loaded');assert.equal(p.coins,400);assert.deepEqual(p.data.stages,[1,2,3,4]);assert(p.unlockedWeapon('hammer'));assert.equal(p.weaponGrades.blade,2);
 assert.equal(new ProgressStore(s).coins,400);assert.equal(p.manualSaves[0].data.coins,400);
});
test('delete removes only selected manual slot and cannot resurrect from recovery or backup after restart',()=>{
 const s=memory(),p=account(s);for(const e of p.manualSaves)p.saveManual(e.slot,e.token,p.data.revision);
 const e=p.manualSaves[1];assert.equal(p.deleteManual(2,e.token),'deleted');assert.equal(p.deleteManual(2,e.token),'missing');
 const q=new ProgressStore(s);assert.equal(q.coins,400);assert.deepEqual(q.manualSaves.map(e=>e.state),['saved','empty','saved']);
 assert(!s.getItem(PROGRESS_KEY+'-manual-2').includes('400'),'deleted slot must no longer contain account payload');
});
test('old confirmation buttons cannot overwrite/delete newly changed slots or load over changed current account',()=>{
 const p=account(memory()),e=p.manualSaves[0],revision=p.data.revision;p.saveManual(1,e.token,revision);
 assert.equal(p.saveManual(1,e.token,revision),'stale');assert.equal(p.deleteManual(1,e.token),'stale');
 const saved=p.manualSaves[0];p.data.revision++;assert.equal(p.loadManual(1,saved.token,revision),'stale');assert.equal(p.saveManual(1,saved.token,revision),'stale');
});
test('failed save/delete/load leaves current wallet and previous slot intact',()=>{
 const s=memory(),p=account(s),e=p.manualSaves[0];p.saveManual(1,e.token,p.data.revision);const raw=s.getItem(PROGRESS_KEY+'-manual-1');
 const q=new ProgressStore({...s,setItem:()=>{throw Error('quota');}}),saved=q.manualSaves[0];
 assert.equal(q.saveManual(1,saved.token,q.data.revision),'save-failed');assert.equal(q.deleteManual(1,saved.token),'save-failed');assert.equal(q.loadManual(1,saved.token,q.data.revision),'save-failed');assert.equal(q.coins,400);assert.equal(s.getItem(PROGRESS_KEY+'-manual-1'),raw);
});
test('corrupt readable slot can be explicitly replaced or deleted, transient read errors never authorize overwrite',()=>{
 const s=memory(),p=account(s);s.setItem(PROGRESS_KEY+'-manual-1','bad json');let e=p.manualSaves[0];assert.equal(e.state,'invalid');assert.equal(p.deleteManual(1,e.token),'deleted');
 s.setItem(PROGRESS_KEY+'-manual-1','bad json');e=p.manualSaves[0];assert.equal(p.saveManual(1,e.token,p.data.revision),'saved');
 const q=new ProgressStore({...s,getItem:k=>{if(k.endsWith('-manual-1'))throw Error('unavailable');return s.getItem(k);}});e=q.manualSaves[0];assert.equal(e.state,'unreadable');assert.equal(q.deleteManual(1,e.token),'save-failed');assert.equal(q.saveManual(1,e.token,q.data.revision),'save-failed');
});
