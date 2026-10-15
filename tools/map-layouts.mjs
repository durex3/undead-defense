import fs from 'node:fs';
import {SIEGE_WALLS,SIEGE_ROUTES} from '../temp/tests/battle/SiegeMap.mjs';
import {SAND_ROCKS,SAND_NESTS,SAND_TRAIL} from '../temp/tests/battle/SandMap.mjs';
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="790" viewBox="0 0 1200 790"><rect width="1200" height="790" fill="#151b29"/><style>text{font-family:system-ui,sans-serif;fill:#e7e0ca} .note{font-size:16px;fill:#acbbc8}</style>';
function panel(cx,title,boxes,sand=false){const cy=390,scale=10;svg+=`<text x="${cx}" y="42" text-anchor="middle" font-size="26">${title}</text><g transform="translate(${cx},${cy}) scale(${scale},${-scale})"><rect x="-23" y="-27" width="46" height="54" fill="${sand?'#775240':'#39353a'}" stroke="#82909d" stroke-width=".18"/>`;
 if(sand){svg+=`<path d="${SAND_TRAIL.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')}" stroke="#c7a46a" fill="none" stroke-width=".375" opacity=".55"/>`;for(const p of SAND_NESTS)svg+=`<ellipse cx="${p.x}" cy="${p.y}" rx="2" ry="1.3" fill="#392d35" stroke="#b89b66" stroke-width=".2"/>`;}else for(const p of SIEGE_ROUTES.slice(1))svg+=`<path d="M 0 0 L ${p.x} ${p.y}" stroke="#b6a17d" stroke-width=".7" opacity=".4"/>`;
 svg+='<circle cx="0" cy="0" r="6" fill="none" stroke="#7ecec1" stroke-width=".15" stroke-dasharray=".5 .5"/>';
 for(const b of boxes)svg+=`<rect x="${b.x-b.halfWidth}" y="${b.y-b.halfHeight}" width="${b.halfWidth*2}" height="${b.halfHeight*2}" fill="${sand?'#62535a':'#64514b'}" stroke="#cc9b6f" stroke-width=".2"/>`;
 svg+=`<circle cx="0" cy="${sand?-8:0}" r=".5" fill="#fff4b7"/></g><text x="${cx}" y="710" text-anchor="middle" class="note">${sand?'斜向转场 · 分散岩岛 · 每个岩岛均可双向绕行':'中央开阔区 · 错位短墙 · 左右侧路循环'}</text>`;
}
panel(300,'第一关 · 铁棘围城',SIEGE_WALLS);panel(900,'第二关 · 赤砂虫巢',SAND_ROCKS,true);
svg+='<text x="600" y="755" text-anchor="middle" class="note">黄点：起点　虚线圈：中央6单位净空　巢纹：装饰地标　墙体挡移动，不挡攻击</text></svg>';
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/maps-0.22.1.svg',svg);console.log('artifacts/maps-0.22.1.svg');
