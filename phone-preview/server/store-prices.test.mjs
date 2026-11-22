import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {ingredientSignature,validateOffer,quoteStorePrices,priceRequest} from './store-prices.mjs';
import {catalogueDocuments} from './recipe-catalogue.mjs';
import {createApp} from './app.mjs';
const now=Date.parse('2026-11-22T08:00:00Z');
const ingredients={rice:{name:'Basmati rice',unit:'g',kind:'plant'},yogurt:{name:'Plain yogurt',unit:'g',kind:'dairy',allergen:'Milk'}};
const body={shop:'Carrefour',city:'Dubai',items:[{key:'rice',need:750,unit:'g'},{key:'yogurt',need:300,unit:'g'}]};
// Synthetic observations are test fixtures only, never retailer data or production seeds.
const record=(id,patch={})=>({shop:'Carrefour',city:'Dubai',ingredientId:id,ingredientSignature:ingredientSignature(ingredients[id]),locationId:'fixture-zone',locationName:'Fixture branch',productId:'fixture-'+id,productName:'Fixture '+id,productUrl:'https://www.carrefouruae.com/fixture/'+id,packQuantity:id==='rice'?500:200,packLabel:id==='rice'?'500 g':'200 g',quantityBasis:'Fixture usable food weight in the recipe ingredient state.',unit:'g',price:id==='rice'?7.5:3.25,currency:'AED',taxIncluded:true,availability:'in-stock',checkedAt:new Date(now-60000).toISOString(),validUntil:new Date(now+3600000).toISOString(),source:{type:'retailer-page',name:'Fixture source',url:'https://www.carrefouruae.com/fixture'},review:{approved:true,by:'Fixture reviewer',at:new Date(now-30000).toISOString()},...patch});
test('Actual usable packs, integer money, source and timestamps determine recorded subtotals',()=>{
 const quote=quoteStorePrices(body,[record('rice'),record('yogurt')],ingredients,now);
 assert.equal(quote.recordedSubtotal,21.5);assert.equal(quote.matched,2);assert.equal(quote.items[0].packs,2);assert.equal(quote.items[0].subtotal,15);assert.equal(quote.checkoutVerified,false);
 assert.equal(quote.items[0].checkedAt,record('rice').checkedAt);assert.equal(quote.items[0].source.name,'Fixture source');
 assert.equal(quoteStorePrices({...body,items:[{key:'rice',need:500.0000001,unit:'g'}]},[record('rice')],ingredients,now).items[0].packs,2);
});
test('Unknown, stale, unavailable, insufficient stock and edited identities cannot form complete totals',()=>{
 for(const patch of [{availability:'out-of-stock'},{availability:'unknown'},{stockPacks:1},{checkedAt:new Date(now-2*86400000).toISOString(),validUntil:new Date(now-86400000).toISOString(),review:{approved:true,by:'Fixture',at:new Date(now-86400000).toISOString()}},{review:{approved:false}},{taxIncluded:false},{packQuantity:0}]){
  const q=quoteStorePrices(body,[record('rice'),record('yogurt',patch)],ingredients,now);assert.equal(q.recordedSubtotal,null);assert.equal(q.matched,1);
 }
 assert.equal(quoteStorePrices(body,[],ingredients,now).recordedSubtotal,null);
 const changed={...ingredients,rice:{...ingredients.rice,name:'Cooked rice'}};assert.equal(quoteStorePrices(body,[record('rice'),record('yogurt')],changed,now).matched,1);
});
test('Prices never cross shops, cities or locations; a newer out-of-stock observation wins',()=>{
 assert.equal(quoteStorePrices({...body,city:'Ajman'},[record('rice')],ingredients,now).matched,0);
 assert.equal(quoteStorePrices({...body,shop:'LuLu'},[record('rice')],ingredients,now).matched,0);
 const q=quoteStorePrices(body,[record('rice'),record('yogurt',{locationId:'other-zone'})],ingredients,now);assert.equal(q.status,'choose-location');assert.equal(q.recordedSubtotal,null);
 const selected=quoteStorePrices({...body,locationId:'fixture-zone'},[record('rice'),record('yogurt',{locationId:'other-zone'})],ingredients,now);assert.equal(selected.matched,1);
 const newer=record('rice',{availability:'out-of-stock',checkedAt:new Date(now-20000).toISOString(),review:{approved:true,by:'Fixture',at:new Date(now-10000).toISOString()}});
 assert.equal(quoteStorePrices(body,[record('rice'),newer],ingredients,now).matched,0);
});
test('Invalid money, future checks, guessed matching and duplicate quantities fail validation',()=>{
 for(const patch of [{price:0},{price:NaN},{price:2.345},{checkedAt:new Date(now+1000).toISOString()},{ingredientSignature:'guessed'},{productUrl:'javascript:alert(1)'},{source:{type:'search-index'}},{currency:'USD'},{unit:'ml'}])assert(validateOffer(record('rice',patch),ingredients.rice,now).length);
 assert.throws(()=>priceRequest({...body,items:[body.items[0],body.items[0]]}),{status:400});
 assert.throws(()=>priceRequest({...body,items:[{key:'rice',need:-1,unit:'g'}]}),{status:400});
});
test('Price endpoint is read-only, does not require a session and preserves cross-site protection',async()=>{
 const docs=catalogueDocuments(),store={publishedRecipes:async()=>docs,storePriceRecords:async()=>[]};
 const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;server.on('request',createApp({store,origin}));
 try{
  const response=await fetch(origin+'/api/store-prices',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,200);const data=await response.json();assert.equal(data.status,'no-records');assert.equal(data.recordedSubtotal,null);assert.equal(data.checkoutVerified,false);
  assert.equal((await fetch(origin+'/api/store-prices',{method:'POST',headers:{origin,'Content-Type':'application/json','Sec-Fetch-Site':'cross-site'},body:JSON.stringify(body)})).status,403);
  assert.equal((await fetch(origin+'/api/store-prices',{method:'GET'})).status,405);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
