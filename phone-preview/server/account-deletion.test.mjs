import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createApp} from './app.mjs';
import {createCloudBackup} from '../dist/cloud-backup.js';
class Store{
 users=new Map();sessions=new Map();kitchens=new Map();
 async userByEmail(email){return this.users.get(email);}
 async createUser(user){if(this.users.has(user.email))return false;this.users.set(user.email,user);return true;}
 async saveSession(s){this.sessions.set(s._id,s);}
 async session(id){return this.sessions.get(id);}
 async deleteSession(id){this.sessions.delete(id);}
 async kitchen(id){return this.kitchens.get(id);}
 async saveKitchen(id,revision,data){const old=this.kitchens.get(id);if((old?.revision||0)!==revision)return null;const next={revision:revision+1,data,updatedAt:new Date().toISOString()};this.kitchens.set(id,next);return next;}
 async deleteAccount(id,version){const user=[...this.users.values()].find(u=>u._id===id);if(!user||(user.authVersion||0)!==version)return false;this.users.delete(user.email);this.kitchens.delete(id);for(const [key,s] of this.sessions)if(s.userId===id)this.sessions.delete(key);return true;}
}
const password='correct horse battery staple';
const kitchen=note=>({state:{profile:{name:note},pantry:{},checked:[],favorites:[],recipeJournal:{rice:{rating:5,note}}},history:{version:1,events:[]}});
async function fixture(t){
 const store=new Store(),server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port;server.on('request',createApp({allowPasswordAuth:true,store,origin}));t.after(()=>new Promise(r=>server.close(r)));
 function client(){let cookie='',csrf='';return {async call(path,method='GET',body,extra={}){const res=await fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf,...extra},...(body?{body:JSON.stringify(body)}:{})});if(res.headers.has('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];const data=await res.json();if(data.csrf)csrf=data.csrf;return {status:res.status,data,headers:res.headers};}};}
 return {store,origin,client};
}
test('Delete account requires an authenticated owner and CSRF without password or typed confirmation; removes only the signed-in owner and all their sessions',async t=>{
 const {store,client}=await fixture(t),a=client(),second=client(),b=client(),anon=client();
 await a.call('/api/auth/register','POST',{email:'delete@example.com',password});await second.call('/api/auth/login','POST',{email:'delete@example.com',password});
 const other=(await b.call('/api/auth/register','POST',{email:'keep@example.com',password})).data.user.id;
 await a.call('/api/kitchen','PUT',{revision:0,data:kitchen('delete')});await b.call('/api/kitchen','PUT',{revision:0,data:kitchen('keep')});
 const body={userId:other};
 assert.equal((await anon.call('/api/account','DELETE',body)).status,401);
 assert.equal((await a.call('/api/account','DELETE',body,{'X-CSRF-Token':'wrong'})).status,403);
 assert.equal((await a.call('/api/account','DELETE',body,{Origin:'https://other.example'})).status,403);
 assert.equal(store.users.size,2);
 const result=await a.call('/api/account','DELETE',body);assert.equal(result.data.deleted,true);assert.match(result.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await second.call('/api/kitchen')).status,401);assert.equal(store.users.has('delete@example.com'),false);assert.equal(store.kitchens.size,1);
 assert.equal((await b.call('/api/kitchen')).data.data.state.recipeJournal.rice.note,'keep');assert.equal((await second.call('/api/auth/login','POST',{email:'delete@example.com',password})).status,401);
});
test('Cloud deletion clears only owner cache, preserves guest/other accounts and clears only after server deletion succeeds',async t=>{
 const {origin,store}=await fixture(t),nativeFetch=globalThis.fetch,previousStorage=globalThis.localStorage,storage=new Map();
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 let cookie='';globalThis.fetch=async(path,init={})=>{const res=await nativeFetch(origin+path,{...init,headers:{...init.headers,Origin:origin,Cookie:cookie}});if(res.headers.has('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return res;};
 t.after(()=>{globalThis.fetch=nativeFetch;globalThis.localStorage=previousStorage;});
 let data=kitchen('guest');const client=createCloudBackup({snapshot:()=>structuredClone(data),apply:value=>{data=structuredClone(value);}});
 await client.init();client.localChanged();await client.login('a@example.com',password,true);await client.importGuest();
 const owner=client.info().account.id;storage.set('mealday.cloud.cache.'+owner+'.conflict','remove');storage.set('mealday.cloud.cache.other','keep');
 const authenticatedFetch=globalThis.fetch;globalThis.fetch=async(path,init)=>path==='/api/account'&&init?.method==='DELETE'?new Response(JSON.stringify({error:'Temporary failure'}),{status:503}):authenticatedFetch(path,init);
 await assert.rejects(client.deleteAccount(),/Temporary failure/);assert(client.info().account);assert(storage.has('mealday.cloud.cache.'+owner));globalThis.fetch=authenticatedFetch;
 assert.equal((await client.deleteAccount()).localCleared,true);assert.equal(client.info().account,null);assert.equal(data.state.recipeJournal.rice.note,'guest');
 for(const key of ['mealday.cloud.cache.'+owner,'mealday.cloud.cache.'+owner+'.conflict','mealday.cloud.account.'+owner])assert.equal(storage.has(key),false);
 assert.equal(storage.get('mealday.cloud.cache.other'),'keep');assert(storage.has('mealday.cloud.cache.guest'));assert.equal(store.users.size,0);assert.equal(store.kitchens.size,0);
});
