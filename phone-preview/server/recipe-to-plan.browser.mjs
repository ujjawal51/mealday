import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
import {liveCatalogue} from './live-catalogue.mjs';
import {catalogueDocuments} from './recipe-catalogue.mjs';
import {api,installLiveCatalogue} from '../dist/api.js';
const stock=(await liveCatalogue({publishedRecipes:async()=>catalogueDocuments()})).ingredients;
const docs=[['starting','Chickpea rice plate','chickpeas','vegan',100],['replacement','Chana cucumber rice bowl','chickpeas','vegan',160],['milk','Paneer rice plate','paneer','vegetarian',100],
 ['other','Emirati rice plate','chickpeas','vegan',100,'Emirati']].map(([id,name,protein,diet,n,cuisine='South Asian'])=>{
 const items=[[protein,n],['rice',60],['cucumber',100]];
 return {id,published:true,data:{id,name,items,time:20,cuisine,diet,mealTypes:['dinner'],appliances:['Hob'],steps:['Prepare ingredients.','Cook and serve.']},
 ingredients:Object.fromEntries(items.map(([key])=>[key,stock[key]]))};
});
const profile={name:'Test family',city:'Dubai',shop:'LuLu',people:1,budget:150,minutes:30,cuisine:'South Asian',cuisines:['South Asian'],diet:'Vegetarian',days:[0],mealTypes:['dinner'],allergies:['Milk'],appliances:['Hob'],priorities:[]};
const pantry={};
installLiveCatalogue(await liveCatalogue({publishedRecipes:async()=>docs}));
const url=new URL('http://mealday.test/api/quote');
const quote=await api(new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profile,pantry,plan:[{day:0,meal:'dinner',recipeId:'starting'}]})}),url);
assert.equal(quote.status,200);
const initial={profile,pantry,result:await quote.json(),checked:[],favorites:[],seed:0};
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
server.on('request',createApp({origin,store:{publishedRecipes:async()=>docs,storePriceRecords:async()=>[]}}));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(value=>{if(!localStorage.getItem('mealday.android.v1'))localStorage.setItem('mealday.android.v1',JSON.stringify(value));},initial);
 const page=await context.newPage();await page.goto(origin);
 await page.getByRole('button',{name:'Meals',exact:true}).click();
 await page.getByRole('heading',{name:'Explore by cuisine',exact:true}).waitFor();
 for(const img of await page.locator(".cuisine-tile img").all()){await img.scrollIntoViewIfNeeded();await page.waitForFunction(el=>el.complete&&el.naturalWidth>0,await img.elementHandle(),{timeout:10000});}
 await page.evaluate(()=>window.scrollTo(0,0));
 const desi=page.getByRole('button',{name:/^Desi /});await desi.click();
 await page.getByRole('heading',{name:'Chana cucumber rice bowl',exact:true}).waitFor();
 assert.equal(await desi.getAttribute('aria-pressed'),'true');
 assert.equal(await page.getByRole('combobox',{name:'Filter cuisine'}).inputValue(),'South Asian');
 assert.equal(await page.getByRole('heading',{name:'Emirati rice plate',exact:true}).count(),0);
 if(process.env.DISCOVERY_SCREENSHOT)await page.screenshot({path:process.env.DISCOVERY_SCREENSHOT,fullPage:false});
 const choose=async name=>{await page.locator('.recipe-card').filter({has:page.getByRole('heading',{name:new RegExp('^'+name)})}).getByRole('button',{name:'View recipe',exact:true}).click();
 await page.getByRole('button',{name:'Add to my plan',exact:true}).click();
 await page.getByRole('button',{name:'Preview Monday dinner',exact:true}).click();};
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mealday.android.v1')));
 assert.equal(await page.getByRole('heading',{name:/^Paneer rice plate/}).count(),0);
 await page.getByRole('button',{name:'Show all recipes',exact:true}).click();
 await choose('Paneer rice plate');
 await page.getByRole('alert').filter({hasText:/does not match your preferences/}).waitFor();assert.equal((await stored()).result.plan[0].recipeId,'starting');
 await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Back from recipe',exact:true}).click();
 await page.getByRole('button',{name:'Use my preferences',exact:true}).click();
 await choose('Chana cucumber rice bowl');await page.getByRole('heading',{name:'Review plan change',exact:true}).waitFor();
 assert.match(await page.getByRole('dialog').innerText(),/Estimated weekly groceries/);
 assert.equal((await stored()).result.plan[0].recipeId,'starting');
 await page.getByRole('button',{name:'Confirm this meal',exact:true}).click();
 await page.getByRole('heading',{name:'Meal added to your plan',exact:true}).waitFor();
 await page.getByRole('button',{name:'View grocery list',exact:true}).click();
 await page.getByRole('heading',{name:'Grocery list',exact:true}).waitFor();
 let saved=await stored();assert.equal(saved.result.plan[0].recipeId,'replacement');
 assert.equal(saved.result.items.find(x=>x.key==='chickpeas').required,160);
 await page.reload();assert.equal((await stored()).result.plan[0].recipeId,'replacement');
 await page.getByRole('button',{name:'Meals',exact:true}).click();
 await page.getByRole('heading',{name:'Recently viewed',exact:true}).waitFor();
 assert.match(await page.locator('.recent-recipe-rail').innerText(),/Chana cucumber rice bowl/);
 assert.doesNotMatch(await page.locator('.recent-recipe-rail').innerText(),/Paneer/);
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('heading',{name:'Hi, Test family',exact:true}).waitFor();
 assert.match(await page.locator('.settings-profile').innerText(),/Shopping at LuLu.*Guest/s);
 await page.getByRole('button',{name:'Rate Mealday',exact:true}).click();
 await page.getByRole('heading',{name:'Enjoying Mealday?',exact:true}).waitFor();
 if(process.env.RATING_SCREENSHOT)await page.screenshot({path:process.env.RATING_SCREENSHOT,fullPage:false});
 await page.getByRole('button',{name:'Not today',exact:true}).click();
 assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'Rate Mealday',exact:true}).click();
 await page.getByRole('button',{name:'Sure!',exact:true}).click();
 await page.getByRole('heading',{name:'Rate Mealday',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Send feedback',exact:true}).count(),1);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 for(const width of [320,768]){await page.setViewportSize({width,height:844});await page.getByRole('button',{name:'Meals',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow at '+width);}
 console.log('Recipe to plan: original cuisine tiles, milk restriction, explicit weekly quote confirmation, persisted replacement and updated grocery quantities at phone widths.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
