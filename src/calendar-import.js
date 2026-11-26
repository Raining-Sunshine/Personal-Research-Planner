import ICAL from 'ical.js';
const MAX=2000;
const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const time=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
export function parseICS(text,start,end){
 if(new TextEncoder().encode(text).length>2000000)throw Error('Calendar file exceeds 2 MB / 日历文件超过 2 MB');
 const root=new ICAL.Component(ICAL.parse(text));
 if(root.name!=='vcalendar')throw Error('Invalid ICS / 无效的 ICS 文件');
 // Timezone definitions travel with the feed; never silently guess an unknown TZID.
 for(const c of root.getAllSubcomponents('vtimezone'))ICAL.TimezoneService.register(new ICAL.Timezone({component:c}));
 const components=root.getAllSubcomponents('vevent'),events=[],masters=[],exceptions=new Map();
 for(const c of components){
  for(const name of ['dtstart','dtend','recurrence-id']){const p=c.getFirstProperty(name),tz=p?.getParameter('tzid');if(tz&&!ICAL.TimezoneService.has(tz))throw Error('Unsupported timezone / 未识别的时区: '+tz)}
  const e=new ICAL.Event(c);if(!e.uid)throw Error('Missing event UID / 日历事件缺少 UID');if(e.isRecurrenceException()){const list=exceptions.get(e.uid)||[];list.push(e);exceptions.set(e.uid,list)}else masters.push(e);
 }
 const floor=new Date(start+'T00:00:00'),ceil=new Date(end+'T23:59:59.999');
 let steps=0;
 function add(e,s,f,identity){
  if(e.component.getFirstPropertyValue('status')==='CANCELLED')return;
  const a=s.toJSDate(),b=f.toJSDate();
  // ICS DTEND is exclusive for all-day events; Planner date ranges are inclusive.
  if(b>a){if(s.isDate)b.setDate(b.getDate()-1);else b.setMilliseconds(b.getMilliseconds()-1)}
  if(a>ceil||b<floor)return;
  events.push({sourceUid:e.uid+'|'+identity,title:(e.summary||'Untitled event').slice(0,180),start:s.isDate?s.toString().slice(0,10):key(a),end:f.isDate?key(b):key(b),time:s.isDate?'':time(a),note:[e.description,e.location,e.component.getFirstPropertyValue('url')].filter(Boolean).join('\n').slice(0,20000)});
  if(events.length>MAX)throw Error('More than 2,000 occurrences; shorten the date range / 请缩小日期范围');
 }
 for(const e of masters){
  for(const ex of exceptions.get(e.uid)||[])e.relateException(ex);
  if(!e.startDate)continue;
  if(e.isRecurring()){
   const it=e.iterator();let occurrence;
   while((occurrence=it.next())){
    if(++steps>50000)throw Error('Recurrence too complex; export a shorter calendar / 重复规则过于复杂');
    if(occurrence.toJSDate()>ceil)break;
    const detail=e.getOccurrenceDetails(occurrence);add(detail.item,detail.startDate,detail.endDate,occurrence.toString());
   }
   // Moved exceptions may originate outside the requested range.
   for(const ex of exceptions.get(e.uid)||[])add(ex,ex.startDate,ex.endDate,ex.recurrenceId.toString());
  }else add(e,e.startDate,e.endDate,e.startDate.toString());
 }
 return [...new Map(events.map(e=>[e.sourceUid,e])).values()];
}
export function graphEvents(values){
 return values.filter(e=>!e.isCancelled).map(e=>{
  const utc=v=>new Date(v.dateTime.replace(/Z$/,'')+'Z');
  const a=utc(e.start),b=utc(e.end);if(e.isAllDay)b.setUTCDate(b.getUTCDate()-1);else if(b>a)b.setMilliseconds(b.getMilliseconds()-1);
  return {sourceUid:e.id,title:(e.subject||'Untitled event').slice(0,180),start:e.isAllDay?e.start.dateTime.slice(0,10):key(a),end:e.isAllDay?b.toISOString().slice(0,10):key(b),time:e.isAllDay?'':time(a),note:[e.bodyPreview,e.location?.displayName,e.webLink].filter(Boolean).join('\n').slice(0,20000)};
 });
}
// Replacing one source is atomic with the normal versioned plan save. Other
// sources and hand-written events are untouched; repeat refreshes do not duplicate.
export function mergeCalendar(data,source,events){
 const previous=new Map(data.items.filter(i=>i.sourceId===source.id).map(i=>[i.sourceUid,i]));
 const items=events.map(e=>({...e,id:previous.get(e.sourceUid)?.id||crypto.randomUUID(),sourceId:source.id,type:'event',projectId:source.mode==='project'?source.projectId:null,calendarOnly:source.mode==='calendar',color:source.color,done:previous.get(e.sourceUid)?.done||false}));
 return {...data,calendars:[...(data.calendars||[]).filter(c=>c.id!==source.id),source],items:[...data.items.filter(i=>i.sourceId!==source.id),...items]};
}
