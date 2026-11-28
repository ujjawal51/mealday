// Synthetic guest kitchen and packaged recipes; no production accounts or paid API calls.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
const state={profile:{name:'Recipe test',shop:'Carrefour',city:'Dubai',people:1,days:[0],mealTypes:['dinner'],budget:100},favorites:[],pantry:{},checked:[],result:{total:15,plan:[{recipeId:'arab-shakshuka',day:0,meal:'dinner'}],items:[],meals:[{id:'arab-shakshuka',name:'Classic Shakshuka with Pita',day:0,meal:'dinner',minutes:30,diet:'vegetarian',cuisine:'Arab',ingredientCost:15,imageUrl:'/recipes/arab-shakshuka.webp'}]}};
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;server.on('request',createApp({origin,store:{storePriceRecords:async()=>[]}}));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(value=>{if(!localStorage.getItem('mealday.android.v1'))localStorage.setItem('mealday.android.v1',JSON.stringify(value));},state);
 const page=await context.newPage();await page.goto(origin);await page.locator('.meal-open').click();
 await page.getByRole('heading',{name:'Classic Shakshuka with Pita',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('.recipe-cover>img')?.naturalWidth>0);
 assert.equal(await page.locator('.nav').isVisible(),false);
 assert.equal(await page.locator('.macro-value').count(),4);
 assert.match(await page.locator('.recipe-actions>p').innerText(),/Cook time: 30 min.*Serves: 1/);
 assert.equal(await page.getByRole('button',{name:'Ingredients',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('.recipe-quality').getAttribute('open'),null);
 if(process.env.RECIPE_SCREENSHOT==='1')console.log('RECIPE_SCREENSHOT '+(await page.screenshot()).toString('base64'));
 await page.getByRole('button',{name:'Save recipe',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Remove saved recipe',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Rate 4 out of 5',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Rate 4 out of 5',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Mark as cooked',exact:true}).click();await page.getByRole('button',{name:'Undo cooked mark',exact:true}).waitFor();
 await page.getByRole('button',{name:'Undo cooked mark',exact:true}).click();await page.getByRole('button',{name:'Mark as cooked',exact:true}).waitFor();
 await page.locator('#recipe-note').fill('Add lemon next time.');
 await page.getByRole('button',{name:'Instructions',exact:true}).click();await page.locator('.recipe-instructions').waitFor();
 assert.equal(await page.getByRole('button',{name:'Instructions',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Cook step-by-step',exact:true}).click();await page.locator('.guided-cook').waitFor();
 await page.getByRole('button',{name:'Next step',exact:true}).click();assert.match(await page.locator('.guided-cook > .recipe-kicker').innerText(),/STEP 2 OF/);
 await page.getByRole('button',{name:'Ingredients',exact:true}).click();await page.locator('.recipe-ingredients').waitFor();
 assert.equal(await page.locator('#recipe-note').inputValue(),'Add lemon next time.');
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.getByRole('button',{name:'Back from recipe',exact:true}).click();await page.locator('.meal-open').click();
 assert.equal(await page.getByRole('button',{name:'Rate 4 out of 5',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#recipe-note').inputValue(),'Add lemon next time.');
 assert.equal(await page.getByRole('button',{name:'Remove saved recipe',exact:true}).count(),1);
 console.log('Recipe detail passed: photo, macro cards, servings, save, rating, cooked/undo, notes persistence, ingredient/instruction tabs, guided cooking, back navigation and responsive widths.');
 await context.close();
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
