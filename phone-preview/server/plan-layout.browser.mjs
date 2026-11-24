// Public synthetic kitchen; no production account or supplier requests.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
const meals=[['arab-shakshuka','Classic Shakshuka with Pita',30,15.95],['arab-ful','Ful medames with Arabic bread',15,10.58],['arab-mujadara','Mujadara — lentils, rice & onions',35,20.28],['arab-hummus','Hummus, cucumber & pita plate',10,11.87],['arab-adas-complete','Red lentil soup, rice & cucumber',50,13.67]].map(([id,name,minutes,ingredientCost],day)=>({id,name,minutes,ingredientCost,day,meal:'dinner',diet:'vegetarian',cuisine:'Arab',imageUrl:'/recipes/'+id+'.webp'}));
const state={profile:{name:'Ujjawal',shop:'LuLu',city:'Dubai',people:1,days:[0,1,2,3,4],mealTypes:['dinner'],budget:90,minutes:60,cuisine:'Arab',diet:'Any',allergies:[],appliances:['Hob'],cuisines:['Arab'],priorities:['Everyday']},pantry:{},checked:['onion'],favorites:[],extraGroceries:[{id:'extra',name:'Bananas',quantity:'2 lb',checked:true}],result:{total:72.35,meals,plan:meals.map(m=>({id:m.id,day:m.day,meal:m.meal})),items:[{key:'onion',name:'Onion',need:250,have:0,pack:1000,packs:1,cost:5,category:'Vegetables',unit:'g'}]}};
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
server.on('request',createApp({origin,store:{storePriceRecords:async()=>[]}}));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(value=>localStorage.setItem('mealday.android.v1',JSON.stringify(value)),state);
 const page=await context.newPage();await page.goto(origin);
 await page.getByRole('heading',{name:'Chef Ujjawal!',exact:true}).waitFor();
 assert.match(await page.locator('.plan-salutation').innerText(),/GOOD (MORNING|AFTERNOON|EVENING)/);
 assert.match(await page.locator('.overview-cost').innerText(),/AED 72\.35\s*\/ 90/);
 assert.equal(await page.locator('.meal-row').count(),5);
 assert.equal(await page.locator('.meal-day').first().innerText(),'MONDAY');
 assert.match(await page.locator('.grocery-link').innerText(),/2\/2 items bought/);
 await page.waitForFunction(()=>[...document.querySelectorAll('.meal-open img')].every(i=>i.complete&&i.naturalWidth>0));
 if(process.env.PLAN_SCREENSHOT==='1')console.log('PLAN_SCREENSHOT '+(await page.screenshot()).toString('base64'));
 await page.getByRole('button',{name:/Tap to view Grocery list/}).click();await page.getByRole('heading',{name:'Grocery list',exact:true}).waitFor();assert.equal(await page.locator('.grocery-done').innerText(),'2/2 done');
 await page.getByRole('button',{name:'Back to my week',exact:true}).click();
 await page.getByRole('button',{name:'Plan preferences',exact:true}).click();await page.waitForSelector('body[data-view=plan]');
 await page.locator('.nav [data-view=week]').click();
 await page.locator('.meal-open').first().click();await page.waitForSelector('body[data-view=recipe]');
 assert.equal(await page.locator('.recipe-page h1').innerText(),'Classic Shakshuka with Pita');
 await page.evaluate(()=>window.mealdayBack());await page.waitForSelector('body[data-view=week]');
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow at '+width);}
 assert.equal(await page.getByRole('button',{name:'Rebuild plan',exact:true}).isEnabled(),true);
 console.log('Plan layout passed: five meal photos, actual AED budget, extras-aware grocery progress, grocery/preferences/recipe navigation and responsive widths.');
 await context.close();
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
