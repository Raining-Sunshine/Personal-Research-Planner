import fs from 'node:fs/promises';
import {palette,paletteFamilies} from '../src/palette.js';

// Generate the documentation swatch sheet from the same data used by the app.
// This is a color-data preview, not a screenshot of a user's private records.
const width=1120,columns=10,cellWidth=87,rowHeight=72;
let y=138;
const blocks=[];
for(const group of paletteFamilies){
 const height=Math.ceil(group.colors.length/columns)*rowHeight+32;
 blocks.push('<text x="42" y="'+(y+22)+'" font-size="16" font-weight="600">'+group.zh+'</text>');
 blocks.push('<text x="42" y="'+(y+44)+'" font-size="11">'+group.en+'</text>');
 group.colors.forEach((hex,index)=>{
  const x=186+(index%columns)*cellWidth,cy=y+Math.floor(index/columns)*rowHeight;
  blocks.push('<circle cx="'+(x+28)+'" cy="'+(cy+17)+'" r="18" fill="'+hex+'" stroke="#17191d" stroke-opacity=".12"/>');
  blocks.push('<text x="'+(x+28)+'" y="'+(cy+51)+'" text-anchor="middle" font-size="11">'+hex+'</text>');
 });
 blocks.push('<line x1="42" x2="1078" y1="'+(y+height-14)+'" y2="'+(y+height-14)+'" stroke="#e5e9ee"/>');
 y+=height;
}
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+(y+38)+'" viewBox="0 0 '+width+' '+(y+38)+'"><rect width="100%" height="100%" rx="18" fill="#fff"/><g fill="#17191d" font-family="Arial, Noto Sans SC, sans-serif"><text x="42" y="58" font-size="30" font-weight="700">Planner · 预设颜色</text><text x="42" y="91" font-size="14">'+palette.length+' unique HEX colors · 按色系排列，同色系从浅到深</text>'+blocks.join('')+'<text x="42" y="'+(y+15)+'" font-size="12">Source: src/palette.js · 取自用户提供的五张色卡，重复色号已合并。</text></g></svg>';
await fs.mkdir('docs/previews',{recursive:true});
await fs.writeFile('docs/previews/palette.svg',svg);
console.log('Generated docs/previews/palette.svg with '+palette.length+' colors.');
