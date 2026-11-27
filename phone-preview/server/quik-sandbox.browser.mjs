// Uses Careem's downloadable scenario data through a local-only server. No live Careem calls.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
import {createQuikSandbox,careemLocalTransport} from './quik-sandbox.mjs';
import {startQuikFixtures} from './quik-fixture-runner.mjs';

if(!process.env.CAREEM_FIXTURE_SPEC)throw Error('Set CAREEM_FIXTURE_SPEC to the downloaded Careem spec directory.');
const fixture=await startQuikFixtures(process.env.CAREEM_FIXTURE_SPEC),server=createServer();
server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
const quikSandbox=createQuikSandbox({call:careemLocalTransport(fixture.url)});
server.on('request',createApp({origin,store:{},quikSandbox}));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const stop=server=>{server.closeAllConnections();return new Promise(r=>server.close(r));};
const baseProfile={name:'Fixture kitchen',shop:'LuLu',city:'Dubai',people:1,days:[0],mealTypes:['breakfast'],budget:100};
const createState=(breadUnit='g')=>({profile:baseProfile,pantry:{},checked:[],favorites:[],result:{total:40,meals:[],plan:[],items:[
 {key:'milk',name:'Fresh milk',unit:'ml',need:1250,pack:1000,packs:2,cost:14,category:'Chilled'},
 {key:'egg',name:'Eggs',unit:'eggs',need:6,pack:6,packs:1,cost:8,category:'Chilled'},
 {key:'bread',name:'Bread',unit:breadUnit,need:breadUnit==='g'?350:8,pack:500,packs:1,cost:7,category:'Bakery'},
]},extraGroceries:[{id:'fixture',name:'Paper towels',checked:false}]});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 for(const valid of [true,false]){
  const page=await context.newPage();
  await page.addInitScript(state=>localStorage.setItem('mealday.android.v1',JSON.stringify(state)),createState(valid?'g':'slices'));
  await page.goto(origin);await page.locator('.nav [data-view=shopping]').click();
  await page.getByRole('button',{name:'Try Careem Quik (sandbox)',exact:true}).click();
  let form=page.getByRole('dialog',{name:'Careem Quik sandbox'});
  assert.match(await form.innerText(),/not live/);assert.match(await form.innerText(),/Added extras are not included/);
  await form.getByLabel('Test delivery area').selectOption('london');await form.getByRole('button',{name:'Find sandbox products'}).click();
  await form.getByText('No fixture delivery coverage for this test location.',{exact:true}).waitFor();
  await form.getByLabel('Test delivery area').selectOption('marina');await form.getByRole('button',{name:'Find sandbox products'}).click();
  form=page.getByRole('dialog',{name:'Review sandbox basket'});
  await form.waitFor();assert.match(await form.innerText(),/Fixture ETA 15 min/);
  if(valid){
   await form.getByRole('combobox').nth(0).selectOption('4000101');await form.getByRole('combobox').nth(1).selectOption('4000102');await form.getByRole('combobox').nth(2).selectOption('4000103');
   assert.match(await form.locator('option:checked').first().innerText(),/2 pack\(s\).*6.75 AED/);
   await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Build sandbox basket and quote'}).click();
   const quote=page.getByRole('dialog',{name:'Sandbox quote'});await quote.waitFor();
   const summary=await quote.innerText();for(const text of ['40.00 AED','4.00 AED','1.50 AED','45.50 AED','Checkout is disabled'])assert(summary.includes(text));
  }else{
   assert.match(await form.innerText(),/Some ingredients are missing. No partial total is shown/);
   assert.equal(await form.getByRole('button',{name:'Build sandbox basket and quote'}).count(),0);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.close();
 }
 assert.equal(fixture.calls.filter(c=>c.name==='create_grocery_cart_with_quantities').length,1);
 assert.equal(fixture.calls.filter(c=>c.name==='cart_get_basket_price').length,1);
 await context.close();
 console.log('Mobile Quik sandbox passed: coverage, pack selection, exact fixture quote, unmapped units, no checkout.');
}finally{await browser.close();await Promise.all([stop(server),stop(fixture.server)]);}
