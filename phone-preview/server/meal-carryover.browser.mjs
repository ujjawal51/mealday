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
 await page.getByRole('button',{name:/Paneer rice dinner/}).click();
 await page.getByRole('button',{name:'Swap this meal',exact:true}).click();
 const similar=page.locator('dialog .swap-option').filter({hasText:'Spiced paneer rice'});
 assert.match(await similar.innerText(),/No change in estimated grocery spend/);
 const light=page.locator('dialog .swap-option').filter({hasText:'Lighter paneer rice'});
 assert.match(await light.innerText(),/Save AED 9\.00/);
 await light.getByRole('button',{name:'Choose',exact:true}).click();
 const report=page.getByRole('dialog');
 await report.getByText('Swap updated',{exact:true}).waitFor();
 assert.match(await report.innerText(),/Paneer · 2 → 1 planned packs/);
 assert.match(await report.innerText(),/Whole-basket estimate, not a checkout saving/);
 await report.getByRole('button',{name:'Close',exact:true}).click();
 await page.reload();await page.getByText('Last swap estimate').waitFor();
 await page.getByRole('button',{name:'Review leftovers',exact:true}).click();
 const amount=report.getByRole('spinbutton',{name:'Paneer remaining in g',exact:true});
 assert.equal(await amount.inputValue(),'');
 // Leaving the review before confirmation must not change any held stock.
 await report.getByRole('button',{name:'Close',exact:true}).click();
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mealday.android.v1')));
 assert.equal((await stored()).pantry.paneer,20);
 await page.getByRole('button',{name:'Review leftovers',exact:true}).click();
 await amount.fill('400');await report.getByRole('button',{name:'Confirm and plan next week',exact:true}).click();
 await page.getByText('Next week planned with your confirmed pantry.',{exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Review leftovers',exact:true}).waitFor();
 const next=await stored(),paneer=next.result.items.find(r=>r.key==='paneer');
 assert.equal(next.pantry.paneer,400);assert.equal(paneer.have,400);assert.equal(paneer.packs,0);
 assert.deepEqual(next.carryoverCandidates,[]);
 console.log('Phone swap & carryover passed: same-pack zero, two-to-one pack AED 9 estimate, explicit 400 g pantry after reload, no paneer purchase next week.');
} finally {await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
