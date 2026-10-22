/** Design-only stage18 whitebox and isolated, sampled escape examples. No registration. */
import fs from 'node:fs';
import ts from 'typescript';
import sharp from 'sharp';
const out = 'artifacts/stage18-design';
fs.mkdirSync(out, {recursive:true});
const compiled=ts.transpileModule(fs.readFileSync('assets/scripts/battle/StageGrowth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const {stageReference,stageGrowth}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const boxes=[{x:-11,y:-10,hx:2.4,hy:1.1},{x:11,y:10,hx:2.4,hy:1.1},{x:-11,y:10,hx:1.1,hy:2.4},{x:11,y:-10,hx:1.1,hy:2.4},{x:-17,y:0,hx:.8,hy:2},{x:17,y:0,hx:.8,hy:2}];
const blocked=(p,r)=>Math.abs(p.x)>22-r||Math.abs(p.y)>26-r||boxes.some(b=>Math.abs(p.x-b.x)<b.hx+r&&Math.abs(p.y-b.y)<b.hy+r);
const clear=(a,b,r)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.025));for(let i=0;i<=n;i++)if(blocked({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},r))return false;return true;};
const paths=[[[0,-8],[-4,-8],[-4,18],[0,18]],[[0,-8],[4,-8],[4,18],[0,18]],[[0,-8],[0,-23.5],[-20.2,-23.5],[-20.2,23.5],[20.2,23.5],[20.2,-23.5],[0,-23.5],[0,-8]]].map(ps=>ps.map(([x,y])=>({x,y})));
function connected(r){const free=new Set();for(let x=-44;x<=44;x++)for(let y=-52;y<=52;y++)if(!blocked({x:x*.5,y:y*.5},r))free.add(x+','+y);const seen=new Set(['0,-16']),q=[[0,-16]];for(let i=0;i<q.length;i++){const[x,y]=q[i];for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const k=(x+dx)+','+(y+dy);if(free.has(k)&&!seen.has(k)){seen.add(k);q.push([x+dx,y+dy]);}}}return{radius:r,freeCells:free.size,reachable:seen.size,connected:seen.size===free.size,routes:paths.map(ps=>ps.slice(1).every((p,i)=>clear(ps[i],p,r)))};}
const segDist=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);};
function sectorDistance(p,b,a,r,half){const q={x:p.x-b.x,y:p.y-b.y},d=Math.hypot(q.x,q.y),delta=Math.abs(Math.atan2(Math.sin(Math.atan2(q.y,q.x)-a),Math.cos(Math.atan2(q.y,q.x)-a)));if(delta<=half)return Math.max(0,d-r);return Math.min(...[-1,1].map(s=>segDist(p,b,{x:b.x+Math.cos(a+s*half)*r,y:b.y+Math.sin(a+s*half)*r})));}
const hit=(p,b,a,type,offset=0)=>type==='thrust'?segDist(p,b,{x:b.x+Math.cos(a)*6.2,y:b.y+Math.sin(a)*6.2})<=.42+.3:sectorDistance(p,b,a+offset,3.6,65*Math.PI/180)<=.3;
// The second aim is sampled from each candidate's position at t=.9, then stays fixed.
// This is not the runtime continuous collision solver or a proof for all positions.
const scenes=[['center',{x:0,y:0},{x:-3,y:0}],['edge',{x:20,y:0},{x:16.8,y:0}],['corner',{x:20,y:24},{x:17,y:21.6}],['plinth',{x:-7,y:-10},{x:-7,y:-13.5}]];
const examples=[];
for(const[name,start,body]of scenes)for(const action of ['A','B','C']){
 let found;
 for(let d=0;d<24&&!found;d++)for(let turn=0;turn<24&&!found;turn++){
  let p={...start},second,valid=true;const aim=Math.atan2(p.y-body.y,p.x-body.x),dt=1/120;
  for(let frame=0;frame<=444;frame++){
   const t=frame*dt;
   if(frame===108)second=Math.atan2(p.y-body.y,p.x-body.x);
   if(t>=.35){const angle=(t<2.7?d:turn)*Math.PI/12,next={x:p.x+Math.cos(angle)*4.2*dt,y:p.y+Math.sin(angle)*4.2*dt};if(!clear(p,next,.3)||Math.hypot(next.x-body.x,next.y-body.y)<1){valid=false;break;}p=next;}
   if(t>=2.4&&t<2.6&&hit(p,body,aim,action==='B'?'thrust':'sweep',action==='C'?-Math.PI/4:0)){valid=false;break;}
   if(t>=3.3&&t<3.5&&hit(p,body,second,action==='A'?'thrust':'sweep',action==='C'?Math.PI/4:0)){valid=false;break;}
  }
  if(valid)found={firstDirectionDeg:d*15,after2p7DirectionDeg:turn*15};
 }
 examples.push({scene:name,action,sampledEscape:found??null});
}
const r=stageReference(18),prior=stageReference(17),total=r.bossDps*r.bossSeconds;
const report={scope:'Design only: .5-grid connectivity, sampled route clearance, twelve isolated two-lock escape examples at 120Hz and formula arithmetic. No crowds, runtime integration, comprehensive escape proof, win rate or device QA.',boxes,connectivity:[connected(.3),connected(.7)],examples,budget:{...r,...stageGrowth(18),total,increasePercent:100*(total/(prior.bossDps*prior.bossSeconds)-1),clearCoins:440,holyEpicCost:1440},proposal:{forms:1,revivals:0,addedAchievements:2,weaponSeries:14,weaponForms:33}};
fs.writeFileSync(out+'/whitebox.json',JSON.stringify(report,null,2)+'\n');
const X=x=>270+x*10.5,Y=y=>367-y*10.5;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1020" height="740"><rect width="1020" height="740" fill="#151c26"/><style>text{font-family:Arial,'PingFang SC',sans-serif;fill:#eee7db}.small{font-size:16px;fill:#b6c4ce}</style><text x="30" y="42" font-size="26">18 · 错拍鸣庭 / Design whitebox</text><rect x="${X(-22)}" y="${Y(26)}" width="462" height="546" fill="#222e38" stroke="#8094a0"/>${boxes.map(b=>`<rect x="${X(b.x-b.hx)}" y="${Y(b.y+b.hy)}" width="${b.hx*21}" height="${b.hy*21}" fill="#6f8a91" stroke="#b5cccf"/>`).join('')}${paths.map((p,i)=>`<polyline points="${p.map(p=>X(p.x)+','+Y(p.y)).join(' ')}" fill="none" stroke="${['#8ed4b4','#e8ba79','#90b9e7'][i]}" stroke-width="2" stroke-dasharray="7 5"/>`).join('')}<circle cx="${X(0)}" cy="${Y(-8)}" r="5" fill="#fff"/><text x="${X(0)+10}" y="${Y(-8)+5}" class="small">Spawn</text><text x="35" y="688" class="small">x ±22 · y ±26 · player r0.3 · boss r0.7</text><text x="555" y="110" font-size="23">Two locks · one readable sequence</text>${[[210,'Sweep',0,240,'#eabb77'],[310,'Thrust',90,240,'#a8c6f2']].map(([y,label,x,w,color])=>`<text x="555" y="${y-25}" class="small">${label} / full 2.4s warning</text><rect x="${565+x}" y="${y}" width="${w}" height="18" fill="${color}" opacity=".45"/><rect x="${565+x+w}" y="${y-4}" width="20" height="26" fill="${color}"/>`).join('')}<text x="555" y="390" class="small">0.9s offset · second aim locks once</text><text x="555" y="425" class="small">Both start from the real, stationary body.</text><text x="555" y="460" class="small">One form · no revival · full recovery</text><text x="555" y="525" font-size="23">Boss total: ${total.toFixed(1)}</text><text x="555" y="560" class="small">440 clear gold · 14 weapon families</text><text x="555" y="625" class="small">Static design, not a playable stage.</text></svg>`;
fs.writeFileSync(out+'/layout.svg',svg);await sharp(Buffer.from(svg)).png().toFile(out+'/layout.png');
if(report.connectivity.some(x=>!x.connected||x.routes.some(v=>!v))||examples.some(x=>!x.sampledEscape))throw Error('Stage18 design whitebox failed');
console.log(JSON.stringify({connectivity:report.connectivity,examples,budget:report.budget},null,2));
