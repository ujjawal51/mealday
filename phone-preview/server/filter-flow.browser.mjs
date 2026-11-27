// Synthetic guest only; no production users or paid retailer lookups.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
const state={profile:{name:'Filter test',city:'Dubai',shop:'LuLu',people:1,budget:500,minutes:60,cuisine:'UAE mix',cuisines:['UAE mix'],diet:'Any',days:[0],mealTypes:['dinner'],allergies:[],appliances:['Hob'],priorities:[]},pantry:{},favorites:[],checked:[],seed:1,result:{total:15,items:[],plan:[{day:0,meal:'dinner',recipeId:'arab-shakshuka'}],meals:[{id:'arab-shakshuka',name:'Classic Shakshuka with Pita',minutes:30,day:0,meal:'dinner',diet:'vegetarian',cuisine:'Arab',imageUrl:'/recipes/arab-shakshuka.webp'}]}};
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;server.on('request',createApp({origin,store:{storePriceRecords:async()=>[]}}));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(value=>localStorage.setItem('mealday.android.v1',JSON.stringify(value)),state);
 const page=await context.newPage();await page.goto(origin);await page.getByRole('button',{name:'Plan preferences',exact:true}).click();
 const tile=(name,key)=>page.locator('label.preference-choice').filter({has:page.locator('input[name="'+name+'"][value="'+key+'"]')});
 await tile('diet','Vegan').click();assert.equal(await page.locator('[name=diet][value=Vegan]').isChecked(),true);await page.locator('[name=minutes]').selectOption('30');
 await tile('allergies','Milk').click();await tile('allergies','Gluten').click();
 const none=page.locator('.no-allergies');assert.equal(await none.getAttribute('aria-pressed'),'false');await none.click();assert.equal(await page.locator('[name=allergies]:checked').count(),0);
 await tile('allergies','Milk').click();await tile('allergies','Gluten').click();
 await page.locator('.optional-preferences>summary').click();await page.locator('[name=cuisines][value="UAE mix"]').uncheck();await page.locator('[name=cuisines][value=Arab]').check();await page.locator('[name=priorities][value=Quick]').check();
 await page.getByRole('button',{name:'Apply & rebuild plan',exact:true}).click();await page.waitForSelector('body[data-view=week]',{timeout:60000});
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mealday.android.v1')));
 assert.equal(saved.profile.diet,'Vegan');assert.deepEqual(saved.profile.allergies,['Gluten','Milk']);assert.deepEqual(saved.profile.cuisines,['Arab']);assert(saved.result.meals.every(r=>r.minutes<=30&&r.diet==='vegan'&&r.cuisine==='Arab'&&r.matchedStyles.includes('Quick')));
 assert.equal(await page.locator('.meal-tag').first().innerText(),'Speedy meals');
 // An infeasible combination reports no match and retains the last saved plan.
 const before=JSON.stringify(saved.result);await page.getByRole('button',{name:'Plan preferences',exact:true}).click();
 await tile('appliances','Hob').click();await tile('appliances','Oven').click();
 await page.locator('[name=minutes]').selectOption('15');await page.locator('.optional-preferences>summary').click();
 await page.locator('[name=priorities][value=Quick]').uncheck();await page.locator('[name=priorities][value=Protein]').check();
 await page.getByRole('button',{name:'Apply & rebuild plan',exact:true}).click();await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/No .*recipes match/);
 saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mealday.android.v1')));assert.equal(JSON.stringify(saved.result),before);assert.deepEqual(saved.profile.priorities,['Quick']);
 console.log('Filter browser passed: combined Vegan/Arab/Gluten/Milk/time/Quick preferences rebuild and matching badges, no-match message and unchanged saved plan.');
 await context.close();
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
