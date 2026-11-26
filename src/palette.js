// HEX values transcribed from the five user-provided reference sheets.
// Repeated colors stay in the source lists for traceability and are deduplicated below.
export const sourcePalette=[
 ['FFF2D3','DDCF6C','ABD4DE','A79F98','8C9B96','937770','F7CAC9','92A8D1','DFABA7','7683A9','DAB469','DDA580','98AABE','E4D2BE','A8736B','AB8B89','BAAEA9','859FA4','82A097'],
 ['DDC19A','CB7431','87431B','5E281C','D7DAC9','A9B8A4','D8D9D3','4E5C4F','F2CF70','F58E69','8B8B59'],
 ['D09999','DFB290','C1CDCA','731A2C','F8E9B8','D7B33B','2A4925','C9C9C9','121D40','1D2B54','986F31','B7863D','737373'],
 ['06382C','537469','9F9675','D4E3DA','737373','F9C100','D8AB00','967918','5E4600','000000','A1322A','E8AC39','F8F7B6','482C25','725620','8E7986','F7E7E1','E9E0DE','C8A7A2','A48678','807594','8E7986'],
 ['BF9065','D7BEA3','A59884','DCBFAC','D3BFA3','D3997D','7D6F5C','B09F88','D2A679','B88C85','778875','EDDCBF','75543D','BB8E6B','DDB02E','C15A3F','D28264','DDAB8F','947770','DDB02E','92A08E','728D5D','657A6D','869B9A']
];
export function colorMetrics(hex){
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
 const [r,g,b]=rgb,max=Math.max(...rgb),min=Math.min(...rgb),delta=max-min;
 const lightness=(max+min)/2,saturation=delta===0?0:delta/(1-Math.abs(2*lightness-1));
 let hue=delta===0?0:max===r?60*(((g-b)/delta)%6):max===g?60*((b-r)/delta+2):60*((r-g)/delta+4);
 if(hue<0)hue+=360;
 const linear=rgb.map(c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4));
 const luminance=0.2126*linear[0]+0.7152*linear[1]+0.0722*linear[2];
 return {hue,saturation,lightness,luminance};
}
export const paletteFamilies=[
 {id:'red',zh:'红 · 粉',en:'Red · pink'},
 {id:'orange',zh:'橙 · 棕',en:'Orange · brown'},
 {id:'yellow',zh:'黄 · 金',en:'Yellow · gold'},
 {id:'green',zh:'绿色',en:'Green'},
 {id:'teal',zh:'青色',en:'Teal'},
 {id:'blue',zh:'蓝色',en:'Blue'},
 {id:'purple',zh:'紫色',en:'Purple'},
 {id:'neutral',zh:'中性色',en:'Neutrals'}
].map(family=>({...family,colors:[]}));
for(const hex of [...new Set(sourcePalette.flat())].map(hex=>'#'+hex)){
 const {hue}=colorMetrics(hex);
 const neutral=['#A79F98','#BAAEA9','#D8D9D3','#C9C9C9','#737373','#000000','#E9E0DE'].includes(hex);
 const family=neutral?'neutral':hue<15||hue>=345?'red':hue<38?'orange':hue<75?'yellow':hue<165?'green':hue<200?'teal':hue<260?'blue':'purple';
 paletteFamilies.find(group=>group.id===family).colors.push(hex);
}
for(const group of paletteFamilies)group.colors.sort((a,b)=>colorMetrics(b).luminance-colorMetrics(a).luminance);
export const palette=paletteFamilies.flatMap(group=>group.colors);
export const defaultColors={research:'#92A8D1',website:'#A9B8A4',writing:'#807594',event:'#DDA580'};
