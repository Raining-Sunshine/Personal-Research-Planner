// Date-only arithmetic uses UTC here so recurrence never drifts at DST changes.
const date=s=>new Date(s+'T00:00:00Z'),key=d=>d.toISOString().slice(0,10);
const delta=(a,b)=>Math.round((date(b)-date(a))/86400000);
const plus=(s,n)=>key(new Date(+date(s)+n*86400000));
export function recurringOverlap(item,start,end){
 const r=item.recurrence;
 if(!r)return item.start<=end&&item.end>=start;
 const lower=start>item.start?plus(start,-delta(item.start,item.end)):item.start;
 const upper=r.until&&r.until<end?r.until:end;
 if(upper<item.start)return false;
 if(r.frequency==='weekly'){
  const monday=plus(item.start,-((date(item.start).getUTCDay()+6)%7)),cycle=r.interval*7;
  return r.weekdays.some(day=>{const base=plus(monday,(day+6)%7);const n=Math.max(0,Math.ceil(delta(base,lower)/cycle),Math.ceil(delta(base,item.start)/cycle));return plus(base,n*cycle)<=upper});
 }
 const origin=date(item.start),lo=date(lower),day=origin.getUTCDate();
 let n=Math.max(0,Math.floor(((lo.getUTCFullYear()-origin.getUTCFullYear())*12+lo.getUTCMonth()-origin.getUTCMonth())/r.interval));
 // A leap-day series may need up to 48 months to find its next valid date.
 for(let tries=0;tries<50;tries++,n++){
  const d=new Date(Date.UTC(origin.getUTCFullYear(),origin.getUTCMonth()+n*r.interval,1));
  if(key(d)>upper)return false;
  const month=d.getUTCMonth();d.setUTCDate(day);
  if(d.getUTCMonth()!==month)continue;
  const k=key(d);if(k>=lower&&k>=item.start&&k<=upper)return true;
 }
 return false;
}
export function validRecurrence(r,item,validDate){
 return r===undefined||r===null||(item.type==='event'&&r&&typeof r==='object'&&['weekly','monthly'].includes(r.frequency)&&Number.isInteger(r.interval)&&r.interval>=1&&r.interval<=12&&(!r.until||(validDate(r.until)&&r.until>=item.start))&&(r.frequency!=='weekly'||(Array.isArray(r.weekdays)&&r.weekdays.length>0&&r.weekdays.length<=7&&new Set(r.weekdays).size===r.weekdays.length&&r.weekdays.every(n=>Number.isInteger(n)&&n>=0&&n<7))));
}
