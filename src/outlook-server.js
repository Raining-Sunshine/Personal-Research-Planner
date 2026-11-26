// Microsoft authorization grants read-only calendar access. Sites remains the
// sole app identity provider; every token belongs to its verified Sites user.
const scope='offline_access https://graph.microsoft.com/Calendars.Read.Shared';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
const b64=b=>btoa(String.fromCharCode(...b));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
export function configured(env){
 try{return !!(env.MS_CLIENT_ID&&env.MS_CLIENT_SECRET&&new URL(env.MS_REDIRECT_URI).protocol==='https:'&&unb64(env.OUTLOOK_TOKEN_ENCRYPTION_KEY).length===32&&/^(common|organizations|consumers|[a-f\d-]{36})$/i.test(env.MS_TENANT_ID||'common'))}catch{return false}
}
export async function seal(value,env,user,decrypt=false){
 const key=await crypto.subtle.importKey('raw',unb64(env.OUTLOOK_TOKEN_ENCRYPTION_KEY),'AES-GCM',false,['encrypt','decrypt']);
 const iv=decrypt?unb64(value.split('.')[0]):crypto.getRandomValues(new Uint8Array(12));
 const params={name:'AES-GCM',iv,additionalData:new TextEncoder().encode(user)};
 if(decrypt)return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt(params,key,unb64(value.split('.')[1]))));
 const result=await crypto.subtle.encrypt(params,key,new TextEncoder().encode(JSON.stringify(value)));
 return b64(iv)+'.'+b64(new Uint8Array(result));
}
async function bounded(response){
 if(!response.body)throw Error('Empty response');const reader=response.body.getReader();let size=0,result='';const decoder=new TextDecoder();
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000){await reader.cancel();throw Error('Response too large')}result+=decoder.decode(value,{stream:true})}return result+decoder.decode()}finally{reader.releaseLock()}
}
export function allowedFeed(value){
 try{const u=new URL(value.replace(/^webcal:/i,'https:'));return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='outlook.office365.com'||u.hostname==='outlook.office.com'||u.hostname==='outlook.live.com')?u:null}catch{return null}
}
const validRange=(a,b)=>/^\d{4}-\d{2}-\d{2}$/.test(a)&&/^\d{4}-\d{2}-\d{2}$/.test(b)&&new Date(a).toISOString().slice(0,10)===a&&new Date(b).toISOString().slice(0,10)===b&&b>=a&&(new Date(b)-new Date(a))/86400000<=366;
async function exchange(env,params){
 const r=await fetch(`https://login.microsoftonline.com/${env.MS_TENANT_ID||'common'}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.MS_CLIENT_ID,client_secret:env.MS_CLIENT_SECRET,scope,...params}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Microsoft authorization expired or refused; reconnect / Microsoft 授权失效或被拒绝，请重新连接');
 const t=JSON.parse(await bounded(r));return {access_token:t.access_token,refresh_token:t.refresh_token,expires:Date.now()+t.expires_in*1000};
}
async function store(env,user,t){await env.DB.prepare('INSERT INTO outlook_tokens (user_id, encrypted) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET encrypted = excluded.encrypted').bind(user,await seal(t,env,user)).run()}
async function token(env,user){
 const row=await env.DB.prepare('SELECT encrypted FROM outlook_tokens WHERE user_id = ?').bind(user).first();if(!row)throw Error('Connect Outlook first / 请先连接 Outlook');
 let t=await seal(row.encrypted,env,user,true);
 if(t.expires<Date.now()+60000){const next=await exchange(env,{grant_type:'refresh_token',refresh_token:t.refresh_token});t={...next,refresh_token:next.refresh_token||t.refresh_token};await store(env,user,t)}return t.access_token;
}
async function graph(env,user,path){
 const access=await token(env,user);let url='https://graph.microsoft.com/v1.0/'+path,values=[];
 for(let page=0;page<20;page++){
  // Only Microsoft Graph may receive a bearer token, including pagination.
  const u=new URL(url);if(u.origin!=='https://graph.microsoft.com'||!u.pathname.startsWith('/v1.0/'))throw Error('Invalid Graph pagination');
  const r=await fetch(u,{headers:{Authorization:'Bearer '+access,Prefer:'outlook.timezone="UTC", IdType="ImmutableId"'},signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('Microsoft calendar unavailable. Check sharing permissions or reconnect / 请检查共享权限或重新连接');
  const body=JSON.parse(await bounded(r));values.push(...(body.value||[]));if(values.length>2000)throw Error('Too many events; shorten date range / 事件过多，请缩小日期范围');
  if(!body['@odata.nextLink'])return values;url=body['@odata.nextLink'];
 }throw Error('Too many pages / 日历数据过多');
}
export async function calendarAPI(request,env){
 const u=new URL(request.url),path=u.pathname,user=request.headers.get('oai-authenticated-user-id');
 if(!user)return json({error:'Sign in required'},401);
 if(!env.DB)return json({error:'Database unavailable'},503);
 try{
  if(path==='/api/outlook/status'&&request.method==='GET')return json({configured:configured(env),connected:configured(env)&&!!await env.DB.prepare('SELECT user_id FROM outlook_tokens WHERE user_id = ?').bind(user).first()});
  if(path==='/api/outlook/callback'&&request.method==='GET'){
   const state=u.searchParams.get('state')||'';
   const row=await env.DB.prepare('DELETE FROM outlook_states WHERE state = ? AND user_id = ? RETURNING verifier, expires').bind(state,user).first();
   if(!row||row.expires<Date.now()||!configured(env))return json({error:'Authorization expired. Reconnect from Planner / 授权已失效，请从 Planner 重新连接'},400);
   if(u.searchParams.has('error'))return Response.redirect(u.origin+'/?outlook=cancelled',303);
   if(!u.searchParams.get('code'))return json({error:'Missing code'},400);
   const t=await exchange(env,{grant_type:'authorization_code',code:u.searchParams.get('code'),redirect_uri:env.MS_REDIRECT_URI,code_verifier:row.verifier});await store(env,user,t);
   return Response.redirect(u.origin+'/?outlook=connected',303);
  }
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(request.headers.get('Origin')!==u.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Origin mismatch'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Expected JSON'},415);
  const minute=Math.floor(Date.now()/60000)*60;
  const rate=await env.DB.prepare('INSERT INTO planner_write_limits (user_id, window_start, attempts) VALUES (?, ?, 1) ON CONFLICT(user_id) DO UPDATE SET attempts = CASE WHEN window_start = excluded.window_start THEN attempts + 1 ELSE 1 END, window_start = excluded.window_start RETURNING attempts').bind('calendar:'+user,minute).first();
  if(rate.attempts>30)return json({error:'Too many calendar requests / 请求过于频繁'},429);
  const body=JSON.parse(await bounded(request));
  if(path==='/api/calendar/feed'){
   let target=typeof body.url==='string'&&allowedFeed(body.url);if(!target)return json({error:'Use an HTTPS Outlook published calendar URL, or upload an ICS file / 请使用 Outlook 发布日历链接，其他来源请上传 ICS 文件'},400);
   for(let n=0;n<4;n++){
    const r=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Accept:'text/calendar'}});
    if(r.status>=300&&r.status<400){target=allowedFeed(new URL(r.headers.get('Location'),target).href);if(!target)throw Error('Unsafe calendar redirect');continue}
    if(!r.ok)throw Error('Calendar link unavailable; check publishing permissions / 链接不可用，请检查发布权限');
    return json({ics:await bounded(r)});
   }throw Error('Too many redirects');
  }
  if(path==='/api/outlook/disconnect'){await env.DB.prepare('DELETE FROM outlook_tokens WHERE user_id = ?').bind(user).run();await env.DB.prepare('DELETE FROM outlook_states WHERE user_id = ?').bind(user).run();return json({ok:true})}
  if(!configured(env))return json({error:'Microsoft app is not configured / 尚未配置 Microsoft 应用'},503);
  if(path==='/api/outlook/connect'){
   if(new URL(env.MS_REDIRECT_URI).origin!==u.origin)return json({error:'Open Planner at its configured custom domain before connecting / 请在已配置的自定义域名打开 Planner 后连接'},400);
   const state=random(),verifier=random(),challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
   await env.DB.prepare('DELETE FROM outlook_states WHERE user_id = ? OR expires < ?').bind(user,Date.now()).run();
   await env.DB.prepare('INSERT INTO outlook_states (state, user_id, verifier, expires) VALUES (?, ?, ?, ?)').bind(state,user,verifier,Date.now()+600000).run();
   const auth=new URL(`https://login.microsoftonline.com/${env.MS_TENANT_ID||'common'}/oauth2/v2.0/authorize`);auth.search=new URLSearchParams({client_id:env.MS_CLIENT_ID,response_type:'code',redirect_uri:env.MS_REDIRECT_URI,response_mode:'query',scope,state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();return json({url:auth.href});
  }
  if(path==='/api/outlook/calendars')return json({calendars:(await graph(env,user,'me/calendars?$select=id,name,owner&$top=100')).map(c=>({id:c.id,name:c.name,owner:c.owner?.address||''}))});
  if(path==='/api/outlook/events'){
   if(typeof body.calendarId!=='string'||body.calendarId.length>1000||!validRange(body.start,body.end))return json({error:'Invalid calendar or date range'},400);
   const start=new Date(body.start);start.setUTCDate(start.getUTCDate()-1);
   const end=new Date(body.end);end.setUTCDate(end.getUTCDate()+2);
   const q=new URLSearchParams({startDateTime:start.toISOString(),endDateTime:end.toISOString(),'$top':'200','$select':'id,subject,start,end,isAllDay,isCancelled,bodyPreview,location,webLink'});
   return json({events:await graph(env,user,`me/calendars/${encodeURIComponent(body.calendarId)}/calendarView?${q}`)});
  }
  return json({error:'Not found'},404);
 }catch(e){return json({error:e.message?.includes(' / ')?e.message:'Calendar request failed / 日历请求失败，请检查配置或日历链接'},502)}
}
