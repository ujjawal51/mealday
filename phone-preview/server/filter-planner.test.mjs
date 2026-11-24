import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {api,installLiveCatalogue} from '../dist/api.js';
import {createPersonalizedApi} from '../dist/recommendations.js';
import {matchedMealStyles} from '../source/meal-styles.mjs';
import {calculateNutrition} from '../dist/nutrition.js';
const backup=JSON.parse(await readFile(new URL('../source/catalogue-backup.json',import.meta.url)));
const stock=backup.ingredients,recipes=new Map(backup.recipes.map(r=>[r.id,r]));
const base={city:'Dubai',shop:'LuLu',people:1,budget:500,minutes:1440,cuisine:'UAE mix',cuisines:['UAE mix'],diet:'Any',days:[0],mealTypes:['dinner'],allergies:[],appliances:['Hob','Oven','Microwave','Air fryer'],priorities:[]};
async function call(path,profile,extra={},handler=api){const url=new URL(path,'https://mealday.test');const response=await handler(new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile,pantry:{},seed:3,...extra})}),url);return {status:response.status,data:await response.json()};}
function styles(r,minutes){return matchedMealStyles(r,stock,calculateNutrition(r.items.map(([id,amount])=>({id,amount,name:stock[id].name,unit:stock[id].unit}))),minutes);}
function assertMatches(result,p){
 assert.equal(result.status,200,JSON.stringify({p,error:result.data.error}));const plan=result.data;
 assert.equal(plan.meals.length,p.days.length*p.mealTypes.length);assert(plan.total<=p.budget);
 const allowed={Any:['plant','dairy','egg','meat','fish'],Vegetarian:['plant','dairy','egg'],'Eggless vegetarian':['plant','dairy'],Vegan:['plant'],Pescatarian:['plant','dairy','egg','fish'],'Non-vegetarian':['plant','dairy','egg','meat','fish']}[p.diet];
 for(const m of plan.meals){const r=recipes.get(m.id);assert(p.days.includes(m.day));assert(p.mealTypes.includes(m.meal));assert(r.mealTypes.includes(m.meal));assert(m.minutes<=p.minutes);assert(r.appliances.every(a=>p.appliances.includes(a)));assert(p.cuisines.includes('UAE mix')||p.cuisines.includes(r.cuisine));
  let animal=false;
  for(const [id] of r.items){const ingredient=stock[id];assert(allowed.includes(ingredient.kind));if(['fish','meat'].includes(ingredient.kind))animal=true;assert(![ingredient.allergen,...(ingredient.allergens||[])].some(a=>p.allergies.includes(a)));}
  if(p.diet==='Non-vegetarian')assert(animal);
  if(p.priorities.length){assert(p.priorities.some(s=>styles(r,m.minutes).includes(s)));assert(m.matchedStyles.length);assert(m.matchedStyles.every(s=>p.priorities.includes(s)));}
 }
}
test('Every diet, exclusion, time, equipment, cuisine and meal selection constrains generated plans',async()=>{
 const variants=[...['Any','Vegetarian','Eggless vegetarian','Vegan','Pescatarian','Non-vegetarian'].map(diet=>({diet})),...['Gluten','Milk','Egg','Peanuts','Tree nuts','Fish','Shellfish','Sesame','Soy'].map(a=>({allergies:[a]})),...[15,30,45,60].map(minutes=>({minutes})),...['Hob','Oven','Microwave','Air fryer'].map(a=>({appliances:[a]})),...['Emirati','Arab','South Asian','Turkish'].map(c=>({cuisine:c,cuisines:[c]})),...['breakfast','lunch','dinner'].map(m=>({mealTypes:[m]})),{people:3,days:[1,4],mealTypes:['lunch','dinner'],budget:500},{diet:'Vegan',allergies:['Gluten','Milk','Egg'],minutes:30,appliances:['Hob'],cuisine:'Arab',cuisines:['Arab'],priorities:['Everyday']}];
 for(const variant of variants){const p={...base,...variant};const result=await call('/api/plan',p);if(result.status===422){assert.match(result.data.error,/No |Only |not enough|budget/i);continue;}assertMatches(result,p);}
});
test('All six styles constrain plans, quotes and swaps; ratings cannot reintroduce excluded recipes',async()=>{
 for(const style of ['Quick','Everyday','Family','Comfort','Fresh','Protein']){
  const p={...base,priorities:[style]};const result=await call('/api/plan',p);assertMatches(result,p);
  assert.equal((await call('/api/quote',p,{plan:result.data.plan})).status,200);
  const swaps=await call('/api/swaps',p,{plan:result.data.plan,index:0});assert.equal(swaps.status,200);
  for(const choice of swaps.data.choices){const applied=await call('/api/swap',p,{plan:result.data.plan,index:0,recipeId:choice.id});assertMatches(applied,p);}
  const personalized=await call('/api/plan',p,{signals:{ratings:[['arab-hummus',5],['chicken-rice',5]],saved:['arab-hummus','chicken-rice']}},createPersonalizedApi(api));assertMatches(personalized,p);
 }
 assertMatches(await call('/api/plan',{...base,priorities:['Fresh','Protein']}),{...base,priorities:['Fresh','Protein']});
 const ordinary=await call('/api/plan',base),strict={...base,minutes:15,priorities:['Protein'],diet:'Vegan',appliances:[]};
 assert.equal((await call('/api/quote',strict,{plan:ordinary.data.plan})).status,422);
 const impossible=await call('/api/plan',strict);assert.equal(impossible.status,422);assert.match(impossible.data.error,/No .*recipes match.*meal styles/);
});
test('Style rules require complete nutrition and ignore misleading source tags',()=>{
 const r={items:[['tomato',200],['rice',80]],appliances:['Hob'],tags:['Protein','Fresh','Quick']};
 const missing={complete:false,totals:null};assert(!matchedMealStyles(r,stock,missing,50).includes('Protein'));assert(!matchedMealStyles(r,stock,missing,50).includes('Fresh'));assert(!matchedMealStyles(r,stock,missing,50).includes('Quick'));
 const complete={complete:true,totals:{kcal:600,protein:25}};assert(matchedMealStyles(r,stock,complete,30).includes('Fresh'));assert(matchedMealStyles(r,stock,complete,30).includes('Protein'));
 assert(!matchedMealStyles(r,stock,{complete:true,totals:{kcal:601,protein:24.9}},30).includes('Fresh'));assert(!matchedMealStyles(r,stock,{complete:true,totals:{kcal:601,protein:24.9}},30).includes('Protein'));
});
test('Live catalogue edits invalidate style matches; caller supplied eligibility IDs cannot bypass filters',async()=>{
 const r=structuredClone(backup.recipes.find(r=>r.id==='arab-hummus'));const p={...base,mealTypes:['lunch'],priorities:['Quick']};
 try{installLiveCatalogue({ingredients:stock,recipes:[r]});assert.equal((await call('/api/plan',p)).status,200);
  r.time=120;r.timing={prepMinutes:60,cookMinutes:60,waitMinutes:0,estimated:true};
  installLiveCatalogue({ingredients:stock,recipes:[r]});assert.equal((await call('/api/plan',{...p,mealStyleRecipeIds:[r.id]})).status,422);
 }finally{installLiveCatalogue(backup);}
});
