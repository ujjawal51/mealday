// Isolated synthetic product observations, never real store prices or production writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createApp} from './app.mjs';
import {catalogueDocuments} from './recipe-catalogue.mjs';
import {ingredientSignature} from './store-prices.mjs';
const docs=catalogueDocuments(),ingredients=Object.assign({},...docs.map(d=>d.ingredients));
let mode='none';
const offers=()=>['rice','yogurt'].map(key=>({shop:'Carrefour',city:'Dubai',ingredientId:key,ingredientSignature:ingredientSignature(ingredients[key]),locationId:'fixture',locationName:'Fixture Dubai branch',productId:'fixture-'+key,productName:'Fixture '+key,productUrl:'https://www.carrefouruae.com/fixture/'+key,packQuantity:key==='rice'?500:200,packLabel:key==='rice'?'500 g':'200 g',quantityBasis:'Fixture ingredient-state usable weight.',unit:'g',price:key==='rice'?7.5:3.25,currency:'AED',taxIncluded:true,availability:mode==='partial'&&key==='yogurt'?'out-of-stock':'in-stock',checkedAt:new Date(Date.now()-60000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),review:{approved:true,by:'Fixture reviewer',at:new Date(Date.now()-30000).toISOString()},source:{type:'retailer-page',name:'Fixture retailer source',url:'https://www.carrefouruae.com/fixture'}}));
const store={publishedRecipes:async()=>docs,storePriceRecords:async(shop,city)=>{if(mode==='error')throw Error('Fixture outage');return mode==='none'?[]:offers().filter(r=>r.shop===shop&&r.city===city);}};
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;server.on('request',createApp({store,origin}));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 const state={profile:{name:'Fixture Chef',shop:'Carrefour',city:'Dubai',people:2,days:[0],mealTypes:['dinner'],budget:150},favorites:[],pantry:{},checked:[],result:{total:21,meals:[],plan:[],items:[{...ingredients.rice,key:'rice',need:750,packs:1,cost:14},{...ingredients.yogurt,key:'yogurt',need:300,packs:1,cost:7}]}};
 await page.addInitScript(value=>localStorage.setItem('mealday.android.v1',JSON.stringify(value)),state);
 await page.goto(origin);await page.locator('[data-action="go-shopping"]').click();await page.getByRole('button',{name:'Prices & product options',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.store-price-status')?.textContent.includes('No checked product prices'));
 assert.equal(await page.locator('.recorded-price-total').count(),0);assert.match(await page.locator('.basket-row').first().innerText(),/Catalogue estimate/);
 mode='complete';await page.locator('[data-action="check-store-prices"]').click();
 await page.waitForSelector('.recorded-price-total');assert.match(await page.locator('.recorded-price-total').innerText(),/21.50/);
 assert.match(await page.locator('.store-price-status').innerText(),/not a live checkout quote/);
 assert.match(await page.locator('.store-product-record').first().innerText(),/2 × 500 g/);assert.match(await page.locator('.store-product-record').first().innerText(),/Price checked/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 mode='partial';await page.locator('[data-action="check-store-prices"]').click();
 await page.waitForSelector('.known-price-subtotal');assert.equal(await page.locator('.recorded-price-total').count(),0);assert.match(await page.locator('.known-price-subtotal').innerText(),/15.00/);assert.match(await page.locator('.store-product-record').last().innerText(),/out of stock/);
 mode='error';await page.locator('[data-action="check-store-prices"]').click();
 await page.waitForFunction(()=>document.querySelector('.store-price-status')?.textContent.includes('could not be checked'));
 assert.equal(await page.locator('.known-price-subtotal').count(),0);assert.equal(await page.locator('.recorded-price-total').count(),0);
 assert.match(await page.locator('.basket-row').first().innerText(),/Catalogue estimate/);
 console.log('Store pricing browser checks passed: unconnected, exact product packs, dated source, partial stock, failed refresh and responsive layout.');
 await context.close();
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
