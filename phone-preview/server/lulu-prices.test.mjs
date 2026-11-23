import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createLuluPrices,plainPack,normalizeLuluProduct,luluPackQuote} from './lulu-prices.mjs';
import {createApp} from './app.mjs';
const now=()=>Date.parse('2026-11-23T06:00:00Z');
const row=(extra={})=>({product_id:'carrot-500',sku:'123',name:'Carrots 500 g',price:3.48,currency:'AED',pack_size:'500 g',in_stock:true,stock:5,url:'https://gcc.luluhypermarket.com/en-ae/carrots/p/123/',...extra});
const envelope=(rows=[row()])=>({ok:true,meta:{mode:'live',fetched_at:new Date(now()).toISOString()},data:{country:'ae',currency:'AED',results:rows}});
test('LuLu packs use exact units and whole-pack cents; ambiguous, drained and incompatible quantities fail closed',()=>{
 assert.deepEqual(plainPack('1.5 kg'),{quantity:1500,unit:'g'});assert.deepEqual(plainPack('2 Litres'),{quantity:2000,unit:'ml'});
 for(const label of ['500 g + free','6 x 200 g','1 bunch','approximately 500 g'])assert.equal(plainPack(label),null);
 const p=normalizeLuluProduct(row());assert.deepEqual(luluPackQuote(p,480,'g'),{packs:1,subtotal:3.48});
 assert.deepEqual(luluPackQuote(p,750,'g'),{packs:2,subtotal:6.96});
 assert.equal(luluPackQuote(p,1,'ml'),null);assert.equal(luluPackQuote({...p,inStock:false},480,'g'),null);
 assert.equal(luluPackQuote({...p,maxOrderQuantity:1},750,'g'),null);
 assert.equal(luluPackQuote({...p,stock:1},750,'g'),null);
 for(const extra of [{currency:'SAR'},{price:0},{url:'https://evil.example/'},{product_id:'../secret'},{hidden_in_country:true}])assert.equal(normalizeLuluProduct(row(extra)),null);
});
test('Reef key stays in fixed server request; safe normalized results preserve provider time and cache duplicates',async()=>{
 let calls=0,credits=0;const service=createLuluPrices({key:'PRIVATE_TEST_KEY',now,reserve:async cost=>{credits+=cost;return true;},fetchImpl:async(url,init)=>{
  calls++;assert.equal(url,'https://api.reefapi.com/luluhypermarket/v1/search');assert.equal(init.headers['x-api-key'],'PRIVATE_TEST_KEY');assert.equal(init.redirect,'error');assert.equal(JSON.parse(init.body).country,'ae');
  return Response.json(envelope([row({secret:'DO_NOT_RETURN'})]));
 }});
 const [a,b]=await Promise.all([service.search({query:'carrots'}),service.search({query:'carrots'})]);
 assert.equal(calls,1);assert.equal(credits,2);assert.equal(a.locationVerified,false);assert.equal(a.checkoutVerified,false);
 assert(!JSON.stringify(a).includes('PRIVATE_TEST_KEY'));assert(!JSON.stringify(a).includes('DO_NOT_RETURN'));
 assert.equal((await service.search({query:'carrots'})).cached,true);assert.equal(calls,1);assert.equal(a.checkedAt,b.checkedAt);
});
test('Missing credentials, malformed data, stale times, provider auth failures and quota never become prices',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return Response.json(envelope());};
 await assert.rejects(createLuluPrices({fetchImpl}).search({query:'carrots'}),/not configured/);assert.equal(calls,0);
 await assert.rejects(createLuluPrices({key:'x',now,reserve:async()=>false,fetchImpl}).search({query:'carrots'}),/limit/);assert.equal(calls,0);
 for(const edit of [v=>v.data.country='sa',v=>v.data.currency='SAR',v=>v.meta.mode='sample',v=>v.meta.fetched_at='2020-01-01',v=>v.data.results=null]){
  const value=envelope();edit(value);await assert.rejects(createLuluPrices({key:'x',now,reserve:async()=>true,fetchImpl:async()=>Response.json(value)}).search({query:'carrots'}));
 }
 const bad=createLuluPrices({key:'x',now,reserve:async()=>true,fetchImpl:async()=>new Response('private upstream details',{status:401})});
 await assert.rejects(bad.search({query:'carrots'}),/credentials or credits/);await assert.rejects(bad.search({query:'milk'}),/temporarily unavailable/);
});
test('Selected product is re-fetched by exact provider ID, with quantity and stock guards',async()=>{
 const service=createLuluPrices({key:'x',now,reserve:async()=>true,fetchImpl:async(url,init)=>{
  assert(url.endsWith('/product'));assert.equal(JSON.parse(init.body).product_id,'carrot-500');
  return Response.json({ok:true,meta:{mode:'live',fetched_at:new Date(now()).toISOString()},data:{country:'ae',currency:'AED',product:row()}});
 }});
 const value=await service.product({productId:'carrot-500',need:480,unit:'g'});assert.deepEqual(value.quote,{packs:1,subtotal:3.48});
 assert.equal((await service.product({productId:'carrot-500',need:480,unit:'ml'})).quote,null);
 await assert.rejects(service.product({productId:'https://evil.example',need:480,unit:'g'}),/valid LuLu/);
});
test('Price requests require signed-in session, same-origin JSON and CSRF; status never exposes credentials',async t=>{
 let count=0;const session={userId:'one',email:'test@example.com',csrf:'csrf',authVersion:0};
 const store={session:async()=>session,userByEmail:async()=>({_id:'one',authVersion:0})};
 const luluPrices={status:()=>({configured:true}),search:async()=>{count++;return {products:[]};}};
 const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;server.on('request',createApp({store,origin,luluPrices}));t.after(()=>new Promise(r=>server.close(r)));
 const call=(extra={})=>fetch(origin+'/api/lulu/search',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:'mealday_session='+'a'.repeat(43),'X-CSRF-Token':'csrf',...extra},body:JSON.stringify({query:'carrots'})});
 assert.equal((await call({Cookie:''})).status,401);assert.equal((await call({'X-CSRF-Token':'wrong'})).status,403);assert.equal((await call({Origin:'https://evil.example'})).status,403);assert.equal((await call({'Sec-Fetch-Site':'cross-site'})).status,403);assert.equal(count,0);
 assert.deepEqual(await (await fetch(origin+'/api/lulu/status')).json(),{configured:true});assert.equal(count,0);
 assert.equal((await call()).status,200);assert.equal(count,1);
});
