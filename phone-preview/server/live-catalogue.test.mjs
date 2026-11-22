import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createApp} from './app.mjs';
import {liveCatalogue} from './live-catalogue.mjs';
import {catalogueDocuments} from './recipe-catalogue.mjs';
import {publicRecipe,publicSnapshot} from '../dist/catalogue-schema.js';
import {createLiveCatalogue} from '../dist/live-recipes.js';
const documents=catalogueDocuments();
test('Public projection validates all 420 records, strips private fields and blocks unsafe data',()=>{
 assert.equal(publicSnapshot(documents).recipes.length,420);
 const bsonRows=structuredClone(documents);for(const d of bsonRows)if(d.data.timing===undefined)d.data.timing=null;
 assert.equal(publicSnapshot(bsonRows).recipes.length,420,'MongoDB BSON stores legacy undefined timings as null; total time remains valid');
 const doc=structuredClone(documents[0]);doc.privateNote='secret';doc.data.privateNote='secret';doc.ingredients[doc.data.items[0][0]].secret='hidden';
 assert(!JSON.stringify(publicSnapshot([doc])).includes('secret'));
 for(const change of [d=>d.published=false,d=>d.data.reviewStatus='draft',d=>d.data.items[0][1]=0,d=>d.data.time=NaN,d=>d.data.items.push(['unknown',2]),d=>d.ingredients[d.data.items[0][0]].pack=0]){const d=structuredClone(doc);change(d);assert.equal(publicRecipe(d),null);}
 doc.data.imageUrl='javascript:alert(1)';assert.equal(publicRecipe(doc).data.imageUrl,'/recipe-image-unavailable.svg');
});
test('Central GET API reflects inserts, edits, unpublishes and deletes without leaking private data',async()=>{
 const rows=[structuredClone(documents[0])],store={publishedRecipes:async()=>rows.filter(r=>r.published)};
 const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;server.on('request',createApp({store,origin}));
 try{
  const first=await fetch(origin+'/api/catalogue'),etag=first.headers.get('etag');assert.equal(first.status,200);assert.equal((await first.json()).recipes.length,1);
  assert.equal((await fetch(origin+'/api/catalogue',{headers:{'If-None-Match':etag}})).status,304);
  assert.equal((await fetch(origin+'/api/catalogue',{headers:{'If-None-Match':'W/'+etag}})).status,304);
  assert.equal((await fetch(origin+'/api/catalogue',{headers:{'If-None-Match':'"old", W/'+etag}})).status,304);
  rows[0].data.name='Updated title';rows[0].data.items[0][1]=81;rows[0].data.steps[0]='Updated preparation instructions.';
  const next=await fetch(origin+'/api/catalogue',{headers:{'If-None-Match':etag}});assert.equal(next.status,200);assert.notEqual(next.headers.get('etag'),etag);
  const detail=await (await fetch(origin+'/api/recipe/'+rows[0].id)).json();assert.equal(detail.name,'Updated title');assert.equal(detail.items[0].amount,81);assert.equal(detail.steps[0],'Updated preparation instructions.');
  const newDoc=structuredClone(rows[0]);newDoc.id=newDoc.data.id='new-central';newDoc.data.name='Inserted central recipe';rows.push(newDoc);
  assert.equal((await (await fetch(origin+'/api/recipes?q=Inserted')).json()).count,1);
  rows[1].published=false;assert.equal((await fetch(origin+'/api/recipe/new-central')).status,404);
  rows.splice(0,1);assert.equal((await (await fetch(origin+'/api/catalogue')).json()).recipes.length,0);
  assert.equal((await fetch(origin+'/api/catalogue',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{}'})).status,405);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('Live synchronization deduplicates, revalidates and uses the last verified snapshot offline',async()=>{
 let rows=[documents[0]],online=true,installed=[],requests=0;const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 const sync=createLiveCatalogue({install:s=>installed.push(s),storage,fetcher:async(url,options)=>{requests++;if(!online)throw Error('offline');const snapshot=await liveCatalogue({publishedRecipes:async()=>rows});return options.headers['If-None-Match']==='"'+snapshot.revision+'"'?new Response(null,{status:304}):Response.json(snapshot);}});
 await Promise.all([sync.refresh(),sync.refresh()]);assert.equal(requests,1);assert.equal(installed.length,1);assert.equal(sync.mode(),'live');
 await sync.refresh();assert.equal(installed.length,1);
 rows=[];await sync.refresh();assert.equal(installed.at(-1).recipes.length,0);
 online=false;await sync.refresh();assert.equal(sync.mode(),'cached-offline');assert.equal(installed.at(-1).recipes.length,0,'Never resurrect unpublished bundled records');
 const reload=createLiveCatalogue({install:s=>installed.push(s),storage,fetcher:async()=>{throw Error('offline');}});await reload.refresh();assert.equal(reload.mode(),'cached-offline');assert.equal(installed.at(-1).recipes.length,0);
 const cold=createLiveCatalogue({install(){throw Error('not expected');},storage:{getItem:()=>null},fetcher:async()=>{throw Error('offline');}});await cold.refresh();assert.equal(cold.mode(),'bundled-offline');
});
test('The actual shipped engine uses changed live data for recipes, planning, quotes and swaps',async()=>{
 const engine=(await readFile(new URL('../dist/engine-url.js',import.meta.url),'utf8')).match(/engine-[a-f0-9]+\.js/)[0];
 const row=structuredClone(documents.find(d=>d.id==='coverage-ar-cold-0'));row.id=row.data.id='only-central';row.data.name='Only live recipe';row.data.mealTypes=['dinner'];row.data.time=15;delete row.data.timing;
 let rows=[row];
 const context=vm.createContext({window:{},console,URL,URLSearchParams,Request,Response,TextEncoder,TextDecoder,structuredClone,AbortController,setTimeout,clearTimeout,fetch:async()=>Response.json(await liveCatalogue({publishedRecipes:async()=>rows}))});
 vm.runInContext(await readFile(new URL('../dist/'+engine,import.meta.url),'utf8'),context);
 const call=async(path,body)=>{const url=new URL(path,'https://mealday.test');return context.window.MealdayRecipeEngine(new Request(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),url);};
 assert.equal((await (await call('/api/recipes')).json()).count,1);
 const profile={people:1,budget:200,minutes:30,diet:'Vegan',cuisine:'Arab',city:'Dubai',shop:'LuLu',days:[0],mealTypes:['dinner'],appliances:['Hob'],allergies:[]};
 const plan=await (await call('/api/plan',{profile,pantry:{},seed:1})).json();assert.equal(plan.meals[0].id,'only-central');assert.equal(plan.meals[0].name,'Only live recipe');
 row.data.name='Edited live title';row.data.items[0][1]=150;
 const detail=await (await call('/api/recipe/only-central')).json();assert.equal(detail.name,'Edited live title');assert.equal(detail.items[0].amount,150);
 assert((await call('/api/quote',{profile,pantry:{},plan:plan.plan})).ok);
 const swaps=await (await call('/api/swaps',{profile,pantry:{},plan:plan.plan,index:0})).json();assert(swaps.choices.every(r=>r.id==='only-central'));
 rows=[];assert.equal((await (await call('/api/recipes')).json()).count,0);assert.equal((await call('/api/recipe/only-central')).status,404);
 assert.equal((await call('/api/quote',{profile,pantry:{},plan:plan.plan})).status,400);
});
