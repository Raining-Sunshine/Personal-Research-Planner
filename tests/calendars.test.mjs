import {test} from 'node:test';
import assert from 'node:assert/strict';
import {overlaps,seed,validateState,normalizeState} from '../src/model.js';
import {parseICS,mergeCalendar,graphEvents} from '../src/calendar-import.js';
import {allowedFeed,configured,seal,calendarAPI} from '../src/outlook-server.js';
const event={type:'event',start:'2026-11-23',end:'2026-11-23',recurrence:{frequency:'weekly',interval:2,weekdays:[1,3],until:'2026-12-10'}};
test('weekly recurrence uses Monday-based weeks, selected weekdays, interval and inclusive cutoff',()=>{
 for(const d of ['2026-11-23','2026-11-25','2026-12-07','2026-12-09'])assert.equal(overlaps(event,d,d),true,d);
 for(const d of ['2026-11-22','2026-11-24','2026-11-30','2026-12-14'])assert.equal(overlaps(event,d,d),false,d);
 assert.equal(overlaps({...event,end:'2026-11-25'},'2026-11-27','2026-11-27'),true);
});
test('monthly series skips invalid month dates and supports leap years',()=>{
 const e={...event,start:'2024-01-31',end:'2024-01-31',recurrence:{frequency:'monthly',interval:1}};
 assert.equal(overlaps(e,'2024-02-01','2024-02-29'),false);assert.equal(overlaps(e,'2024-03-31','2024-03-31'),true);
 const leap={...e,start:'2024-02-29',end:'2024-02-29',recurrence:{frequency:'monthly',interval:12}};
 assert.equal(overlaps(leap,'2025-01-01','2025-12-31'),false);assert.equal(overlaps(leap,'2028-02-29','2028-02-29'),true);
});
const ics=lines=>['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Planner Tests//EN',...lines,'END:VCALENDAR'].join('\r\n');
test('ICS expands repeat rules, exclusions, moved exceptions, cancellation and exclusive all-day end',()=>{
 const values=parseICS(ics(['BEGIN:VEVENT','UID:weekly','DTSTART;VALUE=DATE:20261123','DTEND;VALUE=DATE:20261124','RRULE:FREQ=WEEKLY;COUNT=4','EXDATE;VALUE=DATE:20261130','SUMMARY:Weekly','END:VEVENT','BEGIN:VEVENT','UID:weekly','RECURRENCE-ID;VALUE=DATE:20261207','DTSTART;VALUE=DATE:20261208','DTEND;VALUE=DATE:20261209','SUMMARY:Moved','END:VEVENT','BEGIN:VEVENT','UID:weekly','RECURRENCE-ID;VALUE=DATE:20261214','DTSTART;VALUE=DATE:20261214','DTEND;VALUE=DATE:20261215','STATUS:CANCELLED','END:VEVENT']),'2026-11-01','2026-12-31');
 assert.deepEqual(values.map(e=>[e.start,e.end,e.title]),[['2026-11-23','2026-11-23','Weekly'],['2026-12-08','2026-12-08','Moved']]);
});
test('ICS rejects unknown timezones and malformed files',()=>{
 assert.throws(()=>parseICS('not ICS','2026-01-01','2026-02-01'));
 assert.throws(()=>parseICS(ics(['BEGIN:VEVENT','UID:a','DTSTART;TZID=Unknown/Zone:20261123T120000','SUMMARY:Test','END:VEVENT']),'2026-11-01','2026-12-01'),/timezone/);
});
test('source refresh deduplicates, preserves unrelated events, and roundtrips private source metadata',()=>{
 const s={id:'source1',name:'Calendar',kind:'file',mode:'calendar',projectId:null,start:'2026-11-01',end:'2026-12-01',color:'#ABD4DE',url:'',calendarId:'',syncedAt:new Date().toISOString()};
 const events=[{sourceUid:'a',title:'Imported',start:'2026-11-26',end:'2026-11-26',time:'',note:''}];
 const first=mergeCalendar(seed(),s,events),second=mergeCalendar(first,s,events);
 assert.equal(second.items.length,first.items.length);assert.equal(first.items.at(-1).id,second.items.at(-1).id);assert.equal(validateState(second),true);
 const normalized=normalizeState(second);assert.equal(normalized.items.at(-1).calendarOnly,true);assert.equal(normalized.calendars[0].id,s.id);
 assert.equal(mergeCalendar(second,s,[]).items.length,seed().items.length);
 second.calendars[0].mode='project';second.calendars[0].projectId='missing';assert.equal(validateState(second),false);
});
test('invalid recurrence cannot persist; native event rules survive normalization',()=>{
 const d=seed();const e=d.items.find(e=>e.type==='event');e.recurrence={frequency:'weekly',interval:1,weekdays:[],until:''};assert.equal(validateState(d),false);
 e.recurrence.weekdays=[1,5];assert.equal(validateState(d),true);assert.deepEqual(normalizeState(d).items.find(x=>x.id===e.id).recurrence,e.recurrence);
 e.recurrence.interval=0;assert.equal(validateState(d),false);
});
test('subscription proxy accepts only explicit Microsoft HTTPS hosts',()=>{
 for(const url of ['http://outlook.office.com/a','https://127.0.0.1/a','https://outlook.office.com.evil.test/a','https://user:pass@outlook.live.com/a','https://outlook.live.com:8080/a','https://169.254.169.254/'])assert.equal(allowedFeed(url),null,url);
 assert.ok(allowedFeed('webcal://outlook.office365.com/calendar.ics'));
});
test('OAuth encrypted tokens are bound to the user and configuration never appears as connected without keys',async()=>{
 const env={MS_CLIENT_ID:'id',MS_CLIENT_SECRET:'secret',MS_REDIRECT_URI:'https://planner.test/api/outlook/callback',OUTLOOK_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};
 assert.equal(configured({}),false);assert.equal(configured(env),true);
 const cipher=await seal({refresh_token:'private-token'},env,'alice');assert.ok(!cipher.includes('private-token'));
 assert.deepEqual(await seal(cipher,env,'alice',true),{refresh_token:'private-token'});await assert.rejects(()=>seal(cipher,env,'bob',true));
 const req=(path,headers={})=>new Request('https://planner.test'+path,{method:'POST',headers,body:'{}'});
 assert.equal((await calendarAPI(req('/api/outlook/connect'),{})).status,401);
 assert.equal((await calendarAPI(req('/api/outlook/connect',{'oai-authenticated-user-id':'alice',Origin:'https://evil.test'}),{DB:{}})).status,403);
});
test('Graph all-day end is exclusive and canceled events are not imported',()=>{
 const values=graphEvents([{id:'a',subject:'Day',isAllDay:true,start:{dateTime:'2026-11-26T00:00:00.0000000'},end:{dateTime:'2026-11-27T00:00:00.0000000'}},{isCancelled:true}]);
 assert.equal(values.length,1);assert.equal(values[0].start,'2026-11-26');assert.equal(values[0].end,'2026-11-26');assert.equal(values[0].time,'');
});

