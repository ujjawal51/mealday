// Isolated supplier responses and test account only; never calls ReefAPI or production.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
import {createLuluPrices} from './lulu-prices.mjs';
let calls=0,fail=false;const state={profile:{name:'Test chef',shop:'LuLu',city:'Dubai',people:1,days:[0],mealTypes:['dinner'],budget:100},favorites:[],pantry:{},checked:[],result:{total:16,meals:[],plan:[],items:[{key:'tomato',name:'Tomatoes',unit:'g',need:600,have:0,packs:2,pack:500,cost:10,category:'Vegetables'},{key:'peas',name:'Frozen peas',unit:'g',need:210,have:0,packs:1,pack:400,cost:6,category:'Vegetables'}]}};
const product={product_id:'test-tomato',sku:'123',name:'Tomato Jordan 500 g',pack_size:'500 g',price:3.48,currency:'AED',url:'https://gcc.luluhypermarket.com/en-ae/tomato/p/123/',in_stock:true,stock:10};
const luluPrices=createLuluPrices({key:'PRIVATE_FIXTURE_KEY',reserve:async()=>true,fetchImpl:async(url,init)=>{
 calls++;if(fail)throw Error('PRIVATE_FIXTURE_KEY');const large={...product,product_id:'large',name:'Tomato 1.5 kg',pack_size:'1.5 kg',price:11.95};const data={country:'ae',currency:'AED',...(url.endsWith('/search')?{results:[product,large]}:{product:JSON.parse(init.body).product_id==='large'?large:product})};
 return Response.json({ok:true,meta:{mode:'live',fetched_at:new Date().toISOString()},data});
}});
const store={session:async()=>({userId:'fixture',email:'fixture@example.com',csrf:'test-csrf'}),userByEmail:async()=>({_id:'fixture'}),kitchen:async()=>({revision:1,data:{state,history:{version:1,events:[]}}}),storePriceRecords:async()=>[]};
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;server.on('request',createApp({store,origin,luluPrices}));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addCookies([{name:'mealday_session',value:'a'.repeat(43),url:origin}]);
 const page=await context.newPage();await page.goto(origin);
 await page.waitForSelector('body[data-view="week"]');await page.locator('[data-action="go-shopping"]').click();
 await page.waitForFunction(()=>document.querySelector('.lulu-connection')?.textContent.includes('configured'));
 assert.equal(calls,0);
 await page.getByRole('button',{name:'Find LuLu price',exact:true}).first().click();
 await page.locator('#lulu-product-dialog .lulu-results article').first().waitFor();
 assert.equal(await page.locator('#lulu-product-dialog .lulu-results article').count(),2);
 await page.getByRole('button',{name:'Use this product',exact:true}).first().click();
 await page.waitForFunction(()=>document.querySelector('.basket-row .price')?.textContent.includes('AED 6.96'));
 assert.match(await page.locator('.lulu-ingredient').first().innerText(),/2 × 500 g/);
 assert.match(await page.locator('.lulu-old-estimate').innerText(),/AED 10.00/);
 assert.match(await page.locator('.shopping-head strong').innerText(),/AED 12.96/);
 assert.match(await page.locator('.shopping-head .section-caption').innerText(),/includes estimates/);
 assert.match(await page.locator('.basket-row .price').last().innerText(),/Est. AED 6/);
 assert.equal(await page.locator('.priced-grocery-item').first().locator('.store-product-record:not(.lulu-ingredient)').isVisible(),false);
 await page.getByRole('button',{name:'Change / recheck LuLu product',exact:true}).click();
 await page.getByRole('button',{name:'Use this product',exact:true}).last().click();
 await page.waitForFunction(()=>document.querySelector('.basket-row .price')?.textContent.includes('AED 11.95'));
 assert.match(await page.locator('.lulu-ingredient').first().innerText(),/1 × 1.5 kg/);
 assert.match(await page.locator('.shopping-head strong').innerText(),/AED 17.95/);
 assert.match(await page.locator('#lulu-price-panel').innerText(),/delivery area.*not verified/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 // Restore the estimates when references expire, without spending credits.
 await page.evaluate(()=>{window.realTestNow=Date.now;Date.now=()=>window.realTestNow()+360000;window.dispatchEvent(new Event('focus'));});
 await page.waitForFunction(()=>document.querySelector('.basket-row .price')?.textContent.includes('Est. AED 10'));
 assert.match(await page.locator('.shopping-head strong').innerText(),/AED 16/);
 assert.equal(await page.locator('.lulu-old-estimate').count(),0);
 await page.evaluate(()=>{Date.now=window.realTestNow;});
 // With a fully matched single-item basket, label the total as a LuLu reference subtotal.
 state.result.items.pop();state.result.total=10;
 await page.reload();await page.waitForSelector('body[data-view="week"]');await page.locator('[data-action="go-shopping"]').click();
 await page.getByRole('button',{name:'Find LuLu price',exact:true}).click();await page.getByRole('button',{name:'Use this product',exact:true}).last().click();
 await page.waitForFunction(()=>document.querySelector('.basket-row .price')?.textContent.includes('AED 11.95'));
 assert.equal(await page.locator('.shopping-head .section-caption').innerText(),'LuLu UAE online subtotal');
 assert.match(await page.locator('.shopping-head strong').innerText(),/AED 11.95/);
 assert(!await page.content().then(s=>s.includes('PRIVATE_FIXTURE_KEY')));
 // Changing the search to an uncached query and failing it removes the old selection.
 fail=true;await page.getByRole('button',{name:'Change / recheck LuLu product',exact:true}).click();
 await page.locator('#lulu-product-dialog input').fill('fresh carrots');
 await page.locator('#lulu-product-dialog button[type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('#lulu-product-dialog [role="status"]')?.textContent.includes('could not be reached'));
 assert.match(await page.locator('.lulu-selected-total').innerText(),/No LuLu products/);
 assert.match(await page.locator('.basket-row .price').innerText(),/Est. AED 10/);
 assert.equal(await page.locator('.shopping-head .section-caption').innerText(),'Estimated grocery total');
 assert.equal(await page.locator('.priced-grocery-item .store-product-record:not(.lulu-ingredient)').isVisible(),true);
 assert(!await page.content().then(s=>s.includes('PRIVATE_FIXTURE_KEY')));
 await context.close();console.log('LuLu phone browser passed: main-row selected prices, mixed and complete totals, pack changes, expiry and failure restoration, responsive layout, no secret exposure.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
