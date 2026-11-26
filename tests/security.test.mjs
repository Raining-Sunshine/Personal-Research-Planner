import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {createHandler} from '../src/server.js';
import {seed,validateState} from '../src/model.js';

function fixture(){
 const db=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+file,'utf8'));
 const env={DB:{
  prepare(sql){
   let args=[];const statement=db.prepare(sql);
   return {
    bind(...values){args=values;return this},
    async first(){return statement.get(...args)||null},
    async run(){return {meta:{changes:Number(statement.run(...args).changes)}}}
   };
  }
 }};
 const handler=createHandler({}),request=(user='alice',options={})=>{
  const method=options.method||'PUT',headers={'Content-Type':'application/json',Origin:'https://planner.test',...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'}:{}),...options.headers};
  return new Request('https://planner.test/api/state',{method,headers,...(method==='GET'?{}:{body:options.raw??JSON.stringify({data:options.data??seed(),revision:options.revision??0,accountId:options.accountId??user}),...(options.raw instanceof ReadableStream?{duplex:'half'}:{})})});
 };
 return {db,env,handler,request,send:(user,options)=>handler.fetch(request(user,options),env)};
}
test('only authenticated identity owns a plan; another account cannot read or overwrite it',async()=>{
 const f=fixture();
 assert.equal((await f.send(null,{method:'GET'})).status,401);
 assert.equal((await f.send(null)).status,401);
 assert.equal((await f.send('alice')).status,200);
 const alice=await (await f.send('alice',{method:'GET'})).json();assert.equal(alice.account.email,'alice@example.test');assert.equal(alice.revision,1);
 const bob=await (await f.send('bob',{method:'GET'})).json();assert.equal(bob.data,null);
 assert.equal((await f.send('bob',{accountId:'alice',revision:1})).status,401);
 assert.equal((await f.send('bob',{revision:1})).status,409);
 assert.equal((await f.send('alice',{revision:0})).status,409);
 assert.equal((await f.send('alice',{revision:1})).status,200);
 f.db.close();
});
test('cross-site requests, wrong content types and unsupported methods do not write records',async()=>{
 const f=fixture();
 for(const options of [{headers:{Origin:'https://evil.test'}},{headers:{Origin:''}},{headers:{'Sec-Fetch-Site':'cross-site'}}])assert.equal((await f.send('alice',options)).status,403);
 assert.equal((await f.send('alice',{headers:{'Content-Type':'text/plain'}})).status,415);
 assert.equal((await f.send('alice',{method:'POST'})).status,405);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM planner_states').get().n,0);
 f.db.close();
});
test('invalid structures are rejected without exceptions and unknown fields are not stored',async()=>{
 const f=fixture();
 const cases=[d=>d.projects.push(null),d=>d.items.push(null),d=>d.projects[0].id=123,d=>d.projects[0].subtitle={},d=>d.items[0].time=['12:00'],d=>d.items[0].done='false',d=>d.demo='true',d=>d.items[0].color=null];
 for(const mutate of cases){const d=seed();mutate(d);assert.equal(validateState(d),false);assert.equal((await f.send('alice',{data:d})).status,400)}
 assert.equal((await f.send('alice',{raw:'null'})).status,400);
 assert.equal((await f.send('alice',{raw:'{'})).status,400);
 assert.equal((await f.send('alice',{revision:Number.MAX_SAFE_INTEGER})).status,400);
 const data=seed();data.extra='discard me';data.projects[0].extra='discard me';data.items[0].extra='discard me';
 assert.equal((await f.send('alice',{data})).status,200);
 const stored=await (await f.send('alice',{method:'GET'})).json();
 assert.equal(stored.data.extra,undefined);assert.equal(stored.data.projects[0].extra,undefined);assert.equal(stored.data.items[0].extra,undefined);
 f.db.close();
});
test('oversized UTF-8 streams are cancelled before buffering the full request',async()=>{
 const f=fixture();let cancelled=false;
 const raw=new ReadableStream({pull(controller){controller.enqueue(new TextEncoder().encode('你'.repeat(700000)))},cancel(){cancelled=true}});
 assert.equal((await f.send('alice',{raw})).status,413);assert.equal(cancelled,true);
 assert.equal((await f.send('alice',{headers:{'Content-Length':'2000001'}})).status,413);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM planner_states').get().n,0);
 f.db.close();
});
test('write limits persist in SQL, isolate accounts, and reset in the next time window',async()=>{
 const f=fixture();
 for(let revision=0;revision<60;revision++)assert.equal((await f.send('alice',{revision})).status,200);
 const blocked=await f.send('alice',{revision:60});assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('Retry-After'))>0);
 assert.equal((await f.send('bob')).status,200);
 f.db.prepare('UPDATE planner_write_limits SET window_start = 0 WHERE user_id = ?').run('alice');
 assert.equal((await f.send('alice',{revision:60})).status,200);
 const read=await f.send('alice',{method:'GET'});assert.match(read.headers.get('Cache-Control'),/no-store/);assert.equal((await read.json()).revision,61);
 f.db.close();
});
