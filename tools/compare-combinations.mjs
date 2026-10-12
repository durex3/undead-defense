import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {SYNTHESIS_RECIPES} from '../temp/tests/battle/SurvivalConfig.mjs';
const output=process.argv[2]||'temp/balance-0109/report.json';
const runs=[];
for(const stage of [1,3])for(const main of Object.keys(SYNTHESIS_RECIPES)){
 const result=spawnSync(process.execPath,['tools/simulate-survival.mjs',`pair:${main}`,'ranger',String(stage),'cautious','primary','locked'],{encoding:'utf8'});
 if(result.status!==0)throw new Error(result.stderr||result.stdout);
 const rows=result.stdout.trim().split('\n').map(JSON.parse);runs.push(...rows);
 console.log(JSON.stringify({stage,main,wins:rows.filter(r=>r.state==='won').length,formed:rows.filter(r=>r.firstCombo!==null).length,firstCombo:rows.map(r=>r.firstCombo),bossSeconds:rows.map(r=>r.state==='won'?r.time-240:null)}));
}
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify({policy:'Ranger, stages 1 and 3, seeds 1/19/72; lock one recipe; prioritize lower-rank recipe member; cautious collection; choose first final form; no granted XP or stats. Results describe this bot policy, not human win rates.',runs},null,2)+'\n');
