import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {createGoogleAuth} from './google-auth.mjs';
import {createApp} from './app.mjs';
const clientId='test-client.apps.googleusercontent.com';
const claims=(nonce,extra={})=>({iss:'https://accounts.google.com',aud:clientId,sub:'google-one',email:'cook@gmail.com',email_verified:true,nonce,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,...extra});
const auth=()=>createGoogleAuth({clientId,verifyIdToken:async token=>JSON.parse(token)});
class Store{
 users=new Map();sessions=new Map();challenges=new Map();kitchens=new Map();
 async userByEmail(email){return this.users.get(email);}
 async session(id){const value=this.sessions.get(id);return value?.expiresAt>new Date()?value:null;}
 async saveSession(s){this.sessions.set(s._id,s);}
 async deleteSession(id){this.sessions.delete(id);}
 async issueGoogleChallenge(s){this.challenges.set(s._id,s);}
 async consumeGoogleChallenge(hash,at){const value=this.challenges.get(hash);if(!value||value.expiresAt<=at)return null;this.challenges.delete(hash);return value;}
 async markGoogleReauthenticated(id,at){this.sessions.get(id).deleteVerifiedAt=at;}
 async googleUser({sub,email,authoritative},{allowRegistration=true}={}){
  let user=[...this.users.values()].find(u=>u.googleSub===sub);if(user)return user;
  user=this.users.get(email);
  if(user){if(user.googleSub||!authoritative)throw Object.assign(Error('Cannot link this account.'),{status:409});user.googleSub=sub;user.authVersion=(user.authVersion||0)+1;for(const [id,s] of this.sessions)if(s.userId===user._id)this.sessions.delete(id);return user;}
  if(!allowRegistration)throw Object.assign(Error('New accounts are not enabled.'),{status:403});
  user={_id:randomUUID(),email,googleSub:sub,emailVerifiedAt:new Date().toISOString(),authVersion:0};this.users.set(email,user);return user;
 }
 async kitchen(id){return this.kitchens.get(id);}
 async deleteAccount(id,version){const user=[...this.users.values()].find(u=>u._id===id);if(!user||(user.authVersion||0)!==version)return false;this.users.delete(user.email);this.kitchens.delete(id);for(const [key,s] of this.sessions)if(s.userId===id)this.sessions.delete(key);return true;}
}
async function fixture(t,googleAuth=auth()){
 const store=new Store(),server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
 server.on('request',createApp({store,origin,googleAuth,production:true,allowRegistration:true}));t.after(()=>new Promise(r=>server.close(r)));
 function browser(){const jar=new Map();let nonce,csrf;return {get nonce(){return nonce;},async call(path,method='GET',body,extra={}){
  const response=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/json','X-CSRF-Token':csrf||'',...extra},...(body?{body:JSON.stringify(body)}:{})});
  for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],at=pair.indexOf('='),name=pair.slice(0,at),value=pair.slice(at+1);if(value)jar.set(name,value);else jar.delete(name);}
  const data=response.headers.get('content-type')?.includes('application/json')?await response.json():{};if(data.nonce)nonce=data.nonce;if(data.csrf)csrf=data.csrf;return {status:response.status,data,headers:response.headers};
 }};}
 return {store,browser,origin};
}
test('Google token claims require the configured audience, issuer, nonce, expiry and verified email',async()=>{
 assert.equal(createGoogleAuth({clientId:''}),null);const verifier=auth(),nonce='n'.repeat(43);
 assert.equal((await verifier.verify(JSON.stringify(claims(nonce)),nonce)).authoritative,true);
 for(const bad of [{aud:'other'},{azp:'other'},{iss:'https://evil.example'},{nonce:'wrong'},{email_verified:false},{exp:1},{iat:Math.floor(Date.now()/1000)+3600},{sub:''}])await assert.rejects(verifier.verify(JSON.stringify(claims(nonce,bad)),nonce));
 assert.equal((await verifier.verify(JSON.stringify(claims(nonce,{email:'external@example.com'})),nonce)).authoritative,false);
 assert.equal((await verifier.verify(JSON.stringify(claims(nonce,{email:'work@example.com',hd:'example.com'})),nonce)).authoritative,true);
});
test('Google creates or restores the same account, binds a single-use challenge to the browser and preserves old kitchen data',async t=>{
 const {store,browser}=await fixture(t),a=browser(),other=browser();
 store.users.set('cook@gmail.com',{_id:'existing',email:'cook@gmail.com',password:{old:'do not use'}});store.kitchens.set('existing',{revision:1,data:{note:'keep my data'}});
 const challenge=await a.call('/api/auth/google/challenge');assert.match(challenge.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);assert.match(challenge.headers.get('set-cookie'),/Secure/);
 const credential=JSON.stringify(claims(a.nonce));assert.equal((await other.call('/api/auth/google','POST',{credential})).status,400);
 assert.equal((await a.call('/api/auth/google','POST',{credential},{Origin:'https://evil.example'})).status,403);
 const login=await a.call('/api/auth/google','POST',{credential});assert.equal(login.status,200);assert.equal(login.data.user.id,'existing');assert.equal(login.data.user.authMethod,'google');assert.match(login.headers.get('set-cookie'),/__Host-mealday_session=/);
 assert.equal((await a.call('/api/kitchen')).data.data.note,'keep my data');assert.equal((await a.call('/api/auth/google','POST',{credential})).status,400);
 await other.call('/api/auth/google/challenge');const second=await other.call('/api/auth/google','POST',{credential:JSON.stringify(claims(other.nonce))});assert.equal(second.data.user.id,'existing');assert.equal(store.users.size,1);
 assert.equal((await a.call('/api/auth/register','POST',{email:'new@gmail.com',password:'unused-password'})).status,410);
 assert.equal((await a.call('/api/auth/request-verification','POST',{email:'cook@gmail.com'})).status,410);
 assert.equal((await a.call('/verify-email.html')).status,303);
});
test('Google account deletion uses the existing session without another Google challenge',async t=>{
 const {store,browser}=await fixture(t),a=browser();await a.call('/api/auth/google/challenge');await a.call('/api/auth/google','POST',{credential:JSON.stringify(claims(a.nonce))});
 assert.equal((await a.call('/api/account','DELETE',{})).data.deleted,true);assert.equal(store.users.size,0);assert.equal(store.sessions.size,0);
 assert.equal((await a.call('/api/account','DELETE',{})).status,401);
});
test('Missing Google client configuration stays explicit without re-enabling email signup',async t=>{
 const {browser}=await fixture(t,null),a=browser();assert.equal((await a.call('/api/account')).data.googleSignIn,false);
 assert.equal((await a.call('/api/auth/google/challenge')).status,503);assert.equal((await a.call('/api/auth/login','POST',{email:'a@gmail.com',password:'anything'})).status,410);
});
