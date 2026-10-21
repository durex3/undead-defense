import test from 'node:test';
import assert from 'node:assert/strict';
import {ProgressStore,PROGRESS_KEY,RECOVERY_KEY,createRepairCode} from '../temp/tests/platform/ProgressStore.mjs';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
const storage=()=>{const m=new Map();return {m,getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const account=()=>({...new ProgressStore(storage()).data,revision:20,stages:[1,2,3],coins:875,purchasedWeapons:['hammer'],achievements:['forge_mastery'],grades:{blade:3,hammer:2},settledRuns:['prior-win']});
const won=()=>{const w=new SurvivalWorld(19,'ranger',4);w.state='won';return w;};
test('unknown optional achievements, grades and mod history cannot erase valid coins, purchases or clears',()=>{
 const s=storage(),d=account();d.achievements.push('future-achievement');d.grades.fire=4;d.modWins={blade:{'removed+orbit':[1],'orbit+return':[2]}};
 const original=JSON.stringify(d);s.setItem(PROGRESS_KEY,original);const p=new ProgressStore(s);
 assert.equal(p.coins,875);assert.deepEqual(p.data.stages,[1,2,3]);assert(p.unlockedWeapon('hammer'));assert(p.unlockedWeapon('wheel'));assert.equal(p.weaponGrades.blade,3);
 assert(p.loadNotice.includes('兼容'));assert(p.data.settledRuns.includes('prior-win'));assert.deepEqual(p.data.modWins.blade,{'orbit+return':[2]});
 assert(JSON.parse(s.getItem(RECOVERY_KEY)).some(x=>x.raw===original));
 const again=new ProgressStore(s);assert.equal(again.coins,875);assert(again.unlockedStage(4));
});
test('WeChat object and double-encoded records restore the same account without awarding historical coins',()=>{
 for(const raw of [account(),JSON.stringify(JSON.stringify(account()))]){
  const s=storage();s.m.set(PROGRESS_KEY,raw);const p=new ProgressStore(s);assert.equal(p.coins,875);assert(p.unlockedStage(4));assert(p.unlockedWeapon('hammer'));
 }
});
test('actual prior Cocos Set serialization signature [{}] does not discard the wallet or recorded clears',()=>{
 const s=storage(),d=account();d.achievements=[{},'forge_mastery'];d.modWins={blade:{'orbit+return':[{}]}};d.sealOpeners=[{}];
 s.setItem(PROGRESS_KEY,JSON.stringify(d));const p=new ProgressStore(s);assert.equal(p.coins,875);assert.deepEqual(p.data.stages,[1,2,3]);assert(p.unlockedWeapon('hammer'));assert(p.unlockedWeapon('wheel'));
 assert(p.data.achievements.every(id=>typeof id==='string'));assert.deepEqual(p.data.modWins.blade['orbit+return'],[]);assert.equal(new ProgressStore(s).coins,875);
});
test('one corrupt best entry and duplicate stage ID are isolated, known victory evidence recovers missing clears',()=>{
 const s=storage(),d=account();d.stages=[1,1];d.stageBest={2:{won:true,time:450,phase:2,bossRemaining:0},3:{time:-1}};
 s.setItem(PROGRESS_KEY,JSON.stringify(d));const p=new ProgressStore(s);assert.deepEqual(p.data.stages,[1,2]);assert.equal(p.coins,875);assert(p.unlockedStage(3));assert(!p.unlockedStage(4));
});
test('existing clear achievements and won best records recover clears, without inferring other missing stages',()=>{
 const s=storage(),d=account();d.stages=[];d.achievements=['windcloister_clear','forge_mastery'];d.stageBest={4:{won:true,time:450,phase:2,bossRemaining:0}};
 s.setItem(PROGRESS_KEY,JSON.stringify(d));const p=new ProgressStore(s);assert.deepEqual(new Set(p.data.stages),new Set([4,9]));assert.equal(p.coins,875);assert(!p.unlockedStage(3));
});
test('newer invalid wallet uses valid backup and preserves the bad raw primary before repair',()=>{
 const s=storage(),d=account();s.setItem(PROGRESS_KEY+'-backup',JSON.stringify(d));const bad=JSON.stringify({...d,revision:99,coins:-1});s.setItem(PROGRESS_KEY,bad);
 const p=new ProgressStore(s);assert.equal(p.coins,875);assert(p.unlockedStage(4));assert(JSON.parse(s.getItem(RECOVERY_KEY)).some(x=>x.raw===bad));
});
test('compatible record in an old location is recovered, obsolete schemas remain untouched',()=>{
 const s=storage(),old='ashen-survivors-progress-v1',obsolete='undead-defense-v1';s.setItem(old,JSON.stringify(account()));s.setItem(obsolete,JSON.stringify({version:3,stages:[14,15],coins:900}));
 const p=new ProgressStore(s);assert.equal(p.coins,875);assert(p.unlockedStage(4));assert(s.getItem(old));assert(s.getItem(obsolete));
});
test('unknown or unreadable active saves block automatic overwrites and cannot be falsely restored',()=>{
 for(const raw of ['broken json',JSON.stringify({version:99,rules:'future',coins:990,stages:[1,2]})]) {
  const s=storage();s.setItem(PROGRESS_KEY,raw);const p=new ProgressStore(s);assert(p.readBlocked);p.observe(won());assert(!p.flush());assert.equal(s.getItem(PROGRESS_KEY),raw);assert.equal(s.getItem(PROGRESS_KEY+'-backup'),null);assert.equal(p.restoreRecord('missing',p.data.revision),'missing');
 }
});
test('temporary primary read failure does not authorize writing a blank account over unseen data',()=>{
 const s=storage();s.setItem(PROGRESS_KEY,JSON.stringify(account()));const original=s.getItem(PROGRESS_KEY);let unreadable=true;
 const p=new ProgressStore({...s,getItem:k=>{if(unreadable&&k===PROGRESS_KEY)throw Error('not ready');return s.getItem(k);}});
 assert(p.readBlocked);unreadable=false;p.observe(won());assert.equal(s.getItem(PROGRESS_KEY),original);assert(!p.flush());
});
test('previewed recovery replaces exact balance, preserves current raw, and rejects duplicate old buttons',()=>{
 const s=storage(),d=account();s.setItem(PROGRESS_KEY,JSON.stringify({...d,revision:99,stages:[],coins:0,achievements:[],stageBest:{}}));s.setItem(RECOVERY_KEY,JSON.stringify([{key:PROGRESS_KEY,raw:JSON.stringify(d)}]));
 const p=new ProgressStore(s),record=p.recoveryRecords.find(x=>x.data.coins===875),revision=p.data.revision;assert(record);
 assert.equal(p.restoreRecord(record.id,revision),'restored');assert.equal(p.coins,875);assert(p.unlockedStage(4));assert(p.unlockedWeapon('hammer'));assert.equal(p.restoreRecord(record.id,revision),'stale');
 assert(JSON.parse(s.getItem(RECOVERY_KEY)).some(x=>JSON.parse(x.raw).coins===0));assert.equal(new ProgressStore(s).coins,875);
});
test('failed preservation or recovery write never changes persistent originals or in-memory wallet',()=>{
 const s=storage(),d=account(),raw=JSON.stringify(d);s.setItem(PROGRESS_KEY,raw);
 const p=new ProgressStore({...s,setItem:()=>{throw Error('quota');}});const record=p.recoveryRecords[0],before=JSON.stringify(p.data);
 assert.equal(p.evolveWeapon('blade',3),'save-failed'); // Pending data must be protected before a transaction.
 assert.equal(p.buyWeapon('lamp'),'save-failed');
 assert.equal(p.restoreRecord(record.id,p.data.revision),'save-failed');assert.equal(JSON.stringify(p.data),before);assert.equal(s.getItem(PROGRESS_KEY),raw);
});
test('original snapshots survive bounded retention after many later wins',()=>{
 const s=storage(),raw=JSON.stringify(account());s.setItem(PROGRESS_KEY,raw);const p=new ProgressStore(s);
 for(let i=0;i<25;i++)p.observe(won());const history=JSON.parse(s.getItem(RECOVERY_KEY));assert(history.length<=12);assert(history.some(x=>x.raw===raw));assert.equal(p.coins,875+25*160);
});
test('corrupt recovery archive blocks destructive writes instead of replacing the archive',()=>{
 const s=storage(),raw=JSON.stringify(account());s.setItem(PROGRESS_KEY,raw);s.setItem(RECOVERY_KEY,'corrupt history');const p=new ProgressStore(s);p.observe(won());assert(p.pending);assert.equal(s.getItem(PROGRESS_KEY),raw);assert.equal(s.getItem(RECOVERY_KEY),'corrupt history');
});
test('confirmed repair code restores four clears and exactly 400 coins, no paid/challenge weapons or invented times',()=>{
 const s=storage(),p=new ProgressStore(s),code=createRepairCode(4,400,'2026102101');
 const preview=p.previewRepairCode(code);assert(preview);assert.equal(p.coins,0);assert.deepEqual(preview.data.stages,[1,2,3,4]);
 assert.equal(p.applyRepairCode(code,p.data.revision),'restored');assert.equal(p.coins,400);assert(p.unlockedStage(5));assert(!p.unlockedStage(6));assert(!p.unlockedWeapon('hammer'));assert(!p.unlockedWeapon('wheel'));assert(!p.unlockedWeapon('needle'));assert.deepEqual(p.data.stageBest,{});
 const revision=p.data.revision;p.observe(won());assert.equal(p.coins,560);assert.equal(p.applyRepairCode(code,revision),'already');assert.equal(p.coins,560);
 const reopened=new ProgressStore(s);assert.equal(reopened.coins,560);assert.deepEqual(reopened.data.stages,[1,2,3,4]);
});
test('mistyped, out-of-range, stale or unsavable repair codes leave the wallet unchanged',()=>{
 const s=storage(),p=new ProgressStore(s),code=createRepairCode(4,400,'2026102101');
 assert.equal(p.applyRepairCode(code.replace('-400-','-401-'),0),'invalid');assert.equal(p.applyRepairCode(createRepairCode(14,400,'2026102101'),0),'invalid');
 assert.equal(p.applyRepairCode(code,99),'stale');assert.equal(p.coins,0);
 const q=new ProgressStore({getItem:()=>null,setItem:()=>{throw Error('quota');}});assert.equal(q.applyRepairCode(code,0),'save-failed');assert.equal(q.coins,0);assert(!q.unlockedStage(2));
});
