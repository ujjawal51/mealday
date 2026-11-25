import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {catalogueDocuments} from './recipe-catalogue.mjs';
import {publicSnapshot,publicRecipe} from '../dist/catalogue-schema.js';
import {api,installLiveCatalogue} from '../dist/api.js';
import {prepareCompleteMeals} from '../dist/meal-completeness.js';
const backup=JSON.parse(await readFile(new URL('../source/catalogue-backup.json',import.meta.url))),manifest=JSON.parse(await readFile(new URL('../source/generated-recipe-images.json',import.meta.url)));
const profile={city:'Dubai',shop:'LuLu',people:1,budget:200,minutes:90,cuisine:'UAE mix',cuisines:['UAE mix'],diet:'Any',days:[0],mealTypes:['dinner'],allergies:[],appliances:['Hob','Oven','Microwave','Air fryer'],priorities:[]};
async function plan(p,pantry={}){const u=new URL('https://mealday.test/api/plan'),r=await api(new Request(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:p,pantry,seed:1})}),u);return {status:r.status,data:await r.json()};}
test('All 420 meals including 174 Desi recipes and 18 legacy dishes have real unique image assets',async()=>{
 const snapshot=publicSnapshot(catalogueDocuments());assert.equal(snapshot.recipes.length,420);assert.equal(snapshot.recipes.filter(r=>r.cuisine==='South Asian').length,174);assert.equal(new Set(snapshot.recipes.map(r=>r.imageUrl)).size,420);
 for(const r of snapshot.recipes){assert.equal(r.imageUrl,'/recipes/'+r.id+'.webp');const bytes=await readFile(new URL('../dist'+r.imageUrl,import.meta.url));assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');}
 assert.equal(manifest.images.length,18);for(const a of manifest.images){const bytes=await readFile(new URL('../dist'+a.path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);assert.equal(bytes.length,a.bytes);assert(a.width>=512&&a.width===a.height);}
});
test('MongoDB placeholders resolve to generated images while source records and custom photos remain intact',()=>{
 const d=catalogueDocuments().find(d=>d.id==='tomato-pasta');d.data.imageUrl='/recipe-image-unavailable.svg';d.photo.path='/recipe-image-unavailable.svg';d.photo.status='missing';const before=JSON.stringify(d),r=publicRecipe(d);assert.equal(r.data.imageUrl,'/recipes/tomato-pasta.webp');assert.equal(r.data.photoStatus,'generated');assert.equal(JSON.stringify(d),before);
 d.data.imageUrl='https://example.com/custom.webp';assert.equal(publicRecipe(d).data.imageUrl,d.data.imageUrl);d.data.imageUrl='javascript:alert(1)';assert.equal(publicRecipe(d).data.imageUrl,'/recipe-image-unavailable.svg');
});
test('Flatbread flour and potato mains do not gain duplicate staples; cold sides do not invent Hob requirements',()=>{
 const paratha=backup.recipes.find(r=>r.name.startsWith('Muttai Parotta'));assert(paratha);const r=prepareCompleteMeals([paratha],backup.ingredients)[0];assert(!r.items.some(([id])=>id==='quality-roti'));
 const dish={id:'potato-fixture',name:'Loaded microwave potato',time:15,diet:'vegetarian',cuisine:'UAE mix',mealTypes:['dinner'],appliances:['Microwave'],items:[['potato',250],['yogurt',50],['cheese',20],['tomato',60]],steps:['Cook potato in microwave.','Add topping.']};
 const full=prepareCompleteMeals([dish],backup.ingredients)[0];assert(full.mealComplete);assert(!full.items.some(([id])=>id==='rice'));assert(full.items.some(([id])=>id==='cucumber'));assert.deepEqual(full.appliances,['Microwave']);assert.equal(full.time,20);
 const repeated={...dish,items:[...dish.items,['tomato',20]]};const merged=prepareCompleteMeals([repeated],backup.ingredients)[0];assert.equal(merged.items.filter(([id])=>id==='tomato').length,1);assert.equal(merged.items.find(([id])=>id==='tomato')[1],80);
 assert.deepEqual(prepareCompleteMeals([full],backup.ingredients)[0],full);
});
test('Ingredient kind closes missing Milk Egg Fish and Shellfish tag bypasses',async()=>{
 try{for(const [key,kind,name,allergy,amount] of [['yogurt','dairy','Plain yogurt','Milk',80],['egg','egg','Eggs','Egg',2],['tuna','fish','Tuna (drained weight)','Fish',100],['test-prawns','fish','Prawns','Shellfish',100],['test-shellfish','fish','Shellfish mix','Shellfish',100]]){
  const stock={...backup.ingredients,[key]:{name,kind,unit:key==='egg'?'eggs':'g',pack:200,price:5,category:'Chilled'}},r={id:'guard',name:'Guard fixture',time:15,diet:kind==='fish'?'fish':'vegetarian',cuisine:'Arab',mealTypes:['dinner'],appliances:['Hob'],items:[[key,amount],['rice',60],['tomato',100]],steps:['Prepare ingredients.','Cook and serve.']};installLiveCatalogue({ingredients:stock,recipes:[r]});assert.equal((await plan(profile)).status,200);assert.equal((await plan({...profile,allergies:[allergy]})).status,422);
 }}finally{installLiveCatalogue(backup);}
});
test('Pantry and servings change whole-pack budgets without relaxing recipe constraints',async()=>{
 try{const r={id:'pantry-fixture',name:'Rice chickpea tomato meal',time:15,diet:'vegan',cuisine:'Arab',mealTypes:['dinner'],appliances:['Hob'],items:[['rice',60],['chickpeas',120],['tomato',100]],steps:['Cook rice.','Serve chickpeas and tomatoes.']};installLiveCatalogue({ingredients:backup.ingredients,recipes:[r]});assert.equal((await plan({...profile,budget:20})).status,422);const p={...profile,people:2,budget:20},pantry={rice:120,chickpeas:240,tomato:200},q=await plan(p,pantry);assert.equal(q.status,200);assert.equal(q.data.total,0);const rice=q.data.items.find(i=>i.key==='rice');assert.equal(rice.required,120);assert.equal(rice.need,0);assert.equal(rice.have,120);assert.equal((await plan({...p,appliances:[]},pantry)).status,422);
 }finally{installLiveCatalogue(backup);}
});
