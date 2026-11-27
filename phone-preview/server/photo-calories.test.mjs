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
