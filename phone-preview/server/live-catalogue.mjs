import {createHash} from 'node:crypto';
import {prepareCompleteMeals} from '../dist/meal-completeness.js';
import {publicSnapshot} from '../dist/catalogue-schema.js';
export async function liveCatalogue(store){
 if(!store.publishedRecipes)throw Object.assign(Error('Live catalogue unavailable.'),{status:503});
 const documents=await store.publishedRecipes();
 if(documents.length>2000)throw Object.assign(Error('Catalogue exceeds the supported size.'),{status:503});
 const {rejected,...snapshot}=publicSnapshot(documents);
 if(rejected)console.warn(`Catalogue: ${rejected} invalid published recipe(s) withheld.`);
 snapshot.recipes=prepareCompleteMeals(snapshot.recipes,snapshot.ingredients);
 const encoded=JSON.stringify(snapshot);
 if(Buffer.byteLength(encoded)>8*1024*1024)throw Object.assign(Error('Catalogue payload exceeds the supported size.'),{status:503});
 const revision=createHash('sha256').update(encoded).digest('hex');
 return {...snapshot,revision};
}
export function catalogueSummary(r){return {id:r.id,name:r.name,minutes:r.time,cuisine:r.cuisine,diet:r.diet,meals:r.mealTypes,componentNames:r.componentNames,mealComplete:r.mealComplete,photoStatus:r.photoStatus,imageUrl:r.imageUrl};}
export function catalogueDetail(r,ingredients){return {...catalogueSummary(r),items:r.items.map(([id,amount])=>({id,amount,name:ingredients[id].name,unit:ingredients[id].unit})),steps:r.steps,appliances:r.appliances,source:r.sourceUrl,sourceName:r.sourceName||r.authorship,licence:r.licence,ingredientCost:Math.round(r.items.reduce((n,[id,amount])=>n+amount/ingredients[id].pack*ingredients[id].price,0)*100)/100};}

export function matchesCatalogueTag(header,etag){
 const plain=value=>value.trim().replace(/^W\//,'');
 return typeof header==='string'&&header.split(',').some(value=>value.trim()==='*'||plain(value)===plain(etag));
}
