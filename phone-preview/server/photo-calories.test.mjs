import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calorieRows,localDay,recipeCalories} from '../dist/calorie-log.js';
import {createPhotoCalories,validateMealImage,photoEstimateOutput} from './photo-calories.mjs';
import {createApp} from './app.mjs';
import {createServer} from 'node:http';
import {once} from 'node:events';
const jpg='/9j/2wAAAAAAAAAA/9k=';
test('Photo intake checks type and size, then returns only an editable bounded food estimate',async()=>{
 assert.equal(validateMealImage(jpg),jpg);
 for(const v of ['not-a-jpeg','A'.repeat(520004),'aGVsbG8gd29ybGQ='])assert.throws(()=>validateMealImage(v));
 assert.throws(()=>photoEstimateOutput({food:false}),/No meal/);
 assert.throws(()=>photoEstimateOutput({food:true,name:'Rice',portion:'1 cup',minKcal:500,maxKcal:300}));
 let calls=0;
 const adapter=createPhotoCalories({key:'test-secret',limit:2,reserve:async(user,day,limit)=>{assert.equal(user,'test-user');assert.equal(limit,2);return true;},
 fetcher:async(url,init)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(init.body);
  assert.equal(body.store,false);assert.equal(body.input[0].content[0].image_url,'data:image/jpeg;base64,'+jpg);
  return new Response(JSON.stringify({output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({food:true,name:'Rice bowl',portion:'About 1 bowl',minKcal:350,maxKcal:500})}]}]}));
 }});
 assert.deepEqual(await adapter.estimate('test-user',jpg),{name:'Rice bowl',portion:'About 1 bowl',minKcal:350,maxKcal:500});
 assert.equal(calls,1);
 assert.equal(createPhotoCalories({key:'configured-no-cap',limit:0}),null);
 const blocked=createPhotoCalories({key:'test',limit:2,reserve:async()=>false,fetcher:()=>assert.fail('must not use provider')});
 await assert.rejects(blocked.estimate('test-user',jpg),{status:429});
});
test('Camera endpoint requires a signed-in session and same-origin submission',async t=>{
 let calls=0;
 const photoCalories={estimate:async(user,image)=>{calls++;assert.equal(user,'test-user');assert.equal(image,jpg);return {name:'Rice bowl',minKcal:350,maxKcal:500,portion:'1 bowl'};}};
 const store={session:async()=>({userId:'test-user',email:'test@example.invalid'}),userByEmail:async()=>({_id:'test-user'})};
 const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port; server.on('request',createApp({store,origin,photoCalories}));
 t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));
 const cookie='mealday_session='+'a'.repeat(43);
 const submit=(headers={})=>fetch(origin+'/api/calories/estimate',{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify({image:jpg})});
 assert.deepEqual(await (await fetch(origin+'/api/calories/status')).json(),{configured:true,signedIn:false});
 assert.equal((await submit()).status,401);
 assert.equal((await submit({origin:'https://other.invalid',cookie})).status,403);
 assert.equal((await submit({cookie})).status,200);
 assert.equal(calls,1);
});
test('Recipe calorie entries require complete nutrient data and a valid portion',()=>{
 assert.equal(recipeCalories({complete:true,totals:{kcal:321}},1.5),482);
 assert.equal(recipeCalories({complete:false,totals:{kcal:200}},1),null);
 assert.equal(recipeCalories({complete:true,totals:{kcal:321}},0),null);
 assert.equal(localDay(new Date(2026,10,27,23,0)),'2026-11-27');
 assert.equal(calorieRows([{id:'x',name:'Breakfast',kcal:300,day:'2026-11-27',source:'Manual'}]).length,1);
});

