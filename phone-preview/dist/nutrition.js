import {nutritionData} from './nutrition-data.js';
const keys=['kcal','protein','carbs','fat'];
export function calculateNutrition(items, data=nutritionData){
  const totals=Object.fromEntries(keys.map(k=>[k,0]));
  const references=[],missing=[];
  if(!Array.isArray(items)||!items.length)return {complete:false,totals:null,references,missing:[{name:'Recipe ingredients',reason:'Ingredient quantities are unavailable.'}]};
  for(const item of items){
    // No silent zeroes for absent data, unknown units, or invalid amounts.
    const match=data.ingredients[item.id],food=match&&data.foods[match.fdcId];
    const valid=match?.status==='mapped'&&match.unit===item.unit&&food&&Number.isFinite(item.amount)&&item.amount>0&&Number.isFinite(match.gramsPerUnit)&&match.gramsPerUnit>0&&keys.every(k=>Number.isFinite(food.per100g[k])&&food.per100g[k]>=0);
    if(!valid){missing.push({name:item.name,reason:match?.reason||'A verified nutrient reference and quantity conversion are needed.'});continue;}
    const grams=item.amount*match.gramsPerUnit;
    const nutrients=Object.fromEntries(keys.map(k=>[k,food.per100g[k]*grams/100]));
    for(const k of keys)totals[k]+=nutrients[k];
    references.push({name:item.name,fdcId:match.fdcId,description:food.description,grams,nutrients,note:match.note});
  }
  return {complete:missing.length===0,totals:missing.length?null:totals,references,missing};
}
export const nutritionSource=nutritionData.source;
