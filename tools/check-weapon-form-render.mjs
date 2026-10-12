import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
function load(file, deps) {
 const src=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};vm.runInNewContext(src,{exports,require:(key)=>deps[key],Math});return exports;
}
const forms=load('assets/scripts/battle/WeaponForms.ts',{});
const skills=Object.keys(forms.WEAPON_FORMS);
const colors=Object.fromEntries(skills.map(k=>[k,'#abcdef']));
class Color {constructor(r=171,g=205,b=239,a=255){this.hex=`rgb(${r},${g},${b})`;this.a=a;}fromHEX(h){this.hex=h;return this;}}
const expansion=load('assets/scripts/presentation/ExpansionPainter.ts',{cc:{Color},'../battle/WeaponForms':forms,'../battle/SurvivalConfig':{COLORS:colors}});
const companions=load('assets/scripts/presentation/CompanionForms.ts',{cc:{Color}});
const {BattlePainter}=load('assets/scripts/presentation/BattlePainter.ts',{
 '../battle/WeaponForms':forms,'../battle/BossSystem':{bossExposed:()=>false},
 './ExpansionPainter':expansion,cc:{Color},
 '../battle/SurvivalConfig':{COLORS:colors,WEAPONS:skills,isElite:()=>false,isLarge:()=>false}
});
const coverage=skills;
const cells=[];
for(const skill of coverage) {
 const signatures=[];
 for(const level of [1,4,7,10]) {
  const calls=[];const g=new Proxy({}, {get:(o,k)=>o[k]??((...args)=>calls.push([k,...args])),set:(o,k,v)=>(calls.push(['style',k,v]),o[k]=v,true)});
  const w={skills:Object.fromEntries(skills.map(k=>[k,k===skill?level:0])),evolutions:{},time:1,active:true,stageId:1,player:{x:0,y:0},zones:[],enemies:[],gems:[],rings:[],shots:[],hazards:[],expansion:{fields:[],mines:[],bats:[]},arsenal:{links:[],markers:[],totems:[],bolts:[]}};
  w.weaponEvolution=(key)=>w.evolutions[key] || (w.skills[key]>=7?'signature':undefined);
  if(['water','poison','void'].includes(skill))w.expansion.fields.push({skill,x:0,y:0,radius:1.15,due:0,created:-1,origin:{x:0,y:0}});
  else if(skill==='mine')w.expansion.mines.push({x:0,y:0,armed:0});
  else if(skill==='bat')w.expansion.bats.push({x:0,y:0,id:0});
  else if(['chain','soul'].includes(skill))w.arsenal.links.push({active:true,skill,x:0,y:0,endX:1.4,endY:.5});
  else if(['pillar','meteor'].includes(skill))w.arsenal.markers.push({active:true,skill,x:0,y:0,radius:1.5,due:2,created:0});
  else if(skill==='totem')w.arsenal.totems.push({active:true,x:0,y:0});
  else if(skill==='ice')w.rings.push({x:0,y:0,radius:2,age:.2});
  else if(skill!=='blade')w.shots.push({skill,x:0,y:0,vx:8,vy:4,age:.2});
  new BattlePainter(g).draw(w,.016,[]);
  if(skill==='blade')companions.drawBladeForm(g,level);
  if(skill==='ghost')companions.drawGhostForm(g,level,false,1);
  const geometry=calls.filter(c=>c[0]!=='style');
  cells.push({skill,level,calls});
  const signature=JSON.stringify(geometry);assert(!signature.includes('null'),`${skill} has non-finite geometry`);signatures.push(signature);
 }
 assert.equal(new Set(signatures).size,4,`${skill} must have four different drawing geometries`);
}
console.log(`Verified four distinct render geometries at levels 1/4/7/10 for ${coverage.length} weapons: ${coverage.join(', ')}`);

function svg(calls) {
 let fill='#abcdef',stroke='#abcdef',width=2,path='',out='';
 const emit=(type)=>{if(path)out+=`<path d="${path}" fill="${type==='fill'?fill:'none'}" stroke="${type==='stroke'?stroke:'none'}" stroke-width="${width}" stroke-linejoin="round"/>`;path='';};
 const ellipse=(x,y,rx,ry)=>{path+=` M ${x+rx} ${y} A ${rx} ${ry} 0 1 0 ${x-rx} ${y} A ${rx} ${ry} 0 1 0 ${x+rx} ${y}`;};
 for(const [method,...a] of calls) {
  if(method==='style'){const [k,v]=a;if(k==='fillColor')fill=v.hex;if(k==='strokeColor')stroke=v.hex;if(k==='lineWidth')width=v;continue;}
  if(method==='moveTo')path+=` M ${a[0]} ${a[1]}`;
  if(method==='lineTo')path+=` L ${a[0]} ${a[1]}`;
  if(method==='close')path+=' Z';
  if(method==='circle')ellipse(a[0],a[1],a[2],a[2]);
  if(method==='ellipse')ellipse(...a);
  if(method==='rect'||method==='roundRect'){const [x,y,w,h]=a;path+=` M ${x} ${y} h ${w} v ${h} h ${-w} Z`;}
  if(method==='arc'){const [x,y,r,start,end]=a;for(let i=0;i<=32;i++){const t=start+(end-start)*i/32;path+=`${i?' L':' M'} ${x+Math.cos(t)*r} ${y+Math.sin(t)*r}`;}}
  if(method==='quadraticCurveTo')path+=` Q ${a.join(' ')}`;
  if(method==='bezierCurveTo')path+=` C ${a.join(' ')}`;
  if(method==='fill'||method==='stroke')emit(method);
 }
 return out;
}
const width=900,height=coverage.length*155+45;
let sheet=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101826"/>`;
for(let col=0;col<4;col++)sheet+=`<text x="${210+col*190}" y="25" fill="#e5edff" font-size="17">Level ${[1,4,7,10][col]}</text>`;
for(const {skill,level,calls} of cells){const row=coverage.indexOf(skill),col=[1,4,7,10].indexOf(level);if(col===0)sheet+=`<text x="12" y="${row*155+110}" fill="#e5edff" font-size="18">${skill}</text>`;sheet+=`<g transform="translate(${230+col*190} ${row*155+115}) scale(.8 -.8)">${svg(calls)}</g>`;}
sheet+='</svg>';
fs.mkdirSync('temp/weapon-forms',{recursive:true});fs.writeFileSync('temp/weapon-forms/contact-sheet.svg',sheet);
const sharp=(await import('sharp')).default;await sharp(Buffer.from(sheet)).png().toFile('temp/weapon-forms/contact-sheet.png');
console.log('Wrote temp/weapon-forms/contact-sheet.svg and .png (actual Graphics call geometry; base sprite art excluded).');
