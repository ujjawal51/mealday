import {nutritionData} from './nutrition-data.js';
const keys=['kcal','protein','carbs','fat'];
const validNutrients=values=>values&&keys.every(k=>Number.isFinite(values[k])&&values[k]>=0);
export function calculateNutrition(items, data=nutritionData){
  const totals=Object.fromEntries(keys.map(k=>[k,0]));
  const references=[],missing=[];
  if(!Array.isArray(items)||!items.length)return {complete:false,totals:null,references,missing:[{name:'Recipe ingredients',reason:'Ingredient quantities are unavailable.'}]};
  for(const item of items){
    const match=data.ingredients?.[item.id],referenceId=match?.referenceId??match?.fdcId,food=data.foods?.[referenceId];
    const baseValid=match?.status==='mapped'&&match.unit===item.unit&&food&&Number.isFinite(item.amount)&&item.amount>0;
    let scale,grams=null,values;
    if(baseValid&&food.basis){
      const basis=food.basis;
      if(basis.unit===item.unit&&Number.isFinite(basis.amount)&&basis.amount>0&&Number.isFinite(match.unitsPerInput)&&match.unitsPerInput>0){scale=item.amount*match.unitsPerInput/basis.amount;values=food.nutrients;}
    }else if(baseValid&&Number.isFinite(match.gramsPerUnit)&&match.gramsPerUnit>0){
      grams=item.amount*match.gramsPerUnit;scale=grams/100;values=food.per100g;
    }
    const nutrients=validNutrients(values)&&Number.isFinite(scale)&&scale>0?Object.fromEntries(keys.map(k=>[k,values[k]*scale])):null;
    if(!validNutrients(nutrients)||!keys.every(k=>Number.isFinite(totals[k]+nutrients[k]))){missing.push({id:item.id,name:item.name,reason:match?.reason||'A verified nutrient reference and quantity conversion are needed.'});continue;}
    for(const k of keys)totals[k]+=nutrients[k];
    const fallback=match.fdcId?{name:'USDA FoodData Central SR Legacy',url:'https://fdc.nal.usda.gov/food-details/'+match.fdcId+'/nutrients',retrieved:'2026-11-18'}:null;
    const source=food.source||fallback;
    references.push({id:item.id,name:item.name,referenceId,fdcId:match.fdcId??null,description:food.description,grams,amount:item.amount,unit:item.unit,nutrients,note:match.note,matchType:match.matchType||'generic',source,url:source?.url});
  }
  return {complete:missing.length===0,totals:missing.length?null:totals,references,missing};
}
export const nutritionSource=nutritionData.source;
