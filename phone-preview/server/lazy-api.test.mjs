import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,stat} from 'node:fs/promises';
const dist=new URL('../dist/',import.meta.url);
async function fixture(){
 const scripts=[],timers=new Map();let serial=0;
 const context=vm.createContext({Promise,Error,window:{},document:{createElement:()=>({remove(){this.removed=true;}}),head:{appendChild:s=>scripts.push(s)}},setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)});
 let source=await readFile(new URL('lazy-api.js',dist),'utf8');source=source.replace(/^import[^\n]+/,'const engineUrl="/engine-test.js";').replace(/export /g,'');vm.runInContext(source,context);
 return {context,scripts,timers};
}
test('Recipe catalogue stays off the startup path and concurrent operations share one download',async()=>{
 const {context,scripts,timers}=await fixture();assert.equal(scripts.length,0);
 const first=context.personalizedApi('request','url'),second=context.personalizedApi('other','url');assert.equal(scripts.length,1);
 context.window.MealdayRecipeEngine=(req,url)=>req+':'+url;scripts[0].onload();
 assert.equal(await first,'request:url');assert.equal(await second,'other:url');assert.equal(timers.size,0);
 assert.equal(await context.personalizedApi('cached','url'),'cached:url');assert.equal(scripts.length,1);
});
test('A failed or timed out download can be retried without leaving the app stuck',async()=>{
 const {context,scripts,timers}=await fixture();const failed=context.loadRecipeEngine();scripts[0].onerror();await assert.rejects(failed,/could not load/);assert.ok(scripts[0].removed);
 const retry=context.loadRecipeEngine();assert.equal(scripts.length,2);[...timers.values()][0]();await assert.rejects(retry,/could not load/);
 const last=context.loadRecipeEngine();context.window.MealdayRecipeEngine=()=>42;scripts[2].onload();assert.equal((await last)(),42);
});
test('Shipped home entry stays below 200 KB and HTML does not eagerly load the catalogue',async()=>{
 const html=await readFile(new URL('index.html',dist),'utf8');const entry=html.match(/src="\/(client-[a-f0-9]+\.js)"/)[1];
 assert.ok((await stat(new URL(entry,dist))).size<200000);
 assert.doesNotMatch(html,/<script[^>]+src="\/engine-/);
 const code=await readFile(new URL(entry,dist),'utf8');assert.ok(!code.includes('Every slot and dish must be distinct.'),'Catalogue records must stay out of the initial script');
});

test('Deferred classic engine still serves the full recipe catalogue',async()=>{
 const url=await readFile(new URL('engine-url.js',dist),'utf8');const name=url.match(/engine-[a-f0-9]+\.js/)[0];
 const context=vm.createContext({window:{},console,URL,URLSearchParams,Request,Response,TextEncoder,TextDecoder,structuredClone});
 vm.runInContext(await readFile(new URL(name,dist),'utf8'),context);
 const address=new URL('https://mealday.test/api/health');const response=await context.window.MealdayRecipeEngine(new Request(address),address);
 const health=await response.json();assert.equal(health.recipes,402);assert.equal(health.ok,true);
});
