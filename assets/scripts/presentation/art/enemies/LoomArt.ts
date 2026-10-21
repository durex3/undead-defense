import type {Graphics} from 'cc';
import type {SurvivalWorld} from '../../../battle/SurvivalWorld';
import type {Enemy} from '../../../battle/SurvivalTypes';
import type {EnemyArt} from '../EnemyCatalog';
import type {Pose} from '../Actor';
import {Silhouette,detailPoly,detailLine,detailEllipse} from '../Brush';
/** Charred wooden looms, suspended cocoons and skeletal shuttle legs. */
export function drawLoomBody(g:Graphics,w:SurvivalWorld,e:Enemy,art:EnemyArt,p:Pose){
 const c=art.palette,k=e.kind==='minion'?'ragbound':e.kind,s=new Silhouette(g,p,c.base,c.outline,2.5),gait=p.stride;
 const poly=(v:[number,number][],color=c.light)=>detailPoly(g,p,v,color),line=(a:[number,number],b:[number,number],color=c.metal,width=2)=>detailLine(g,p,a,b,color,width),oval=(x:number,y:number,rx:number,ry:number,color=c.shade)=>detailEllipse(g,p,x,y,rx,ry,color);
 if(k==='ragbound'){
  s.poly([[-18,8],[-23,25],[-12,39],[7,42],[21,28],[16,9]]);
  for(const x of [-12,10])s.poly([[x-4,14],[x-8-gait,2],[x+7-gait,0],[x+4,14]]);s.commit();
  poly([[-14,31],[-5,36],[10,29],[13,13],[-10,15]],c.cloth);for(let i=0;i<3;i++)line([-12,20+i*5],[10,18+i*5],c.bone,1.4);
  oval(0,34,8,6,c.bone);oval(-3,35,2,2,c.outline);oval(3,35,2,2,c.outline);return;
 }
 const boss=k==='boss',warden=k==='twinweftwarden',jailer=k==='shuttlejailer',crawler=k==='shuttlecrawler',cocoon=k==='hemcocoon';
 if(boss||warden||k==='weftbinder'){
  const wide=boss?58:warden?34:21,top=boss?116:warden?95:75;
  s.poly([[-wide,10],[-wide-6,top-10],[-wide+5,top],[wide-5,top],[wide+6,top-10],[wide,10],[wide-10,10],[wide-12,top-16],[-wide+12,top-16],[-wide+10,10]]);
  for(const x of [-wide+8,wide-8])s.poly([[x-5,18],[x-10-gait,2],[x+9-gait,0],[x+5,18]]);
  if(boss)for(const x of [-22,22])s.poly([[x-4,16],[x-9+gait,0],[x+6+gait,0],[x+5,16]]);s.commit();
  for(let i=0;i<(boss?3:warden?2:1);i++){const x=(i-((boss?3:warden?2:1)-1)/2)*(boss?27:23);oval(x,top-15-(i%2)*9,boss?11:8,13,c.metal);line([x,top-29],[x,24],c.cloth,3);for(const d of [-1,1])line([x+d*6,top-26],[x+d*6,29],c.bone,1);}
  const faceY=boss?65:45;poly([[-13,faceY+14],[13,faceY+14],[17,faceY-4],[0,faceY-16],[-17,faceY-4]],c.bone);for(const x of [-6,6])oval(x,faceY+3,3,4,c.outline);
  const open=e.state==='recover';poly([[-wide+13,24],[0,open?5:17],[wide-13,24],[0,33]],open?c.eye:c.shade);
  for(const side of [-1,1])line([side*(wide-6),top-20],[side*(wide+12),34],c.metalLight,4);
  if(boss)for(let i=0;i<e.bossPhase;i++)poly([[-30+i*30,top+7],[-24+i*30,top+17],[-18+i*30,top+7]],c.accent);return;
 }
 if(cocoon){
  s.poly([[-17,19],[-22,58],[-8,78],[9,78],[23,58],[17,19],[0,7]]);
  for(const x of [-25,25])for(const y of [7,20])s.poly([[x*.5,y+15],[x-gait,y+5],[x*1.2-gait,y],[x*.7,y+6]]);s.commit();
  oval(0,45,15,25,c.cloth);for(let i=0;i<5;i++)line([-15,27+i*8],[15,31+i*8],i%2?c.bone:c.metalLight,2);poly([[-6,58],[0,64],[6,58],[0,46]],c.eye);return;
 }
 const wide=jailer?49:33,top=jailer?68:42;
 s.poly([[-wide,12],[-wide+5,top-8],[-15,top],[wide-6,top-5],[wide,11]]);
 for(const side of [-1,1])for(let i=0;i<2;i++)s.poly([[side*(wide-10),15+i*10],[side*(wide+10)+gait,8+i*4],[side*(wide+13)+gait,i*4],[side*(wide-5),8+i*10]]);s.commit();
 poly([[-wide+8,top-11],[wide-9,top-8],[wide-18,17],[-wide+13,18]],c.cloth);
 for(const x of [-18,18]){oval(x,18,11,12,c.metal);oval(x,18,5,6,c.outline);line([x-7,11],[x+7,25],c.bone,2);}
 const jaw=jailer?24:16;for(const side of [-1,1])poly([[side*5,top-14],[side*jaw,top+5],[side*(jaw+5),top-6],[side*12,top-26]],c.bone);
 line([-wide+8,top-10],[wide-8,top-13],c.metalLight,3);oval(0,top-15,4,3,c.eye);
}
