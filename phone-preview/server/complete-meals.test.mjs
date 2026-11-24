import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareCompleteMeals,completeMealRoles} from '../dist/meal-completeness.js';
import {api,installLiveCatalogue} from '../dist/api.js';
import {publicSnapshot,validateSnapshot} from '../dist/catalogue-schema.js';
import {catalogueDocuments} from './recipe-catalogue.mjs';
import {liveCatalogue} from './live-catalogue.mjs';
const backup=JSON.parse(await readFile(new URL('../source/catalogue-backup.json',import.meta.url))),stock=backup.ingredients;
const simple=(cuisine)=>({id:'only-curry',name:'Vegetable curry',time:15,diet:'vegan',cuisine,mealTypes:['dinner'],appliances:['Hob'],items:[['carrot',150],['onion',30],['oil',5]],steps:['Chop the vegetables.','Simmer until tender.'],imageUrl:'/recipe-image-unavailable.svg',tags:[],reviewStatus:'preview'});
async function call(path,profile,extra={}){const u=new URL(path,'https://mealday.test');const r=await api(new Request(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile,pantry:{},seed:1,...extra})}),u);return {status:r.status,data:await r.json()};}
const profile=(cuisine)=>({city:'Dubai',shop:'LuLu',people:2,budget:200,minutes:90,cuisine,cuisines:[cuisine],diet:'Vegan',days:[0],mealTypes:['dinner'],allergies:[],appliances:['Hob'],priorities:[]});
test('Full meals use cuisine-specific staples/protein with complete quantities, steps and elapsed time',()=>{
 for(const cuisine of ['South Asian','Emirati','Arab','Turkish']){
  const original=simple(cuisine),r=prepareCompleteMeals([original],stock)[0];assert.equal(r.id,original.id);assert.equal(r.mealComplete,true);assert.equal(r.cuisine,cuisine);assert(r.time>original.time);assert(r.steps.length>original.steps.length);assert.deepEqual(completeMealRoles(r,stock),{starch:true,protein:true,vegetables:true});
  if(cuisine==='South Asian'){assert(r.componentNames.includes('Roti'));assert(r.componentNames.includes('Red lentil dal'));assert(r.items.some(([id,n])=>id==='quality-roti'&&n===2));}
  if(cuisine==='Emirati'){assert(r.componentNames.includes('Rice'));assert(r.componentNames.includes('Dango-inspired chickpeas'));assert(!r.componentNames.includes('Red lentil dal'));}
  if(cuisine==='Arab'){assert(r.componentNames.includes('Arabic pita'));assert(!r.componentNames.includes('Roti'));}
  assert.deepEqual(original,simple(cuisine),'Source is never mutated');assert.deepEqual(prepareCompleteMeals([r],stock)[0],r,'Assembly is idempotent');
 }
 const breakfast={...simple('South Asian'),mealTypes:['breakfast']};assert.deepEqual(prepareCompleteMeals([breakfast],stock)[0],breakfast);
});
test('Already complete dishes never receive duplicate rice/bread and missing definitions never invent side prices',()=>{
 const r=backup.recipes.find(r=>r.id==='arab-mujadara'),full=prepareCompleteMeals([r],stock)[0];assert.deepEqual(full.items,r.items);assert.equal(full.time,r.time);assert.equal(full.mealComplete,true);
 const partial=prepareCompleteMeals([simple('South Asian')],{carrot:stock.carrot,onion:stock.onion,oil:stock.oil})[0];assert.equal(partial.mealComplete,false);assert.deepEqual(partial.items,simple('South Asian').items);
 const edited={...full,items:[['carrot',150]],mealComplete:true,mealAssemblyVersion:2};assert.equal(prepareCompleteMeals([edited],{carrot:stock.carrot})[0].mealComplete,false,'Stale complete flags cannot bypass content checks');
});
test('Desi bread and old v1 rice/dal combinations become regional pairings while IDs and unowned recipes remain intact',()=>{
 const chana=backup.recipes.find(r=>r.id==='desi-chana'),desi=prepareCompleteMeals([chana],stock)[0];assert(!desi.items.some(([id])=>id==='pita'));assert(desi.items.some(([id,n])=>id==='quality-roti'&&n===2));assert.match(desi.name,/Roti/);
 const old=backup.recipes.find(r=>r.cuisine==='South Asian'&&r.mealAssemblyVersion===1&&r.componentNames.includes('Rice')&&!/rice|biryani|pulao|khichdi|poha/i.test(r.componentNames[0]));assert(old);assert(prepareCompleteMeals([old],stock)[0].componentNames.includes('Roti'));
 const emir=backup.recipes.find(r=>r.cuisine==='Emirati'&&r.mealTypes.some(m=>m==='lunch'||m==='dinner')&&r.items.some(([id])=>id==='pita'));assert(emir);const e=prepareCompleteMeals([emir],stock)[0];assert(e.items.some(([id])=>id==='regag'));assert(!e.items.some(([id])=>id==='pita'));
});
test('Plan, shopping quote and swap include all components while allergy/time/budget filters remain mandatory',async()=>{
 try{const raw=simple('South Asian');installLiveCatalogue({ingredients:stock,recipes:[raw]});const p=profile('South Asian');const result=await call('/api/plan',p);assert.equal(result.status,200);assert(result.data.meals[0].mealComplete);assert(result.data.meals[0].componentNames.includes('Roti'));const roti=result.data.items.find(i=>i.key==='quality-roti');assert.equal(roti.need,4);assert.equal(roti.unit,'pieces');assert(result.data.items.some(i=>i.key==='lentils'));
  assert.equal((await call('/api/quote',p,{plan:result.data.plan})).status,200);
  assert.equal((await call('/api/plan',{...p,allergies:['Gluten']})).status,422);assert.equal((await call('/api/plan',{...p,minutes:15})).status,422);assert.equal((await call('/api/plan',{...p,people:12,budget:20})).status,422);
 }finally{installLiveCatalogue(backup);}
});
test('MongoDB public catalogue and client keep complete components across refresh without rewriting source rows',async()=>{
 const r=simple('Arab'),doc={id:r.id,data:r,ingredients:stock,published:true};const before=JSON.stringify(doc);const snapshot=await liveCatalogue({publishedRecipes:async()=>[...catalogueDocuments(),doc]});const found=snapshot.recipes.find(r=>r.id===doc.id);assert.equal(found.mealComplete,true);assert(found.componentNames.includes('Arabic pita'));assert.equal(JSON.stringify(doc),before);const validated=validateSnapshot(snapshot);assert.deepEqual(validated.recipes.find(r=>r.id===doc.id).componentNames,found.componentNames);
});
