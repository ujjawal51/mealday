import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {createApp} from './app.mjs';
import {createQuikSandbox,reviewProducts,careemLocalTransport} from './quik-sandbox.mjs';
import {startQuikFixtures} from './quik-fixture-runner.mjs';

const milk={key:'milk',name:'Milk',unit:'ml',need:1250};
const eggs={key:'egg',name:'Eggs',unit:'eggs',need:6};
const bread={key:'bread',name:'Bread',unit:'g',need:350};
const product=(id,item,description,total)=>({id,item,description,price:{total},currency:{code:'AED'},active:true,is_available:true,catalog_id:40001});
const p=[product(1,'Full Cream Milk','Full Cream Milk (1 L)',6.75),product(2,'Free Range Eggs','Free Range Eggs (12 pcs)',14.5),product(3,'Sourdough Bread','Sourdough Bread (500 g)',12)];
const basket={id:60,merchant_id:40001,currency:{code:'AED'},price:{net_total:40},items:[{catalog_item_id:'1',count:2},{catalog_item_id:'2',count:1},{catalog_item_id:'3',count:1}]};
function mocks({mismatch=false,unavailable=false,fail=false}={}){
  const calls=[];
  const call=async(name,args)=>{
    calls.push({name,args});
    if(name==='is_grocery_area_serviceable')return {serviceable:args.latitude!==51.5074};
    if(name==='search_groceries_items')return {merchant_id:40001,merchant_name:'Local Marina',domain:'quik',merchant_eta_minutes:15,groups:[
      {name:'milk',items:[p[0],product(4,'Greek Yogurt','Greek Yogurt (500 ml)',12)]},{name:'eggs',items:[p[1]]},{name:'bread',items:unavailable?[]:[p[2]]}]};
    if(name==='create_grocery_cart_with_quantities'){if(fail)throw Error('timeout');return {data:{basket_id:60,current_basket:mismatch?{...basket,items:basket.items.slice(1)}:basket}};}
    if(name==='cart_get_basket_price')return {merchant:{id:40001,eta_in_minutes:15},basket,price:{price:{total:45.5},fees:[{type:'delivery_fee',value:4},{type:'service_fee',value:1.5}]}};
    throw Error('Unexpected call');
  };
  return {calls,call};
}
const selection=r=>r.lines.flatMap(l=>l.options.length?[{key:l.key,id:l.options[0].id}]:[]);
const params=r=>({reviewId:r.reviewId,selections:selection(r),confirmed:true});
test('Product review is strict and sizes whole packs using compatible units',()=>{
  const invalid=[
    {...p[0],catalog_id:12345},{...p[0],active:false},{...p[0],is_available:false},{...p[0],description:'Full Cream Milk'}, {...p[0],description:'Full Cream Milk (1 kg)'}, {...p[0],currency:{code:'USD'}},{...p[0],price:{total:-1}},
    product(4,'Greek Yogurt','Greek Yogurt (500 ml)',12),
  ];
  assert.deepEqual(reviewProducts(milk,[p[0],...invalid],40001),[{id:'1',title:'Full Cream Milk',pack:1000,unit:'ml',packs:2,priceCents:675}]);
  assert.equal(reviewProducts({...milk,need:1000},p,40001)[0].packs,1);
  assert.deepEqual(reviewProducts({...bread,unit:'slices'},p,40001),[]);
  assert.equal(reviewProducts(eggs,p,40001)[0].packs,1);
});
test('No cart call for unsupported locations, missing matches, or unconfirmed products',async()=>{
  const {call,calls}=mocks({unavailable:true});const q=createQuikSandbox({call});
  assert.deepEqual(await q.review({location:'london',items:[milk]}),{mode:'sandbox',serviceable:false});
  await assert.rejects(()=>q.review({location:'invalid',items:[milk]}),{status:400});
  const reviewed=await q.review({location:'marina',items:[milk,eggs,bread]});
  await assert.rejects(()=>q.quote({...params(reviewed),confirmed:false}),{status:400});
  await assert.rejects(()=>q.quote(params(reviewed)),{status:400});
  assert.equal(calls.filter(x=>x.name.includes('cart')).length,0);
});
test('One basket mutation even on parallel requests; quote only exact basket and provider fees',async()=>{
  const {call,calls}=mocks();let t=0;const q=createQuikSandbox({call,now:()=>t});
  const r=await q.review({location:'marina',items:[milk,eggs,bread]});
  assert.equal(r.lines[0].options.length,1);
  await assert.rejects(()=>q.quote({...params(r),selections:[{key:'milk',id:'fake'},...selection(r).slice(1)]}),{status:400});
  const [a,b]=await Promise.all([q.quote(params(r)),q.quote(params(r))]);
  assert.deepEqual(a,b);assert.equal(a.canCheckout,false);assert.equal(a.quote.totalCents,4550);assert.equal(a.quote.subtotalCents,4000);
  assert.deepEqual(a.quote.fees,[{label:'delivery_fee',cents:400},{label:'service_fee',cents:150}]);
  const c=calls.filter(x=>x.name.startsWith('create_'));assert.equal(c.length,1);assert.deepEqual(c[0].args.items.map(i=>i.quantity),[2,1,1]);assert.equal(c[0].args.merchant_id,40001);
  t=300001;await assert.rejects(()=>q.quote(params(r)),{status:410});
});
test('A partial/mismatched cart or ambiguous provider failure does not get quoted or retried',async()=>{
  for(const scenario of [{mismatch:true},{fail:true}]){
    const {call,calls}=mocks(scenario);const q=createQuikSandbox({call});
    const r=await q.review({location:'marina',items:[milk,eggs,bread]});
    for(let i=0;i<2;i++)await assert.rejects(()=>q.quote(params(r)),{status:scenario.fail?503:409});
    assert.equal(calls.filter(x=>x.name.startsWith('create_')).length,1);assert.equal(calls.filter(x=>x.name==='cart_get_basket_price').length,0);
  }
});
test('Routes are opt-in, origin-bound, and never expose ordering in production',async t=>{
  for(const production of [true,false]){
    const {call,calls}=mocks();
    const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
    const origin='http://127.0.0.1:'+server.address().port;
    server.on('request',createApp({origin,production,store:{},quikSandbox:createQuikSandbox({call})}));
    t.after(()=>{server.closeAllConnections();return new Promise(r=>server.close(r));});
    const request=(path,body,where=origin)=>fetch(origin+'/api/quik-sandbox/'+path,body?{method:'POST',headers:{Origin:where,'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
    assert.equal((await (await request('status')).json()).enabled,!production);
    assert.equal((await request('review',{location:'marina',items:[milk]},'https://third-party.test')).status,403);
    assert.equal((await request('checkout',{})).status,404);
    const response=await request('review',{location:'marina',items:[milk]});assert.equal(response.status,production?404:200);
    assert.equal(calls.length,production?0:2);
  }
  assert.throws(()=>careemLocalTransport('https://mcp.careemapis.com/mcp'),/loopback/);
});
test('Careem official sandbox specs round-trip via local streamable HTTP', {skip:!process.env.CAREEM_FIXTURE_SPEC},async t=>{
 const fixture=await startQuikFixtures(process.env.CAREEM_FIXTURE_SPEC);
 t.after(()=>{fixture.server.closeAllConnections();return new Promise(r=>fixture.server.close(r));});
 const q=createQuikSandbox({call:careemLocalTransport(fixture.url)});
 const r=await q.review({location:'marina',items:[milk,eggs,bread]});
 assert.deepEqual(selection(r),[{key:'milk',id:'4000101'},{key:'egg',id:'4000102'},{key:'bread',id:'4000103'}]);
 const x=await q.quote(params(r));assert.equal(x.quote.etaMinutes,15);assert.equal(x.quote.totalCents,4550);
 assert.deepEqual(fixture.calls.map(x=>x.name),['is_grocery_area_serviceable','search_groceries_items','create_grocery_cart_with_quantities','cart_get_basket_price']);
});
