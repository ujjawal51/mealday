import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {serverConfig} from './config.mjs';
import {createApp} from './app.mjs';
import {createGateway} from '../hosting/site-gateway.mjs';
const secret='test-only-proxy-secret-with-at-least-32-characters';
class Store {
 users=new Map();sessions=new Map();kitchens=new Map();offline=false;
 async ping(){if(this.offline)throw Error('private-database-credentials');}
 async userByEmail(email){return this.users.get(email);}
 async createUser(user){this.users.set(user.email,user);return true;}
 async saveSession(session){this.sessions.set(session._id,session);}
 async session(id){return this.sessions.get(id);}
 async deleteSession(id){this.sessions.delete(id);}
 async kitchen(id){return this.kitchens.get(id);}
 async saveKitchen(id,revision,data){const old=this.kitchens.get(id);if((old?.revision||0)!==revision)return null;const next={revision:revision+1,data,updatedAt:new Date().toISOString()};this.kitchens.set(id,next);return next;}
}
test('Cloud deployment binds externally, derives HTTPS origin and rejects a PC-local Mongo URI on Render',()=>{
 const env={NODE_ENV:'production',RENDER:'true',RENDER_EXTERNAL_URL:'https://mealday.example',MONGODB_URI:'mongodb+srv://db.example/mealday',PORT:'10000'};
 assert.equal(serverConfig(env).host,'0.0.0.0');assert.equal(serverConfig(env).origin,env.RENDER_EXTERNAL_URL);assert.equal(serverConfig(env).port,10000);
 assert.throws(()=>serverConfig({...env,MONGODB_URI:'mongodb://127.0.0.1:27017'}),/localhost/);
 assert.throws(()=>serverConfig({...env,APP_ORIGIN:'http://mealday.example'}),/HTTPS/);
 assert.throws(()=>serverConfig({...env,APP_ORIGIN:'https://mealday.example/path'}),/origin/);
 assert.throws(()=>serverConfig({...env,MEALDAY_PROXY_SECRET:'short'}),/32/);
});
test('Gateway keeps platform credentials private, pins the backend and fails closed on redirects or outages',async()=>{
 let captured;
 const gateway=createGateway(async(url,init)=>{captured={url,init};return new Response('{}',{headers:{'Content-Type':'application/json','Set-Cookie':'other=secret; Secure; HttpOnly'}});});
 const req=new Request('https://mealday.example/api/account',{headers:{Cookie:'platform_identity=private; __Host-mealday_session='+'a'.repeat(43),Authorization:'Bearer private-platform-token','oai-authenticated-user-id':'private-user','cf-connecting-ip':'203.0.113.1'}});
 const env={MEALDAY_BACKEND_URL:'https://backend.example',MEALDAY_PROXY_SECRET:secret};const res=await gateway.fetch(req,env);
 assert.equal(captured.url,'https://backend.example/api/account');assert.equal(captured.init.headers.get('cookie'),'__Host-mealday_session='+'a'.repeat(43));assert.equal(captured.init.headers.get('authorization'),null);assert.equal(captured.init.headers.get('oai-authenticated-user-id'),null);assert.equal(res.headers.get('set-cookie'),null);assert.equal(captured.init.redirect,'manual');
 assert.equal((await gateway.fetch(req,{})).status,503);
 assert.equal((await gateway.fetch(req,{...env,MEALDAY_BACKEND_URL:'https://mealday.example'})).status,503);
 assert.equal((await createGateway(async()=>Response.redirect('https://other.example')).fetch(req,env)).status,503);
 assert.equal((await createGateway(async()=>{throw Error(secret);}).fetch(req,env)).status,503);
});
test('Published-origin gateway: two phones share Mongo-store state while sessions, CSRF and identity remain isolated',async t=>{
 const store=new Store(),origin='https://mealday.example';
 const server=createServer(createApp({store,origin,production:true,allowRegistration:true,proxySecret:secret}));server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));
 const local='http://127.0.0.1:'+server.address().port;
 const gateway=createGateway((url,init)=>fetch(local+new URL(url).pathname,init));
 const env={MEALDAY_BACKEND_URL:'https://backend.example',MEALDAY_PROXY_SECRET:secret};
 function phone(ip){let cookie='',csrf='';return {async call(path,method='GET',data){const response=await gateway.fetch(new Request(origin+path,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf,'CF-Connecting-IP':ip},...(data?{body:JSON.stringify(data)}:{})}),env);if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const value=await response.json();if(value.csrf)csrf=value.csrf;return {response,value};}};}
 const a=phone('203.0.113.1'),b=phone('203.0.113.2'),other=phone('203.0.113.3');const credentials={email:'same@example.com',password:'A correct test password 123'};
 const registration=await a.call('/api/auth/register','POST',credentials);assert.equal(registration.response.status,200);assert.match(registration.response.headers.get('set-cookie'),/__Host-mealday_session=.*Secure/);
 const kitchen={state:{profile:{name:'Phone one'},pantry:{},favorites:[],checked:[],recipeJournal:{rice:{rating:5,note:'From phone one'}}},history:{version:1,events:[]}};
 assert.equal((await a.call('/api/kitchen','PUT',{revision:0,data:kitchen})).response.status,200);
 assert.equal((await b.call('/api/auth/login','POST',credentials)).response.status,200);assert.equal((await b.call('/api/kitchen')).value.data.state.recipeJournal.rice.note,'From phone one');
 kitchen.state.recipeJournal.rice.note='Changed on phone two';assert.equal((await b.call('/api/kitchen','PUT',{revision:1,data:kitchen})).response.status,200);assert.equal((await a.call('/api/kitchen')).value.data.state.recipeJournal.rice.note,'Changed on phone two');
 assert.equal((await other.call('/api/kitchen')).response.status,401);assert.equal((await a.call('/api/kitchen','PUT',{revision:0,data:kitchen})).response.status,409);
 assert.equal((await a.call('/api/auth/logout','POST',{})).response.status,200);assert.equal((await a.call('/api/kitchen')).response.status,401);
 assert.equal((await fetch(local+'/api/account')).status,403);assert.equal((await fetch(local+'/api/health')).status,200);store.offline=true;const down=await fetch(local+'/api/health');assert.equal(down.status,503);assert.doesNotMatch(await down.text(),/private-database-credentials/);
});
