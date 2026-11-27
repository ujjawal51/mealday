import assert from 'node:assert/strict';
import {test} from 'node:test';
import {catalogueDocuments} from './recipe-catalogue.mjs';
import {dinnerCoverageDocuments,installDinnerCoverage} from './dinner-coverage.mjs';
import {api,installLiveCatalogue} from '../dist/api.js';
import {liveCatalogue} from './live-catalogue.mjs';
const original=catalogueDocuments();
const originalSnapshot=await liveCatalogue({publishedRecipes:async()=>original});
const extra=dinnerCoverageDocuments(originalSnapshot.ingredients);
test('New distinct dinners fit strict Dubai family scenarios without changing cooking time or budget',async()=>{
 const snapshot=await liveCatalogue({publishedRecipes:async()=>[...original,...extra]});
 installLiveCatalogue(snapshot);
 assert.equal(extra.filter(r=>r.cuisine==='South Asian').length,12);
 assert.equal(extra.filter(r=>r.cuisine==='Turkish').length,6);
 const u=new URL('https://mealday.test/api/plan');
 const base={city:'Dubai',shop:'LuLu',people:3,budget:150,cuisine:'South Asian',cuisines:['South Asian'],diet:'Any',days:[0,1,2,3,4],mealTypes:['dinner'],allergies:[],appliances:['Hob'],priorities:['Quick','Family']};
 for(const overrides of [{minutes:15},{minutes:20},{minutes:15,diet:'Vegetarian'},{minutes:30,allergies:['Gluten']},{minutes:30,cuisine:'Turkish',cuisines:['Turkish']}]) {
  const profile={...base,...overrides};
  const r=await api(new Request(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profile,pantry:{},seed:1})}),u);const data=await r.json();
  assert.equal(r.status,200,JSON.stringify({profile,error:data.error}));
  assert.equal(data.meals.length,5);
  assert.equal(new Set(data.meals.map(m=>m.id)).size,5);assert(data.total<=150);
  assert(data.meals.every(m=>m.cuisine===profile.cuisine&&m.mealComplete&&m.minutes<=profile.minutes));
  console.log(profile.cuisine,profile.diet,profile.minutes,data.total,data.meals.map(m=>m.name));
 }
});
test('The release import is insert-only and runs once, while preserving edits and unpublishes',async()=>{
 const recipeRows=original.map(r=>structuredClone(r));
 for(const doc of recipeRows)doc._id=doc.id;
 const row=recipeRows.find(r=>r.id==='target-ar-bissara');
 const markers=new Set(),db={collection(name){if(name==='catalogue_metadata')return {findOne:async({_id})=>markers.has(_id),updateOne:async({_id})=>markers.add(_id)};
 return {createIndex:async()=>{},bulkWrite:async operations=>{for(const {updateOne:{filter,update}} of operations)if(!recipeRows.some(r=>r.id===filter.id))recipeRows.push(structuredClone(update.$setOnInsert));},findOne:async filter=>recipeRows.find(x=>x.id===filter.id&&filter['data.name'].$eq===x.data.name),updateOne:async(filter,{$set})=>{const target=recipeRows.find(x=>x._id===filter._id);target.data.name=$set['data.name'];target.name=$set.name;}};}};
 await installDinnerCoverage(db,async()=>originalSnapshot);
 assert.equal(recipeRows.length,original.length+18);assert.doesNotMatch(row.data.name,/Breakfast/);
 assert.equal(recipeRows.filter(r=>/\bBreakfast\b/i.test(r.data.name)&&r.data.mealTypes.includes('dinner')).length,0);
 const added=recipeRows.at(-1);added.published=false;added.data.name='Reviewer edit';
 await installDinnerCoverage(db,async()=>{throw Error('Must not re-read the catalogue after the import has completed');});
 assert.equal(added.published,false);assert.equal(added.data.name,'Reviewer edit');assert.equal(recipeRows.length,original.length+18);
});
