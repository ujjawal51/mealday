import {writeFile,readFile} from 'node:fs/promises';
import {recipeCatalogue,recipeIngredients} from '../dist/api.js';
import {calculateNutrition,nutritionSource} from '../dist/nutrition.js';
import {nutritionData} from '../dist/nutrition-data.js';
export function nutritionCoverage(){
 const missing=new Map();
 const recipes=[...recipeCatalogue.values()].map(r=>{
  const result=calculateNutrition(r.items.map(([id,amount])=>({id,amount,name:recipeIngredients[id].name,unit:recipeIngredients[id].unit})));
  for(const item of result.missing){if(!missing.has(item.id))missing.set(item.id,{id:item.id,name:item.name,unit:recipeIngredients[item.id].unit,reason:item.reason,recipes:[]});missing.get(item.id).recipes.push(r.id);}
  return {id:r.id,name:r.name,missing:result.missing.map(x=>x.name),missingIds:result.missing.map(x=>x.id),complete:result.complete,totals:result.totals,referenceAssumptions:result.references.filter(x=>x.matchType!=='generic').map(x=>({id:x.id,type:x.matchType}))};
 });
 const unresolved=[...missing.values()].sort((a,b)=>b.recipes.length-a.recipes.length||a.id.localeCompare(b.id));
 return {version:nutritionSource.version,complete:recipes.filter(r=>r.complete).length,total:recipes.length,mappedIngredients:Object.values(nutritionData.ingredients).filter(m=>m.status==='mapped').length,totalIngredients:Object.keys(nutritionData.ingredients).length,unresolved,recipes};
}
const report=nutritionCoverage(),target=new URL('../source/nutrition-coverage.json',import.meta.url);
const text=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==text)throw Error('Nutrition coverage is stale. Run node phone-preview/scripts/audit-nutrition.mjs.');}
else await writeFile(target,text);
console.log(`Nutrition audit: ${report.complete}/${report.total} complete reference estimates; ${report.unresolved.length} unresolved ingredient IDs.`);
