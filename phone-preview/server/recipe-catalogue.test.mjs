import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {catalogueDocuments,seedRecipes} from './recipe-catalogue.mjs';
function fixture(initial=[]){
 const rows=new Map(initial.map(doc=>[doc.id,structuredClone(doc)]));let index;
 const collection={async createIndex(keys,options){index={keys,options};},async bulkWrite(ops,options){assert.equal(options.ordered,true);let upsertedCount=0;for(const {updateOne:op} of ops){
   if(op.upsert){assert.deepEqual(Object.keys(op.update),['$setOnInsert']);if(!rows.has(op.filter.id)){rows.set(op.filter.id,structuredClone(op.update.$setOnInsert));upsertedCount++;}}
   else {assert.deepEqual(Object.keys(op.update),['$set']);assert.deepEqual(Object.keys(op.update.$set),['nutrition']);const doc=rows.get(op.filter.id),f=op.filter;if(doc&&doc.importSource===f.importSource&&JSON.stringify(doc.data?.items)===JSON.stringify(f['data.items'].$eq)&&JSON.stringify(doc.ingredients)===JSON.stringify(f.ingredients.$eq)&&doc.nutrition?.dataVersion!==f['nutrition.dataVersion'].$ne)doc.nutrition=structuredClone(op.update.$set.nutrition);}
  }return {upsertedCount};},async countDocuments(query){return query.id.$in.filter(id=>rows.has(id)).length;}};
 return {rows,index:()=>index,db:{collection:name=>{assert.equal(name,'recipes');return collection;}}};
}
test('Full recipe import keeps quantities, steps, existing records and photo/nutrition status',async()=>{
 const documents=catalogueDocuments();assert.equal(documents.length,420);
 await Promise.all(documents.map(doc=>access(new URL('../dist'+doc.photo.path,import.meta.url))));
 assert.equal(documents.filter(doc=>doc.nutrition.complete).length,376);
 assert.ok(documents.filter(doc=>!doc.nutrition.complete).every(doc=>doc.nutrition.totals===null));
 assert.equal(new Set(documents.map(d=>d.id)).size,420);
 assert.equal(documents.filter(doc=>doc.photo.status==='missing').length,0);
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
 assert.equal(pasta.photo.status,'illustrative');assert.equal(pasta.photo.path,'/recipes/tomato-pasta.webp');
 assert.equal((await seedRecipes(f.db)).inserted,0);
});

test('Refresh derived nutrition without touching recipe content, kitchen notes, or edited ingredient quantities',async()=>{
 const docs=catalogueDocuments(),owned=structuredClone(docs[0]),edited=structuredClone(docs[1]),custom=structuredClone(docs[2]);
 owned.nutrition={complete:false,totals:null};owned.privateNote='Preserve this';
 edited.data.items[0][1]+=1;edited.nutrition={custom:true};
 custom.ingredients[custom.data.items[0][0]].name='Custom ingredient';custom.nutrition={custom:true};
 const f=fixture([owned,edited,custom]);await seedRecipes(f.db);
 assert.deepEqual(f.rows.get(owned.id).nutrition,docs[0].nutrition);assert.equal(f.rows.get(owned.id).privateNote,'Preserve this');assert.deepEqual(f.rows.get(owned.id).data,owned.data);
 assert.deepEqual(f.rows.get(edited.id).nutrition,{custom:true});assert.deepEqual(f.rows.get(custom.id).nutrition,{custom:true});
});