test('OAuth state is user-bound, single-use; tokens stay server-side and disconnect removes them',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const fs=await import('node:fs');
 const db=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 const env={MS_CLIENT_ID:'test-app',MS_CLIENT_SECRET:'test-secret',MS_REDIRECT_URI:'https://planner.test/api/outlook/callback',OUTLOOK_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,5).toString('base64'),DB:{prepare(sql){const stmt=db.prepare(sql);let args=[];return{bind(...a){args=a;return this},async first(){return stmt.get(...args)||null},async run(){return{meta:{changes:Number(stmt.run(...args).changes)}}}}}}};
 const call=(path,user='alice',method='POST')=>calendarAPI(new Request('https://planner.test'+path,{method,headers:{'oai-authenticated-user-id':user,Origin:'https://planner.test','Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})}),env);
 const connected=await (await call('/api/outlook/connect')).json(),auth=new URL(connected.url);assert.equal(auth.origin,'https://login.microsoftonline.com');assert.equal(auth.searchParams.get('code_challenge_method'),'S256');
 assert.equal((await (await call('/api/outlook/status','alice','GET')).json()).connected,false);
 const callback='/api/outlook/callback?code=test&state='+auth.searchParams.get('state');
 assert.equal((await call(callback,'bob','GET')).status,400);
 const oldFetch=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async(url,options)=>{calls++;assert.ok(String(url).startsWith('https://login.microsoftonline.com/'));assert.equal(options.body.get('grant_type'),'authorization_code');return Response.json({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600})};
 assert.equal((await call(callback,'alice','GET')).status,303);assert.equal(calls,1);assert.equal((await call(callback,'alice','GET')).status,400);assert.equal(calls,1);
 const status=await (await call('/api/outlook/status','alice','GET')).json();assert.deepEqual(status,{configured:true,connected:true});
 assert.equal((await (await call('/api/outlook/status','bob','GET')).json()).connected,false);
 assert.ok(!db.prepare('SELECT encrypted FROM outlook_tokens').get().encrypted.includes('test-refresh'));
 await call('/api/outlook/disconnect');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM outlook_tokens').get().n,0);
 }finally{globalThis.fetch=oldFetch;db.close()}
});
