// Synthetic guest with public catalogue fixtures; no production writes or paid APIs.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
import {catalogueDocuments} from './recipe-catalogue.mjs';
const rows=catalogueDocuments(),state={profile:{name:'Complete meal test',city:'Dubai',shop:'LuLu',people:2,budget:200,minutes:90,cuisine:'South Asian',cuisines:['South Asian'],diet:'Vegetarian',days:[0],mealTypes:['dinner'],allergies:[],appliances:['Hob'],priorities:[]},seed:0,pantry:{},favorites:[],checked:[],result:{total:0,items:[],plan:[],meals:[]}};
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;server.on('request',createApp({origin,store:{publishedRecipes:async()=>rows,storePriceRecords:async()=>[]}}));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await context.addInitScript(value=>localStorage.setItem('mealday.android.v1',JSON.stringify(value)),state);
 const page=await context.newPage();await page.goto(origin);
 for(const cuisine of ['South Asian','Emirati','Arab']){
  await page.getByRole('button',{name:'Plan preferences',exact:true}).click();await page.locator('.optional-preferences>summary').click();
  for(const field of await page.locator('[name=cuisines]').all())await field.uncheck();await page.locator('[name=cuisines][value="'+cuisine+'"]').check();
  await page.getByRole('button',{name:'Apply & rebuild plan',exact:true}).click();await page.waitForSelector('body[data-view=week]',{timeout:60000});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mealday.android.v1'))),meal=saved.result.meals[0];
  assert.equal(meal.cuisine,cuisine);assert.equal(meal.mealComplete,true);assert(meal.componentNames.length);assert(saved.result.total<=saved.profile.budget);
  await page.locator('.meal-open').click();await page.waitForSelector('.recipe-page');assert.equal(await page.locator('.recipe-page h1').innerText(),meal.componentNames[0]);
  if(meal.componentNames.length>1){assert.match(await page.locator('.recipe-page>.meal-components').innerText(),/Includes:/);for(const side of meal.componentNames.slice(1))assert((await page.locator('.recipe-page>.meal-components').innerText()).includes(side));}
  await page.waitForFunction(()=>document.querySelector('.recipe-cover>img').complete);await page.evaluate(()=>scrollTo(0,0));
  if(process.env.COMPLETE_MEAL_SCREENSHOT==='1')console.log('COMPLETE_MEAL_SCREENSHOT_'+cuisine.replace(' ','_')+' '+(await page.screenshot()).toString('base64'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const ingredientCount=await page.locator('.recipe-ingredients li').count();assert(ingredientCount>2);
  await page.getByRole('button',{name:'Instructions',exact:true}).click();assert((await page.locator('.recipe-instructions li').count())>=2);
  await page.getByRole('button',{name:'Back from recipe',exact:true}).click();
  await page.getByRole('button',{name:/Tap to view Grocery list/}).click();assert((await page.locator('.priced-grocery-item').count())>2);await page.getByRole('button',{name:'Back to my week',exact:true}).click();
 }
 console.log('Complete meal browser passed: strict Desi/Emirati/Arab plans, full meal components, quantities, instructions and grocery list through the live catalogue.');
 await context.close();
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
