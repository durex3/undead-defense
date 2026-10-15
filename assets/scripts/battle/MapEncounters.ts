/** Spatial rhythm only: enemy counts, stats, caps, rests and attack warnings stay in their directors. */
export function mapApproach(stage:number,time:number,wave:number,jitter:number){
 if(time<30)return jitter*Math.PI*2;
 const phase=time<60?0:time<130?1:time<225?2:time<350?3:4;
 const axes=stage===14?[0,Math.PI/2,Math.PI/4,0,Math.PI/2]:[Math.PI/4,-Math.PI/4,0,Math.PI/2,Math.PI/4];
 return axes[phase]+(wave%2?Math.PI:0)+(jitter-.5)*.45;
}
export function mapPackOffset(stage:number,time:number,wave:number,index:number,count:number){
 if(stage===15&&time>=135&&wave%2===0){
  // Three separated fronts, with more than a full quadrant left between them.
  const sector=Math.floor(index*3/count),start=Math.ceil(sector*count/3),end=Math.ceil((sector+1)*count/3);
  return sector*Math.PI*2/3+(index-(start+end-1)/2)*.07;
 }
 return (index>=count/2?(stage===14?Math.PI*.85:Math.PI):0)+index*(stage===14?.12:.15);
}
export function mapRouteHint(stage:number,time:number){
 if(stage===14)return time<60?'中央练习绕盾 · 两侧缺口可转线':time<130?'弩线锁定后横移 · 通过侧路接近后排':time<225?'盾弩交错推进 · 穿阵或引入地面区':time<350?'短墙两端均可绕行 · 留意侧面突袭':'利用中央与侧路换线 · 冲撞后抓住反击空档';
 return time<60?'开阔沙道引开追兵 · 岩岛两侧都能通过':time<130?'绕岩岛换线 · 避开喷砂与潜沙落点':time<225?'虫群分路涌入 · 移动清路再收经验':time<350?'绕岩岛聚拢敌群 · 清理孵出的幼虫':'穿过斜向沙道转场 · 抓住出土停顿';
}
