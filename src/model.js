import {recurringOverlap,validRecurrence} from './recurrence.js';
import {defaultColors} from './palette.js';
export const dayKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
// Use local noon for date-only values so timezone conversion does not move a
// task into the previous day. daysBetween rounds across daylight-saving shifts.
export const parseDay=s=>new Date(s+'T12:00:00');
export const addDays=(s,n)=>{let d=parseDay(s);d.setDate(d.getDate()+n);return dayKey(d)};
export const daysBetween=(a,b)=>Math.round((parseDay(b)-parseDay(a))/86400000);
export const uid=()=>crypto.randomUUID();
export const overlaps=recurringOverlap;
export const nextMilestone=(project,items)=>items.filter(x=>x.projectId===project.id&&x.type==='milestone'&&!x.done).sort((a,b)=>a.start.localeCompare(b.start))[0];
export function seed(today=dayKey()){
 const d=n=>addDays(today,n);
 return {demo:true,projects:[
 {id:'p1',title:'认知与交互研究',subtitle:'从问题出发，让想法落地',color:defaultColors.research,flagColor:defaultColors.research,start:d(-12),end:d(35)},
 {id:'p2',title:'个人网站 2.0',subtitle:'为作品留一个自己的空间',color:defaultColors.website,flagColor:defaultColors.website,start:d(-5),end:d(20)},
 {id:'p3',title:'阅读与写作',subtitle:'持续积累，也持续表达',color:defaultColors.writing,flagColor:defaultColors.writing,start:d(-8),end:d(50)}
 ],items:[
 {id:'t1',projectId:'p1',type:'task',title:'整理访谈记录',start:d(-2),end:d(2),note:'整理共性问题，标记值得继续追问的线索。\n参考资料：https://www.nngroup.com/articles/user-interviews/',color:defaultColors.research,done:false},
 {id:'t2',projectId:'p1',type:'task',title:'完成研究框架',start:d(1),end:d(8),note:'把研究问题、方法和预期产出放在同一张图里。',color:defaultColors.research,done:false},
 {id:'t3',projectId:'p1',type:'task',title:'阅读核心文献',start:d(-8),end:d(-1),note:'',color:defaultColors.research,done:true},
 {id:'m1',projectId:'p1',type:'milestone',title:'研究方案定稿',start:d(7),end:d(7),note:'确认研究范围、招募计划与访谈提纲。',color:defaultColors.research,done:false},
 {id:'e1',projectId:'p1',type:'event',title:'每周研究讨论',start:d(1),end:d(1),time:'14:00',note:'带上本周的发现与两个待讨论的问题。',color:defaultColors.research,done:false},
 {id:'t4',projectId:'p2',type:'task',title:'设计首页与作品页',start:d(-1),end:d(5),note:'留白多一些，信息清晰一些。',color:defaultColors.website,done:false},
 {id:'m2',projectId:'p2',type:'milestone',title:'第一版上线',start:d(14),end:d(14),note:'',color:defaultColors.website,done:false},
 {id:'t5',projectId:'p3',type:'task',title:'写下本周阅读笔记',start:d(0),end:d(3),note:'选一个真正想清楚的问题，写下来。',color:defaultColors.writing,done:false},
 {id:'m3',projectId:'p3',type:'milestone',title:'完成十一月随笔',start:d(11),end:d(11),note:'',color:defaultColors.writing,done:false},
 {id:'e2',projectId:null,type:'event',title:'留一点时间给自己',start:d(0),end:d(0),time:'18:30',note:'散步、咖啡，或者什么也不做。',color:defaultColors.event,done:false}
 ]};
}
export function validateState(data){
 // Validate imported files and API writes before they reach React or storage.
 // Return false for malformed records rather than allowing rendering crashes.
 const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 if(!record(data)||typeof data.demo!=='boolean'||!Array.isArray(data.projects)||!Array.isArray(data.items)||data.projects.length>250||data.items.length>5000) return false;
 const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(parseDay(s))&&dayKey(parseDay(s))===s;
 const color=s=>typeof s==='string'&&(s===''||/^#[\da-f]{6}$/i.test(s));
 const title=s=>typeof s==='string'&&s.trim().length>0&&s.length<=180;
 const id=s=>typeof s==='string'&&/^[a-z\d_-]{1,100}$/i.test(s);
 const ids=new Set();
 for(const p of data.projects){if(!record(p)||!id(p.id)||ids.has(p.id)||!title(p.title)||typeof p.subtitle!=='string'||p.subtitle.length>300||!date(p.start)||!date(p.end)||p.end<p.start||!color(p.color)||!color(p.flagColor))return false;ids.add(p.id);}
 const sourceIds=new Set();
 if(data.calendars!==undefined){
  if(!Array.isArray(data.calendars)||data.calendars.length>30)return false;
  for(const c of data.calendars){
   if(!record(c)||!id(c.id)||sourceIds.has(c.id)||!title(c.name)||!['file','url','outlook'].includes(c.kind)||!['calendar','project'].includes(c.mode)||!date(c.start)||!date(c.end)||c.end<c.start||daysBetween(c.start,c.end)>366||!color(c.color)||typeof c.url!=='string'||c.url.length>4096||typeof c.calendarId!=='string'||c.calendarId.length>1000||typeof c.syncedAt!=='string'||c.syncedAt.length>40||(c.mode==='project'&&!ids.has(c.projectId)))return false;
   sourceIds.add(c.id);
  }
 }
 const itemIds=new Set();
 for(const i of data.items){if(!record(i)||!id(i.id)||itemIds.has(i.id)||!title(i.title)||!['task','event','milestone'].includes(i.type)||!date(i.start)||!date(i.end)||i.end<i.start||(i.type==='milestone'&&i.start!==i.end)||!color(i.color)||typeof i.done!=='boolean'||typeof i.note!=='string'||i.note.length>20000||(i.projectId!==null&&(!id(i.projectId)||!ids.has(i.projectId)))||(i.projectId===null&&i.type!=='event')||(i.time!==undefined&&(typeof i.time!=='string'||(i.time!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(i.time)))))return false;if(!validRecurrence(i.recurrence,i,date)||(i.calendarOnly!==undefined&&typeof i.calendarOnly!=='boolean')||(i.calendarOnly&&(i.type!=='event'||i.projectId!==null))||(i.sourceId!==undefined&&(!sourceIds.has(i.sourceId)||i.type!=='event'))||(i.sourceUid!==undefined&&(typeof i.sourceUid!=='string'||i.sourceUid.length>2000)))return false;itemIds.add(i.id);}
 return true;
}
export function normalizeState(data){
 // Persist only known fields; extra properties from an import are not trusted.
 return {demo:data.demo,calendars:(data.calendars||[]).map(c=>({id:c.id,name:c.name,kind:c.kind,mode:c.mode,projectId:c.mode==='project'?c.projectId:null,color:c.color,start:c.start,end:c.end,url:c.url,calendarId:c.calendarId,syncedAt:c.syncedAt})),projects:data.projects.map(p=>({id:p.id,title:p.title,subtitle:p.subtitle,start:p.start,end:p.end,color:p.color,flagColor:p.flagColor})),items:data.items.map(i=>({id:i.id,projectId:i.projectId,type:i.type,title:i.title,start:i.start,end:i.end,time:i.time||'',note:i.note,color:i.color,done:i.done,...(i.recurrence?{recurrence:{frequency:i.recurrence.frequency,interval:i.recurrence.interval,until:i.recurrence.until||'',...(i.recurrence.frequency==='weekly'?{weekdays:i.recurrence.weekdays}:{})}}:{}),...(i.calendarOnly?{calendarOnly:true}:{}),...(i.sourceId?{sourceId:i.sourceId,sourceUid:i.sourceUid||''}:{})}))};
}
