import fs from 'node:fs';
import {withVerificationLock} from './verification-lock.mjs';
import {SurvivalWorld} from '../temp/tests/battle/SurvivalWorld.mjs';
import {leadImpact} from '../temp/tests/battle/LeadFoundryGeometry.mjs';
import {eclipseImpacts} from '../temp/tests/battle/EclipseGeometry.mjs';
await withVerificationLock(async()=>{
 const rows=[];
 for(const stage of [14,15])for(const phase of [1,2,3])for(const p of [{x:0,y:0},{x:20,y:0},{x:20,y:24},{x:-10,y:-10}])for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const preferred of ['A','B','C']){
  const w=new SurvivalWorld(31,'ranger',stage);w.time=400;w.player={...p};w.stageStrategy.map.resolve(w.player,.3);w.camera={x:Math.max(-512/48,Math.min(512/48,w.player.x)),y:Math.max(-1124/48,Math.min(1124/48,w.player.y))};w.viewport={x:7.5*844/390,y:7.5};
  const e=w.addEnemy('boss',Math.max(-21.3,Math.min(21.3,w.player.x-Math.cos(a)*4.8)),Math.max(-25.3,Math.min(25.3,w.player.y-Math.sin(a)*4.8)));w.stageStrategy.map.resolve(e,.7);e.bossPhase=phase;e.state='seek';const s=stage===14?w.eclipse:w.lead;s.state(e).action=preferred;
  const covers=items=>stage===14?items.some(h=>eclipseImpacts(h,w.player,h.until,h.due).length):items.some(h=>h.lead.legs.some(f=>leadImpact(f,w.player,f.end,f.due)));
  const authored=s.plan(e),proposal=s.selectBossPlan(e,preferred);
  rows.push({stage,phase,point:p,angle:a,preferred,authoredLegal:authored.every(h=>s.legal(h)),authoredThreatens:!!covers(authored),selected:proposal?.action,selectedThreatens:proposal?.threatens,selectedLegal:proposal?.items.every(h=>s.legal(h))});
 }
 const changed=rows.filter(r=>r.selected&&r.selected!==r.preferred).length,improved=rows.filter(r=>r.selectedThreatens&&(!r.authoredThreatens||!r.authoredLegal)).length;
 fs.mkdirSync('artifacts/ai-0.40.2',{recursive:true});fs.writeFileSync('artifacts/ai-0.40.2/boss-plans.json',JSON.stringify({scope:'Stages14/15,three phases,four positions,four approach angles,three preferred actions; frozen pre-publication snapshots,not win-rate',changed,improved,rows},null,2)+'\n');
 console.log(JSON.stringify({cases:rows.length,changed,improved,noProposal:rows.filter(r=>!r.selected).length}));if(!changed||!improved||rows.some(r=>r.selected&&!r.selectedLegal))throw Error('Boss alternative selection diagnostic failed');
});
