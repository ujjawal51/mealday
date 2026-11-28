// Exercise the shipped phone app, planner and catalogue with local recipes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
import {liveCatalogue} from './live-catalogue.mjs';
import {catalogueDocuments} from './recipe-catalogue.mjs';
import {api,installLiveCatalogue} from '../dist/api.js';
const stock=(await liveCatalogue({publishedRecipes:async()=>catalogueDocuments()})).ingredients;
const docs=[['rich','Paneer rice dinner',350],['similar','Spiced paneer rice',330],['light','Lighter paneer rice',150]].map(([id,name,paneer])=>{
 const items=[['paneer',paneer],['rice',60],['cucumber',100]];
 return {id,published:true,data:{id,name,items,time:20,cuisine:'South Asian',diet:'vegetarian',mealTypes:['dinner'],appliances:['Hob'],steps:['Prepare ingredients.','Cook and serve.']},
 ingredients:Object.fromEntries(items.map(([key])=>[key,stock[key]]))};
});
const profile={name:'Test family',city:'Dubai',shop:'LuLu',people:1,budget:150,minutes:30,cuisine:'South Asian',cuisines:['South Asian'],diet:'Vegetarian',days:[0],mealTypes:['dinner'],allergies:[],appliances:['Hob'],priorities:[]};
const pantry={paneer:20};
installLiveCatalogue(await liveCatalogue({publishedRecipes:async()=>docs}));
const url=new URL('http://mealday.test/api/quote');
const quote=await api(new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profile,pantry,plan:[{day:0,meal:'dinner',recipeId:'rich'}]})}),url);
assert.equal(quote.status,200);
const initial={profile,pantry,result:await quote.json(),checked:[],favorites:[],seed:0};
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
server.on('request',createApp({origin,store:{publishedRecipes:async()=>docs,storePriceRecords:async()=>[]}}));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(value=>{if(!localStorage.getItem('mealday.android.v1'))localStorage.setItem('mealday.android.v1',JSON.stringify(value));},initial);
 const page=await context.newPage();await page.goto(origin);
 const assertNoCarryoverCard=async()=>{
  for(const label of ['Leftovers for next week','At the end of your week, confirm what is actually left before reusing it.','Last swap estimate','Review leftovers','Update pantry for next week']){
   assert.equal(await page.getByText(label,{exact:true}).count(),0,label);
  }
 };
 await page.getByRole('button',{name:'Rebuild plan',exact:true}).waitFor();
 await assertNoCarryoverCard();
 await page.getByRole('button',{name:/Tap to view Grocery list/}).click();
 const paneerRow=page.getByRole('checkbox',{name:'Bought Paneer',exact:true}).locator('..');
 assert.match(await paneerRow.locator('.basket-needed').innerText(),/330 g needed/);
 assert.match(await paneerRow.locator('.basket-quantities').textContent(),/Recipe 350 · At home 20 · Needed 330 g/);
 await page.getByText('Using 1 ingredient you already have',{exact:true}).click();
 assert.match(await page.locator('.pantry-used').innerText(),/20 g from home\s+330 g still needed/);
 await page.getByRole('button',{name:'Back to my week'}).click();
 await page.setViewportSize({width:320,height:750});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('button',{name:'Swap Monday dinner',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 const similar=page.locator('dialog .swap-option').filter({hasText:'Spiced paneer rice'});
 assert.match(await similar.innerText(),/No change in estimated grocery spend/);
 const light=page.locator('dialog .swap-option').filter({hasText:'Lighter paneer rice'});
 assert.match(await light.innerText(),/Save AED 9\.00/);
 await page.getByRole('searchbox',{name:'Search meals'}).fill('lighter');
 assert.equal(await similar.isVisible(),false);
 await light.getByRole('button',{name:/^Choose Lighter paneer rice/}).click();
 const report=page.getByRole('dialog');
 await report.getByText('Swap updated',{exact:true}).waitFor();
 assert.match(await report.innerText(),/Paneer · 2 → 1 planned packs/);
 assert.match(await report.innerText(),/Estimated change for the whole grocery list/);
 await report.getByRole('button',{name:'View updated grocery list',exact:true}).click();
 await page.getByRole('heading',{name:'Grocery list',exact:true}).waitFor();
 await assertNoCarryoverCard();
 assert.match(await paneerRow.locator('.basket-needed').innerText(),/130 g needed/);
 await page.getByRole('button',{name:'Back to my week'}).click();
 await page.reload();await page.getByRole('button',{name:'Rebuild plan',exact:true}).waitFor();
 await assertNoCarryoverCard();
 await page.getByRole('button',{name:'Kitchen',exact:true}).click();
 await page.getByRole('button',{name:/^Update pantry for next week/}).click();
 const amount=report.getByRole('spinbutton',{name:'Paneer remaining in g',exact:true});
 assert.equal(await amount.inputValue(),'');
 // Leaving the review before confirmation must not change any held stock.
 await report.getByRole('button',{name:'Close',exact:true}).click();
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mealday.android.v1')));
 assert.equal((await stored()).pantry.paneer,20);
 await page.getByRole('button',{name:/^Update pantry for next week/}).click();
 await amount.fill('400');await report.getByRole('button',{name:'Confirm and plan next week',exact:true}).click();
 await page.getByText('Next week planned with your confirmed pantry.',{exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Rebuild plan',exact:true}).waitFor();
 await assertNoCarryoverCard();
 const next=await stored(),paneer=next.result.items.find(r=>r.key==='paneer');
 assert.equal(next.pantry.paneer,400);assert.equal(paneer.have,400);assert.equal(paneer.packs,0);
 assert.deepEqual(next.carryoverCandidates,[]);
 await page.getByRole('button',{name:/Tap to view Grocery list/}).click();
 assert.equal(await page.getByRole('checkbox',{name:'Bought Paneer',exact:true}).count(),0);
 await page.getByText('Using 1 ingredient you already have',{exact:true}).click();
 assert.match(await page.locator('.pantry-used').innerText(),new RegExp(paneer.required+' g from home\\s+No purchase needed'));
 await page.getByRole('button',{name:'Kitchen',exact:true}).click();
 const search=page.getByRole('searchbox',{name:'Find an ingredient'});
 await search.fill('cucumber');
 const cucumber=page.getByRole('checkbox',{name:'At home: Cucumber',exact:true});
 await cucumber.click();
 await report.getByRole('button',{name:'Add without amount'}).click();
 assert.equal(await cucumber.isChecked(),true);
 assert.equal((await stored()).pantry.cucumber,undefined);
 await page.reload();
 await page.getByRole('button',{name:'Kitchen',exact:true}).click();
 await page.getByRole('searchbox',{name:'Find an ingredient'}).fill('cucumber');
 await cucumber.waitFor();
 assert.equal(await cucumber.isChecked(),true);
 await page.getByRole('button',{name:/Don’t like/}).click();
 const dislike=page.getByRole('checkbox',{name:'Don’t like: Cucumber',exact:true});
 await dislike.check();
 assert.deepEqual((await stored()).profile.dislikedIngredients,['cucumber']);
 const current=await stored();
 for(const [path,expected] of [['quote',200],['plan',422],['swaps',200]]){
  const endpoint=new URL('http://mealday.test/api/'+path);
  const response=await api(new Request(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profile:current.profile,pantry:current.pantry,plan:current.result.plan,index:0})}),endpoint);
  assert.equal(response.status,expected,path);
  if(path==='swaps')assert.deepEqual((await response.json()).choices,[]);
 }
 await page.getByRole('button',{name:'At home',exact:true}).click();
 await page.getByRole('button',{name:'Set amount for Cucumber'}).click();
 await report.getByRole('spinbutton').fill('100');
 await report.getByRole('button',{name:'Save amount'}).click();
 await report.waitFor({state:'hidden'});
 assert.equal((await stored()).pantry.cucumber,100);
 assert.equal((await stored()).result.items.find(x=>x.key==='cucumber').packs,0);
 await cucumber.click();
 await page.getByText('Ingredient removed.',{exact:true}).waitFor();
 assert.equal(await cucumber.isChecked(),false);
 assert.equal((await stored()).pantry.cucumber,undefined);
 await search.fill('mealday no such ingredient');
 await page.getByText('No ingredients match your search.').waitFor();
 await search.fill('');
 await page.setViewportSize({width:320,height:750});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 if(process.env.KITCHEN_SCREENSHOT){
  await search.fill('');
  await page.screenshot({path:process.env.KITCHEN_SCREENSHOT});
 }
 console.log('Kitchen browser passed: pantry search, mark without a quantity, reload, edit amount, grocery deduction, dislike filtering and narrow phone layout.');
 console.log('Phone swap & carryover passed: same-pack zero, two-to-one pack AED 9 estimate, explicit 400 g pantry after reload, no paneer purchase next week.');
} finally {await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
