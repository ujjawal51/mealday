import assert from 'node:assert/strict';
import {api as baseApi} from '../dist/api.js';
import {createPersonalizedApi,preferenceSignals,preferenceScore,recencyPenalty} from '../dist/recommendations.js';
const now=Date.parse('2026-11-18T12:00:00Z');
const api=createPersonalizedApi(baseApi,()=>now);
const profile={city:'Dubai',shop:'Any supermarket',people:1,budget:250,minutes:60,cuisine:'UAE mix',cuisines:['UAE mix'],diet:'Any',days:[0,1,2],mealTypes:['dinner'],allergies:[],appliances:['Hob','Oven','Microwave','Air fryer'],priorities:[]};
async function call(handler,path,payload){const url=new URL(path,'https://mealday.test');const r=await handler(new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),url);return {status:r.status,data:await r.json()};}
const body={profile,pantry:{},seed:1};
const baseline=await call(baseApi,'/api/plan',body);
assert.equal(baseline.status,200);
const cold=await call(api,'/api/plan',body);assert.deepEqual(cold,baseline,'No feedback must preserve the original planner behaviour');
const options=await call(baseApi,'/api/swaps',{...body,plan:baseline.data.plan,index:0});
assert(options.data.choices.length);
const liked=options.data.choices.find(r=>!baseline.data.meals.some(m=>m.id===r.id)).id;
const disliked=baseline.data.meals[0].id;
let signals={ratings:[[liked,5],[disliked,1]],saved:[],previous:[],cooked:[],plans:[]};
const start=performance.now();
const personalized=await call(api,'/api/plan',{...body,signals});
assert.equal(personalized.status,200);assert.equal(personalized.data.recommendationInfo.status,'applied');
assert(personalized.data.meals.some(r=>r.id===liked),'A feasible 5-star recipe must receive preference');
assert(!personalized.data.meals.some(r=>r.id===disliked),'Avoid feasible low-rated meals when alternatives exist');
const recent={...signals,ratings:[],previous:baseline.data.meals.map(r=>r.id),cooked:baseline.data.meals.map(r=>[r.id,'2026-11-18T10:00:00Z'])};
const varied=await call(api,'/api/plan',{...body,signals:recent});
assert(varied.data.meals.filter(r=>recent.previous.includes(r.id)).length<baseline.data.meals.length,'Recent meals should rotate out when feasible');
const swaps=await call(api,'/api/swaps',{...body,signals,plan:baseline.data.plan,index:0});
assert.equal(swaps.data.choices[0].id,liked,'Swap suggestions must use ratings too');
// Re-validate complete personalized plans through the original engine.
for(const plan of [personalized.data,varied.data]){
 const quote=await call(baseApi,'/api/quote',{profile,pantry:{},plan:plan.plan});assert.equal(quote.status,200);assert.equal(quote.data.total,plan.total);assert(plan.total<=profile.budget);assert.equal(new Set(plan.meals.map(r=>r.id)).size,plan.meals.length);
}
// A high-rated fish/meat recipe cannot override vegetarian, allergy, equipment,
// cooking-time or budget constraints; every returned plan must pass the base API.
for(const constrained of [
 {...profile,diet:'Vegan',allergies:['Peanuts','Milk'],appliances:['Hob'],minutes:30,budget:150},
 {...profile,cuisines:['Arab'],cuisine:'Arab',diet:'Vegetarian',allergies:['Peanuts'],appliances:['Hob'],minutes:45,budget:100,days:[0,1]},
 {...profile,people:2,budget:35,days:[0],minutes:30,appliances:['Hob']}
]){
 const input={...body,profile:constrained,signals:{...signals,ratings:[['target-desi-mas-huni',5],[liked,5]],saved:['mealday-lamb-korma']}};
 const original=await call(baseApi,'/api/plan',input),result=await call(api,'/api/plan',input);
 assert.equal(result.status,original.status);
 if(result.status===200){const quote=await call(baseApi,'/api/quote',{profile:constrained,pantry:{},plan:result.data.plan});assert.equal(quote.status,200);assert(result.data.total<=constrained.budget);if(constrained.diet==='Vegan')assert(result.data.meals.every(r=>r.diet==='vegan'));}
}
const normalized=preferenceSignals({ratings:[['x',6],['x',-1]],cooked:[['old','2025-01-01'],['future','2027-01-01'],['unknown',null]],plans:[]},now);assert.equal(normalized.active,false);
assert.equal(preferenceSignals(null,now).active,false);
assert(preferenceScore('liked',preferenceSignals({ratings:[['liked',5]]},now))>preferenceScore('disliked',preferenceSignals({ratings:[['disliked',1]]},now)));
assert.equal(recencyPenalty('x',preferenceSignals({cooked:[['x','2025-01-01']]},now)),0);
console.log('Recommendation checks passed: ratings, recent rotation, swaps, cold start, budget and hard constraints.');
console.log('Personalized plan ids:',personalized.data.meals.map(r=>r.id));console.log('Recent-meal plan ids:',varied.data.meals.map(r=>r.id));console.log('Integration checks duration ms:',Math.round(performance.now()-start));
