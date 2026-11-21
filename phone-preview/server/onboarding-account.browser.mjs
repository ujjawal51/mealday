// End-to-end UI checks use only an isolated in-memory account store; no real emails.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
import {passwordHash} from './security.mjs';
class Store{
 users=new Map();sessions=new Map();kitchens=new Map();
 async userByEmail(email){return this.users.get(email);}
 async createUser(user){if(this.users.has(user.email))return false;this.users.set(user.email,user);return true;}
 async saveSession(s){this.sessions.set(s._id,s);}
 async session(id){return this.sessions.get(id);}
 async deleteSession(id){this.sessions.delete(id);}
 async kitchen(id){return this.kitchens.get(id);}
 async issueEmailToken(){return true;}
 async cancelEmailToken(){}
 async saveKitchen(id,revision,data){const old=this.kitchens.get(id);if((old?.revision||0)!==revision)return null;const next={revision:revision+1,data,updatedAt:new Date().toISOString()};this.kitchens.set(id,next);return next;}
}
const store=new Store(),messages=[];
await store.createUser({_id:'existing',email:'existing@example.com',password:await passwordHash('existing-password-123')});
store.kitchens.set('existing',{revision:1,data:{state:{profile:{name:'Old profile',days:[0],mealTypes:['dinner'],people:2,shop:'LuLu',budget:100},pantry:{},result:null,checked:[],favorites:[],recipeJournal:{rice:{note:'Keep this cloud note',rating:5}}},history:{version:1,events:[]}}});
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;server.on('request',createApp({store,origin,mailer:{send:async message=>messages.push(message)}}));
const browser=await chromium.launch();
try{
 async function page(){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
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
 assert.match(await first.page.locator('h1').innerText(),/Your week starts here/);
 assert.equal(await first.page.locator('.nav').isVisible(),false);
 assert.equal(await first.page.locator('button:has-text("Sign in with Google")').count(),0);
 assert.equal(await first.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const saved=await first.page.evaluate(()=>JSON.parse(localStorage.getItem('mealday.pending-setup.v1')));
 assert.equal(saved.profile.name,'New Chef');assert.equal(saved.profile.shop,'LuLu');
 await click(first.page,'setup-account-back');await first.page.waitForSelector('.story-benefits');
 await click(first.page,'story-next');
 await first.page.reload();await first.page.waitForSelector('body[data-view="account"]');
 await click(first.page,'setup-account-mode','register');
 await first.page.locator('[name="email"]').fill('new@example.com');
 await first.page.locator('[name="password"]').fill('a-long-password-123');
 await first.page.locator('[name="confirmPassword"]').fill('different-password-123');
 await first.page.locator('#setup-account-form button[type="submit"]').click();
 assert.match(await first.page.locator('[role="alert"]').innerText(),/match/);
 await first.page.locator('[name="email"]').fill('new@example.com');
 await first.page.locator('[name="password"]').fill('a-long-password-123');
 await first.page.locator('[name="confirmPassword"]').fill('a-long-password-123');
 await first.page.locator('#setup-account-form button[type="submit"]').click();
 await first.page.getByRole('alert').filter({hasText:'Check your inbox'}).waitFor();
 assert.equal(messages.length,1);
 assert.equal(await first.page.evaluate(()=>JSON.stringify({...localStorage}).includes('a-long-password-123')),false);
 await first.page.reload();await first.page.waitForSelector('body[data-view="account"]');
 await click(first.page,'setup-account-mode','login');
 await first.page.locator('[name="email"]').fill('existing@example.com');
 await first.page.locator('[name="password"]').fill('existing-password-123');
 await first.page.locator('#setup-account-form button[type="submit"]').click();
 await first.page.waitForSelector('body[data-view="week"]',{timeout:60000});
 const result=await first.page.evaluate(()=>JSON.parse(localStorage.getItem('mealday.android.v1')));
 assert.equal(result.profile.name,'New Chef');assert.equal(result.profile.people,1);assert.equal(result.profile.shop,'LuLu');
 assert.equal(result.recipeJournal.rice.note,'Keep this cloud note');
 assert.equal(await first.page.evaluate(()=>localStorage.getItem('mealday.pending-setup.v1')),null);
 await first.context.close();
 const guest=await page();await wizard(guest.page);await click(guest.page,'setup-account-guest');
 await guest.page.waitForSelector('body[data-view="week"]',{timeout:60000});
 assert.equal(await guest.page.evaluate(()=>JSON.parse(localStorage.getItem('mealday.android.v1')).profile.name),'New Chef');
 assert.equal(await guest.page.evaluate(()=>localStorage.getItem('mealday.pending-setup.v1')),null);
 await guest.context.close();
 console.log('Browser onboarding account checks passed: full wizard, phone layout, Back, refresh, mismatch, verification, login, preserved cloud notes, selected preferences and guest plan.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
