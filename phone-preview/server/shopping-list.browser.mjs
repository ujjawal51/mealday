// Synthetic kitchen only: no production account, retailer lookup or paid calls.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
const rows=[['onion','Onion',250,1000,1,5,'Vegetables','g'],['chilli','Green chilli',4,100,1,3,'Vegetables','g'],['lemon','Lemon',0.9,3,1,4,'Vegetables','lemons'],['garlic','Fresh garlic',8,200,1,4,'Vegetables','g'],['tomato','Tomatoes',400,500,1,5,'Vegetables','g'],['tuna','Tuna (drained weight)',460,120,4,24,'Pantry','g'],['egg','Eggs',6,6,1,8,'Chilled','eggs']];
const state={profile:{name:'Test kitchen',shop:'Carrefour',city:'Dubai',people:1,days:[0],mealTypes:['dinner'],budget:100},pantry:{},checked:[],favorites:[],recipeJournal:{tomato:{rating:5,note:'Keep this note'}},extraGroceries:[{id:'extra-test',name:'Kitchen towels',checked:false}],result:{total:53,meals:[],plan:[],items:rows.map(([key,name,need,pack,packs,cost,category,unit])=>({key,name,need,pack,packs,cost,category,unit,have:0}))}};
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
server.on('request',createApp({origin,store:{storePriceRecords:async()=>[]}}));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(value=>{localStorage.setItem('mealday.android.v1',JSON.stringify(value));Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>{window.sharedShopping=payload.text;}});},state);
 const page=await context.newPage();await page.goto(origin);await page.locator('.nav [data-view="shopping"]').click();
 await page.getByRole('heading',{name:'Shopping list',exact:true}).waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('.ingredient-image')].every(img=>img.complete&&img.naturalWidth>0));
 assert.equal(await page.locator('.priced-grocery-item').count(),8);assert.match(await page.locator('.shopping-progress-label').innerText(),/0 \/ 8 items bought/);
 assert.match(await page.locator('.grocery-group').first().locator('h3').innerText(),/VEGETABLES/);
 assert.equal(await page.locator('.ingredient-image').first().getAttribute('src'),'/ingredients/onion.png');
 assert.equal(await page.locator('.basket-row .price').first().innerText(),'AED 5.00');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 // Capture the actual rendered reference layout using public fixture data only.
 if(process.env.SHOPPING_SCREENSHOT==='1')console.log('SHOPPING_SCREENSHOT '+(await page.screenshot()).toString('base64'));
 await page.getByRole('checkbox',{name:'Bought Onion',exact:true}).check();
 await page.waitForFunction(()=>document.querySelector('.shopping-progress').value===1);
 await page.getByRole('button',{name:'To buy',exact:true}).click();assert.equal(await page.locator('.priced-grocery-item').count(),7);
 await page.getByRole('button',{name:'Bought',exact:true}).click();assert.equal(await page.locator('.priced-grocery-item').count(),1);
 assert.equal(await page.getByRole('checkbox',{name:'Bought Onion',exact:true}).isChecked(),true);
 await page.getByRole('button',{name:'Reset bought items',exact:true}).click();await page.getByText('No items bought yet.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'All',exact:true}).click();assert.equal(await page.locator('.priced-grocery-item').count(),8);
 await page.getByRole('checkbox',{name:'Bought Kitchen towels',exact:true}).check();
 await page.getByRole('button',{name:'Share grocery list ↗',exact:true}).click();
 const share=await page.evaluate(()=>window.sharedShopping);assert.match(share,/\[x\] Kitchen towels/);assert.match(share,/Tuna \(drained weight\) — 4 × 120 g/);assert.match(share,/catalogue estimate AED 5.00/);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mealday.android.v1')));assert.equal(saved.recipeJournal.tomato.note,'Keep this note');assert.equal(saved.result.items.length,7);
 // A rejected share falls back to a copyable list, without losing any kitchen data.
 await page.evaluate(()=>{Object.defineProperty(navigator,'share',{value:undefined});Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('Fixture clipboard unavailable');}}});});
 await page.getByRole('button',{name:'Share grocery list ↗',exact:true}).click();await page.getByRole('textbox',{name:'Grocery list to share'}).waitFor();
 await page.locator('#dialog').evaluate(d=>d.close());
 await page.getByRole('button',{name:'Reset bought items',exact:true}).click();assert.equal(await page.getByRole('checkbox',{name:'Bought Kitchen towels',exact:true}).isChecked(),false);
 await page.setViewportSize({width:320,height:750});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await context.close();console.log('Shopping list browser passed: local ingredient images, bought progress, All/To buy/Bought, reset, extra items, native share and copy fallback, 390px and 320px layout.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
