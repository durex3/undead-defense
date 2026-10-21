/** Current 14-series output audit. Controlled targets, not human win rate or a balance certification. */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['tools/test-build.mjs'],{stdio:'inherit'});
const {SurvivalWorld}=await import('../temp/tests/battle/SurvivalWorld.mjs');
const {ALL_WEAPONS}=await import('../temp/tests/battle/SurvivalConfig.mjs');
const {weaponStats,MODS}=await import('../temp/tests/battle/ArmoryConfig.mjs');
const {initialGrade,weaponName,validGrade}=await import('../temp/tests/battle/WeaponGrade.mjs');
const {WEAPON_BALANCE,weaponBalanceBand}=await import('../temp/tests/battle/WeaponBalance.mjs');
const seconds=30,rows=[];
function probe(skill,level,scene,mods=[],grade=initialGrade(skill)){
 const armored=scene==='armored-boss'||scene==='exposed-boss';
 const w=new SurvivalWorld(31,'ranger',armored?10:1);w.time=360;w.player={x:0,y:0};w.enemies=[];w.lastMove={x:1,y:0};
 for(const s of ALL_WEAPONS){w.skills[s]=0;w.mods[s]=[];}
 w.skills[skill]=level;w.mods[skill]=mods;w.weaponGrades[skill]=grade;
 const count=['cluster','ring','line'].includes(scene)?8:1;
 for(let i=0;i<count;i++){
  const a=i*Math.PI*2/count;
  const p=scene==='cluster'?{x:2.4+Math.cos(a)*.4,y:Math.sin(a)*.4}:scene==='ring'?{x:Math.cos(a)*2.4,y:Math.sin(a)*2.4}:scene==='line'?{x:1.6+i*.8,y:0}:scene==='far'?{x:6,y:0}:scene==='rear'?{x:-2.4,y:0}:{x:2.4,y:0};
  const e=w.addEnemy(armored?'boss':'minion',p.x,p.y);Object.assign(e,{hp:1e8,maxHp:1e8,state:scene==='exposed-boss'?'recover':'seek'});
  if(scene==='exposed-boss')e.library={vulnerable:true};
 }
 let control=0,maxHit=0,first=null;
 for(let frame=0;frame<seconds*60;frame++){
  w.time+=1/60;
  if(scene==='moving'){const t=frame/60;w.enemies[0].x=2.4+Math.sin(t*1.2)*1.4;w.enemies[0].y=Math.cos(t*1.2)*1.4;}
  w.armory.step(1/60);
  control+=w.enemies.filter(e=>e.freezeUntil>w.time).length/60;
  for(const event of w.drain())if(event.type==='hit'&&event.skill===skill){maxHit=Math.max(maxHit,event.value??0);if(first===null)first=frame/60;}
 }
 const damage=w.damage[skill]||0,s=weaponStats(w,skill);
 return {skill,name:weaponName(skill,w.weaponGrades),grade,level,scene,mods,damage:+damage.toFixed(2),dps:+(damage/seconds).toFixed(2),maxHit:+maxHit.toFixed(2),firstHitSeconds:first,controlTargetSeconds:+control.toFixed(2),baseHit:+s.damage.toFixed(2),count:s.count,cooldown:+s.cooldown.toFixed(3)};
}
for(const level of [1,4,8])for(const skill of ALL_WEAPONS)for(const scene of ['near','far','rear','moving','cluster','ring','line','armored-boss','exposed-boss'])rows.push(probe(skill,level,scene));
const modified=[];
for(const skill of ALL_WEAPONS){const pairs=[];for(let i=0;i<MODS[skill].length;i++)for(let j=i+1;j<MODS[skill].length;j++){const a=MODS[skill][i],b=MODS[skill][j];if(a.excludes===b.id||b.excludes===a.id)continue;pairs.push([a.id,b.id]);}
 for(let grade=1;grade<=4;grade++)if(validGrade(skill,grade))for(const mods of pairs)for(const scene of ['near','moving','cluster','armored-boss'])modified.push(probe(skill,8,scene,mods,grade));
}
const grades=[];for(const skill of ALL_WEAPONS)for(let grade=1;grade<=4;grade++)if(validGrade(skill,grade))for(const scene of [WEAPON_BALANCE[skill].scene,'armored-boss'])grades.push(probe(skill,8,scene,[],grade));
const teams=[];
for(const scene of ['single','pair','cluster'])for(const fourth of [null,'lamp','needle','hammer','wheel','ghost']){
 const w=new SurvivalWorld(31,'ranger',1);w.time=360;w.player={x:0,y:0};w.enemies=[];
 for(const s of ALL_WEAPONS){w.skills[s]=0;w.mods[s]=[];}
 for(const s of ['blade','water','lightning',...(fourth?[fourth]:[])])w.skills[s]=8;
 const count=scene==='single'?1:scene==='pair'?2:8;
 for(let i=0;i<count;i++){const a=i*2*Math.PI/count,e=w.addEnemy('minion',2.4+Math.cos(a)*.3,Math.sin(a)*.3);Object.assign(e,{hp:1e8,maxHp:1e8,state:'seek'});}
 for(let i=0;i<1800;i++){w.time+=1/60;w.armory.step(1/60);w.drain();}
 const dps=Object.values(w.damage).reduce((n,v)=>n+v,0)/seconds;
 const baseline=teams.find(t=>t.scene===scene&&t.fourth===null)?.dps??dps;
 teams.push({scene,fourth,dps:+dps.toFixed(2),gain:+(dps-baseline).toFixed(2),bySkill:w.damage});
}
const budgets=ALL_WEAPONS.map(skill=>{const p=WEAPON_BALANCE[skill],r=rows.find(r=>r.skill===skill&&r.level===8&&r.scene===p.scene),band=weaponBalanceBand(skill,r.grade);return {skill,role:p.role,scene:p.scene,grade:r.grade,dps:r.dps,...band,pass:r.dps>=band.min&&r.dps<=band.max};});
const gradeBudgets=grades.map(r=>{const band=weaponBalanceBand(r.skill,r.grade);return {skill:r.skill,grade:r.grade,scene:r.scene,dps:r.dps,...band,pass:r.scene==='armored-boss'||r.dps>=band.min&&r.dps<=band.max};});
const modifiedCaps=modified.map(r=>({skill:r.skill,grade:r.grade,scene:r.scene,mods:r.mods,dps:r.dps,max:weaponBalanceBand(r.skill,r.grade).max*1.8,pass:r.dps<=weaponBalanceBand(r.skill,r.grade).max*1.8})).filter(r=>r.scene==='near'||r.scene==='moving');
const report={scope:'30s isolated real Armory/hit logic, ranger +10% innate damage, no passives or AI/contact. Native initial grades differ legitimately. High-HP targets avoid kill/retarget effects. Armor/exposure probes are fixed stage10 boss states. Budget bands apply only to the designated reference scene; team diagnostics separately count support amplification/transfer. This is not human win rate or device performance.',rows,modified,grades,teams,budgets,gradeBudgets,modifiedCaps};
const out=process.argv[2]||'artifacts/weapon-balance-0.33.9';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/after.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({cases:rows.length+modified.length+grades.length+teams.length,budgets,teams:teams.map(({bySkill,...t})=>t)},null,2));
if([...budgets,...gradeBudgets,...modifiedCaps].some(r=>!r.pass))throw Error('Weapon balance reference outside role/grade band');
