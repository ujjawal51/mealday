// Isolated supplier responses and test account only; never calls ReefAPI or production.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
import {createLuluPrices} from './lulu-prices.mjs';
let calls=0,fail=false;const state={profile:{name:'Test chef',shop:'LuLu',city:'Dubai',people:1,days:[0],mealTypes:['dinner'],budget:100},favorites:[],pantry:{},checked:[],result:{total:3,meals:[],plan:[],items:[{key:'carrots',name:'Carrots',unit:'g',need:480,have:0,packs:1,pack:500,cost:3,category:'Vegetables'}]}};
const product={product_id:'test-carrots',sku:'123',name:'Carrots 500 g',pack_size:'500 g',price:3.48,currency:'AED',url:'https://gcc.luluhypermarket.com/en-ae/carrots/p/123/',in_stock:true,stock:10};
const luluPrices=createLuluPrices({key:'PRIVATE_FIXTURE_KEY',reserve:async()=>true,fetchImpl:async(url)=>{
 calls++;if(fail)throw Error('PRIVATE_FIXTURE_KEY');const data={country:'ae',currency:'AED',...(url.endsWith('/search')?{results:[product,{...product,product_id:'australia',name:'Carrots Australia 500 g',price:5.33}]}:{product})};
 return Response.json({ok:true,meta:{mode:'live',fetched_at:new Date().toISOString()},data});
}});
const store={session:async()=>({userId:'fixture',email:'fixture@example.com',csrf:'test-csrf'}),userByEmail:async()=>({_id:'fixture'}),kitchen:async()=>({revision:1,data:{state,history:{version:1,events:[]}}}),storePriceRecords:async()=>[]};
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;server.on('request',createApp({store,origin,luluPrices}));
const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addCookies([{name:'mealday_session',value:'a'.repeat(43),url:origin}]);
 const page=await context.newPage();await page.goto(origin);
 await page.waitForSelector('body[data-view="week"]');await page.locator('[data-action="go-shopping"]').click();
 await page.waitForFunction(()=>document.querySelector('.lulu-connection')?.textContent.includes('configured'));
 assert.equal(calls,0);
 await page.getByRole('button',{name:'Find LuLu price',exact:true}).click();
 await page.locator('#lulu-product-dialog .lulu-results article').first().waitFor();
 assert.equal(await page.locator('#lulu-product-dialog .lulu-results article').count(),2);
 await page.getByRole('button',{name:'Use this product',exact:true}).first().click();
 await page.waitForFunction(()=>document.querySelector('.lulu-ingredient')?.textContent.includes('AED 3.48'));
 assert.match(await page.locator('.lulu-ingredient').innerText(),/1 × 500 g/);
 assert.match(await page.locator('.lulu-selected-total').innerText(),/AED 3.48/);
 assert.match(await page.locator('.basket-row .price').innerText(),/Est. AED 3/);
 assert.match(await page.locator('#lulu-price-panel').innerText(),/delivery area.*not verified/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert(!await page.content().then(s=>s.includes('PRIVATE_FIXTURE_KEY')));
 assert.equal(calls,2);
 // Changing the search to an uncached query and failing it removes the old selection.
 fail=true;await page.getByRole('button',{name:'Change / recheck LuLu product',exact:true}).click();
 await page.locator('#lulu-product-dialog input').fill('fresh carrots');
 await page.locator('#lulu-product-dialog button[type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('#lulu-product-dialog [role="status"]')?.textContent.includes('could not be reached'));
 assert.match(await page.locator('.lulu-selected-total').innerText(),/No LuLu products/);
 assert(!await page.content().then(s=>s.includes('PRIVATE_FIXTURE_KEY')));
 await context.close();console.log('LuLu phone browser passed: explicit exact product, whole-pack price, separate estimates, safe failure, no automatic paid calls, no secret exposure.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
