import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {catalogueDocuments,seedRecipes} from './recipe-catalogue.mjs';
function fixture(initial=[]){
 const rows=new Map(initial.map(doc=>[doc.id,structuredClone(doc)]));let index;
 const collection={async createIndex(keys,options){index={keys,options};},async bulkWrite(ops,options){assert.equal(options.ordered,true);let upsertedCount=0;for(const {updateOne:op} of ops){assert.equal(op.upsert,true);assert.deepEqual(Object.keys(op.update),['$setOnInsert']);if(!rows.has(op.filter.id)){rows.set(op.filter.id,structuredClone(op.update.$setOnInsert));upsertedCount++;}}return {upsertedCount};},async countDocuments(query){return query.id.$in.filter(id=>rows.has(id)).length;}};
 return {rows,index:()=>index,db:{collection:name=>{assert.equal(name,'recipes');return collection;}}};
}
test('Full recipe import keeps quantities, steps, existing records and photo/nutrition status',async()=>{
 const documents=catalogueDocuments();assert.equal(documents.length,420);
 await Promise.all(documents.map(doc=>access(new URL('../dist'+doc.photo.path,import.meta.url))));
 assert.equal(documents.filter(doc=>doc.nutrition.complete).length,175);
 assert.ok(documents.filter(doc=>!doc.nutrition.complete).every(doc=>doc.nutrition.totals===null));
 assert.equal(new Set(documents.map(d=>d.id)).size,420);
 assert.equal(documents.filter(doc=>doc.photo.status==='missing').length,18);
 const f=fixture([{id:documents[0].id,name:'My edited recipe',privateNote:'keep'},{id:'personal',name:'Personal recipe'}]);
 const first=await seedRecipes(f.db);assert.equal(first.inserted,419);assert.equal(first.present,420);
 assert.deepEqual(f.index(),{keys:{id:1},options:{unique:true}});
 const before=JSON.stringify([...f.rows]);const second=await seedRecipes(f.db);
 assert.equal(second.inserted,0);assert.equal(second.existing,420);assert.equal(JSON.stringify([...f.rows]),before);
 assert.equal(f.rows.get(documents[0].id).privateNote,'keep');assert.equal(f.rows.size,421);
});
test('Existing 402 recipe database gains exactly 18 legacy recipes without changing original records',async()=>{
 const docs=catalogueDocuments(),existing=docs.filter(d=>d.importSource==='mealday-phone-preview-v1');
 assert.equal(existing.length,402);
 const f=fixture(existing);f.rows.get(existing[0].id).customNote='Keep this local edit';
 const originals=new Map([...f.rows].map(([id,doc])=>[id,JSON.stringify(doc)]));
 const result=await seedRecipes(f.db);
 assert.deepEqual(result,{catalogue:420,inserted:18,existing:402,present:420});
 for(const [id,before]of originals)assert.equal(JSON.stringify(f.rows.get(id)),before);
 const pasta=f.rows.get('tomato-pasta');assert.equal(pasta.data.items[0][0],'pasta');assert.equal(pasta.data.items[0][1],90);assert.ok(pasta.data.steps.length>=2);
 assert.equal(pasta.photo.status,'missing');assert.equal(pasta.photo.path,'/recipe-image-unavailable.svg');
 assert.equal((await seedRecipes(f.db)).inserted,0);
});
