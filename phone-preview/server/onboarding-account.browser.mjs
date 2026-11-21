// Google's external SDK and token verifier are mocked only for this isolated browser test.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
import {createGoogleAuth} from './google-auth.mjs';
const clientId='test-client.apps.googleusercontent.com';
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
 async saveKitchen(id,revision,data){const old=this.kitchens.get(id);if((old?.revision||0)!==revision)return null;const next={revision:revision+1,data,updatedAt:new Date().toISOString()};this.kitchens.set(id,next);return next;}
 async deleteAccount(id,version){const user=[...this.users.values()].find(u=>u._id===id);if(!user||(user.authVersion||0)!==version)return false;this.users.delete(user.email);this.kitchens.delete(id);for(const [key,s] of this.sessions)if(s.userId===id)this.sessions.delete(key);return true;}
}
const store=new Store();store.users.set('cook@gmail.com',{_id:'existing',email:'cook@gmail.com',password:{legacy:true}});
store.kitchens.set('existing',{revision:1,data:{state:{profile:{name:'Old profile',days:[0],mealTypes:['dinner'],people:2,shop:'LuLu',budget:100},pantry:{},result:null,checked:[],favorites:[],recipeJournal:{rice:{note:'Keep this cloud note',rating:5}}},history:{version:1,events:[]}}});
const googleAuth=createGoogleAuth({clientId,verifyIdToken:async token=>JSON.parse(token)});
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
server.on('request',createApp({store,origin,googleAuth,allowRegistration:true}));const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 async function page(){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.route('https://accounts.google.com/gsi/client',route=>route.fulfill({contentType:'application/javascript',body:`window.google={accounts:{id:{initialize(options){window.testGoogleOptions=options;},renderButton(node){const button=document.createElement('button');button.type='button';button.textContent='Continue with Google';button.onclick=()=>{const user=window.testGoogleIdentity||{sub:'google-one',email:'cook@gmail.com'};window.testGoogleOptions.callback({credential:JSON.stringify({...user,iss:'https://accounts.google.com',aud:window.testGoogleOptions.client_id,email_verified:true,nonce:window.testGoogleOptions.nonce,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})});};node.append(button);}}}};`}));
  const page=await context.newPage();await page.goto(origin);return {context,page};
 }
 const click=(page,action,id)=>page.locator('[data-action="'+action+'"]'+(id===undefined?'':'[data-id="'+id+'"]')).first().click();
 async function wizard(page){
  await click(page,'start-setup');
  await page.locator('#wizard-name').fill('New Chef');await click(page,'pick-one','25-34');await click(page,'next-step');
  await click(page,'pick-one','solo');await click(page,'next-step');
  await click(page,'pick-one','time');await click(page,'next-step');await click(page,'story-next');
  await click(page,'pick-one','likely');await click(page,'next-step');
  await click(page,'pick-one','30');await click(page,'next-step');
  await click(page,'pick-one','instagram');await click(page,'next-step');await click(page,'story-next');
  await click(page,'pick-one','LuLu');await click(page,'next-step');
  for(let n=0;n<9;n++)await click(page,'next-step'); // People through dietary needs.
  await click(page,'pick-many','None');await click(page,'next-step');await click(page,'next-step');
  await click(page,'story-next');
  await page.waitForSelector('body[data-view="account"]');
 }

 const first=await page();await wizard(first.page);
 assert.equal(await first.page.locator('input[type="password"]').count(),0);
 assert.equal(await first.page.locator('.nav').isVisible(),false);
 assert.equal(await first.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await first.page.locator('text=Resend verification').count(),0);
 await click(first.page,'setup-account-back');await first.page.waitForSelector('.story-benefits');await click(first.page,'story-next');
 await first.page.reload();await first.page.waitForSelector('body[data-view="account"]');
 await first.page.getByRole('button',{name:'Continue with Google',exact:true}).click();
 await first.page.waitForSelector('body[data-view="week"]',{timeout:60000});
 await first.page.waitForFunction(()=>!JSON.parse(localStorage.getItem('mealday.cloud.v1')).dirty);
 const result=await first.page.evaluate(()=>JSON.parse(localStorage.getItem('mealday.android.v1')));
 assert.equal(result.profile.name,'New Chef');assert.equal(result.profile.people,1);assert.equal(result.recipeJournal.rice.note,'Keep this cloud note');
 assert.equal(await first.page.evaluate(()=>localStorage.getItem('mealday.pending-setup.v1')),null);
 await first.page.locator('.nav [data-view="settings"]').click();await click(first.page,'delete-account');
 assert.equal(await first.page.locator('#dialog input[type="password"]').count(),0);
 assert.equal(await first.page.locator('#delete-account-form button[type="submit"]').isDisabled(),true);
 await first.page.evaluate(()=>{window.testGoogleIdentity={sub:'other',email:'other@gmail.com'};});
 await first.page.getByRole('button',{name:'Continue with Google',exact:true}).click();
 await first.page.getByRole('status').filter({hasText:'Use the Google account'}).waitFor();assert(store.users.has('cook@gmail.com'));
 await first.page.evaluate(()=>{delete window.testGoogleIdentity;});await first.page.getByRole('button',{name:'Try Google sign-in again',exact:true}).click();
 await first.page.getByRole('button',{name:'Continue with Google',exact:true}).click();
 await first.page.waitForFunction(()=>!document.querySelector('#delete-account-form button[type="submit"]').disabled);
 await first.page.locator('#delete-account-form [name="confirmation"]').fill('DELETE');await first.page.locator('#delete-account-form button[type="submit"]').click();
 await first.page.waitForFunction(()=>!document.querySelector('#dialog').open);assert(!store.users.has('cook@gmail.com'));assert(!store.kitchens.has('existing'));await first.context.close();
 const signup=await page();await wizard(signup.page);await signup.page.evaluate(()=>{window.testGoogleIdentity={sub:'brand-new',email:'new@gmail.com'};});
 await signup.page.getByRole('button',{name:'Continue with Google',exact:true}).click();await signup.page.waitForSelector('body[data-view="week"]',{timeout:60000});assert(store.users.has('new@gmail.com'));await signup.context.close();
 const guest=await page();await wizard(guest.page);await click(guest.page,'setup-account-guest');await guest.page.waitForSelector('body[data-view="week"]',{timeout:60000});await guest.context.close();
 const standalone=await page();await standalone.page.goto(origin+'/signup.html');assert.equal(await standalone.page.locator('input[type="password"]').count(),0);await standalone.page.getByRole('button',{name:'Continue with Google',exact:true}).waitFor();await standalone.context.close();
 console.log('Browser Google checks passed: all filters, responsive layout, Back, refresh, same-account login and retained notes, Google signup, guest planning, and Google-confirmed deletion.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
