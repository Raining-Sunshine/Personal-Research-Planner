import {calendarAPI} from './outlook-server.js';
import {validateState,normalizeState} from './model.js';
const MAX_BODY_BYTES=2000000;
async function readBoundedBody(request){
 // Enforce the byte limit during streaming, before an unbounded body can be
 // buffered. Content-Length alone is neither required nor sufficient.
 if(!request.body)return '';
 const reader=request.body.getReader(),decoder=new TextDecoder();let bytes=0,text='';
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_BODY_BYTES){await reader.cancel();throw new RangeError('Too large')}text+=decoder.decode(value,{stream:true})}return text+decoder.decode()}finally{reader.releaseLock()}
}
export function createHandler(assets){
 const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',...headers}});
 return {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/outlook/')||url.pathname==='/api/calendar/feed')return calendarAPI(request,env);
  if(url.pathname==='/api/state'){
   // Sites supplies and verifies this identity header. A client-supplied ID
   // never chooses which user's record is read or modified.
   const userId=request.headers.get('oai-authenticated-user-id');
   if(!userId)return json({error:'Sign in required'},401);
   if(!env.DB)return json({error:'Cloud storage is unavailable'},503);
   try{
    if(request.method==='GET'){
     const row=await env.DB.prepare('SELECT document, revision FROM planner_states WHERE user_id = ?').bind(userId).first();
     const email=request.headers.get('oai-authenticated-user-email')||'';
     let name=request.headers.get('oai-authenticated-user-full-name')||'';
     if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(name)}catch{name=''}}
     return json({data:row?JSON.parse(row.document):null,revision:row?.revision||0,account:{id:userId,email,name:name||email},access:'private'});
    }
    if(request.method!=='PUT')return json({error:'Method not allowed'},405);
    const origin=request.headers.get('Origin');
    if(!origin||origin!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Origin mismatch'},403);
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Expected JSON'},415);
    if(Number(request.headers.get('Content-Length')||0)>MAX_BODY_BYTES)return json({error:'Too large'},413);
    const now=Math.floor(Date.now()/1000),windowStart=Math.floor(now/60)*60;
    // D1's atomic upsert applies one shared limit across Worker instances.
    const limit=await env.DB.prepare('INSERT INTO planner_write_limits (user_id, window_start, attempts) VALUES (?, ?, 1) ON CONFLICT(user_id) DO UPDATE SET attempts = CASE WHEN window_start = excluded.window_start THEN attempts + 1 ELSE 1 END, window_start = excluded.window_start RETURNING attempts').bind(userId,windowStart).first();
    if(limit.attempts>60)return json({error:'Too many updates'},429,{'Retry-After':String(60-(now-windowStart))});
    let raw;try{raw=await readBoundedBody(request)}catch(e){if(e instanceof RangeError)return json({error:'Too large'},413);throw e}
    let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
    if(!body||typeof body!=='object')return json({error:'Invalid plan'},400);
    if(body.accountId!==userId)return json({error:'Session changed'},401);
    if(!validateState(body.data)||!Number.isSafeInteger(body.revision)||body.revision<0||body.revision>=Number.MAX_SAFE_INTEGER)return json({error:'Invalid plan'},400);
    const document=JSON.stringify(normalizeState(body.data)),next=body.revision+1,stamp=new Date().toISOString();
    // Compare-and-set: an outdated device receives 409 instead of overwriting
    // the newer revision. The first save has equivalent insert-only semantics.
    const result=body.revision===0?
     await env.DB.prepare('INSERT INTO planner_states (user_id, document, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING').bind(userId,document,stamp).run():
     await env.DB.prepare('UPDATE planner_states SET document = ?, revision = ?, updated_at = ? WHERE user_id = ? AND revision = ?').bind(document,next,stamp,userId,body.revision).run();
    if(!result.meta.changes)return json({error:'Version conflict'},409);
    return json({revision:next});
   }catch{return json({error:'Cloud storage request failed'},503)}
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const path=url.pathname==='/'?'/index.html':url.pathname,asset=assets[path];
  if(!asset)return new Response('Not found',{status:404});
  const bytes=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));
  return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':path.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com; worker-src 'self'; manifest-src 'self'"}});
 }};
}
