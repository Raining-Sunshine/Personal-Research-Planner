import {validateState} from './model.js';
export function createHandler(assets){
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 return {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/state'){
   const userId=request.headers.get('oai-authenticated-user-id');
   if(!userId)return json({error:'Sign in required'},401);
   if(!env.DB)return json({error:'Cloud storage is unavailable'},503);
   try{
    if(request.method==='GET'){
     const row=await env.DB.prepare('SELECT document, revision FROM planner_states WHERE user_id = ?').bind(userId).first();
     return json({data:row?JSON.parse(row.document):null,revision:row?.revision||0});
    }
    if(request.method!=='PUT')return json({error:'Method not allowed'},405);
    const origin=request.headers.get('Origin');
    if(!origin||origin!==url.origin)return json({error:'Origin mismatch'},403);
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Expected JSON'},415);
    if(Number(request.headers.get('Content-Length')||0)>2000000)return json({error:'Too large'},413);
    const raw=await request.text();if(raw.length>2000000)return json({error:'Too large'},413);
    let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
    if(!validateState(body.data)||!Number.isInteger(body.revision)||body.revision<0)return json({error:'Invalid plan'},400);
    const document=JSON.stringify(body.data),next=body.revision+1,stamp=new Date().toISOString();
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