test('Cloudflare pilot requires an explicit account, secret, verified user and small cap', async t=>{
 const accountId='0123456789abcdef0123456789abcdef',pilotEmail='pilot@example.invalid',secret='test-only';
 const base={provider:'cloudflare',key:secret,accountId,pilotEmail,limit:5};
 for(const override of [{key:''},{accountId:'wrong'},{pilotEmail:''},{limit:0},{limit:21},{provider:'unknown'}]){
  assert.equal(createPhotoCalories({...base,...override}),null);
 }
 let calls=0,reservations=0;
 const success={food:true,name:'Dal and rice',portion:'One small plate',minKcal:320,maxKcal:490};
 const photoCalories=createPhotoCalories({...base,reserve:async(userId,day,cap)=>{
  reservations++;assert.equal(userId,'pilot');assert.match(day,/^\d{4}-\d{2}-\d{2}$/);assert.equal(cap,5);return true;
 },fetcher:async(url,init)=>{
  calls++;assert.equal(url,'https://api.cloudflare.com/client/v4/accounts/'+accountId+'/ai/run/@cf/meta/llama-3.2-11b-vision-instruct');
  assert.equal(init.headers.Authorization,'Bearer '+secret);assert.equal(init.redirect,'error');
  const request=JSON.parse(init.body);
  assert.equal(request.image,'data:image/jpeg;base64,'+jpg);
  assert.equal(request.messages[1].content,'Estimate the food in this photo.');
  assert.equal(request.stream,false);
  assert.equal(request.max_tokens,240);
  assert(!('store' in request));
  return Response.json({success:true,result:'Here is the estimate:\n'+String.fromCharCode(96).repeat(3)+'json\n'+JSON.stringify(success)+'\n'+String.fromCharCode(96).repeat(3)});
 }});
 const ownerCookie='a'.repeat(43),guestCookie='b'.repeat(43),unverifiedCookie='c'.repeat(43);
 const users=[{id:'pilot',email:pilotEmail,verified:true},{id:'other',email:'other@example.invalid',verified:true},{id:'pending',email:pilotEmail,verified:false}];
 let signed=0;
 const store={session:async()=>({userId:users[signed].id,email:users[signed].email}),
   userByEmail:async()=>({_id:users[signed].id,emailVerifiedAt:users[signed].verified?new Date():null})};
 const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port; server.on('request',createApp({store,origin,photoCalories}));
 t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));
 const cookie=key=>key?{'Cookie':'mealday_session='+key}:{};
 const status=async key=>(await fetch(origin+'/api/calories/status',{headers:cookie(key)})).json();
 const submit=key=>fetch(origin+'/api/calories/estimate',{method:'POST',headers:{origin,'content-type':'application/json',...cookie(key)},body:JSON.stringify({image:jpg})});
 assert.deepEqual(await status(),{configured:false,signedIn:false});
 assert.equal((await submit()).status,401);
 signed=1;
 assert.deepEqual(await status(guestCookie),{configured:false,signedIn:true});
 assert.equal((await submit(guestCookie)).status,403);
 signed=2;
 assert.equal((await submit(unverifiedCookie)).status,403);
 assert.equal(calls,0);assert.equal(reservations,0);
 signed=0;
 assert.deepEqual(await status(ownerCookie),{configured:true,signedIn:true,provider:'cloudflare'});
 const response=await submit(ownerCookie);
 assert.equal(response.status,200);const {food:_,...expected}=success;assert.deepEqual(await response.json(),expected);
 assert.equal(calls,1);assert.equal(reservations,1);
});

test('Cloudflare accepts one validated estimate from native response variants',async()=>{
 const estimate={food:true,name:'Rice',portion:'1 bowl',minKcal:300,maxKcal:450};
 const json=JSON.stringify(estimate);
 for(const result of [json,estimate,{response:estimate},{response:json},{response:'Estimate:\n'+json+'\nEstimated portions only.'}]){
  const adapter=createPhotoCalories({provider:'cloudflare',key:'test-only',accountId:'0123456789abcdef0123456789abcdef',pilotEmail:'pilot@example.invalid',limit:3,reserve:async()=>true,diagnostic:()=>assert.fail('unexpected failure'),fetcher:async()=>Response.json({success:true,result})});
  const {food:_,...expected}=estimate;
  assert.deepEqual(await adapter.estimate('pilot',jpg),expected);
 }
});

test('Cloudflare quota, bad payloads and nonfood fail safely without retry or fallback',async()=>{
 const base={provider:'cloudflare',key:'test-only',accountId:'0123456789abcdef0123456789abcdef',pilotEmail:'pilot@example.invalid',limit:5,reserve:async()=>true};
 const cases=[
  [()=>new Response(null,{status:429}),429],
  [()=>Response.json({success:false,errors:[{code:5016,message:'do not log provider payload'}]},{status:403}),503],
  [()=>{throw Error('timeout or network');},503],
  [()=>Response.json({success:true,result:{response:'Food detected, missing JSON'}}),503],
  [()=>Response.json({success:true,result:'[{"food":false}]'}),503],
  [()=>Response.json({success:true,result:'Estimate: {"food":false} or {"food":true}'}),503],
  [()=>Response.json({success:true,result:{response:{name:'Rice',minKcal:300}}}),503],
  [()=>Response.json({success:true,result:{response:'Estimate: {"food":true,"name":"Rice","portion":"1 cup","minKcal":"300 kcal","maxKcal":400}'}}),422],
  [()=>Response.json({success:false,result:{response:'{}'}}),503],
  [()=>Response.json({success:true,result:{response:'{"food":false,"name":"","portion":"","minKcal":0,"maxKcal":0}'}}),422],
  [()=>Response.json({success:true,result:{response:'{"food":true,"name":"Rice","portion":"1 cup","minKcal":400,"maxKcal":300}'}}),422],
 ];
 for(const [payload,status] of cases){
  let calls=0;const events=[];
  const adapter=createPhotoCalories({...base,diagnostic:event=>events.push(event),fetcher:async url=>{calls++;assert.match(url,/^https:\/\/api\.cloudflare\.com\//);return payload();}});
  await assert.rejects(adapter.estimate('pilot',jpg),{status});assert.equal(calls,1);
  if(status!==422){
   assert.equal(events.length,1);
   assert.deepEqual(Object.keys(events[0]),['event','provider','stage','httpStatus','code','ms',...(events[0].stage==='parse'?['outputShape']:[])]);
   if(events[0].stage==='parse')assert(['nested','direct_text','direct_object','unknown'].includes(events[0].outputShape));
   if(events[0].httpStatus===403)assert.equal(events[0].code,5016);
   assert(!JSON.stringify(events).includes('do not log provider payload'));
  }else assert.equal(events.length,0);
 }
});
