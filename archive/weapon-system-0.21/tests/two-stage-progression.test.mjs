import test from 'node:test';
import assert from 'node:assert/strict';
import {ProgressStore,PROGRESS_KEY} from '../temp/tests/platform/ProgressStore.mjs';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {STAGE_IDS,stageNumber,LEGACY_STAGE_IDS} from '../temp/tests/battle/ProgressionConfig.mjs';
import {STAGES} from '../temp/tests/battle/StageRules.mjs';
function storage(){const map=new Map();return {map,getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};}
function win(stage){const w=new SurvivalWorld(19,'ranger',stage);w.state='won';return w;}
test('only two stages are playable; stable identities preserve exact combat multipliers',()=>{
 assert.deepEqual(STAGE_IDS,[14,15]);assert.equal(stageNumber(14),1);assert.equal(stageNumber(15),2);
 const p=new ProgressStore(storage());assert(p.unlockedStage(14));assert(!p.unlockedStage(15));
 for(const id of LEGACY_STAGE_IDS.filter(id=>id<14))assert(!p.unlockedStage(id));
 assert.deepEqual(Object.values(STAGES[14]),['铁棘围城','铁棘围城督军',1.65,1.85,2.45,1.42,.85,42]);
 assert.deepEqual(Object.values(STAGES[15]),['赤砂虫巢','赤砂巢皇',1.72,1.95,2.65,1.46,.85,42]);
});
test('new progression unlocks by clears only, without earning achievements or duplicate roles',()=>{
 const s=storage(),p=new ProgressStore(s);assert(!p.unlockedCharacter('alchemist'));assert(!p.unlockedCharacter('necromancer'));
 const w=win(14);w.level=64;w.kills=6000;w.eliteKills=8;w.mods.fire=['heavy'];
 assert.deepEqual(p.observe(w),[]);assert.deepEqual(p.data.achievements,[]);assert(p.unlockedStage(15));assert(p.unlockedCharacter('alchemist'));assert(!p.unlockedCharacter('necromancer'));
 p.observe(w);assert.deepEqual(p.data.unlocked,['ranger','alchemist']);
 p.observe(win(15));p.observe(win(15));const q=new ProgressStore(s);
 assert.deepEqual(q.data.unlocked,['ranger','alchemist','necromancer']);assert(q.unlockedCharacter('necromancer'));assert.deepEqual(q.data.achievements,[]);assert.deepEqual(q.data,p.data);
});
test('old first and second clears do not unlock or supply records for new first and second',()=>{
 const s=storage(),d=new ProgressStore(s).data;d.stages=[1,2];d.stageBest={1:{time:510,phase:2,bossRemaining:0,won:true},2:{time:520,phase:2,bossRemaining:0,won:true}};s.setItem(PROGRESS_KEY,JSON.stringify(d));
 const p=new ProgressStore(s);assert(p.unlockedStage(14));assert(!p.unlockedStage(15));assert.equal(p.data.stageBest[14],undefined);assert.equal(p.data.stageBest[15],undefined);assert.equal(p.bestLine(14),'本关尚无挑战记录');
});
test('old achievements, all historical records, character access and new-stage clears survive reload',()=>{
 const s=storage(),d=new ProgressStore(s).data;d.stages=[...LEGACY_STAGE_IDS];d.achievements=['level','learn','four','modify','elite','survive','win','kills','three'];d.unlocked=['ranger'];d.revision=9;d.best={kills:7000,time:600,weapons:6};d.stageBest={14:{time:550,phase:2,bossRemaining:0,won:true},15:{time:541,phase:1,bossRemaining:22,won:false}};s.setItem(PROGRESS_KEY,JSON.stringify(d));
 const p=new ProgressStore(s);assert(p.unlockedCharacter('alchemist'));assert(p.unlockedCharacter('necromancer'));assert(p.unlockedStage(15));assert.deepEqual(p.data.achievements,d.achievements);assert.deepEqual(p.data.stageBest,d.stageBest);assert.deepEqual(p.data.best,d.best);assert.equal(p.data.revision,10);
 const q=new ProgressStore(s);assert.deepEqual(q.data,p.data);assert.equal(q.data.revision,10);
});
test('v1 and v2 unlock migration preserves original legacy achievement thresholds',()=>{
 for(const version of [1,2]){const s=storage(),d=new ProgressStore(s).data;d.version=version;delete d.unlocked;d.stages=[1];d.achievements=['level','learn','four','modify','elite','survive'];s.setItem(PROGRESS_KEY,JSON.stringify(d));const p=new ProgressStore(s);assert.deepEqual(p.data.unlocked,['ranger','alchemist','necromancer']);assert(!p.unlockedStage(15));assert.equal(p.data.version,3);}
});
test('corrupt primary restores newest valid backup without losing old stage records',()=>{
 const s=storage(),d=new ProgressStore(s).data;d.stages=[14];d.unlocked=['ranger','alchemist'];d.revision=7;s.setItem(PROGRESS_KEY,'broken');s.setItem(PROGRESS_KEY+'-backup',JSON.stringify(d));const p=new ProgressStore(s);assert.equal(p.data.revision,7);assert(p.unlockedStage(15));assert(p.unlockedCharacter('alchemist'));
});
test('failed writes retain progress for retry and do not mint achievements',()=>{
 let fail=true;const s=storage(),p=new ProgressStore({getItem:s.getItem,setItem:(k,v)=>{if(fail)throw Error('full');s.setItem(k,v);}});p.observe(win(14));assert(p.pending);assert(p.unlockedStage(15));assert.deepEqual(p.data.achievements,[]);fail=false;assert(p.flush());assert(!p.pending);assert(new ProgressStore(s).unlockedStage(15));
});
