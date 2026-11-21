import assert from 'node:assert/strict';
import {calculateNutrition} from '../dist/nutrition.js';
import {nutritionData} from '../dist/nutrition-data.js';
import {api} from '../dist/api.js';
const egg=calculateNutrition([{id:'egg',name:'Egg',unit:'eggs',amount:1}]);
assert.equal(egg.complete,true);assert.equal(egg.totals.kcal,71.5);assert.equal(egg.totals.protein,6.3);
const doubleEgg=calculateNutrition([{id:'egg',name:'Egg',unit:'eggs',amount:2}]);
assert.equal(doubleEgg.totals.kcal,egg.totals.kcal*2);
const dry=calculateNutrition([{id:'rice',name:'Dry rice',unit:'g',amount:100}]);
const cooked=calculateNutrition([{id:'kg-33687560eec7',name:'Cooked rice',unit:'g',amount:100}]);
assert(dry.totals.kcal>cooked.totals.kcal*2,'Raw and cooked weights must not share nutrient records');
const oil=calculateNutrition([{id:'oil',name:'Oil',unit:'ml',amount:14.78676478125}]);
assert(Math.abs(oil.totals.fat-13.5)<1e-9,'USDA tablespoon conversion');
for(const item of [{id:'absent',name:'Unknown',unit:'g',amount:20},{id:'egg',name:'Egg',unit:'ml',amount:1},{id:'egg',name:'Egg',unit:'eggs',amount:NaN},{id:'egg',name:'Egg',unit:'eggs',amount:-2}]){
 const r=calculateNutrition([item]);assert.equal(r.complete,false);assert.equal(r.totals,null);assert.equal(r.missing.length,1);
}
assert.equal(calculateNutrition([]).totals,null);
const broken=structuredClone(nutritionData);delete broken.foods[171287].per100g.protein;
assert.equal(calculateNutrition([{id:'egg',name:'Egg',unit:'eggs',amount:1}],broken).totals,null);
const mixed=calculateNutrition([{id:'egg',name:'Egg',unit:'eggs',amount:1},{id:'unverified-blend',name:'Unverified blend',unit:'g',amount:1}]);
assert.equal(mixed.totals,null,'An incomplete subtotal must never be presented as a full total');
assert.equal(mixed.references.length,1);
async function get(path){const url=new URL(path,'https://mealday.test');return (await api(new Request(url),url)).json();}
let recipes=[];for(let offset=0;;offset+=18){const page=await get('/api/recipes?offset='+offset);const rows=page.recipes||page.items||[];recipes.push(...rows);if(rows.length<18)break;}
assert.equal(recipes.length,402);
let complete=0;const totals=[];
for(const recipe of recipes){const detail=await get('/api/recipe/'+recipe.id);const n=calculateNutrition(detail.items);assert.equal(n.references.length+n.missing.length,detail.items.length);if(n.complete){complete++;assert(Object.values(n.totals).every(x=>Number.isFinite(x)&&x>=0));totals.push([recipe.name,n.totals.kcal]);}}
assert.equal(complete,360);console.log('Nutrition checks passed; '+complete+'/'+recipes.length+' complete recipe estimates.');
console.log('Calorie range:',Math.min(...totals.map(x=>x[1])).toFixed(0),Math.max(...totals.map(x=>x[1])).toFixed(0));

const portion=calculateNutrition([{id:'regag',name:'Regag',unit:'pieces',amount:2}]);assert.equal(portion.totals.kcal,294);assert.equal(portion.references[0].grams,null);assert.match(portion.references[0].url,/spinneys/);
const drink=calculateNutrition([{id:'target-oatmilk',name:'Oat drink',unit:'ml',amount:200}]);assert.equal(drink.totals.kcal,88);assert.equal(drink.totals.protein,2);assert.equal(drink.totals.carbs,14);
const riceFlakes=calculateNutrition([{id:'poha',name:'Dry rice flakes',unit:'g',amount:100}]);assert(Math.abs(riceFlakes.totals.kcal-1480/4.184)<1e-9);assert(Math.abs(riceFlakes.totals.carbs-80.21)<1e-9);
const shellfish=calculateNutrition([{id:'full-mussels',name:'Mussels in shells',unit:'g',amount:300}]);assert.equal(shellfish.references[0].grams,96);assert.equal(shellfish.totals.protein,12.1*.96);
const paneer=calculateNutrition([{id:'paneer',name:'Paneer',unit:'g',amount:100}]);assert.equal(paneer.totals.protein,20);assert.match(paneer.references[0].url,/dudhsagar/);
const damaged=structuredClone(nutritionData);delete damaged.foods['label:oatly-no-sugars'].nutrients.fat;assert.equal(calculateNutrition([{id:'target-oatmilk',name:'Oat drink',unit:'ml',amount:200}],damaged).totals,null);
const wrongUnit=structuredClone(nutritionData);wrongUnit.foods['label:oatly-no-sugars'].basis.unit='g';assert.equal(calculateNutrition([{id:'target-oatmilk',name:'Oat drink',unit:'ml',amount:200}],wrongUnit).totals,null);
const overflow=structuredClone(nutritionData);overflow.ingredients.egg.gramsPerUnit=Number.MAX_VALUE;assert.equal(calculateNutrition([{id:'egg',name:'Egg',unit:'eggs',amount:2}],overflow).totals,null);
// A published complete estimate must have all four sourced values; no ignored ingredient rows.
for(const [id,m] of Object.entries(nutritionData.ingredients))if(m.status==='mapped'){
 const r=calculateNutrition([{id,name:id,unit:m.unit,amount:1}]);assert(r.complete,id);assert.equal(r.references.length,1);assert.match(r.references[0].url,/^https:\/\//);assert(r.references[0].source.name);if(m.referenceId)assert(m.note,id);
}
const blend=nutritionData.foods['blend:bzar'];assert.equal(blend.components.reduce((s,x)=>s+x.grams,0),blend.batchGrams);
for(const key of ['kcal','protein','carbs','fat'])assert(Math.abs(blend.per100g[key]-blend.components.reduce((s,x)=>s+x.per100g[key]*x.grams/blend.batchGrams,0))<1e-9);
