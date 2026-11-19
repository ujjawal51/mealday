import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {catalogueDocuments,seedRecipes} from './recipe-catalogue.mjs';
test('Full recipe import keeps quantities, steps, existing records and photo/nutrition status',async()=>{
 const documents=catalogueDocuments();assert.equal(documents.length,402);
 await Promise.all(documents.map(doc=>access(new URL('../dist'+doc.photo.path,import.meta.url))));
 assert.equal(documents.filter(doc=>doc.nutrition.complete).length,159);
 assert.ok(documents.filter(doc=>!doc.nutrition.complete).every(doc=>doc.nutrition.totals===null));
 assert.equal(new Set(documents.map(d=>d.id)).size,402);
 assert.equal(documents.filter(d=>d.nutrition.complete).length,159);
 for(const doc of documents){
  assert.ok(doc.data.steps.length);assert.ok(doc.data.items.length);
  assert.equal(doc.data.imageUrl,doc.photo.path);
  await access(new URL('../dist'+doc.photo.path,import.meta.url));
  if(!doc.nutrition.complete)assert.equal(doc.nutrition.totals,null);
 }
 // Test-only collection; production always uses MongoDB.
 const rows=new Map([[documents[0].id,{id:documents[0].id,name:'My edited recipe',privateNote:'keep'}],['personal',{id:'personal',name:'Personal recipe'}]]);
 let index;
 const collection={async createIndex(keys,options){index={keys,options};},async bulkWrite(ops,options){assert.equal(options.ordered,true);let upsertedCount=0;for(const {updateOne:op} of ops){assert.equal(op.upsert,true);assert.deepEqual(Object.keys(op.update),['$setOnInsert']);if(!rows.has(op.filter.id)){rows.set(op.filter.id,structuredClone(op.update.$setOnInsert));upsertedCount++;}}return {upsertedCount};},async countDocuments(query){return query.id.$in.filter(id=>rows.has(id)).length;}};
 const db={collection:name=>{assert.equal(name,'recipes');return collection;}};
 const first=await seedRecipes(db);assert.equal(first.inserted,401);assert.equal(first.present,402);
 assert.deepEqual(index,{keys:{id:1},options:{unique:true}});
 const before=JSON.stringify([...rows]);const second=await seedRecipes(db);
 assert.equal(second.inserted,0);assert.equal(second.existing,402);assert.equal(JSON.stringify([...rows]),before);
 assert.equal(rows.get(documents[0].id).privateNote,'keep');assert.equal(rows.size,403);
});
