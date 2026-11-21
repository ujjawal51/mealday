import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createApp} from './app.mjs';
import {mergeGuest,createCloudBackup} from '../dist/cloud-backup.js';
class MemoryStore {
 users=new Map();sessions=new Map();kitchens=new Map();
 async userByEmail(email){return this.users.get(email);}
 async createUser(u){if(this.users.has(u.email))return false;this.users.set(u.email,u);return true;}
 async saveSession(s){this.sessions.set(s._id,s);}
 async session(id){const s=this.sessions.get(id);return s?.expiresAt>new Date()?s:null;}
 async deleteSession(id){this.sessions.delete(id);}
 async kitchen(id){return this.kitchens.get(id);}
 async saveKitchen(id,revision,data){const old=this.kitchens.get(id);if((old?.revision||0)!==revision)return null;const next={revision:revision+1,data,updatedAt:new Date().toISOString()};this.kitchens.set(id,next);return next;}
}
const kitchen=note=>({state:{profile:{name:note},pantry:{},favorites:[],checked:[],recipeJournal:{pasta:{rating:5,note}}},history:{version:1,events:[{id:'cook-1',recipeId:'pasta',cookedAt:'2026-11-19T00:00:00.000Z',undoneAt:null}]}});
async function fixture(t){const store=new MemoryStore();let origin;const server=createServer((req,res)=>createAppHandler(req,res));let createAppHandler;server.listen(0,'127.0.0.1');await once(server,'listening');origin='http://127.0.0.1:'+server.address().port;createAppHandler=createApp({allowPasswordAuth:true,store,origin});t.after(()=>new Promise(resolve=>server.close(resolve)));
 async function client(){let cookie='',csrf='';return {async call(path,method='GET',body,headers={}){const res=await fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf,...headers},...(body?{body:JSON.stringify(body)}:{})});if(res.headers.has('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];const data=await res.json();if(data.csrf)csrf=data.csrf;return {status:res.status,data,res};}};}return {store,client,origin};}
const credentials=email=>({email,password:'correct horse battery staple'});
test('MongoDB API contract: identity, saving, isolation, conflicts and logout',async t=>{
 const {store,client}=await fixture(t),a=await client(),b=await client(),anon=await client();
 assert.equal((await anon.call('/api/kitchen')).status,401);
 assert.equal((await a.call('/api/auth/register','POST',credentials('a@example.com'))).status,200);
 assert.equal((await b.call('/api/auth/register','POST',credentials('b@example.com'))).status,200);
 assert.notEqual(store.users.get('a@example.com').password.hash,credentials('').password);
 assert.equal((await a.call('/api/kitchen','PUT',{revision:0,data:kitchen('first')})).status,200);
 assert.equal((await a.call('/api/kitchen')).data.data.state.recipeJournal.pasta.note,'first');
 assert.equal((await b.call('/api/kitchen')).data.data,null);
 assert.equal((await a.call('/api/kitchen','PUT',{revision:0,data:kitchen('stale')})).status,409);
 assert.equal((await a.call('/api/kitchen')).data.data.state.recipeJournal.pasta.note,'first');
 const second=await client();assert.equal((await second.call('/api/auth/login','POST',credentials('a@example.com'))).status,200);
 assert.equal((await second.call('/api/kitchen')).data.data.history.events.length,1);
 assert.equal((await second.call('/api/kitchen','PUT',{revision:1,data:kitchen('second phone')})).status,200);
 assert.equal((await a.call('/api/kitchen')).data.data.state.recipeJournal.pasta.note,'second phone');
 const feedback=kitchen('Less salt; add lemon 🥣');feedback.state.recipeJournal.pasta.rating=3;
 feedback.history.events[0].undoneAt='2026-11-21T06:00:00.000Z';
 feedback.history.events.push({id:'cook-2',recipeId:'pasta',name:'Pasta',cookedAt:'2026-11-21T07:00:00.000Z',undoneAt:null});
 feedback.state.result=null;
 assert.equal((await second.call('/api/kitchen','PUT',{revision:2,data:feedback})).status,200);
 assert.deepEqual((await a.call('/api/kitchen')).data.data,feedback,'Both sessions retain rating, note, repeated cooks and undo after a plan reset');
 feedback.state.recipeJournal.pasta={rating:0,note:''};
 assert.equal((await a.call('/api/kitchen','PUT',{revision:3,data:feedback})).status,200);
 assert.deepEqual((await second.call('/api/kitchen')).data.data,feedback,'Clearing feedback must sync too');
 assert.equal((await b.call('/api/kitchen')).data.data,null);
 assert.equal((await a.call('/api/auth/logout','POST',{})).status,200);assert.equal((await a.call('/api/kitchen')).status,401);
});
test('Origin, CSRF, bad credentials, body validation and rate limit',async t=>{
 const {client}=await fixture(t),a=await client();
 assert.equal((await a.call('/api/auth/register','POST',credentials('a@example.com'),{Origin:'https://other.example'})).status,403);
 assert.equal((await a.call('/api/auth/register','POST',credentials('a@example.com'))).status,200);
 assert.equal((await a.call('/api/kitchen','PUT',{revision:0,data:kitchen('x')},{'X-CSRF-Token':'wrong'})).status,403);
 assert.equal((await a.call('/api/kitchen','PUT',{revision:0,data:{state:{}}})).status,400);
 assert.equal((await a.call('/api/auth/login','POST',{email:'a@example.com',password:'wrong password long'})).status,401);
 const malicious=kitchen('x');malicious.state.recipeJournal.pasta.rating=100;
 assert.equal((await a.call('/api/kitchen','PUT',{revision:0,data:malicious})).status,400);
 for(let i=0;i<15;i++)await a.call('/api/auth/login','POST',{});
 assert.equal((await a.call('/api/auth/login','POST',{})).status,429);
});
test('Guest import merges favourites/history; cloud journal wins conflicts',()=>{
 const cloud=kitchen('cloud'),guest=kitchen('guest');cloud.state.favorites=[{id:'one'}];guest.state.favorites=[{id:'two'},{id:'one'}];
 const merged=mergeGuest(cloud,guest);assert.equal(merged.state.favorites.length,2);assert.equal(merged.history.events.length,1);assert.equal(merged.state.recipeJournal.pasta.note,'cloud');assert.equal(guest.state.recipeJournal.pasta.note,'guest');
});
test('Cloud client: guest import, offline retry, second device conflict and account switching',async t=>{
 const {origin}=await fixture(t);const nativeFetch=globalThis.fetch;
 const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 let cookie='',offline=false;
 globalThis.fetch=async(path,init={})=>{if(offline)throw Error('offline');const res=await nativeFetch(origin+path,{...init,headers:{...init.headers,Origin:origin,Cookie:cookie}});if(res.headers.has('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return res;};
 t.after(()=>{globalThis.fetch=nativeFetch;delete globalThis.localStorage;});
 let data=kitchen('guest');const client=createCloudBackup({snapshot:()=>structuredClone(data),apply:v=>{data=structuredClone(v);}});
 await client.init();assert.equal(client.info().status,'guest');client.localChanged();
 await client.login('a@example.com',credentials('').password,true);assert.equal(data.state.recipeJournal,undefined);
 await client.importGuest();assert.equal(data.state.recipeJournal.pasta.note,'guest');assert.equal(client.info().status,'synced');
 data.state.recipeJournal.pasta.note='offline edit';offline=true;client.localChanged();await client.retry();assert.equal(client.info().status,'pending');
 offline=false;await client.retry();assert.equal(client.info().status,'synced');
 // Separate client advances server revision, then stale local changes must not overwrite it.
 const second=await nativeFetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(credentials('a@example.com'))});const auth=await second.json();const headers={Origin:origin,Cookie:second.headers.get('set-cookie').split(';')[0],'Content-Type':'application/json','X-CSRF-Token':auth.csrf};
 const remote=await (await nativeFetch(origin+'/api/kitchen',{headers})).json();await nativeFetch(origin+'/api/kitchen',{method:'PUT',headers,body:JSON.stringify({revision:remote.revision,data:kitchen('remote edit')})});
 data.state.recipeJournal.pasta.note='local edit';client.localChanged();await client.retry();assert.equal(client.info().conflict,true);assert.equal(data.state.recipeJournal.pasta.note,'local edit');
 await client.resolve(false);assert.equal(data.state.recipeJournal.pasta.note,'remote edit');
 await client.logout();assert.equal(data.state.recipeJournal.pasta.note,'guest');
 await client.login('b@example.com',credentials('').password,true);assert.equal(data.state.recipeJournal,undefined);
 await client.logout();
 await client.login('a@example.com',credentials('').password);cookie='';
 data.state.recipeJournal.pasta.note='expired-session edit';client.localChanged();await client.retry();
 assert.equal(client.info().account,null);assert.equal(data.state.recipeJournal.pasta.note,'expired-session edit');
 await client.login('a@example.com',credentials('').password);assert.equal(client.info().status,'synced');
 await client.logout();
});

test('MongoDB sessions rotate, reject expired sessions and ignore caller-selected owners',async t=>{
 const {store,client,origin}=await fixture(t),a=await client(),b=await client();
 const first=await a.call('/api/auth/register','POST',credentials('sessions@example.com'));
 const cookie=first.res.headers.get('set-cookie').split(';')[0];
 assert.match(first.res.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
 assert.equal(store.sessions.size,1);
 assert.equal((await a.call('/api/auth/login','POST',credentials('sessions@example.com'))).status,200);
 assert.equal(store.sessions.size,1);
 const stale=await fetch(origin+'/api/account',{headers:{Cookie:cookie}});
 assert.equal((await stale.json()).user,null);
 const other=await b.call('/api/auth/register','POST',credentials('other@example.com'));
 await a.call('/api/kitchen','PUT',{revision:0,userId:other.data.user.id,data:kitchen('owned by session')});
 assert.equal((await b.call('/api/kitchen')).data.data,null);
 const mine=(await a.call('/api/kitchen')).data;
 assert.equal(mine.data.state.recipeJournal.pasta.note,'owned by session');
 for(const s of store.sessions.values())s.expiresAt=new Date(0);
 assert.equal((await a.call('/api/account')).data.user,null);
 assert.equal((await a.call('/api/kitchen')).status,401);
});

test('Production cookies are secure and registration requires explicit enablement',async t=>{
 const store=new MemoryStore(),origin='https://mealday.example';
 const app=createApp({store,origin,production:true});
 // Exercise the handler directly to inspect production Set-Cookie without disabling TLS.
 const {Readable}=await import('node:stream');
 async function request(handler,path,body){
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);
  Object.assign(req,{url:path,method:'POST',headers:{origin,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}});
  let status,headers,bodyText;
  await handler(req,{writeHead:(s,h)=>{status=s;headers=h;},end:b=>{bodyText=b;}});
  return {status,headers,data:JSON.parse(bodyText)};
 }
 assert.equal((await request(app,'/api/auth/register',credentials('secure@example.com'))).status,410);
 const enabled=createApp({allowPasswordAuth:true,store,origin,production:true,allowRegistration:true});
 const created=await request(enabled,'/api/auth/register',credentials('secure@example.com'));
 assert.equal(created.status,200);
 assert.match(created.headers['Set-Cookie'],/^__Host-mealday_session=/);
 assert.match(created.headers['Set-Cookie'],/; Secure$/);
 assert.equal('password' in created.data.user,false);
});

test('Accounts created in the original root app can log into the latest UI without password or backup migration',async t=>{
 const {scryptSync}=await import('node:crypto');const {store,client}=await fixture(t),a=await client();
 const salt='1234567890abcdef1234567890abcdef',password='old-pass';
 await store.createUser({_id:'original-user',email:'original@example.com',salt,passwordHash:scryptSync(password,salt,64).toString('hex')});
 const before=structuredClone(store.users.get('original@example.com'));
 assert.equal((await a.call('/api/auth/login','POST',{email:'original@example.com',password:'wrong'})).status,401);
 const login=await a.call('/api/auth/login','POST',{email:'original@example.com',password});assert.equal(login.status,200);assert.equal(login.data.user.id,'original-user');
 assert.deepEqual(store.users.get('original@example.com'),before);
 assert.equal((await a.call('/api/auth/logout','POST',{})).status,200);
});
