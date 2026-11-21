import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createEmailRecovery} from './email-recovery.mjs';
import {createMailer} from './mailer.mjs';
import {createApp} from './app.mjs';
import {passwordHash,passwordMatches,digest} from './security.mjs';
class Store{
 users=new Map();sessions=new Map();kitchens=new Map();tokens=new Map();
 async userByEmail(email){return structuredClone(this.users.get(email));}
 async createUser(user){if(this.users.has(user.email))return false;this.users.set(user.email,structuredClone(user));return true;}
 async saveSession(s){this.sessions.set(s._id,s);}
 async session(id){return this.sessions.get(id);}
 async deleteSession(id){this.sessions.delete(id);}
 async kitchen(id){return this.kitchens.get(id);}
 async issueEmailToken(id,purpose,hash,expiresAt,at){
  const key=id+':'+purpose,previous=this.tokens.get(key);
  if(previous&&at-previous.at<60000)return false;
  this.tokens.set(key,{id,purpose,hash,expiresAt,at});return true;
 }
 async cancelEmailToken(id,purpose,hash){const key=id+':'+purpose;if(this.tokens.get(key)?.hash===hash)this.tokens.delete(key);}
 async consumeEmailToken(purpose,hash,at,password){
  const entry=[...this.tokens].find(([,v])=>v.purpose===purpose&&v.hash===hash&&v.expiresAt>at);if(!entry)return null;
  this.tokens.delete(entry[0]);
  const user=[...this.users.values()].find(u=>u._id===entry[1].id);user.emailVerifiedAt=at.toISOString();
  if(purpose==='reset'){user.password=password;user.authVersion=(user.authVersion||0)+1;delete user.passwordHash;delete user.salt;this.tokens.delete(user._id+':verify');for(const [id,s] of this.sessions)if(s.userId===user._id)this.sessions.delete(id);}
  return structuredClone(user);
 }
}
function raw(message){return new URLSearchParams(new URL(message.text.match(/https?:\/\/\S+/)[0]).hash.slice(1)).get('token');}
test('One-time email tokens: hash storage, purpose binding, expiry, cooldown, concurrent consumption and delivery failure',async()=>{
 const store=new Store(),messages=[];let time=Date.now(),fail=false;
 await store.createUser({_id:'one',email:'cook@example.com',password:await passwordHash('original-password-123')});
 const recovery=createEmailRecovery({store,origin:'https://mealday.example',mailer:{send:async m=>{if(fail)throw Error('private-provider-details');messages.push(m);}},now:()=>time});
 assert.deepEqual(await recovery.request('missing@example.com','reset'),await recovery.request('cook@example.com','reset'));
 const reset=raw(messages[0]);assert.equal([...store.tokens.values()][0].hash,digest(reset));
 assert(!messages[0].text.includes('?token='));assert.equal(messages.length,1);
 await recovery.request('cook@example.com','reset');assert.equal(messages.length,1);
 await assert.rejects(recovery.consume('verify',reset),/invalid or expired/);
 time+=31*60000;await assert.rejects(recovery.consume('reset',reset,'new-password-1234'),/invalid or expired/);
 await recovery.request('cook@example.com','reset');const fresh=raw(messages[1]);
 const races=await Promise.allSettled([recovery.consume('reset',fresh,'new-password-1234'),recovery.consume('reset',fresh,'other-password-1234')]);
 assert.equal(races.filter(x=>x.status==='fulfilled').length,1);assert.equal((await store.userByEmail('cook@example.com')).authVersion,1);
 await recovery.sendLink(await store.userByEmail('cook@example.com'),'verify');const verify=raw(messages.at(-1));
 await recovery.consume('verify',verify);await assert.rejects(recovery.consume('verify',verify),/invalid or expired/);
 time+=60001;fail=true;await recovery.request('cook@example.com','reset');assert(!store.tokens.has('one:reset'),'Failed deliveries leave no usable token');
});
test('HTTP flow: new-user verification, reset, revoked sessions, generic requests and existing-account compatibility',async t=>{
 const store=new Store(),messages=[],mailer={send:async m=>messages.push(m)};
 const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port;server.on('request',createApp({store,origin,mailer}));t.after(()=>new Promise(r=>server.close(r)));
 let cookie='';
 async function call(path,body,extra={}){
  const res=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...extra},...(body?{body:JSON.stringify(body)}:{})});
  if(res.headers.has('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
  return {status:res.status,data:await res.json(),headers:res.headers};
 }
 const credentials={email:'cook@example.com',password:'original-password-123'};
 assert.equal((await call('/api/auth/register',credentials)).data.requiresVerification,true);
 assert.equal((await call('/api/auth/login',credentials)).status,403);
 const verify=raw(messages[0]);
 assert.equal((await call('/api/auth/verify-email',{token:verify},{Origin:'https://evil.example'})).status,403);
 assert.equal((await call('/api/auth/verify-email',{token:verify})).status,200);
 assert.equal((await call('/api/auth/login',credentials)).status,200);
 assert.equal((await call('/api/account')).data.user.emailVerified,true);
 const user=await store.userByEmail(credentials.email);store.kitchens.set(user._id,{revision:1,data:{note:'keep my kitchen'}});
 const oldCookie=cookie;
 const known=await call('/api/auth/forgot-password',{email:credentials.email}),unknown=await call('/api/auth/forgot-password',{email:'unknown@example.com'});
 assert.equal(known.status,202);assert.deepEqual(known.data,unknown.data);
 assert(!JSON.stringify(known.data).includes(raw(messages.at(-1))));
 const reset=raw(messages.at(-1));
 assert.equal((await call('/api/auth/reset-password',{token:reset,password:'short'})).status,400);
 const result=await call('/api/auth/reset-password',{token:reset,password:'new-password-1234'});assert.equal(result.status,200);assert.match(result.headers.get('set-cookie'),/Max-Age=0/);
 cookie=oldCookie;assert.equal((await call('/api/kitchen')).status,401);
 assert.equal((await call('/api/auth/login',credentials)).status,401);
 assert.equal((await call('/api/auth/login',{...credentials,password:'new-password-1234'})).status,200);
 assert.equal((await call('/api/kitchen')).data.data.note,'keep my kitchen');
 assert.equal((await call('/api/auth/reset-password',{token:reset,password:'another-password-1234'})).status,400);
 await store.createUser({_id:'legacy',email:'legacy@example.com',password:await passwordHash(credentials.password)});
 assert.equal((await call('/api/auth/login',{...credentials,email:'legacy@example.com'})).status,200,'Existing accounts are not locked out by email rollout');
 for(let n=0;n<12;n++)await call('/api/auth/request-verification',{email:'unknown@example.com'});
 assert.equal((await call('/api/auth/request-verification',{email:'unknown@example.com'})).status,429);
});
test('Mailer is optional, uses Resend HTTPS and never exposes provider errors or keys',async()=>{
 assert.equal(createMailer({}),null);let sent;
 const mailer=createMailer({RESEND_API_KEY:'private-key',MAIL_FROM:'Mealday <accounts@example.com>'},async(url,init)=>{sent={url,init};return Response.json({id:'one'});});
 await mailer.send({to:'cook@example.com',subject:'Test',text:'Safe content'});
 assert.equal(sent.url,'https://api.resend.com/emails');assert.equal(sent.init.headers.Authorization,'Bearer private-key');
 assert.equal(JSON.parse(sent.init.body).from,'Mealday <accounts@example.com>');
 await assert.rejects(createMailer({RESEND_API_KEY:'private-key',MAIL_FROM:'accounts@example.com'},async()=>{throw Error('private-key');}).send({}),e=>!e.message.includes('private-key'));
 const recovery=createEmailRecovery({store:new Store(),origin:'https://mealday.example',mailer:null});
 await assert.rejects(recovery.request('cook@example.com','reset'),{status:503});
});
