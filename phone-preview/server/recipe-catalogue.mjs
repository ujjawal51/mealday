import {legacyRecipes} from './legacy-recipes.mjs';
import {recipeCatalogue,recipeIngredients} from '../dist/api.js';
import {recipePhotos} from '../dist/recipe-photos.js';
import {calculateNutrition,nutritionSource} from '../dist/nutrition.js';
export const CATALOGUE_SOURCE='mealday-phone-preview-v1';
export function catalogueDocuments(){
  return [...recipeCatalogue.values(),...legacyRecipes].map(original=>{
    const legacy=legacyRecipes.some(r=>r.id===original.id);
    const recipe=structuredClone(original);
    if(!recipe.id||!recipe.name||!recipe.items?.length||!recipe.steps?.length)throw Error('Incomplete recipe in bundled catalogue.');
    const ingredients=Object.fromEntries(recipe.items.map(([id,amount])=>{
      const item=recipeIngredients[id];
      if(!item||!Number.isFinite(amount)||amount<=0)throw Error('Invalid ingredient in '+recipe.id);
      return [id,structuredClone(item)];
    }));
    const items=recipe.items.map(([id,amount])=>({id,name:ingredients[id].name,unit:ingredients[id].unit,amount}));
    const photoPath=recipePhotos[recipe.id]||(legacy?'/recipe-image-unavailable.svg':null);
    if(!photoPath)throw Error('Missing recipe photo mapping: '+recipe.id);
    recipe.imageUrl=photoPath;
    const nutrition=calculateNutrition(items);
    return {id:recipe.id,name:recipe.name,cuisine:recipe.cuisine,data:recipe,ingredients,published:true,
      photo:{path:photoPath,storage:'bundled-file',status:legacy?'missing':'illustrative'},
      nutrition:{...nutrition,source:nutritionSource,per:'serving',status:nutrition.complete?'ingredient-based-estimate':'incomplete'},
      importSource:legacy?'mealday-original-repository-v1':CATALOGUE_SOURCE};
  });
}
export async function seedRecipes(db){
  // Validate the complete catalogue before any writes. Existing records are never overwritten.
  const docs=catalogueDocuments();
  if(new Set(docs.map(r=>r.id)).size!==docs.length)throw Error('Duplicate recipe IDs in catalogue.');
  const collection=db.collection('recipes');
  await collection.createIndex({id:1},{unique:true});
  let inserted=0;const importedAt=new Date().toISOString();
  for(let i=0;i<docs.length;i+=100){
    const operations=docs.slice(i,i+100).map(doc=>({updateOne:{filter:{id:doc.id},update:{$setOnInsert:{...doc,importedAt,updatedAt:importedAt}},upsert:true}}));
    const result=await collection.bulkWrite(operations,{ordered:true});inserted+=result.upsertedCount;
  }
  const present=await collection.countDocuments({id:{$in:docs.map(r=>r.id)}});
  if(present!==docs.length)throw Error('Recipe import was incomplete. Run recipes:import again.');
  return {catalogue:docs.length,inserted,existing:docs.length-inserted,present};
}
