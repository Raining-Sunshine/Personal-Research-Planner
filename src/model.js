export const palette=['#8CB8F3','#A9C7AD','#B4A4DF','#E8B890','#E5A4AF','#E1CD83','#9CCBCD','#B4BBC6'];
export const dayKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const parseDay=s=>new Date(s+'T12:00:00');
export const addDays=(s,n)=>{let d=parseDay(s);d.setDate(d.getDate()+n);return dayKey(d)};
export const daysBetween=(a,b)=>Math.round((parseDay(b)-parseDay(a))/86400000);
export const uid=()=>crypto.randomUUID();
export const overlaps=(item,start,end)=>item.start<=end&&(item.end||item.start)>=start;
export const nextMilestone=(project,items)=>items.filter(x=>x.projectId===project.id&&x.type==='milestone'&&!x.done).sort((a,b)=>a.start.localeCompare(b.start))[0];
export function seed(today=dayKey()){
 const d=n=>addDays(today,n);
 return {demo:true,projects:[
 {id:'p1',title:'认知与交互研究',subtitle:'从问题出发，让想法落地',color:palette[0],flagColor:palette[0],start:d(-12),end:d(35)},
 {id:'p2',title:'个人网站 2.0',subtitle:'为作品留一个自己的空间',color:palette[1],flagColor:palette[1],start:d(-5),end:d(20)},
 {id:'p3',title:'阅读与写作',subtitle:'持续积累，也持续表达',color:palette[2],flagColor:palette[2],start:d(-8),end:d(50)}
 ],items:[
 {id:'t1',projectId:'p1',type:'task',title:'整理访谈记录',start:d(-2),end:d(2),note:'整理共性问题，标记值得继续追问的线索。\n参考资料：https://www.nngroup.com/articles/user-interviews/',color:palette[0],done:false},
 {id:'t2',projectId:'p1',type:'task',title:'完成研究框架',start:d(1),end:d(8),note:'把研究问题、方法和预期产出放在同一张图里。',color:palette[0],done:false},
 {id:'t3',projectId:'p1',type:'task',title:'阅读核心文献',start:d(-8),end:d(-1),note:'',color:palette[0],done:true},
 {id:'m1',projectId:'p1',type:'milestone',title:'研究方案定稿',start:d(7),end:d(7),note:'确认研究范围、招募计划与访谈提纲。',color:palette[0],done:false},
 {id:'e1',projectId:'p1',type:'event',title:'每周研究讨论',start:d(1),end:d(1),time:'14:00',note:'带上本周的发现与两个待讨论的问题。',color:palette[0],done:false},
 {id:'t4',projectId:'p2',type:'task',title:'设计首页与作品页',start:d(-1),end:d(5),note:'留白多一些，信息清晰一些。',color:palette[1],done:false},
 {id:'m2',projectId:'p2',type:'milestone',title:'第一版上线',start:d(14),end:d(14),note:'',color:palette[1],done:false},
 {id:'t5',projectId:'p3',type:'task',title:'写下本周阅读笔记',start:d(0),end:d(3),note:'选一个真正想清楚的问题，写下来。',color:palette[2],done:false},
 {id:'m3',projectId:'p3',type:'milestone',title:'完成十一月随笔',start:d(11),end:d(11),note:'',color:palette[2],done:false},
 {id:'e2',projectId:null,type:'event',title:'留一点时间给自己',start:d(0),end:d(0),time:'18:30',note:'散步、咖啡，或者什么也不做。',color:palette[3],done:false}
 ]};
}
export function validateState(data){
 const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 if(!record(data)||typeof data.demo!=='boolean'||!Array.isArray(data.projects)||!Array.isArray(data.items)||data.projects.length>250||data.items.length>5000) return false;
 const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(parseDay(s))&&dayKey(parseDay(s))===s;
 const color=s=>typeof s==='string'&&(s===''||/^#[\da-f]{6}$/i.test(s));
 const title=s=>typeof s==='string'&&s.trim().length>0&&s.length<=180;
 const id=s=>typeof s==='string'&&/^[a-z\d_-]{1,100}$/i.test(s);
 const ids=new Set();
 for(const p of data.projects){if(!record(p)||!id(p.id)||ids.has(p.id)||!title(p.title)||typeof p.subtitle!=='string'||p.subtitle.length>300||!date(p.start)||!date(p.end)||p.end<p.start||!color(p.color)||!color(p.flagColor))return false;ids.add(p.id);}
 const itemIds=new Set();
 for(const i of data.items){if(!record(i)||!id(i.id)||itemIds.has(i.id)||!title(i.title)||!['task','event','milestone'].includes(i.type)||!date(i.start)||!date(i.end)||i.end<i.start||(i.type==='milestone'&&i.start!==i.end)||!color(i.color)||typeof i.done!=='boolean'||typeof i.note!=='string'||i.note.length>20000||(i.projectId!==null&&(!id(i.projectId)||!ids.has(i.projectId)))||(i.projectId===null&&i.type!=='event')||(i.time!==undefined&&(typeof i.time!=='string'||(i.time!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(i.time)))))return false;itemIds.add(i.id);}
 return true;
}
export function normalizeState(data){
 return {demo:data.demo,projects:data.projects.map(p=>({id:p.id,title:p.title,subtitle:p.subtitle,start:p.start,end:p.end,color:p.color,flagColor:p.flagColor})),items:data.items.map(i=>({id:i.id,projectId:i.projectId,type:i.type,title:i.title,start:i.start,end:i.end,time:i.time||'',note:i.note,color:i.color,done:i.done}))};
}
