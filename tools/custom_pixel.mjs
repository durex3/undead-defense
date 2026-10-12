import sharp from 'sharp';
import fs from 'node:fs';
fs.mkdirSync('art/pixel',{recursive:true});
for(let f=0;f<4;f++){
 const lift=f%2;const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="20" shape-rendering="crispEdges"><g transform="translate(0 ${lift})"><path d="M3 6H6V4H15V5H19V7H22V14H19V16H5V14H2V8H3Z" fill="#251f28"/><path d="M4 7H7V5H14V6H18V8H21V13H18V15H6V13H3V9H4Z" fill="#77604d"/><path d="M6 6H13V7H16V9H6Z" fill="#a38a68"/><path d="M4 9H7V13H4ZM10 11H15V14H10Z" fill="#4a3836"/><path d="M16 4H19V8H16Z" fill="#4a3836"/><path d="M18 8H20V10H18Z" fill="#ffcc79"/><path d="M20 12H23V14H20Z" fill="#b99978"/><path d="M18 12H20V16H17V14H18Z" fill="#f1e7cb"/><path d="M3 8H1V11H3Z" fill="#a38a68"/></g><path d="M${5+lift} 16H9V19H${5+lift}ZM${15-lift} 16H19V19H${15-lift}Z" fill="#302831"/></svg>`;
 await sharp(Buffer.from(svg)).png().toFile(`art/pixel/boar_run_anim_f${f}.png`);
}
const ghost=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="20" shape-rendering="crispEdges"><path d="M5 2H11V3H13V5H14V16H12V18H10V16H7V18H5V16H2V6H3V4H5Z" fill="#48678f"/><path d="M5 4H11V5H12V15H10V16H8V14H5V16H4V6H5Z" fill="#adcde0"/><path d="M5 5H10V7H5Z" fill="#e8f3ed"/><path d="M5 8H7V11H5ZM9 8H11V11H9Z" fill="#293848"/></svg>`;
await sharp(Buffer.from(ghost)).png().toFile('art/pixel/ghost.png');
// Original pixel silhouettes for the expansion enemies.
for(let f=0;f<4;f++){
 const bob=f%2;
 const shapes={
 slime:`<g transform="translate(0 ${bob})"><path d="M3 15V9H5V6H9V4H15V6H19V9H21V15H19V18H5V16Z" fill="#223842"/><path d="M5 14V9H7V7H10V6H14V7H17V10H19V15H16V16H7V15Z" fill="#64bc91"/><path d="M7 9V8H11V7H14V9Z" fill="#b4f0b4"/><path d="M7 11H10V13H7ZM14 11H17V13H14ZM10 14H14V15H10Z" fill="#223842"/></g>`,
 banshee:`<g transform="translate(0 ${bob})"><path d="M8 1H16V3H18V8H17V11H20V14H23V16H18V15H17V18H19V21H14V19H11V21H6V19H8V15H5V17H1V15H4V12H7V9H6V4H8Z" fill="#392940"/><path d="M9 3H15V4H16V9H14V11H16V16H14V19H12V17H9V19H8V17H10V11H8V8H8V4Z" fill="#aa8bc4"/><path d="M10 4H14V6H10Z" fill="#e7d6df"/><path d="M9 7H11V9H9ZM13 7H15V9H13ZM11 10H13V13H11Z" fill="#32203e"/><path d="M4 13H8V15H4ZM17 12H20V14H17Z" fill="#cfb7d9"/></g>`,
 wisp:`<g transform="translate(0 ${bob})"><path d="M7 1H13V3H15V8H13V11H9V10H6V7H5V4H7Z" fill="#284353"/><path d="M8 3H12V4H13V7H11V9H8V7H7V5H8Z" fill="#8ce9d4"/><path d="M9 4H11V6H9Z" fill="#edffd0"/><path d="M12 10H14V13H18V15H20V22H12V15H14V13H12Z" fill="#413e45"/><path d="M14 16H18V20H14Z" fill="#f6be63"/><path d="M15 16H17V19H15Z" fill="#fff0ab"/><path d="M7 9H9V13H7V16H5V13H6V11H7Z" fill="#58b3b4"/></g>`};
 for(const [kind,shape] of Object.entries(shapes))await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" shape-rendering="crispEdges">${shape}</svg>`)).png().toFile(`art/pixel/${kind}_run_anim_f${f}.png`);
}
